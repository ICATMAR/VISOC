<template>
  <div class="horizontal pd-container" v-if="station">
    <!-- Close -->
    <i class="fa fa-xmark close-x pd-close-btn clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <!-- Map (left) -->
    <div class="map-container">
      <MapCircleArrows :wind="wind" :waves="waves" :current="current" />
      <div ref="stationMap" class="pd-map"></div>
    </div>

    <!-- Info (center) -->
    <div class="pd-info">

      <!-- Line 1: platform type · lat/lon [copy] -->
      <div class="pd-header">
        <span>{{ $t('Buoy') }}</span>
        <span>·</span>
        <span class="pd-coords">{{ station.lat.toFixed(2) }}° N, {{ station.lon.toFixed(2) }}° E</span>
        <button class="pd-copy-btn clickable" @click="copyCoords" :title="$t('Copy coordinates')">
          <i class="fa fa-copy"></i>
        </button>
      </div>

      <!-- Line 2: station name -->
      <span class="pd-station-name">{{ station.name }}</span>

      <!-- Line 2b: status + depth -->
      <div class="pd-status">
        <div class="pd-status-dot" :class="status"></div>
        <span>{{ $t(statusLabel) }}</span>
        <span>· {{ station.depth }} {{ $t('m depth') }}</span>
      </div>

      <!-- Line 3: selected date -->
      <span class="pd-date" v-if="sp?.date">{{ formattedDate }}</span>

      <!-- Line 4: all variables from selected cell -->
      <div class="pd-values-wrapper" v-if="sp?.date">
        <div class="pd-values-scroll">
          <template v-if="anyData">
            <div class="pd-value-item" v-if="sp.VHM0 != null">
              <span class="pd-value-label">{{ $t('Wave height') }}</span>
              <span class="pd-value-number">{{ sp.VHM0.toFixed(1) }} m</span>
            </div>
            <div class="pd-value-item" v-if="sp.VMDR != null">
              <span class="pd-value-label">{{ $t('Wave dir.') }}</span>
              <span class="pd-value-number">{{ sp.VMDR.toFixed(0) }}°</span>
            </div>
            <div class="pd-value-item" v-if="sp.WSPD != null">
              <span class="pd-value-label">{{ $t('Wind speed') }}</span>
              <span class="pd-value-number">{{ sp.WSPD.toFixed(0) }} km/h</span>
            </div>
            <div class="pd-value-item" v-if="sp.WDIR != null">
              <span class="pd-value-label">{{ $t('Wind dir.') }}</span>
              <span class="pd-value-number">{{ sp.WDIR.toFixed(0) }}°</span>
            </div>
            <div class="pd-value-item" v-if="sp.HCSP != null">
              <span class="pd-value-label">{{ $t('Current') }}</span>
              <span class="pd-value-number">{{ sp.HCSP.toFixed(2) }} m/s</span>
            </div>
            <div class="pd-value-item" v-if="sp.HCDT != null">
              <span class="pd-value-label">{{ $t('Current dir.') }}</span>
              <span class="pd-value-number">{{ sp.HCDT.toFixed(0) }}°</span>
            </div>
            <div class="pd-value-item" v-if="sp.TEMP != null">
              <span class="pd-value-label">{{ $t('Temperature') }}</span>
              <span class="pd-value-number">{{ sp.TEMP.toFixed(1) }} °C</span>
            </div>
            <div class="pd-value-item" v-if="sp.PSAL != null">
              <span class="pd-value-label">{{ $t('Salinity') }}</span>
              <span class="pd-value-number">{{ sp.PSAL.toFixed(1) }} PSU</span>
            </div>
          </template>
          <span class="pd-no-data" v-else>{{ $t('No data available') }}</span>
        </div>
      </div>

      <!-- Switch to Buoys dashboard -->
      <button class="pd-switch-btn clickable" @click="$gui.selectedDashboard = 'buoys'">
        <img :src="buoysDashboard.icon" class="pd-switch-btn-icon" alt="">
        <span>{{ $t('Switch to') }} {{ $t(buoysDashboard.name) }}</span>
      </button>
    </div>

    <!-- Media (right): 3D DTO gif -->
    <div class="pd-media-container">
      <img class="pd-circular-media" :src="buoyGIFURL" alt="Buoy 3D view">
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
      buoyGIFURL: './Assets/Images/mockup/buoydto.gif',
    }
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
    copyCoords() {
      const text = `${this.station.lat.toFixed(2)}, ${this.station.lon.toFixed(2)}`;
      navigator.clipboard?.writeText(text);
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
    formattedDate() {
      const date = this.sp?.date;
      if (!date) return '';
      const opts = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
      if (!this.$gui.timelineUseLocalTime) opts.timeZone = 'UTC';
      return date.toLocaleString(this.$i18n.locale, opts);
    },
    status() {
      if (!this.station) return 'inactive';
      return this.$requests.getStationStatus(this.station.id, 'buoy');
    },
    statusLabel() {
      return { active: 'Active', delayed: 'Delayed', inactive: 'Inactive' }[this.status] ?? 'Inactive';
    },
    buoysDashboard() {
      return this.$gui.dashboards.find(d => d.id === 'buoys') ?? { icon: '', name: 'Buoys' };
    },
    anyData() {
      const p = this.sp;
      return p && (p.VHM0 != null || p.WSPD != null || p.HCSP != null || p.TEMP != null);
    },
    wind() {
      const p = this.sp;
      return (p?.WSPD != null) ? { speed: p.WSPD, dir: p.WDIR ?? 0 } : null;
    },
    waves() {
      const p = this.sp;
      return (p?.VHM0 != null) ? { height: p.VHM0, dir: p.VMDR ?? 0 } : null;
    },
    current() {
      const p = this.sp;
      return (p?.HCSP != null) ? { speed: p.HCSP, dir: p.HCDT ?? 0 } : null;
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
.map-container {
  position: relative;
  flex-shrink: 0;
}
</style>
