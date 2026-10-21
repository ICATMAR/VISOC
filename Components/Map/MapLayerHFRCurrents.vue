<template>
  <!-- Map layers only, nothing in the DOM of its own -->
  <span style="display: none"></span>
</template>


<script>
// The HF radar currents on the main map, for the HFR dashboard: moving
// particles (lib/ol-wind) and/or the totals' grid points, for the hour the
// time handle is on (GUIManager.selectedTime) and the provider picked in the
// bottom-right panel (GUIManager.hfrSource). Mounted only while the HFR
// dashboard is showing (see Map.vue), and takes its layers with it.

// Particle look
const PARTICLE_MAX_AGE = 120;   // frames a particle lives - with the speed below, its trail length
const ALPHA_OVERLAP = 0.98; // The persistance of trail (lower - disappears faster), at REFERENCE_ZOOM and further out
const PARTICLE_SPACING = 6;   // px between particles, on average, where there is data
const TRAIL_WIDTH = 4;
// How fast a particle crosses the screen at REFERENCE_ZOOM: px per frame for
// 1 m/s. The speed is constant on the MAP (see velocityScale), so zooming in
// a level doubles it on the screen.
const PX_PER_FRAME_PER_MS = 0.6;
const REFERENCE_ZOOM = 8;
// How much shorter the trails get per zoom level in, so the faster particles
// don't leave long streaks (see fadeAlpha)
const FADE_PER_ZOOM = 0.05;
// Grid points: a network whose points would be closer than this on screen is
// shown as one circle with its count instead
const MIN_POINT_SPACING_PX = 4;

const DEG = Math.PI / 180;

// The hour a time belongs to: 9:30 up to (not including) 10:30 is 10:00
const roundToHour = time => new Date(Math.floor((time.getTime() + 1800 * 1000) / 3600000) * 3600000);

