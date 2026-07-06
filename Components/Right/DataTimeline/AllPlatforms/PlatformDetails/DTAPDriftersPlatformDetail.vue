<template>
  <div class="horizontal pd-container" v-if="drifter">
    <i class="fa fa-xmark close-x pd-close-btn clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <!-- Map (left): whole trajectory -->
    <div class="map-container map-clickable" @click="centerMainMap" title="Click to center main map">
      <MapCircleArrows :current="current" v-if="current" />
      <div ref="stationMap" class="pd-map"></div>
    </div>

    <!-- Info (center) -->
    <div class="pd-info">

      <!-- Line 1: type · depth · days active -->
      <div class="pd-header">
        <span>{{ $t('Drifter') }}</span>
        <span>·</span>
        <span>{{ depthLabel }}</span>
        <span>·</span>
        <span class="pd-coords">{{ daysActive }} {{ $t('days active') }}</span>
      </div>

      <!-- Line 2: drifter ID · type -->
      <span class="pd-station-name">{{ drifter.id }} · {{ drifter.type }}</span>
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

      <!-- Line 4: values (temperature + current) -->
      <div class="pd-values-wrapper" v-if="sp?.date">
        <div class="pd-values-scroll" ref="valuesScroll"
          :class="{ 'is-dragging': isDragging }"
          @mousedown="onScrollDragStart">
          <template v-if="anyData">
            <!-- Current speed + direction arrow (TO direction: rotate dir-45) -->
            <div class="pd-value-item" v-if="sp.HCSP != null">
              <span class="pd-value-label">{{ $t('Current') }}</span>
              <span class="pd-value-number">
                {{ sp.HCSP.toFixed(2) }} m/s
                <i v-if="sp.HCDT != null" class="fa fa-location-arrow" :title="`${sp.HCDT.toFixed(0)}º`" :style="arrowStyle(sp.HCDT)"></i>
              </span>
            </div>
            <div class="pd-value-item" v-if="sp.TEMP != null">
              <span class="pd-value-label">{{ $t('Temperature') }}</span>
              <span class="pd-value-number">{{ sp.TEMP.toFixed(1) }} °C</span>
            </div>
          </template>
          <span class="pd-no-data" v-else>{{ $t('No data available') }}</span>
        </div>
      </div>

      <!-- Switch to Drifters dashboard -->
      <button class="pd-switch-btn clickable" @click="$gui.selectedDashboard = 'drifters'">
        <div class="pd-switch-btn-circle">
          <img :src="driftersDashboard.icon" class="pd-switch-btn-icon" alt="">
        </div>
        <span class="pd-switch-btn-label">{{ $t('Switch to dashboard') }}</span>
      </button>
    </div>

    <!-- Media (right): 3D DTO gif -->
    <div class="pd-media-container">
      <img class="pd-circular-media" :src="buoyGIFURL" alt="Drifter 3D view">
    </div>
  </div>
</template>


<script>
import MapCircleArrows from '../../MapCircleArrows.vue';

