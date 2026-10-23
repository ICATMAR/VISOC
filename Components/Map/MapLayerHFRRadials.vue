<template>
  <!-- Draws on its own canvas over the map (RadialParticles); nothing here -->
  <span style="display: none"></span>
</template>


<script>
// The HFR dashboard's main map with Radials picked (bottom-right): each
// station's radials at the selected hour - from the EU HFR Node, or for
// ICATMAR's stations from ICATMAR's GitHub when the node has none
// (DPHFRStations.getRadials) - as RadialParticles draws them in a station's
// mini map.
// - ICATMAR: the stations of ICATMAR's network (Puertos del Estado's
//   through their HFR-DeltaEbro copies, SCAL through GitHub);
// - EU HFR Node: the stations in view, picked again after every pan.
// The bottom-right toggles switch single stations off (hfrRadialHidden).

// The hour a time belongs to on the map: 9:30 up to (not including) 10:30 is 10:00
const roundToHour = time => new Date(Math.floor((new Date(time).getTime() + 1800000) / 3600000) * 3600000);
// A station that publishes no coverage box (most polar ones) is taken to
// reach this far around its site, to tell whether it is in view
const ASSUMED_REACH_KM = 100;
// Requests at a time
const PARALLEL = 4;
// How close to a drawn bin a click has to be to pick it: at least this, up
// to one bin spacing on screen, never more than the second
const CLICK_RADIUS_PX = 8;
const MAX_CLICK_RADIUS_PX = 40;
// A radial range cell, roughly (CODAR SeaSondes at 13.5 MHz: 1.66 km)
const BIN_SPACING_M = 1700;
// Bins closer than this on screen aren't drawn as dots
const BIN_DOT_MIN_SPACING_PX = 3;

