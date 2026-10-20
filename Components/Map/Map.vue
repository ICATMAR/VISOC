<template>

  <!-- OL map -->
  <div id="map" ref="OLMap" v-on:drop="onDropFile($event)" v-on:dragover="onDragOver($event)"></div>

  <!-- OVERLAYS -->
  <!-- <MapOverlayMockup></MapOverlayMockup> -->
  <MapOverlayHFRStations></MapOverlayHFRStations>
  <MapOverlayBuoys></MapOverlayBuoys>
  <!-- <MapOverlayDrifters></MapOverlayDrifters> -->
  <!-- HF radar currents, on the HFR dashboard only -->
  <MapLayerHFRCurrents v-if="$gui.selectedDashboard === 'hfr'"></MapLayerHFRCurrents>
  <MapOverlayHFRDrifters v-if="$gui.selectedDashboard === 'hfr' && $gui.hfrShowDrifters"></MapOverlayHFRDrifters>
  <!-- Short screens: the selected buoy's circle arrows -->
  <MapOverlayPlatformArrows></MapOverlayPlatformArrows>
</template>


<script>

import MapOverlayHFRStations from './MapOverlayHFRStations.vue';
import MapOverlayMockup from './MapOverlayMockup.vue';
import MapOverlayBuoys from './MapOverlayBuoys.vue';
import MapOverlayDrifters from './MapOverlayDrifters.vue';
import MapOverlayPlatformArrows from './MapOverlayPlatformArrows.vue';
import MapLayerHFRCurrents from './MapLayerHFRCurrents.vue';
import MapOverlayHFRDrifters from './MapOverlayHFRDrifters.vue';

export default {
  name: "Map",
  created() {
    this.map = undefined;
  },
  mounted() {
    this.map = new ol.Map({
      target: this.$refs.OLMap,
      layers: [
        new ol.layer.Tile({
          source: new ol.source.XYZ({ // https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/0
            url: 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png',
            attributions: '© Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
            cacheSize: 500,
            crossOrigin: 'anonymous',
          }),
        })
      ],
      view: new ol.View({
        center: ol.proj.fromLonLat([2.5, 41.5]),
        zoom: 8
      })
    });
    // markRaw: GUIManager is reactive, and without it every read of olMap
    // would hand back the map wrapped in a Vue proxy. OpenLayers compares
    // layers and overlays by identity, so through a proxy removeLayer() finds
    // nothing to remove (and every call pays for the proxy).
    this.$gui.olMap = Vue.markRaw(this.map);
  },
  methods: {
    onDragOver(e) {
      e.preventDefault();
    },
    onDropFile(e) {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.$map.handleDroppedFiles(files);
      }
    }
  },
  components: {
    MapOverlayMockup,
    MapOverlayHFRStations,
    MapOverlayBuoys,
    MapOverlayDrifters,
    MapOverlayPlatformArrows,
    MapLayerHFRCurrents,
    MapOverlayHFRDrifters,
  }
}

</script>


<style scoped>

#map {
  width: 100%;
  height: 100%;
  z-index: 0;
  background-color: var(--darkBlue);
}

</style>