export default {
  name: "MapLayerHFRCurrents",
  mounted() {
    this.$nextTick(() => {
      this.map = this.$parent.map;
      this.onMoveEnd = () => {
        // On the EU HFR Node, which networks are fetched depends on the view
        if (this.$gui.hfrSource === 'EU') { this.loadField(); this.loadAvailability(); }
        else { this.updateParticleCount(); this.updateGridPoints(); }
      };
      this.map.on('moveend', this.onMoveEnd);
      // What is under the cursor, for the bottom-right panel - at most once a
      // frame, however fast the pointer moves
      this.onPointerMove = event => {
        if (event.dragging) return;
        this.cursorPixel = event.pixel;
        this.cursorFrame ??= requestAnimationFrame(() => {
          this.cursorFrame = null;
          this.updateCursor(this.cursorPixel);
        });
      };
      this.onPointerLeave = () => { this.$gui.hfrCursor = null; };
      this.map.on('pointermove', this.onPointerMove);
      this.map.getViewport().addEventListener('mouseleave', this.onPointerLeave);
      this.goToLatest();
      this.loadAvailability();
    });
  },
  beforeUnmount() {
    this.map?.un('moveend', this.onMoveEnd);
    this.map?.un('pointermove', this.onPointerMove);
    this.map?.getViewport().removeEventListener('mouseleave', this.onPointerLeave);
    if (this.cursorFrame) cancelAnimationFrame(this.cursorFrame);
    this.$gui.hfrCursor = null;
    this.removeParticles();
    if (this.pointLayer) this.map?.removeLayer(this.pointLayer);
    this.$gui.hfrFieldStatus = { state: 'loading' };
    this.$gui.hfrAvailability = [];
  },
  methods: {
    // The view as [minLon, minLat, maxLon, maxLat]
    viewBbox() {
      const extent = this.map.getView().calculateExtent(this.map.getSize());
      return ol.proj.transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
    },
    // The hour the time handle is on - the maps are hourly, and an hour takes
    // in the maps from half an hour either side of it
    selectedHour() {
      return roundToHour(new Date(this.$gui.selectedTime));
    },
    // Puts the time handle on the hour of the newest map, so the dashboard
    // opens on data rather than on "now", which maps reach an hour or two late
    async goToLatest() {
      let latest;
      try {
        latest = await this.$dataService.hfrtotals.getLatestTime(this.$gui.hfrSource, this.viewBbox());
      } catch (error) {
        console.error('Could not find the latest HF radar map:', error);
      }
      if (latest) this.$gui.selectedTime = roundToHour(latest);
      this.loadField();
    },
    // Which hours have maps, per network in view, over the timeline's range
    async loadAvailability() {
      const source = this.$gui.hfrSource;
      const request = (this.availabilityRequest ?? 0) + 1;
      this.availabilityRequest = request;
      // From the start of the UTC day the timeline starts in, so the request
      // stays the same all day and is cached
      const days = this.$gui.dashboards.find(d => d.id === 'hfr')?.latestDaysRange ?? 4;
      const start = new Date(Date.now() - days * 86400 * 1000);
      start.setUTCHours(0, 0, 0, 0);
      let rows = [];
      try {
        rows = await this.$dataService.hfrtotals.getAvailability(source, this.viewBbox(), start);
      } catch (error) {
        console.error('Could not load the HF radar availability:', error);
      }
      if (request !== this.availabilityRequest) return;
      this.$gui.hfrAvailability = rows.filter(row => Object.keys(row.hours).length > 0);
    },
    async loadField() {
      if (!this.map) return;
      const time = this.selectedHour();
      const source = this.$gui.hfrSource;
      const request = (this.request ?? 0) + 1;
      this.request = request;
      this.$gui.hfrFieldStatus = { state: 'loading', time };
      // Only the selected hour's map, never another hour's in its place
      let field = null;
      try {
        field = await this.$dataService.hfrtotals.getField(time, source, this.viewBbox());
      } catch (error) {
        console.error('Could not load the HF radar currents:', error);
      }
      // A newer request (the handle moved on) wins
      if (request !== this.request) return;
      this.field = field;
      this.$gui.hfrFieldStatus = field
        ? { state: 'ok', time: field.time, label: field.isFallback ? `${field.label} (${this.$t('from')} ${field.source})` : field.label }
        : { state: 'none', time };
      this.updateParticles();
      this.updateGridPoints();
      this.preloadNeighbours(time, source);
    },
    // The hours either side, so stepping the handle is instant
    preloadNeighbours(time, source) {
      const bbox = this.viewBbox();
      [-1, 1].forEach(step => {
        const neighbour = new Date(time.getTime() + step * 3600 * 1000);
        this.$dataService.hfrtotals.getField(neighbour, source, bbox).catch(() => {});
      });
    },

    // PARTICLES
    updateParticles() {
      if (!this.field || !this.$gui.hfrShowParticles || !this.showsCurrents) { this.removeParticles(); return; }
      const data = this.field.toWindData();
      if (!this.particleLayer) {
        this.particleLayer = this.quietly(() => new OlWind.WindLayer(data, {
          forceRender: false,
          zIndex: 5,
          windOptions: {
            velocityScale: () => this.velocityScale(),
            maxAge: PARTICLE_MAX_AGE,
            paths: this.particleCount(),
            lineWidth: TRAIL_WIDTH,
            globalAlpha: ALPHA_OVERLAP,
            fadeAlpha: () => this.fadeAlpha(),
            frameRate: 16,
            // Clear the trails' faint leftovers about once a second (see the
            // VISOC patches in lib/ol-wind)
            residueEvery: 60,
            residueAlpha: () => this.residueAlpha(),
            colorScale: speed => this.$gui.colorFor('HCSP', speed) ?? '#fff',
          },
          fieldOptions: { wrapX: false, flipY: true },
        }));
        this.correctForLatitude();
        this.map.addLayer(this.particleLayer);
      } else {
        this.quietly(() => this.particleLayer.setData(data, { wrapX: false, flipY: true }));
        this.correctForLatitude();
        this.updateParticleCount();
      }
    },
    removeParticles() {
      if (!this.particleLayer) return;
      // Through the map, not the layer: that is what stops its animation loop
      // (see the markRaw note in Map.vue)
      this.map?.removeLayer(this.particleLayer);
      this.particleLayer = undefined;
    },
    // The particle layer steps in DEGREES (x += u * scale, y += v * scale),
    // but a degree of longitude is only cos(latitude) of a degree of latitude
    // on the ground - uncorrected, an eastward current would be drawn slower
    // than a northward one of the same speed (by a quarter at 41.5ºN), and a
    // diagonal one turned towards the meridian. So the eastward step is
    // divided by cos(latitude) where it is read, and the speed the colour
    // comes from is left as measured.
    correctForLatitude() {
      const field = this.particleLayer?.getData();
      if (!field || field.__latitudeCorrected) return;
      const valueAt = field.interpolatedValueAt.bind(field);
      field.interpolatedValueAt = (lon, lat) => {
        const vector = valueAt(lon, lat);
        if (!vector) return vector;
        return { u: vector.u / Math.cos(lat * DEG), v: vector.v, m: vector.m };
      };
      field.__latitudeCorrected = true;
    },
    // Degrees per frame for 1 m/s: constant on the MAP, as in the old
    // AnimationEngine (whose particles stepped a fixed distance in lon/lat per
    // frame) - so a particle crosses the same stretch of sea in the same time
    // at any zoom, and zooming in a level doubles its speed on the screen.
    // Calibrated to cross PX_PER_FRAME_PER_MS screen pixels at REFERENCE_ZOOM:
    // a pixel spans 360 / (256 * 2^zoom) degrees of longitude, and only
    // cos(latitude) of that in latitude; with the correction above both
    // directions take the latitude's length, hence the cos() (at the view's
    // centre - the field is a few degrees tall at most).
    velocityScale() {
      const view = this.map?.getView();
      const latitude = view ? ol.proj.toLonLat(view.getCenter())[1] : 41.5;
      return PX_PER_FRAME_PER_MS * 360 / (256 * 2 ** REFERENCE_ZOOM) * Math.cos(latitude * DEG);
    },
    // How much of the trails survives each frame: ALPHA_OVERLAP at
    // REFERENCE_ZOOM and further out, FADE_PER_ZOOM less per zoom level in -
    // the old AnimationEngine's adaptive trail length (0.98 - 0.05 per level
    // past 8.5), so particles that move faster on screen leave trails of
    // about the same length.
    fadeAlpha() {
      const zoom = this.map?.getView().getZoom() ?? REFERENCE_ZOOM;
      return Math.min(ALPHA_OVERLAP, ALPHA_OVERLAP - FADE_PER_ZOOM * (zoom - REFERENCE_ZOOM - 0.5));
    },
    // The faintest alpha the fade still takes down: below 0.5 / (1 - fade) a
    // pixel rounds back to itself every frame (8-bit alpha) and would stay
    // forever, so the residue cleanup clears everything under it
    residueAlpha() {
      return Math.ceil(0.5 / (1 - this.fadeAlpha())) + 1;
    },
    // Particles are only spawned where there is data (see the VISOC patches
    // in lib/ol-wind), so the count follows the screen area the radars cover:
    // an even density there, however much of the screen that is.
    particleCount() {
      const size = this.map.getSize();
      const coveredPx = Math.min(size[0] * size[1], this.coveredPixels());
      const count = coveredPx / (PARTICLE_SPACING * PARTICLE_SPACING);
      return Math.round(Math.min(8000, Math.max(200, count)));
    },
    // Screen area of the cells with data that are in view
    coveredPixels() {
      const field = this.field;
      if (!field) return 0;
      const [minLon, minLat, maxLon, maxLat] = this.viewBbox();
      const pxPerDegree = 256 * 2 ** this.map.getView().getZoom() / 360;
      let px = 0;
      for (let row = 0; row < field.ny; row++) {
        const lat = field.latMax - row * field.dLat;
        if (lat < minLat || lat > maxLat) continue;
        const cellPx = field.dLon * pxPerDegree * field.dLat * pxPerDegree / Math.cos(lat * DEG);
        for (let col = 0; col < field.nx; col++) {
          const lon = field.lonMin + col * field.dLon;
          if (lon < minLon || lon > maxLon) continue;
          if (!Number.isNaN(field.u[row * field.nx + col])) px += cellPx;
        }
      }
      return px;
    },
    updateParticleCount() {
      if (!this.particleLayer) return;
      const paths = this.particleCount();
      if (Math.abs(paths - (this.particleLayer.getWindOptions().paths ?? 0)) / paths < 0.2) return;
      this.particleLayer.setWindOptions({ paths });
    },
    // ol-wind warns on every new field that its rows run north to south and
    // that its column count is rounded - both expected here (see
    // VectorField.toWindData)
    quietly(fn) {
      const warn = console.warn;
      console.warn = (...args) => { if (!String(args[0]).startsWith('[wind-core]')) warn(...args); };
      try { return fn(); } finally { console.warn = warn; }
    },

    // The current under a screen pixel, from the map on screen - read on each
    // network's own grid (field.parts), where the measurements are, rather
    // than the merged one the animation runs on
    updateCursor(pixel) {
      if (!this.showsCurrents) { this.$gui.hfrCursor = null; return; }
      const [lon, lat] = ol.proj.toLonLat(this.map.getCoordinateFromPixel(pixel));
      const parts = this.field?.parts ?? (this.field ? [this.field] : []);
      let value = null, network;
      for (const part of parts) {
        value = part.sample(lon, lat);
        if (value) { network = part.label; break; }
      }
      this.$gui.hfrCursor = {
        lon, lat, network,
        speed: value ? Math.hypot(value.u, value.v) : undefined,
        // where the water goes, clockwise from north
        direction: value ? (Math.atan2(value.u, value.v) / DEG + 360) % 360 : undefined,
      };
    },

    // GRID POINTS
    // Where the measurements are: every point of each network's totals grid
    // that has data at this hour, as a dot - on that network's own grid, not
    // the merged one the animation runs on. Each dot carries its values
    // (network, position, u, v, time) for whatever a click on it shows later.
    //
    // Never thinned: once a network's points are closer than
    // MIN_POINT_SPACING_PX on screen, the whole network is drawn as one circle
    // with its number of points instead, at their centre.
    updateGridPoints() {
      const parts = this.field?.parts ?? (this.field ? [this.field] : []);
      if (parts.length === 0 || !this.$gui.hfrShowGridPoints || !this.showsCurrents) {
        if (this.pointLayer) { this.map.removeLayer(this.pointLayer); this.pointLayer = undefined; }
        return;
      }
      if (!this.pointLayer) {
        this.pointLayer = new ol.layer.Vector({ source: new ol.source.Vector(), zIndex: 6 });
        this.map.addLayer(this.pointLayer);
      }
      const pxPerDegree = 256 * 2 ** this.map.getView().getZoom() / 360;
      const [minLon, minLat, maxLon, maxLat] = this.viewBbox();
      const features = [];
      parts.forEach(field => {
        const spacingPx = Math.min(field.dLon, field.dLat) * pxPerDegree;
        if (spacingPx < MIN_POINT_SPACING_PX) { features.push(this.networkCircle(field)); return; }
        for (let row = 0; row < field.ny; row++) {
          const lat = field.latMax - row * field.dLat;
          if (lat < minLat || lat > maxLat) continue;
          for (let col = 0; col < field.nx; col++) {
            const lon = field.lonMin + col * field.dLon;
            if (lon < minLon || lon > maxLon) continue;
            const i = row * field.nx + col;
            if (Number.isNaN(field.u[i])) continue;
            const feature = new ol.Feature({
              geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])),
              kind: 'gridPoint', network: field.label, longitude: lon, latitude: lat,
              u: field.u[i], v: field.v[i], time: field.time,
            });
            feature.setStyle(this.pointStyle());
            features.push(feature);
          }
        }
      });
      const source = this.pointLayer.getSource();
      source.clear();
      source.addFeatures(features);
    },
    // One network's points, zoomed out: a circle at their centre saying how
    // many there are
    networkCircle(field) {
      let count = 0, sumLon = 0, sumLat = 0;
      for (let row = 0; row < field.ny; row++)
        for (let col = 0; col < field.nx; col++) {
          if (Number.isNaN(field.u[row * field.nx + col])) continue;
          count++;
          sumLon += field.lonMin + col * field.dLon;
          sumLat += field.latMax - row * field.dLat;
        }
      const feature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([sumLon / count, sumLat / count])),
        kind: 'network', network: field.label, count, time: field.time,
      });
      feature.setStyle(new ol.style.Style({
        image: new ol.style.Circle({
          radius: 24,
          fill: new ol.style.Fill({ color: 'rgba(15, 48, 98, 0.75)' }),
          stroke: new ol.style.Stroke({ color: 'rgba(255, 255, 255, 0.9)', width: 1.5 }),
        }),
        text: new ol.style.Text({
          text: `${count}\n${this.$t('points')}`,
          font: '600 10px Poppins, sans-serif',
          fill: new ol.style.Fill({ color: 'white' }),
        }),
      }));
      return feature;
    },
    pointStyle() {
      this.gridPointStyle ??= new ol.style.Style({
        image: new ol.style.Circle({
          radius: 2,
          fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.85)' }),
          stroke: new ol.style.Stroke({ color: 'rgba(0, 0, 0, 0.5)', width: 0.5 }),
        }),
      });
      return this.gridPointStyle;
    },
  },
  computed: {
    showsCurrents() { return this.$gui.hfrProduct === 'currents'; },
  },
  watch: {
    // The maps are hourly: only a change of hour fetches anything
    '$gui.selectedTime'(time, previous) {
      if (roundToHour(new Date(time)).getTime() === roundToHour(new Date(previous)).getTime()) return;
      this.loadField();
    },
    '$gui.hfrSource'() { this.loadField(); this.loadAvailability(); },
    '$gui.hfrShowParticles'() { this.updateParticles(); },
    '$gui.hfrShowGridPoints'() { this.updateGridPoints(); },
    // Radials on the map instead (MapLayerHFRRadials): nothing drawn here,
    // though the maps keep loading - the timeline marks the hours that have one
    showsCurrents() { this.updateParticles(); this.updateGridPoints(); this.$gui.hfrCursor = null; },
  },
}
</script>
