<template>
  <!-- A zero-size anchor that OpenLayers pins to the point; the circle centres
       itself on it (MapCircleArrows is laid out around its parent's middle). -->
  <div class="point-arrows-anchor" ref="anchor">
    <MapCircleArrows v-if="isShown" :items="items" />
    <!-- While the bottom section is loading the place's data -->
    <div v-if="isLoading" class="map-click-spinner point-spinner"><span class="spinner-border"></span></div>
  </div>
</template>


<script>
import MapCircleArrows from '../Right/DataTimeline/MapCircleArrows.vue';

// HFR dashboard: the circle arrows at the place the bottom section is about.
// In Compare, at the compared place (GUIManager.hfrPoint): one chip per
// source at the selected hour, the platform's, each HF radar's and the
// model's (see DTHFRCompare). In Point, at the data point
// (GUIManager.hfrDataPoint), only the current measured there at the selected
// hour (see DTHFRPoint): a totals grid point's current, or a radial bin's
// velocity along the radial, the arrow out from the antenna or in towards it.
export default {
  name: "MapOverlayPoint",
  mounted() {
    this.$nextTick(() => {
      this.map = this.$parent.map;
      this.overlay = new ol.Overlay({ element: this.$refs.anchor, positioning: 'center-center', stopEvent: false });
      this.map.addOverlay(this.overlay);
      this.updatePosition();
    });
  },
  beforeUnmount() {
    this.map?.removeOverlay(this.overlay);
  },
  methods: {
    updatePosition() {
      const point = this.place;
      this.overlay?.setPosition(point ? ol.proj.fromLonLat([point.lon, point.lat]) : undefined);
    },
  },
  computed: {
    // The data point open in the Point view - a radial bin or a totals grid
    // point
    dataPoint() {
      const g = this.$gui;
      const point = g.hfrDataPoint;
      return g.selectedDashboard === 'hfr' && g.isDataTimelineOpen && g.hfrTab === 'Point'
        && (point?.kind === 'radial' || point?.kind === 'total') ? point : null;
    },
    place() {
      return this.dataPoint ?? this.$gui.hfrPoint;
    },
    items() {
      const p = this.dataPoint;
      if (!p) return this.$gui.hfrPointArrows;
      const velocity = this.$gui.hfrDataPointVelocity;
      if (!velocity) return [];
      // Named as Compare names the HF radar rows
      const name = p.kind === 'radial' ? `Radial ${p.station}` : p.provider === 'EU' ? 'HFR EU Node' : 'HFR ICATMAR';
      return [{ name, code: 'HCSP', speed: velocity.speed, direction: velocity.direction }];
    },
    isShown() {
      return this.dataPoint ? this.items.length > 0 : this.$gui.isHFRPointCircleShown;
    },
    // The bottom section still loading the place's data (Compare's rows, the
    // Point view's series)
    isLoading() {
      const g = this.$gui;
      return g.selectedDashboard === 'hfr' && g.isDataTimelineOpen && this.place != null && g.hfrPointLoading;
    },
  },
  watch: {
    place() { this.updatePosition(); },
  },
  components: { MapCircleArrows },
}
</script>


<style scoped>
.point-arrows-anchor {
  position: relative;
  width: 0;
  height: 0;
}

/* Centred on the place, over the circle's centre (styles/mapOverlays.css) */
.point-spinner {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate(-50%, -50%);
}

/* The circle must not block dragging the map; only the units stay clickable */
.point-arrows-anchor :deep(.map-arrows-circle) {
  pointer-events: none;
}
.point-arrows-anchor :deep(.chipUnit) {
  pointer-events: auto;
}
</style>
