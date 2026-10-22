<template>
  <div class="horizontal pd-container">
    <i class="fa fa-xmark close-x pd-close-btn clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <!-- Map (left) — shows the network's stations -->
    <div class="map-container map-clickable" @click="centerMainMap" title="Click to center main map">
      <div ref="stationMap" class="pd-map"></div>
    </div>

    <!-- Info (center) -->
    <div class="pd-info">

      <!-- Line 1: product type -->
      <div class="pd-header">
        <span>{{ $t('Sea water velocities') }}</span>
      </div>

      <!-- Line 2: the network - another network's by its code -->
      <span class="pd-station-name">{{ otherNetworkCode ?? $t('HF radar network') }}</span>

      <!-- Line 3: status -->
      <div class="pd-status">
        <div class="pd-status-dot active"></div>
        <span>{{ $t('Active') }}</span>
      </div>

      <!-- When datacell is selected: date + values -->
      <div class="pd-date-row" v-if="sp?.date">
        <span class="pd-date">{{ formattedDate }}</span>
        <span class="pd-time-toggle" @click="$gui.timelineUseLocalTime = !$gui.timelineUseLocalTime">
          {{ $gui.timelineUseLocalTime ? `(${utcOffsetLabel})` : '(UTC)' }}
        </span>
      </div>

      <div class="pd-values-wrapper" v-if="sp?.date">
        <div class="pd-values-scroll" v-scroll-fade ref="valuesScroll"
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

      <!-- Where the selected bar's count came from -->
      <PDSourceLine v-if="sp?.date && sp.origin" :origins="[sp.origin]" :sources="['EU HFR Node ERDDAP']"
        :note="sourceNote"></PDSourceLine>

      <!-- Switch to HFR currents dashboard -->
      <button class="pd-switch-btn clickable" v-if="$gui.selectedDashboard !== 'hfr'" @click="$gui.selectedDashboard = 'hfr'">
        <div class="pd-switch-btn-circle">
          <img :src="hfrDashboard.icon" class="pd-switch-btn-icon" alt="">
        </div>
        <span class="pd-switch-btn-label">{{ $t('Switch to dashboard') }}</span>
      </button>
    </div>
  </div>
</template>


<script>
import PDSourceLine from '../../Shared/PDSourceLine.vue';

export default {
  name: "DTAPHFRTotalsPlatformDetail",
  mixins: [window.pdFocusMixin],
  components: { PDSourceLine },
  created() {
    this.map = undefined;
    this.stationOverlays = [];
    // Another network's stations, as the EU HFR Node publishes them (memoized)
    this.$dataService.hfrnetwork.getAllNetworks(this.$dataService.hfrstations)
      .then(networks => { this.networks = networks; })
      .catch(error => console.error('Error loading HFR networks for the totals detail:', error));
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
      networks: [],
    }
  },
  methods: {
    initMap() {
      this.map = new ol.Map({
        target: this.$refs.stationMap,
        controls: [],
        interactions: [],
        layers: window.createDetailMapLayers(),
        view: new ol.View({
          center: ol.proj.fromLonLat([2.4, 42.0]),
          zoom: 7
        })
      });
      this.drawStations();
      // Fitted again once the map has its size
      this.map.once('rendercomplete', () => this.fitStations());
    },
    // A marker for each of the network's stations, and the view fitted to them
    drawStations() {
      if (!this.map) return;
      this.stationOverlays.forEach(overlay => this.map.removeOverlay(overlay));
      this.stationOverlays = this.stationPositions.map(([lon, lat]) => {
        const el = document.createElement('div');
        el.className = 'pd-map-icon';
        const img = document.createElement('img');
        img.src = this.radarIconURL;
        el.appendChild(img);
        const overlay = new ol.Overlay({
          element: el,
          positioning: 'center-center',
          stopEvent: false,
          position: ol.proj.fromLonLat([lon, lat]),
        });
        this.map.addOverlay(overlay);
        return overlay;
      });
      this.fitStations();
    },
    fitStations() {
      if (this.map && this.stationPositions.length) this.map.getView().fit(this.stationsExtent(), { padding: [25, 25, 25, 25], maxZoom: 9 });
    },
    stationsExtent() {
      const ext = [Infinity, Infinity, -Infinity, -Infinity];
      for (const [lon, lat] of this.stationPositions) {
        const [x, y] = ol.proj.fromLonLat([lon, lat]);
        if (x < ext[0]) ext[0] = x; if (y < ext[1]) ext[1] = y;
        if (x > ext[2]) ext[2] = x; if (y > ext[3]) ext[3] = y;
      }
      return ext;
    },
    centerMainMap() {
      if (this.stationPositions.length) this.$gui.fitMainMapTo(this.stationsExtent(), 9);
    },
    onScrollDragStart(e) {
      this.isDragging = true;
      this.dragStartX = e.pageX;
      this.dragScrollLeft = this.$refs.valuesScroll?.scrollLeft ?? 0;
      e.preventDefault();
    },
  },
  computed: {
    // How the counts' sources are combined, for the source line's hover
    sourceNote() {
      return this.$t("The valid points of ICATMAR's network totals, as the EU HFR Node counts them.");
    },
    // See pdFocusMixin - the network as a whole, so once per opening and
    // network (once its stations are known)
    mainMapFocusKey() { return this.stationPositions.length ? `TOTALS:${this.otherNetworkCode ?? 'HFR-ICATMAR'}` : null; },
    // The selected Total's network when it isn't ICATMAR's: one of
    // getAllNetworks()' groups
    otherNetworkCode() {
      const code = this.sp?.network;
      return code && code !== 'HFR-ICATMAR' ? code : null;
    },
    otherNetwork() {
      if (!this.otherNetworkCode) return null;
      return this.networks.find(n => this.$dataService.hfrnetwork.networkCode(n) === this.otherNetworkCode) ?? null;
    },
    // [lon, lat] of each of the network's stations
    stationPositions() {
      if (this.otherNetworkCode)
        return (this.otherNetwork?.stations ?? []).filter(s => !s.notOnEUNode).map(s => [s.longitude, s.latitude]);
      return this.$requests.hfrStations.map(s => [s.lon, s.lat]);
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
    hfrDashboard() {
      return this.$gui.dashboards.find(d => d.id === 'hfr') ?? { icon: './Assets/Icons/radar.svg', name: 'HFR currents' };
    },
    totalStations() {
      return this.stationPositions.length;
    },
  },
  watch: {
    stationPositions() { this.drawStations(); },
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
