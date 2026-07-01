<template>
  <div class="horizontal pd-container" v-if="station">
    <i class="fa fa-xmark close-x pd-close-btn clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <!-- Map (left) -->
    <div class="map-container">
      <div ref="stationMap" class="pd-map"></div>
    </div>

    <!-- Info (center) -->
    <div class="pd-info">

      <!-- Line 1: type · lat/lon [copy] -->
      <div class="pd-header">
        <span>{{ $t('High-frequency radar station') }}</span>
        <span>·</span>
        <span class="pd-coords">{{ station.lat.toFixed(4) }}° N, {{ station.lon.toFixed(4) }}° E</span>
        <button class="pd-copy-btn clickable" @click="copyCoords" :title="$t('Copy coordinates')">
          <i class="fa fa-copy"></i>
        </button>
      </div>

      <!-- Line 2: name + status -->
      <span class="pd-station-name">{{ station.name }}</span>
      <div class="pd-status">
        <div class="pd-status-dot" :class="status"></div>
        <span>{{ $t(statusLabel) }}</span>
      </div>

      <!-- Line 3: selected date -->
      <span class="pd-date" v-if="sp?.date">{{ formattedDate }}</span>

      <!-- Line 4: values (drag to scroll) -->
      <div class="pd-values-wrapper" v-if="sp?.date">
        <div class="pd-values-scroll" ref="valuesScroll"
          :class="{ 'is-dragging': isDragging }"
          @mousedown="onScrollDragStart"
          @mousemove="onScrollDragMove"
          @mouseup="onScrollDragEnd"
          @mouseleave="onScrollDragEnd">
          <template v-if="sp.value">
            <div class="pd-value-item">
              <span class="pd-value-label">{{ $t('Valid points') }}</span>
              <span class="pd-value-number">{{ sp.value }}</span>
            </div>
          </template>
          <span class="pd-no-data" v-else>{{ $t('No data available') }}</span>
        </div>
      </div>

      <!-- Switch to HFR currents dashboard -->
      <button class="pd-switch-btn clickable" @click="$gui.selectedDashboard = 'hfr'">
        <div class="pd-switch-btn-circle">
          <img :src="hfrDashboard.icon" class="pd-switch-btn-icon" alt="">
        </div>
        <span class="pd-switch-btn-label">
          {{ $t('Switch to') }} {{ $t(hfrDashboard.name) }} {{ $t('dashboard') }}
        </span>
      </button>
    </div>

    <!-- Media (right): HFR station photo -->
    <div class="pd-media-container">
      <img v-if="!imgError"
        class="pd-circular-media"
        :src="`./Assets/Images/platforms/HFR/${station.id}.jpg`"
        :alt="station.name"
        @error="imgError = true">
      <div v-else class="pd-circular-fallback">
        <img :src="radarIconURL" style="width:45%; opacity:0.35; filter:invert(1)" alt="">
        <span style="font-size:x-small; color:rgba(255,255,255,0.4)">{{ station.id }}</span>
      </div>
    </div>
  </div>
</template>


<script>
export default {
  name: "DTAPHFRPlatformDetail",
  created() {
    this.map = undefined;
    this.markerFeature = undefined;
  },
  mounted() {
    if (!this.station) return;
    this.initMap();
  },
  data() {
    return {
      radarIconURL: './Assets/Icons/radar.svg',
      imgError: false,
      isDragging: false,
      dragStartX: 0,
      dragScrollLeft: 0,
    }
  },
  methods: {
    initMap() {
      this.markerFeature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([this.station.lon, this.station.lat]))
      });
      this.markerFeature.setStyle(new ol.style.Style({
        image: new ol.style.Icon({
          src: this.radarIconURL,
          width: 24,
          height: 24,
          crossOrigin: 'anonymous',
        })
      }));
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
          }),
          new ol.layer.Vector({
            source: new ol.source.Vector({ features: [this.markerFeature] })
          })
        ],
        view: new ol.View({
          center: ol.proj.fromLonLat([this.station.lon, this.station.lat]),
          zoom: 11
        })
      });
    },
    copyCoords() {
      const text = `${this.station.lat.toFixed(4)}, ${this.station.lon.toFixed(4)}`;
      navigator.clipboard?.writeText(text);
    },
    onScrollDragStart(e) {
      this.isDragging = true;
      this.dragStartX = e.pageX;
      this.dragScrollLeft = this.$refs.valuesScroll?.scrollLeft ?? 0;
      e.preventDefault();
    },
    onScrollDragMove(e) {
      if (!this.isDragging) return;
      if (this.$refs.valuesScroll)
        this.$refs.valuesScroll.scrollLeft = this.dragScrollLeft - (e.pageX - this.dragStartX);
    },
    onScrollDragEnd() { this.isDragging = false; },
  },
  computed: {
    station() {
      if (!this.$gui.selectedPlatform?.stationId) return null;
      return this.$requests.getHFRStation(this.$gui.selectedPlatform.stationId);
    },
    sp() { return this.$gui.selectedPlatform; },
    formattedDate() {
      const date = this.sp?.date;
      if (!date) return '';
      const opts = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
      if (!this.$gui.timelineUseLocalTime) opts.timeZone = 'UTC';
      return date.toLocaleString(this.$i18n.locale, opts);
    },
    status() {
      return this.station ? this.$requests.getStationStatus(this.station.id, 'hfr') : 'inactive';
    },
    statusLabel() {
      return { active: 'Active', delayed: 'Delayed', inactive: 'Inactive' }[this.status] ?? 'Inactive';
    },
    hfrDashboard() {
      return this.$gui.dashboards.find(d => d.id === 'hfr') ?? { icon: '', name: 'HFR currents' };
    },
  },
  watch: {
    '$gui.selectedPlatform'() {
      if (!this.map || !this.station) return;
      this.imgError = false;
      const coords = ol.proj.fromLonLat([this.station.lon, this.station.lat]);
      this.markerFeature?.getGeometry().setCoordinates(coords);
      this.map.getView().animate({ center: coords, duration: 300 });
    }
  }
}
</script>


<style scoped>
.map-container {
  position: relative;
  flex-shrink: 0;
}
</style>
