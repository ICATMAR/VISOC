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
        <span class="pd-coords">{{ coordsLabel }}</span>
        <button class="pd-copy-btn clickable" @click="copyCoords" :title="$t('Copy coordinates')">
          <i class="fa fa-copy"></i>
        </button>
      </div>

      <!-- Line 2: name + status -->
      <span class="pd-station-name">{{ station.name ?? station.id }}</span>
      <div class="pd-status">
        <div class="pd-status-dot" :class="status"></div>
        <span>{{ $t(statusLabel) }}</span>
        <span class="pd-last-update" v-if="lastUpdateText">· {{ lastUpdateText }}</span>
      </div>

      <!-- Line 3: date + local/UTC toggle -->
      <div class="pd-date-row" v-if="sp?.date">
        <span class="pd-date">{{ formattedDate }}</span>
        <span class="pd-time-toggle" @click="$gui.timelineUseLocalTime = !$gui.timelineUseLocalTime">
          {{ $gui.timelineUseLocalTime ? `(${utcOffsetLabel})` : '(UTC)' }}
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
      <button class="pd-switch-btn clickable" v-if="$gui.selectedDashboard !== 'hfr'" @click="$gui.selectedDashboard = 'hfr'">
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
  mixins: [window.pdFocusMixin],
  created() {
    this.map = undefined;
    this.markerOverlay = undefined;
    // Static catalogue first so a station already selected renders (and its
    // map draws) on this tick, then whatever the live sources add - the same
    // two-step the map overlay and every buoy view use.
    this.stations = this.$dataService.hfrnetwork.getIcatmarNetwork().stations;
    this.loadStations();
  },
  mounted() {
    this.showStationOnMap();
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
      stations: [],
      networks: [], // every network on the EU HFR Node, for another network's station
    }
  },
  methods: {
    // The mini map, on the selected station. Its element only exists while a
    // station is (the template's v-if), and a station can arrive after this
    // mounts - another network's, once the EU HFR Node's networks load - or
    // go and come back, which renders a new element: so the map is created
    // or moved onto whatever element is there now.
    showStationOnMap() {
      const target = this.$refs.stationMap;
      if (!this.station || !target) return;
      const coords = ol.proj.fromLonLat([this.station.longitude, this.station.latitude]);
      if (!this.map) {
        this.initMap(target, coords);
      } else if (this.map.getTargetElement() !== target) {
        this.map.setTarget(target);
        this.map.getView().setCenter(coords);
      } else {
        this.map.getView().animate({ center: coords, duration: 300 });
      }
      this.markerOverlay.setPosition(coords);
    },
    initMap(target, coords) {
      this.map = new ol.Map({
        target,
        controls: [],
        interactions: [],
        layers: window.createDetailMapLayers(),
        view: new ol.View({ center: coords, zoom: 11 }),
      });
      const iconEl = document.createElement('div');
      iconEl.className = 'pd-map-icon';
      const markerImg = document.createElement('img');
      markerImg.src = this.radarIconURL;
      iconEl.appendChild(markerImg);
      this.markerOverlay = new ol.Overlay({ element: iconEl, positioning: 'center-center', stopEvent: false });
      this.map.addOverlay(this.markerOverlay);
    },
    centerMainMap() {
      if (!this.station) return;
      const zoom = this.$gui.olMap?.getView().getZoom() < 7 ? 11 : undefined;
      this.$gui.centerMainMapOn(this.station.longitude, this.station.latitude, zoom);
    },
    // Rounded on screen, exact on the clipboard: the panel is too narrow for
    // full precision, but a pasted position is meant to be used.
    copyCoords() {
      navigator.clipboard?.writeText(`${this.station.latitude}, ${this.station.longitude}`);
    },
    onScrollDragStart(e) {
      this.isDragging = true;
      this.dragStartX = e.pageX;
      this.dragScrollLeft = this.$refs.valuesScroll?.scrollLeft ?? 0;
      e.preventDefault();
    },
    // Position, coverage box and freshness as the live sources report them -
    // the same station objects the map's status dots read, so the two can't
    // disagree. Shared with the map via getAllNetworks()' memoization, so this
    // costs no extra requests; on failure the static catalogue stays up.
    async loadStations() {
      try {
        this.stations = await this.$dataService.hfrnetwork.getICATMARStations(this.$dataService.hfrstations);
        this.networks = await this.$dataService.hfrnetwork.getAllNetworks(this.$dataService.hfrstations);
      } catch (error) {
        console.error('Error loading HFR stations:', error);
      }
    },
    formatTimeAgo(hours) {
      if (hours == null) return '';
      if (hours < 1) return Math.max(1, Math.floor(hours * 60)) + ' min ago';
      if (hours < 2) return '1h ago';
      if (hours < 24) return Math.floor(hours) + 'h ago';
      const days = Math.floor(hours / 24);
      if (days === 1) return '1 day ago';
      if (days <= 7) return days + ' days ago';
      return 'More than 7 days ago';
    },
  },
  computed: {
    // See pdFocusMixin
    mainMapFocusKey() { return this.station?.id; },
    station() {
      const { stationId: id, network } = this.$gui.selectedPlatform ?? {};
      if (!id) return null;
      // Another network's, as the EU HFR Node publishes it - by its network,
      // since codes repeat across networks
      if (network && network !== 'HFR-ICATMAR') {
        const group = this.networks.find(n => this.$dataService.hfrnetwork.networkCode(n) === network);
        return group?.stations.find(station => station.id === id) ?? null;
      }
      return this.stations.find(station => station.id === id) ?? null;
    },
    coordsLabel() {
      if (!this.station) return '';
      const { latitude, longitude } = this.station;
      return `${Math.abs(latitude).toFixed(2)}° ${latitude < 0 ? 'S' : 'N'}, ${Math.abs(longitude).toFixed(2)}° ${longitude < 0 ? 'W' : 'E'}`;
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
    // Hours since this station last published, or null until a source reports
    // a coverage end for it (the static catalogue carries none, so this stays
    // null through the first paint).
    lastUpdateHours() {
      const endStr = this.station?.metadata?.time_coverage_end;
      return endStr ? (Date.now() - new Date(endStr).getTime()) / 3600000 : null;
    },
    // active < 3h, delayed 3-24h, inactive beyond that - the same thresholds
    // the map's station dots use (MapOverlayHFRStations.stationStatus), so a
    // station never reads one way on the map and another way here. The map's
    // further 'offline' tier (older than 30 days) has no dot of its own in a
    // platform detail, so it stays 'inactive' here.
    status() {
      const hours = this.lastUpdateHours;
      if (hours == null) return 'unknown';
      if (hours < 3) return 'active';
      if (hours <= 24) return 'delayed';
      return 'inactive';
    },
    statusLabel() {
      return { active: 'Active', delayed: 'Delayed', inactive: 'Inactive' }[this.status] ?? 'Unknown';
    },
    lastUpdateText() {
      return this.formatTimeAgo(this.lastUpdateHours);
    },
    hfrDashboard() {
      return this.$gui.dashboards.find(d => d.id === 'hfr') ?? { icon: '', name: 'HFR currents' };
    },
  },
  watch: {
    // The station object, not selectedPlatform: that also changes on every
    // bar click (same station, new date), and it fires again when the live
    // sources replace the static entry with one carrying the real position.
    station() {
      this.imgError = false;
      this.$nextTick(() => this.showStationOnMap()); // once the v-if has rendered the element
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
