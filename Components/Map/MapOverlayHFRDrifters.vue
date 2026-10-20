<template>
  <!-- Drifters on the HFR dashboard: each one's measured current at the
       selected hour, where it was at that hour, to set against the radar's.
       Hidden for a drifter with no reading in that hour. -->
  <div class="overlay-container">
    <!-- v-show, not v-if: OpenLayers holds on to each element -->
    <div v-for="drifter in drifters" :key="drifter.id" :ref="'drifter-' + drifter.id" v-show="readings[drifter.id]">
      <CurrentChip v-if="readings[drifter.id]" :speed="readings[drifter.id].speed"
        :direction="readings[drifter.id].direction" :label="drifter.id" :time="readings[drifter.id].time"></CurrentChip>
    </div>
  </div>
</template>


<script>
import CurrentChip from './CurrentChip.vue';

// The hour a time belongs to: 9:30 up to (not including) 10:30 is 10:00
const HALF_HOUR_MS = 30 * 60 * 1000;
const roundToHour = time => new Date(Math.floor((time.getTime() + HALF_HOUR_MS) / 3600000) * 3600000);

// Drifters are still mock data (RequestsManager / DriftersMockData), the same
// the drifters dashboard draws.
export default {
  name: "MapOverlayHFRDrifters",
  mounted() {
    this.$nextTick(() => {
      this.map = this.$parent.map;
      this.overlays = {};
      this.drifters.forEach(drifter => {
        const overlay = new ol.Overlay({
          element: this.$refs['drifter-' + drifter.id]?.[0],
          positioning: 'center-center',
          stopEvent: false,
        });
        this.map.addOverlay(overlay);
        this.overlays[drifter.id] = overlay;
      });
      this.update();
    });
  },
  beforeUnmount() {
    Object.values(this.overlays ?? {}).forEach(overlay => this.map?.removeOverlay(overlay));
  },
  data() {
    return {
      drifters: this.$requests.drifterStations,
      readings: {}, // drifter id -> { speed, direction, time, lon, lat }
    }
  },
  methods: {
    // Each drifter's reading closest to the selected hour, within it
    update() {
      const hour = roundToHour(new Date(this.$gui.selectedTime));
      const readings = {};
      this.drifters.forEach(drifter => {
        let best;
        this.$requests.getDrifterTrajectory(drifter.id).forEach(point => {
          const time = new Date(point.t);
          if (point.cspd == null || time < hour.getTime() - HALF_HOUR_MS || time >= hour.getTime() + HALF_HOUR_MS) return;
          if (!best || Math.abs(time - hour) < Math.abs(best.time - hour))
            best = { speed: point.cspd, direction: point.cdir, time, lon: point.lon, lat: point.lat };
        });
        if (best) readings[drifter.id] = best;
        this.overlays?.[drifter.id]?.setPosition(best ? ol.proj.fromLonLat([best.lon, best.lat]) : undefined);
      });
      this.readings = readings;
    },
  },
  watch: {
    '$gui.selectedTime'(time, previous) {
      if (roundToHour(new Date(time)).getTime() !== roundToHour(new Date(previous)).getTime()) this.update();
    },
  },
  components: { CurrentChip },
}
</script>