export default {
  name: "DTAPDriftersPlatformDetail",
  created() {
    this.map = undefined;
    this.markerOverlay = undefined;
    this.trajLayer = undefined;
  },
  mounted() {
    if (!this.drifter) return;
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
      isDragging: false,
      dragStartX: 0,
      dragScrollLeft: 0,
    }
  },
  methods: {
    initMap() {
      this.trajLayer = new ol.layer.Vector({
        source: new ol.source.Vector(),
        style: new ol.style.Style({
          stroke: new ol.style.Stroke({ color: 'rgb(20, 120, 167)', width: 2 }),
        }),
      });
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
          this.trajLayer,
        ],
        view: new ol.View({
          center: ol.proj.fromLonLat([this.drifter.startLon, this.drifter.startLat]),
          zoom: 9,
        })
      });

      // Marker at the selected / latest data point.
      const iconEl = document.createElement('div');
      iconEl.className = 'pd-map-dot';
      this.markerOverlay = new ol.Overlay({
        element: iconEl,
        positioning: 'center-center',
        stopEvent: false,
      });
      this.map.addOverlay(this.markerOverlay);

      this._lastDrifterId = this.drifter.id;
      this.renderTrajectory();
    },
    // Draw the trajectory line + marker, then set the view: centered on the
    // clicked data point (opened from a timeline cell) or fit to the whole
    // trajectory (opened from a map icon).
    renderTrajectory() {
      this.drawTrajectory();
      if (this.sp?.lat != null && this.sp?.lon != null) this.focusPoint(false);
      else this.fitTrajectory();
    },
    drawTrajectory() {
      if (!this.trajLayer) return;
      const source = this.trajLayer.getSource();
      source.clear();
      const traj = this.trajectory;
      if (traj.length >= 2) {
        const coords = traj.map(p => ol.proj.fromLonLat([p.lon, p.lat]));
        source.addFeature(new ol.Feature(new ol.geom.LineString(coords)));
      }
      this.updateMarker();
    },
    fitTrajectory() {
      const traj = this.trajectory;
      if (traj.length < 2) return;
      const coords = traj.map(p => ol.proj.fromLonLat([p.lon, p.lat]));
      const geom = new ol.geom.LineString(coords);
      this.map.getView().fit(geom.getExtent(), { padding: [20, 20, 20, 20], maxZoom: 12, duration: 400 });
    },
    focusPoint(animate = true) {
      const p = this.markerPoint;
      if (!p) return;
      const view = this.map.getView();
      const center = ol.proj.fromLonLat([p.lon, p.lat]);
      const zoom = Math.max(view.getZoom() ?? 11, 11);
      if (animate) {
        view.animate({ center, zoom, duration: 300 });
      } else {
        view.setCenter(center);
        view.setZoom(zoom);
      }
    },
    updateMarker() {
      if (!this.markerOverlay) return;
      const p = this.markerPoint;
      if (p) this.markerOverlay.setPosition(ol.proj.fromLonLat([p.lon, p.lat]));
    },
    centerMainMap() {
      const mainMap = this.$gui.olMap;
      if (!mainMap || this.trajectory.length < 2) return;
      const view = mainMap.getView();
      const coords = this.trajectory.map(p => ol.proj.fromLonLat([p.lon, p.lat]));
      const ext = new ol.geom.LineString(coords).getExtent();
      // Big bottom padding to clear the DT + platform-detail UI overlay.
      view.fit(ext, { padding: [40, 60, 420, 60], maxZoom: 12, duration: 600 });
    },
    arrowStyle(dir) {
      // fa-location-arrow points NE (45°). Current "to" direction → rotate dir-45.
      return { transform: `rotate(${dir - 45}deg)`, display: 'inline-block' };
    },
    onScrollDragStart(e) {
      this.isDragging = true;
      this.dragStartX = e.pageX;
      this.dragScrollLeft = this.$refs.valuesScroll?.scrollLeft ?? 0;
      e.preventDefault();
    },
  },
  computed: {
    drifter() {
      if (!this.$gui.selectedPlatform?.stationId) return null;
      return this.$requests.getDrifterStation(this.$gui.selectedPlatform.stationId);
    },
    sp() { return this.$gui.selectedPlatform; },
    trajectory() {
      if (!this.drifter) return [];
      return this.$requests.getDrifterTrajectory(this.drifter.id);
    },
    // Point to place the map marker: selected sample if it has a position, else last trajectory point.
    markerPoint() {
      if (this.sp?.lat != null && this.sp?.lon != null) return { lat: this.sp.lat, lon: this.sp.lon };
      const traj = this.trajectory;
      return traj.length ? traj[traj.length - 1] : null;
    },
    depthLabel() {
      return this.drifter.depth > 0 ? `${this.drifter.depth} ${this.$t('m depth')}` : this.$t('Surface');
    },
    daysActive() {
      const dep = new Date(this.drifter.deployDate);
      if (isNaN(dep)) return 0;
      return Math.max(0, Math.floor((Date.now() - dep.getTime()) / 86400000));
    },
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
      return this.drifter ? this.$requests.getStationStatus(this.drifter.id, 'drifter') : 'inactive';
    },
    statusLabel() {
      return { active: 'Active', delayed: 'Delayed', inactive: 'Inactive' }[this.status] ?? 'Inactive';
    },
    lastUpdateText() {
      if (!this.drifter) return '';
      const hours = this.$requests.getLastUpdateHoursAgo(this.drifter.id, 'drifter');
      if (hours == null) return '';
      if (hours < 1) return 'Less than 1h ago';
      if (hours < 2) return '1h ago';
      if (hours < 24) return Math.floor(hours) + 'h ago';
      const days = Math.floor(hours / 24);
      if (days === 1) return '1 day ago';
      if (days <= 7) return days + ' days ago';
      return 'More than 7 days ago';
    },
    driftersDashboard() {
      return this.$gui.dashboards.find(d => d.id === 'drifters') ?? { icon: '', name: 'Drifters' };
    },
    anyData() {
      const p = this.sp;
      return p && (p.HCSP != null || p.TEMP != null);
    },
    current() { const p = this.sp; return p?.HCSP != null ? { speed: p.HCSP, dir: p.HCDT ?? 0 } : null; },
  },
  watch: {
    '$gui.selectedPlatform'() {
      if (!this.map || !this.drifter) return;
      if (this.drifter.id !== this._lastDrifterId) {
        // Different drifter → redraw its trajectory and set the view.
        this._lastDrifterId = this.drifter.id;
        this.renderTrajectory();
      } else {
        // Same drifter, a data point was picked → recenter on that point.
        this.updateMarker();
        this.focusPoint(true);
      }
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
