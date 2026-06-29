<template>
  <div class="horizontal platform-detail-container" v-if="station">
    <!-- Close button -->
    <i class="fa fa-xmark close-x close-x-position clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <!-- Map (left) -->
    <div class="map-container">
      <div ref="stationMap" class="map-placeholder"></div>
    </div>

    <!-- Info (right) -->
    <div class="vertical info-container">
      <span class="platform-type">High-frequency radar station</span>
      <span class="station-name">{{ station.name }}</span>
      <span class="coordinates">{{ station.lat.toFixed(4) }}° N, {{ station.lon.toFixed(4) }}° E</span>

      <!-- Number of valid points -->
      <div class="vertical value-container" v-if="$gui.selectedPlatform?.value != undefined">
        <span>Number of points</span>
        <span class="value-number">{{ $gui.selectedPlatform.value }}</span>
      </div>

      <!-- Switch to HFR currents dashboard -->
      <button class="clickable switch-button" @click="$gui.selectedDashboard = 'hfr'">
        <img :src="hfrIconSrc" class="button-icon">
        <span>HFR currents</span>
      </button>
    </div>
  </div>
</template>


<script>

export default {
  name: "DTAPHFRPlatformDetail",
  created() {
    this.map = undefined;
  },
  mounted() {
    if (!this.station) return;
    this.initMap();
  },
  data() {
    return {
      hfrIconSrc: './Assets/Icons/radar.svg',
    }
  },
  methods: {
    //onclick: function(e){},
    initMap() {
      this.map = new ol.Map({
        target: this.$refs.stationMap,
        controls: [],
        interactions: [],
        layers: [
          new ol.layer.Tile({
            source: new ol.source.XYZ({
              url: 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png',
              attributions: '© Esri',
              cacheSize: 500,
              crossOrigin: 'anonymous',
            }),
          })
        ],
        view: new ol.View({
          center: ol.proj.fromLonLat([this.station.lon, this.station.lat]),
          zoom: 11
        })
      });
    },
  },
  computed: {
    station() {
      if (!this.$gui.selectedPlatform?.stationId) return null;
      return this.$requests.getHFRStation(this.$gui.selectedPlatform.stationId);
    }
  },
  watch: {
    '$gui.selectedPlatform'(newPlatform) {
      if (!this.map || !this.station) return;
      this.map.getView().animate({
        center: ol.proj.fromLonLat([this.station.lon, this.station.lat]),
        duration: 300
      });
    }
  }
}

</script>


<style scoped>
.platform-detail-container {
  justify-content: flex-start;
  align-items: flex-start;
  gap: 15px;
}

.map-placeholder {
  width: 180px;
  height: 180px;
}

.info-container {
  gap: 5px;
  padding: 10px 0;
}

.platform-type {
  font-size: x-small;
  opacity: 0.6;
}

.station-name {
  font-size: medium;
  font-weight: bold;
  color: black;
  text-shadow: none;
}

.coordinates {
  font-size: x-small;
  color: black;
  text-shadow: none;
}

.value-container {
  background: lightgreen;
  border-radius: 10px;
  padding: 8px 12px;
  margin-top: 5px;
}

.value-container > span:first-child {
  font-size: x-small;
  color: black;
  text-shadow: none;
}

.value-number {
  font-size: medium;
  font-weight: bold;
  color: black;
  text-shadow: none;
}

.switch-button {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 6px 12px;
  background: var(--blue);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: x-small;
}

.switch-button > span {
  color: white;
  text-shadow: none;
}

.button-icon {
  width: 16px;
  height: 16px;
  filter: brightness(0) invert(1);
}

.close-x-position {
  position: absolute;
  z-index: 10;
  top: -9px;
  left: -9px;
}

</style>
