<template>
  <!-- Draws on its own canvas over the map (RadialParticles); nothing here -->
  <span style="display: none"></span>
</template>


<script>
// The HFR dashboard's main map with Radials picked (bottom-right): each
// station's radials at the selected hour, from the EU HFR Node, as
// RadialParticles draws them in a station's mini map.
// - ICATMAR: the stations of ICATMAR's network (Puertos del Estado's
//   through their HFR-DeltaEbro copies; SCAL has none on the node);
// - EU HFR Node: the stations in view, picked again after every pan.
// The bottom-right toggles switch single stations off (hfrRadialHidden).

// The hour a time belongs to on the map: 9:30 up to (not including) 10:30 is 10:00
const roundToHour = time => new Date(Math.floor((new Date(time).getTime() + 1800000) / 3600000) * 3600000);
// A station that publishes no coverage box (most polar ones) is taken to
// reach this far around its site, to tell whether it is in view
const ASSUMED_REACH_KM = 100;
// Requests at a time
const PARALLEL = 4;

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
      this.onMoveEnd = () => { if (this.$gui.hfrSource === 'EU') this.update(); };
      this.map.on('moveend', this.onMoveEnd);
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
    this.particles?.destroy();
    this.$gui.hfrRadialStations = [];
    this.$gui.hfrRadialStatus = { state: 'loading' };
  },
  methods: {
    keyOf(station) {
      return `${station.metadata?.network ?? ''}:${station.id}`;
    },
    // The stations the map can draw now (see the top)
    candidates() {
      const networks = this.networks ?? [];
      if (this.$gui.hfrSource !== 'EU') {
        const icatmar = networks.find(n => this.$dataService.hfrnetwork.networkCode(n) === 'HFR-ICATMAR');
        return (icatmar?.stations ?? []).filter(s => s.id !== 'SCAL');
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
        return;
      }
      const stations = this.candidates().sort((a, b) => b.latitude - a.latitude);
      this.$gui.hfrRadialStations = stations.map(s => ({ key: this.keyOf(s), id: s.id }));
      const hidden = new Set(this.$gui.hfrRadialHidden);
      const shown = stations.filter(s => !hidden.has(this.keyOf(s)));
      const hour = roundToHour(this.$gui.selectedTime);
      this.$gui.hfrRadialStatus = { state: 'loading', time: hour, count: 0 };
      this.particles.start();

      const fields = [];
      const draw = () => {
        if (request !== this.request) return;
        this.particles.setFields(fields, { showFlagged: !this.$gui.hfrRadialsValidOnly });
        this.drawnFields = fields;
      };
      draw(); // clears what the previous hour or view drew
      const queue = [...shown];
      const worker = async () => {
        while (queue.length && request === this.request) {
          const station = queue.shift();
          try {
            const field = await this.$dataService.hfrstations.getRadials(station.metadata?.network ?? 'HFR-ICATMAR', station.id, hour);
            if (field) { fields.push(field); draw(); }
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
    },
  },
}
</script>
