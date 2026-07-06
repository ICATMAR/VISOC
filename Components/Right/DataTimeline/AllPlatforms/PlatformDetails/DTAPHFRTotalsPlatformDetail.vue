<template>
  <div class="horizontal pd-container">
    <i class="fa fa-xmark close-x pd-close-btn clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <!-- Map (left) — shows all HFR stations -->
    <div class="map-container map-clickable" @click="centerMainMap" title="Click to center main map">
      <div ref="stationMap" class="pd-map"></div>
    </div>

    <!-- Info (center) -->
    <div class="pd-info">

      <!-- Line 1: product type -->
      <div class="pd-header">
        <span>{{ $t('Sea water velocities data product') }}</span>
      </div>

      <!-- Line 2: network name -->
      <span class="pd-station-name">{{ $t('HF radar network') }}</span>

      <!-- Line 3: status -->
      <div class="pd-status">
        <div class="pd-status-dot active"></div>
        <span>{{ $t('Active') }}</span>
      </div>

      <!-- When datacell is selected: date + values -->
      <div class="pd-date-row" v-if="sp?.date">
        <span class="pd-date">{{ formattedDate }}</span>
        <span class="pd-time-toggle" @click="$gui.timelineUseLocalTime = !$gui.timelineUseLocalTime">
          {{ $gui.timelineUseLocalTime ? `Local time (${utcOffsetLabel})` : 'UTC' }}
        </span>
      </div>

      <div class="pd-values-wrapper" v-if="sp?.date">
        <div class="pd-values-scroll" ref="valuesScroll"
          :class="{ 'is-dragging': isDragging }"
          @mousedown="onScrollDragStart">
          <template v-if="sp.value">
            <div class="pd-value-item">
              <span class="pd-value-label">{{ $t('Valid points') }}</span>
              <span class="pd-value-number">{{ sp.value }}</span>
            </div>
            <div class="pd-value-item" v-if="sp.activeStations != null">
              <span class="pd-value-label">{{ $t('Valid stations') }}</span>
              <span class="pd-value-number">{{ sp.activeStations }} / {{ totalStations }}</span>
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
  </div>
</template>


<script>
export default {
  name: "DTAPHFRTotalsPlatformDetail",
  created() {
    this.map = undefined;
  },
  mounted() {
    this.initMap();
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
          center: ol.proj.fromLonLat([2.4, 42.0]),
          zoom: 7
        })
      });
      // Add a marker for each HFR station
      for (const station of this.$requests.hfrStations) {
        const el = document.createElement('div');
        el.className = 'pd-map-icon';
        const img = document.createElement('img');
        img.src = this.radarIconURL;
        el.appendChild(img);
        this.map.addOverlay(new ol.Overlay({
          element: el,
          positioning: 'center-center',
          stopEvent: false,
          position: ol.proj.fromLonLat([station.lon, station.lat]),
        }));
      }
      // Fit view to all station locations after the map renders
      this.map.once('rendercomplete', () => {
        const ext = [Infinity, Infinity, -Infinity, -Infinity];
        for (const s of this.$requests.hfrStations) {
          const [x, y] = ol.proj.fromLonLat([s.lon, s.lat]);
          if (x < ext[0]) ext[0] = x;
          if (y < ext[1]) ext[1] = y;
          if (x > ext[2]) ext[2] = x;
          if (y > ext[3]) ext[3] = y;
        }
        this.map.getView().fit(ext, { padding: [25, 25, 25, 25], maxZoom: 9 });
      });
    },
    centerMainMap() {
      const mainMap = this.$gui.olMap;
      if (!mainMap) return;
      const view = mainMap.getView();
      const ext = [Infinity, Infinity, -Infinity, -Infinity];
      for (const s of this.$requests.hfrStations) {
        const [x, y] = ol.proj.fromLonLat([s.lon, s.lat]);
        if (x < ext[0]) ext[0] = x; if (y < ext[1]) ext[1] = y;
        if (x > ext[2]) ext[2] = x; if (y > ext[3]) ext[3] = y;
      }
      // Large bottom padding pushes the network into the visible area above the UI
      view.fit(ext, { padding: [40, 60, 420, 60], maxZoom: 9, duration: 600 });
    },
    onScrollDragStart(e) {
      this.isDragging = true;
      this.dragStartX = e.pageX;
      this.dragScrollLeft = this.$refs.valuesScroll?.scrollLeft ?? 0;
      e.preventDefault();
    },
  },
  computed: {
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
    hfrDashboard() {
      return this.$gui.dashboards.find(d => d.id === 'hfr') ?? { icon: './Assets/Icons/radar.svg', name: 'HFR currents' };
    },
    totalStations() {
      return this.$requests.hfrStations.length;
    },
  },
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
