<template>
  <div class="horizontal platform-detail-container" v-if="station">
    <!-- Close button -->
    <i class="fa fa-xmark close-x close-x-position clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <!-- Map (left) -->
    <div class="map-container">
      <!-- Overlay info -->
      <div class="vertical map-info-overlay">
        <span>{{ $t('Last observation') }}</span>
        <div class="horizontal">
          <div class="icon-last-observation"></div>
          <span>Xh ago. 9:00</span>
        </div>
      </div>

      <!-- Overlay arrows -->
      <MapCircleArrows></MapCircleArrows>

      <!-- Map -->
      <div ref="stationMap" class="map-placeholder"></div>
    </div>

    <!-- Values (center) -->
    <div class="vertical info-container">
      <span class="platform-type">Buoy</span>
      <span class="station-name">{{ station.name }}</span>
      <span class="coordinates">{{ station.lat.toFixed(4) }}° N, {{ station.lon.toFixed(4) }}° E</span>
      <span class="meta">{{ station.depth }} m · {{ station.owner }}</span>

      <div class="horizontal values-container">
        <div class="vertical value-container">
          <span>{{ $t('Temperature') }}</span>
          <span>15° C</span>
        </div>
        <div class="vertical value-container">
          <span>{{ $t('Salinity') }}</span>
          <span>38 psu</span>
        </div>
      </div>
    </div>

    <!-- 3D DTO (right) -->
    <div class="dto-container">
      <img class="dto-gif" :src="mockupGifSource">
      <i class="fa-solid fa-arrow-up-right-from-square icon-open-link clickable"></i>
    </div>

  </div>
</template>


<script>
import MapCircleArrows from '../../MapCircleArrows.vue';

export default {
  name: "DTAPBuoysPlatformDetail",
  created() {
    this.map = undefined;
  },
  mounted() {
    if (!this.station) return;
    this.initMap();
  },
  data() {
    return {
      mockupGifSource: './Assets/Images/mockup/buoydto.gif',
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
      return this.$requests.getBuoyStation(this.$gui.selectedPlatform.stationId);
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
  },
  components: {
    MapCircleArrows
  }
}

</script>


<style scoped>
.platform-detail-container {
  justify-content: space-between;
  align-items: flex-start;
}

.map-container {
  position: relative;
}

.map-info-overlay {
  position: absolute;
  z-index: 1;
  top: 4px;
  right: 4px;
  font-size: x-small;
  background: #80808052;
  padding: 3px;
  border-radius: 5px;
}

.map-placeholder {
  width: 180px;
  height: 180px;
  background: lightblue;
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

.meta {
  font-size: x-small;
  color: black;
  text-shadow: none;
  opacity: 0.7;
}

.values-container {
  gap: 5px;
  margin-top: 5px;
}

.value-container {
  background: lightgreen;
  border-radius: 10px;
  padding: 10px;
}

.value-container span:first-child {
  font-size: x-small;
  color: black;
  text-shadow: none;
}

.value-container span:last-child {
  color: black;
  text-shadow: none;
}

.dto-container {
  position: relative;
}

.dto-gif {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  margin: 10px;
  box-shadow: 0 0 4px black;
}

.icon-open-link {
  position: absolute;
  top: 9px;
  right: 9px;
  width: 30px;
  height: 30px;
  background: var(--blue);
  color: white;
  box-shadow: 0 0 4px black;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.close-x-position {
  position: absolute;
  z-index: 10;
  top: -9px;
  left: -9px;
}
</style>
