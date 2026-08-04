<template>
  <div class="horizontal pd-container" v-if="station">
    <i class="fa fa-xmark close-x pd-close-btn clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <!-- Map (left) -->
    <div class="map-container map-clickable" @click="centerMainMap" title="Click to center main map">
      <div ref="stationMap" class="pd-map"></div>
    </div>

    <!-- Info (center) -->
    <div class="pd-info">

      <!-- Line 1: type · lat/lon [copy] -->
      <div class="pd-header">
        <span>{{ $t('HFR station') }}</span>
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
        <span class="pd-last-update">· {{ lastUpdateText }}</span>
      </div>

      <!-- Line 3: date + local/UTC toggle -->
      <div class="pd-date-row" v-if="sp?.date">
        <span class="pd-date">{{ formattedDate }}</span>
        <span class="pd-time-toggle" @click="$gui.timelineUseLocalTime = !$gui.timelineUseLocalTime">
          {{ $gui.timelineUseLocalTime ? `Local time (${utcOffsetLabel})` : 'UTC' }}
        </span>
      </div>

      <!-- Line 4: values (drag to scroll) -->
      <div class="pd-values-wrapper" v-if="sp?.date">
        <div class="pd-values-scroll" ref="valuesScroll"
          :class="{ 'is-dragging': isDragging }"
          @mousedown="onScrollDragStart">
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
        <span class="pd-switch-btn-label">{{ $t('Switch to dashboard') }}</span>
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
        <span style="font-size:0.7rem; color:rgba(255,255,255,0.4)">{{ station.id }}</span>
      </div>
    </div>
  </div>
</template>


<script>
export default {
  name: "DTAPHFRPlatformDetail",
  created() {
    this.map = undefined;
    this.markerOverlay = undefined;
  },
  mounted() {
    if (!this.station) return;
    this.initMap();
    const iconEl = document.createElement('div');
    iconEl.className = 'pd-map-icon';
    const markerImg = document.createElement('img');
    markerImg.src = this.radarIconURL;
    iconEl.appendChild(markerImg);
    this.markerOverlay = new ol.Overlay({
      element: iconEl,
      positioning: 'center-center',
      stopEvent: false,
      position: ol.proj.fromLonLat([this.station.lon, this.station.lat]),
    });
    this.map.addOverlay(this.markerOverlay);
    this._onDocMouseMove = (e) => {
      if (!this.isDragging) return;
      if (this.$refs.valuesScroll)
        this.$refs.valuesScroll.scrollLeft = this.dragScrollLeft - (e.pageX - this.dragStartX);
    };
    this._onDocMouseUp = () => { this.isDragging = false; };
    document.addEventListener('mousemove', this._onDocMouseMove);
    document.addEventListener('mouseup', this._onDocMouseUp);
  },
  beforeUnmount() {
    document.removeEventListener('mousemove', this._onDocMouseMove);
    document.removeEventListener('mouseup', this._onDocMouseUp);
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
        ],
        view: new ol.View({
          center: ol.proj.fromLonLat([this.station.lon, this.station.lat]),
          zoom: 11
        })
      });
    },
    centerMainMap() {
      const mainMap = this.$gui.olMap;
      if (!mainMap || !this.station) return;
      const view = mainMap.getView();
      const coords = ol.proj.fromLonLat([this.station.lon, this.station.lat]);
      const targetZoom = view.getZoom() < 7 ? 11 : view.getZoom();
      const mapSize = mainMap.getSize(); // [width, height]
      const bottomCovered = 380; // data timeline + platform detail
      const visibleHeight = mapSize[1] - bottomCovered;
      const targetY = Math.max(50, visibleHeight * 0.66); // 35% from top of visible area
      // Shift center so coords appear at targetY instead of canvas center
      const resolution = view.getResolutionForZoom(targetZoom);
      const centerY = coords[1] + (targetY - mapSize[1] / 2) * resolution;
      view.animate({ center: [coords[0], centerY], zoom: targetZoom, duration: 600 });
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
    formatTimeAgo(hours) {
      if (hours == null) return '';
      if (hours < 1) return 'Less than 1h ago';
      if (hours < 2) return '1h ago';
      if (hours < 24) return Math.floor(hours) + 'h ago';
      const days = Math.floor(hours / 24);
      if (days === 1) return '1 day ago';
      if (days <= 7) return days + ' days ago';
      return 'More than 7 days ago';
    },
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
    utcOffsetLabel() {
      const offsetMins = -new Date().getTimezoneOffset();
      const sign = offsetMins >= 0 ? '+' : '-';
      const h = Math.floor(Math.abs(offsetMins) / 60);
      const m = Math.abs(offsetMins) % 60;
      return m ? `UTC${sign}${h}:${String(m).padStart(2, '0')}` : `UTC${sign}${h}`;
    },
    status() {
      return this.station ? this.$requests.getStationStatus(this.station.id, 'hfr') : 'inactive';
    },
    statusLabel() {
      return { active: 'Active', delayed: 'Delayed', inactive: 'Inactive' }[this.status] ?? 'Inactive';
    },
    lastUpdateText() {
      if (!this.station) return '';
      return this.formatTimeAgo(this.$requests.getLastUpdateHoursAgo(this.station.id, 'hfr'));
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
      this.markerOverlay?.setPosition(coords);
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

.map-clickable {
  cursor: pointer;
}
</style>
