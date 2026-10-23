<template>
  <!-- A zero-size anchor that OpenLayers pins to the point; the circle centres
       itself on it (MapCircleArrows is laid out around its parent's middle). -->
  <div class="point-arrows-anchor" ref="anchor">
    <MapCircleArrows v-if="isShown" :items="items" />
  </div>
</template>


<script>
import MapCircleArrows from '../Right/DataTimeline/MapCircleArrows.vue';

// HFR dashboard: the circle arrows at the place the bottom section is about.
// In Compare, at the compared place (GUIManager.hfrPoint): one chip per
// source at the selected hour, the platform's, each HF radar's and the
// model's (see DTHFRCompare). In Point, at a radial data point
// (GUIManager.hfrDataPoint): its sea water velocity along the radial at the
// selected hour, the arrow out from the antenna or in towards it (see
// DTHFRPoint).
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
    // A radial data point open in the Point view
    radialPoint() {
      const g = this.$gui;
      const point = g.hfrDataPoint;
      return g.selectedDashboard === 'hfr' && g.isDataTimelineOpen && g.hfrTab === 'Point' && point?.kind === 'radial' ? point : null;
    },
    place() {
      return this.radialPoint ?? this.$gui.hfrPoint;
    },
    items() {
      if (!this.radialPoint) return this.$gui.hfrPointArrows;
      const velocity = this.$gui.hfrDataPointValues.find(item => item.speed != undefined);
      return velocity ? [{ name: `Radial ${this.radialPoint.station}`, code: 'HCSP', speed: velocity.speed, direction: velocity.direction }] : [];
    },
    isShown() {
      return this.radialPoint ? this.items.length > 0 : this.$gui.isHFRPointCircleShown;
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

/* The circle must not block dragging the map; only the units stay clickable */
.point-arrows-anchor :deep(.map-arrows-circle) {
  pointer-events: none;
}
.point-arrows-anchor :deep(.chipUnit) {
  pointer-events: auto;
}
</style>
