<template>
  <!-- A zero-size anchor that OpenLayers pins to the buoy; the circle centres
       itself on it (MapCircleArrows is laid out around its parent's middle). -->
  <div class="platform-arrows-anchor" ref="anchor">
    <MapCircleArrows v-if="isShown" :wind="arrows.wind" :waves="arrows.waves" :current="arrows.current" />
  </div>
</template>


<script>
import MapCircleArrows from '../Right/DataTimeline/MapCircleArrows.vue';

// On short screens the platform detail has no mini map (see
// GUIManager.SHORT_SCREEN_MAX_HEIGHT), so the selected buoy's circle arrows -
// wind, waves and current at the selected cell - are drawn on the main map,
// around the buoy itself.
export default {
  name: "MapOverlayPlatformArrows",
  mounted() {
    this.$nextTick(() => {
      this.map = this.$parent.map;
      this.overlay = new ol.Overlay({
        element: this.$refs.anchor,
        positioning: 'center-center',
        stopEvent: false,
      });
      this.map.addOverlay(this.overlay);
      this.updatePosition();
    });
  },
  beforeUnmount() {
    this.map?.removeOverlay(this.overlay);
  },
  methods: {
    updatePosition() {
      const buoy = this.buoy;
      this.overlay?.setPosition(buoy ? ol.proj.fromLonLat([buoy.longitude, buoy.latitude]) : undefined);
    },
  },
  computed: {
    // The selected buoy, wherever buoys are being looked at (their own
    // dashboard, or All platforms on the buoys view)
    buoy() {
      const id = this.$gui.selectedPlatform?.stationId;
      if (!id || !this.$gui.isPlatformSelected('buoys', id)) return null;
      return this.$dataService.buoys.getBuoys().find(b => b.id === id) ?? null;
    },
    arrows() {
      return window.buoyCircleArrows(this.$gui.selectedPlatform);
    },
    isShown() {
      const { wind, waves, current } = this.arrows;
      return this.$gui.isShortScreen && this.$gui.isDataTimelineOpen && this.$gui.isPlatformDetailOpen
        && this.buoy != null && (wind || waves || current) != null;
    },
  },
  watch: {
    buoy() { this.updatePosition(); },
  },
  components: { MapCircleArrows },
}
</script>


<style scoped>
.platform-arrows-anchor {
  position: relative;
  width: 0;
  height: 0;
}

/* The circle must not block dragging the map; only the units stay clickable */
.platform-arrows-anchor :deep(.map-arrows-circle) {
  pointer-events: none;
}
.platform-arrows-anchor :deep(.chipUnit) {
  pointer-events: auto;
}
</style>
