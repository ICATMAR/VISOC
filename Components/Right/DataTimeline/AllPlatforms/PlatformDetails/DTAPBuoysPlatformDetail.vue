<template>
  <div class="horizontal pd-container" v-if="station">
    <i class="fa fa-xmark close-x pd-close-btn clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <!-- Map (left) -->
    <div class="map-container map-clickable" @click="centerMainMap" title="Click to center main map">
      <MapCircleArrows :wind="wind" :waves="waves" :current="current" />
      <div ref="stationMap" class="pd-map"></div>
    </div>

    <!-- Info (center) -->
    <div class="pd-info">

      <!-- Line 1: type · depth · lat/lon [copy] -->
      <div class="pd-header">
        <span>{{ $t('Buoy') }} · {{ station.depth }} {{ $t('m depth') }}</span>
        <span>·</span>
        <span class="pd-coords">{{ station.lat.toFixed(2) }}° N, {{ station.lon.toFixed(2) }}° E</span>
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

      <!-- Line 3: date + local/UTC toggle -->
      <div class="pd-date-row" v-if="sp?.date">
        <span class="pd-date">{{ formattedDate }}</span>
        <span class="pd-time-toggle" @click="$gui.timelineUseLocalTime = !$gui.timelineUseLocalTime">
          {{ $gui.timelineUseLocalTime ? `Local time (${utcOffsetLabel})` : 'UTC' }}
        </span>
      </div>

      <!-- Line 4: values (drag to scroll; direction shown as rotated arrow) -->
      <div class="pd-values-wrapper" v-if="sp?.date">
        <div class="pd-values-scroll" ref="valuesScroll"
          :class="{ 'is-dragging': isDragging }"
          @mousedown="onScrollDragStart">
          <template v-if="anyData">
            <!-- Wave height + direction arrow (FROM direction: rotate dir+135) -->
            <div class="pd-value-item" v-if="sp.VHM0 != null">
              <span class="pd-value-label">{{ $t('Wave height') }}</span>
              <span class="pd-value-number">
                {{ sp.VHM0.toFixed(1) }} m
                <i v-if="sp.VMDR != null" class="fa fa-location-arrow" :title="`${sp.VMDR.toFixed(0)}º`" :style="arrowStyle(sp.VMDR, true)"></i>
              </span>
            </div>
            <!-- Wind speed + direction arrow (FROM direction: rotate dir+135) -->
            <div class="pd-value-item" v-if="sp.WSPD != null">
              <span class="pd-value-label">{{ $t('Wind speed') }}</span>
              <span class="pd-value-number">
                {{ sp.WSPD.toFixed(0) }} km/h
                <i v-if="sp.WDIR != null" class="fa fa-location-arrow" :title="`${sp.WDIR.toFixed(0)}º`" :style="arrowStyle(sp.WDIR, true)"></i>
              </span>
            </div>
            <!-- Current speed + direction arrow (TO direction: rotate dir-45) -->
            <div class="pd-value-item" v-if="sp.HCSP != null">
              <span class="pd-value-label">{{ $t('Current') }}</span>
              <span class="pd-value-number">
                {{ sp.HCSP.toFixed(2) }} m/s
                <i v-if="sp.HCDT != null" class="fa fa-location-arrow" :title="`${sp.HCDT.toFixed(0)}º`" :style="arrowStyle(sp.HCDT, false)"></i>
              </span>
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
        <div class="pd-switch-btn-circle">
          <img :src="buoysDashboard.icon" class="pd-switch-btn-icon" alt="">
        </div>
        <span class="pd-switch-btn-label">{{ $t('Switch to dashboard') }}</span>
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
    this.markerOverlay = undefined;
  },
  mounted() {
    if (!this.station) return;
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
      buoyGIFURL: './Assets/Images/mockup/buoydto.gif',
      buoyIconURL: './Assets/Icons/buoy.svg',
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
          zoom: 9
        })
      });
    },
    centerMainMap() {
      const mainMap = this.$gui.olMap;
      if (!mainMap || !this.station) return;
      const view = mainMap.getView();
      const coords = ol.proj.fromLonLat([this.station.lon, this.station.lat]);
      const targetZoom = view.getZoom() < 7 ? 10 : view.getZoom();
      const mapSize = mainMap.getSize();
      const bottomCovered = 380;
      const visibleHeight = mapSize[1] - bottomCovered;
      const targetY = Math.max(50, visibleHeight * 0.66);
      const resolution = view.getResolutionForZoom(targetZoom);
      const centerY = coords[1] + (targetY - mapSize[1] / 2) * resolution;
      view.animate({ center: [coords[0], centerY], zoom: targetZoom, duration: 600 });
    },
    copyCoords() {
      const text = `${this.station.lat.toFixed(2)}, ${this.station.lon.toFixed(2)}`;
      navigator.clipboard?.writeText(text);
    },
    // fa-location-arrow points NE (45° CW from N) by default.
    // isFrom=true  → "coming from" direction (wind/waves): show opposite → rotate dir+135
    // isFrom=false → "going to"   direction (current):                    rotate dir-45
    arrowStyle(dir, isFrom = false) {
      return { transform: `rotate(${isFrom ? dir + 135 : dir - 45}deg)`, display: 'inline-block' };
    },
    onScrollDragStart(e) {
      this.isDragging = true;
      this.dragStartX = e.pageX;
      this.dragScrollLeft = this.$refs.valuesScroll?.scrollLeft ?? 0;
      e.preventDefault();
    },
  },
  computed: {
    station() {
      if (!this.$gui.selectedPlatform?.stationId) return null;
      return this.$requests.getBuoyStation(this.$gui.selectedPlatform.stationId);
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
      return this.station ? this.$requests.getStationStatus(this.station.id, 'buoy') : 'inactive';
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
    wind()    { const p = this.sp; return p?.WSPD != null ? { speed: p.WSPD, dir: p.WDIR ?? 0 } : null; },
    waves()   { const p = this.sp; return p?.VHM0 != null ? { height: p.VHM0, dir: p.VMDR ?? 0 } : null; },
    current() { const p = this.sp; return p?.HCSP != null ? { speed: p.HCSP, dir: p.HCDT ?? 0 } : null; },
  },
  watch: {
    '$gui.selectedPlatform'() {
      if (!this.map || !this.station) return;
      const coords = ol.proj.fromLonLat([this.station.lon, this.station.lat]);
      this.markerOverlay?.setPosition(coords);
      this.map.getView().animate({ center: coords, duration: 300 });
    }
  },
  components: { MapCircleArrows }
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
