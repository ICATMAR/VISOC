<template>
  <div class="horizontal platform-detail-container" v-if="station">
    <!-- Close button -->
    <i class="fa fa-xmark close-x close-x-position clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <!-- Map (left) -->
    <div class="map-container">
      <MapCircleArrows :wind="wind" :waves="waves" :current="current" />
      <div ref="stationMap" class="map-placeholder"></div>
    </div>

    <!-- Info (right) -->
    <div class="vertical info-container">
      <span class="station-name">{{ station.name }}</span>
      <span class="station-meta">{{ $t('Buoy') }} · {{ station.lat.toFixed(2) }}° N, {{ station.lon.toFixed(2) }}° E</span>
      <span class="station-depth">{{ station.depth }} m · {{ station.owner }}</span>

      <!-- Temperature and Salinity from selected cell -->
      <div class="horizontal values-container">
        <div class="vertical value-container" v-if="sp?.TEMP != null">
          <span>{{ $t('Temperature') }}</span>
          <span class="value-number">{{ sp.TEMP.toFixed(1) }} °C</span>
        </div>
        <div class="vertical value-container" v-if="sp?.PSAL != null">
          <span>{{ $t('Salinity') }}</span>
          <span class="value-number">{{ sp.PSAL.toFixed(1) }} PSU</span>
        </div>
      </div>

      <!-- Switch to Buoys dashboard -->
      <button class="clickable switch-button" @click="$gui.selectedDashboard = 'buoys'">
        <i class="fa-solid fa-water"></i>
        <span>{{ $t('Buoys') }}</span>
      </button>
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
  methods: {
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
    },
    sp() {
      return this.$gui.selectedPlatform;
    },
    wind() {
      const p = this.sp;
      if (!p || p.WSPD == null) return null;
      return { speed: p.WSPD, dir: p.WDIR ?? 0 };
    },
    waves() {
      const p = this.sp;
      if (!p || p.VHM0 == null) return null;
      return { height: p.VHM0, dir: p.VMDR ?? 0 };
    },
    current() {
      const p = this.sp;
      if (!p || p.HCSP == null) return null;
      return { speed: p.HCSP, dir: p.HCDT ?? 0 };
    },
  },
  watch: {
    '$gui.selectedPlatform'() {
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
  justify-content: flex-start;
  align-items: flex-start;
  gap: 15px;
  height: 180px;
  overflow: hidden;
}

.map-container {
  position: relative;
  flex-shrink: 0;
}

.map-placeholder {
  width: 180px;
  height: 180px;
}

.info-container {
  gap: 4px;
  padding: 8px 0;
}

.station-name {
  font-size: medium;
  font-weight: bold;
  color: white;
  text-shadow: none;
}

.station-meta {
  font-size: x-small;
  color: white;
  opacity: 0.7;
  text-shadow: none;
}

.station-depth {
  font-size: x-small;
  color: white;
  opacity: 0.5;
  text-shadow: none;
}

.values-container {
  gap: 6px;
  margin-top: 6px;
}

.value-container {
  background: lightgreen;
  border-radius: 8px;
  padding: 4px 8px;
}

.value-container > span:first-child {
  font-size: xx-small;
  color: black;
  text-shadow: none;
  opacity: 0.7;
}

.value-number {
  font-size: small;
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

.close-x-position {
  position: absolute;
  z-index: 10;
  top: -9px;
  left: -9px;
}
</style>
