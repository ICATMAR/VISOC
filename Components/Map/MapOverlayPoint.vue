<template>
  <!-- A zero-size anchor that OpenLayers pins to the point; the circle centres
       itself on it (MapCircleArrows is laid out around its parent's middle). -->
  <div class="point-arrows-anchor" ref="anchor">
    <MapCircleArrows v-if="isShown" :items="$gui.hfrPointArrows" />
  </div>
</template>


<script>
import MapCircleArrows from '../Right/DataTimeline/MapCircleArrows.vue';

// HFR dashboard: the circle arrows at the place the bottom section compares
// (GUIManager.hfrPoint) - one chip per source at the selected hour, the
// platform's, each HF radar's and the model's (see DTHFRCompare).
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
      const point = this.$gui.hfrPoint;
      this.overlay?.setPosition(point ? ol.proj.fromLonLat([point.lon, point.lat]) : undefined);
    },
  },
  computed: {
    isShown() {
      return this.$gui.isHFRPointCircleShown;
    },
  },
  watch: {
    '$gui.hfrPoint'() { this.updatePosition(); },
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
