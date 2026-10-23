<template>
  <!-- Draws on the map (an OpenLayers layer); nothing here -->
  <span style="display: none"></span>
</template>


<script>
// The data point the HFR Point view is about (GUIManager.hfrDataPoint) - a
// totals grid point or a radial bin - ringed on the main map while that view
// is open, so it can be told apart from the points around it. A totals grid
// point with a current measured at the selected hour isn't: its circle arrows
// mark it instead (MapOverlayPoint).
export default {
  name: "MapLayerHFRSelection",
  mounted() {
    this.$nextTick(() => {
      this.map = this.$parent.map;
      this.source = new ol.source.Vector();
      this.layer = new ol.layer.Vector({
        source: this.source,
        zIndex: 60, // over the grid points and radial dots
        style: [
          new ol.style.Style({ image: new ol.style.Circle({ radius: 8, stroke: new ol.style.Stroke({ color: 'rgba(0, 0, 0, 0.6)', width: 4 }) }) }),
          new ol.style.Style({ image: new ol.style.Circle({ radius: 8, stroke: new ol.style.Stroke({ color: '#ff6b6b', width: 2 }) }) }),
          new ol.style.Style({ image: new ol.style.Circle({ radius: 2.5, fill: new ol.style.Fill({ color: 'white' }) }) }),
        ],
      });
      this.map.addLayer(this.layer);
      this.update();
    });
  },
  beforeUnmount() {
    if (this.layer) this.map?.removeLayer(this.layer);
  },
  methods: {
    update() {
      if (!this.source) return;
      this.source.clear();
      const p = this.selected;
      if (p) this.source.addFeature(new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat([p.lon, p.lat]))));
    },
  },
  computed: {
    // While the Point view shows it
    selected() {
      const shown = this.$gui.hfrTab === 'Point' && this.$gui.selectedPlatform?.kind === 'datapoint';
      const point = shown ? this.$gui.hfrDataPoint : null;
      if (point?.kind === 'total' && this.$gui.hfrDataPointVelocity) return null;
      return point;
    },
  },
  watch: {
    selected() { this.update(); },
  },
}
</script>