export default {
  name: "MapLayerHFRRadials",
  mounted() {
    this.$nextTick(async () => {
      this.map = this.$parent.map;
      this.particles = new window.RadialParticles(this.map, {
        colorOf: speed => this.$gui.colorFor('HCSP', speed),
        maxSpeed: this.$gui.rangeFor('HCSP')[1],
        lineWidth: 2,
      });
      this.onMoveEnd = () => {
        if (this.$gui.hfrSource === 'EU') this.update();
        else this.updateBinDots(); // the dots depend on the zoom
      };
      this.map.on('moveend', this.onMoveEnd);
      this.onMapClick = event => this.onClick(event);
      this.map.on('singleclick', this.onMapClick);
      try {
        this.networks = await this.$dataService.hfrnetwork.getAllNetworks(this.$dataService.hfrstations);
      } catch (error) {
        console.error('Error loading the HF radar networks for the radials:', error);
        this.networks = [];
      }
      this.update();
    });
  },
  beforeUnmount() {
    this.map?.un('moveend', this.onMoveEnd);
    this.map?.un('singleclick', this.onMapClick);
    this.particles?.destroy();
    if (this.dotLayer) this.map?.removeLayer(this.dotLayer);
    this.$gui.hfrRadialStations = [];
    this.$gui.hfrRadialStatus = { state: 'loading' };
  },
  methods: {
    // A click picks the nearest drawn radial bin - within one bin spacing on
    // screen, never less than CLICK_RADIUS_PX - and, in the Point view (when
    // it is the open timeline view), shows its every variable; otherwise
    // Compare opens at the bin. Nowhere near a bin, nothing.
    onClick(event) {
      if (!this.shows || event.dragging) return;
      const target = event.originalEvent?.target;
      if (target?.closest?.('.clickable, .platform-icon-container, .point-arrows-anchor')) return;
      const showFlagged = !this.$gui.hfrRadialsValidOnly;
      const radius = Math.max(CLICK_RADIUS_PX, Math.min(this.binSpacingPx(), MAX_CLICK_RADIUS_PX));
      let best;
      (this.drawnFields ?? []).forEach(field => {
        for (let i = 0; i < field.lat.length; i++) {
          if (!showFlagged && field.qc[i] !== 1) continue;
          const pixel = this.map.getPixelFromCoordinate(ol.proj.fromLonLat([field.lon[i], field.lat[i]]));
          const d = Math.hypot(pixel[0] - event.pixel[0], pixel[1] - event.pixel[1]);
          if (d <= radius && (!best || d < best.d)) best = { d, field, i };
        }
      });
      if (!best) return;
      const { field, i } = best;
      const time = new Date(this.$gui.selectedTime);
      const lon = field.lon[i], lat = field.lat[i];
      // Both forms of the place, so Compare and Point can be switched between
      const dataPoint = {
        kind: 'radial', network: field.network, station: field.station, site: field.site,
        lon, lat, axisNames: field.axisNames, a: field.ax[i], b: field.bx[i], direction: field.direction[i],
        // Its range cell (SPRC), where the station's grid is polar
        rangeCell: field.rangeCell?.[i] >= 0 ? field.rangeCell[i] : undefined,
      };
      const name = `${Math.abs(lat).toFixed(3)}º${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(3)}º${lon >= 0 ? 'E' : 'W'}`;
      const comparePoint = { lon, lat, kind: 'point', id: 'point', name, network: field.network };
      if (this.$gui.hfrMapClickOpensPoint) this.$gui.openHFRDataPoint(dataPoint, time, comparePoint);
      else this.$gui.openHFRPoint(comparePoint, time, dataPoint);
    },
    // How far apart radial bins are on screen: a range cell (~1.7 km) at the
    // map's scale here
    binSpacingPx() {
      const view = this.map.getView();
      const center = ol.proj.toLonLat(view.getCenter());
      const metresPerPixel = view.getResolution() * Math.cos(center[1] * Math.PI / 180);
      return BIN_SPACING_M / metresPerPixel;
    },
    // The animation runs while radials are shown and the particle animation
    // is on (bottom-right) - off, the canvas is cleared
    updateAnimation() {
      if (this.shows && this.$gui.hfrShowParticles) this.particles.start();
      else { this.particles.stop(); this.particles.clear(); }
    },
    // Each drawn bin as a dot (bottom-right "data points"), as the totals'
    // grid points are drawn - only while bins are BIN_DOT_MIN_SPACING_PX
    // apart on screen or more: closer, the dots would only be noise
    updateBinDots() {
      const show = this.shows && this.$gui.hfrShowGridPoints && this.binSpacingPx() >= BIN_DOT_MIN_SPACING_PX;
      if (!show) {
        this.dotLayer?.getSource().clear();
        return;
      }
      if (!this.dotLayer) {
        this.dotLayer = new ol.layer.Vector({ source: new ol.source.Vector(), zIndex: 50 });
        this.map.addLayer(this.dotLayer);
      }
      this.dotStyle ??= new ol.style.Style({
        image: new ol.style.Circle({
          radius: 1.8,
          fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.85)' }),
          stroke: new ol.style.Stroke({ color: 'rgba(0, 0, 0, 0.5)', width: 0.5 }),
        }),
      });
      const showFlagged = !this.$gui.hfrRadialsValidOnly;
      const features = [];
      (this.drawnFields ?? []).forEach(field => {
        for (let i = 0; i < field.lat.length; i++) {
          if (!showFlagged && field.qc[i] !== 1) continue;
          const feature = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat([field.lon[i], field.lat[i]])));
          feature.setStyle(this.dotStyle);
          features.push(feature);
        }
      });
      const source = this.dotLayer.getSource();
      source.clear();
      source.addFeatures(features);
    },
    keyOf(station) {
      return `${station.metadata?.network ?? ''}:${station.id}`;
    },
    // The stations the map can draw now (see the top)
    candidates() {
      const networks = this.networks ?? [];
      if (this.$gui.hfrSource !== 'EU') {
        const icatmar = networks.find(n => this.$dataService.hfrnetwork.networkCode(n) === 'HFR-ICATMAR');
        return icatmar?.stations ?? [];
      }
      const view = ol.proj.transformExtent(this.map.getView().calculateExtent(this.map.getSize()), 'EPSG:3857', 'EPSG:4326');
      return networks.flatMap(n => n.stations).filter(s => !s.notOnEUNode && this.reachesInto(s, view));
    },
    reachesInto(station, [minLon, minLat, maxLon, maxLat]) {
      const c = station.coverage;
      const dLat = ASSUMED_REACH_KM / 111;
      const dLon = dLat / Math.cos(station.latitude * Math.PI / 180);
      const box = c ? [c.minLon, c.minLat, c.maxLon, c.maxLat]
        : [station.longitude - dLon, station.latitude - dLat, station.longitude + dLon, station.latitude + dLat];
      return box[0] <= maxLon && box[2] >= minLon && box[1] <= maxLat && box[3] >= minLat;
    },
    // Loads and draws the radials of the stations switched on, at the hour.
    // Drawn as they arrive; a newer call (another hour, a pan) supersedes this.
    async update() {
      if (!this.map || !this.networks) return;
      const request = (this.request ?? 0) + 1;
      this.request = request;
      if (!this.shows) {
        this.particles.stop();
        this.particles.setFields([]);
        this.drawnFields = [];
        this.updateBinDots();
        return;
      }
      const stations = this.candidates().sort((a, b) => b.latitude - a.latitude);
      this.$gui.hfrRadialStations = stations.map(s => ({ key: this.keyOf(s), id: s.id, network: s.metadata?.network ?? '' }));
      // Off one by one, or a whole network at once ('net:<network>')
      const hidden = new Set(this.$gui.hfrRadialHidden);
      const shown = stations.filter(s => !hidden.has(this.keyOf(s)) && !hidden.has(`net:${s.metadata?.network ?? ''}`));
      const hour = roundToHour(this.$gui.selectedTime);
      this.$gui.hfrRadialStatus = { state: 'loading', time: hour, count: 0 };
      this.updateAnimation();

      const fields = [];
      const draw = () => {
        if (request !== this.request) return;
        this.particles.setFields(fields, { showFlagged: !this.$gui.hfrRadialsValidOnly });
        this.drawnFields = fields;
        this.updateBinDots();
      };
      draw(); // clears what the previous hour or view drew
      const queue = [...shown];
      const worker = async () => {
        while (queue.length && request === this.request) {
          const station = queue.shift();
          try {
            const network = station.metadata?.network ?? 'HFR-ICATMAR';
            const field = await this.$dataService.hfrstations.getRadials(network, station.id, hour);
            // Which station it is, for a click on one of its bins
            if (field) { fields.push({ ...field, station: station.id, network }); draw(); }
          } catch (error) {
            console.error(`Error loading the radials of ${station.id}:`, error);
          }
        }
      };
      await Promise.all(Array.from({ length: PARALLEL }, worker));
      if (request !== this.request) return;
      this.$gui.hfrRadialStatus = { state: fields.length ? 'ok' : 'none', time: hour, count: fields.length };
    },
  },
  computed: {
    shows() { return this.$gui.hfrProduct === 'radials'; },
    hourMs() { return roundToHour(this.$gui.selectedTime).getTime(); },
  },
  watch: {
    shows() { this.update(); },
    hourMs() { this.update(); },
    '$gui.hfrSource'() { this.update(); },
    '$gui.hfrRadialHidden'() { this.update(); },
    '$gui.hfrRadialsValidOnly'(validOnly) {
      const showFlagged = !validOnly;
      this.particles?.setFields(this.drawnFields ?? [], { showFlagged });
      this.updateBinDots();
    },
    '$gui.hfrShowParticles'() { if (this.particles) this.updateAnimation(); },
    '$gui.hfrShowGridPoints'() { if (this.map) this.updateBinDots(); },
  },
}
</script>
