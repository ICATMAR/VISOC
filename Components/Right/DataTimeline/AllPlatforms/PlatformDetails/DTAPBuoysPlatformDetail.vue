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
        <span>{{ $t('Buoy') }}</span>
        <span>·</span>
        <span class="pd-coords">{{ station.latitude.toFixed(2) }}° N, {{ station.longitude.toFixed(2) }}° E</span>
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
          {{ $gui.timelineUseLocalTime ? `(${utcOffsetLabel})` : '(UTC)' }}
        </span>
      </div>

      <!-- Line 4: values (drag to scroll; direction shown as rotated arrow).
           Each chip is painted with its variable's own colour legend, the same
           scale the buoys timeline colours its cells with (GUIManager.colorFor).
           A variable with no legend or no range gets undefined back and keeps
           the stylesheet's green (.pd-value-item in platformDetails.css). -->
      <div class="pd-values-wrapper" v-if="sp?.date">
        <div class="pd-values-scroll" ref="valuesScroll"
          :class="{ 'is-dragging': isDragging }"
          @mousedown="onScrollDragStart">
          <template v-if="anyData">
            <!-- The sea state as one reading: average height, mean direction, average
                 period. Split across three chips they read as unrelated numbers -
                 together they are what tells a long swell from a short wind chop.
                 Coloured by the height, and the arrow is a FROM direction -->
            <div class="pd-value-item" :title="groupTitle([{ label: 'Wave height', code: 'VHM0', value: sp.VHM0 }, { label: 'Direction', code: 'VMDR', value: sp.VMDR, bearing: true }, { label: 'Wave period', code: 'VTM02', value: sp.VTM02 }])" v-if="hasAny(['VHM0', 'VMDR', 'VTM02'])"
              :style="{ background: $gui.colorFor('VHM0', sp.VHM0) }">
              <span class="pd-value-label">{{ $t('Waves') }}</span>
              <span class="pd-value-number">
                <span v-if="sp.VHM0 != null" class="pd-reading" :class="{ clickable: $gui.isUnitSwitchable('VHM0') }"
                  :title="readingTitle('Wave height', 'VHM0', sp.VHM0)"
                  @click="cycle('VHM0')">{{ format('VHM0', sp.VHM0) }}</span>
                <i v-if="sp.VMDR != null" class="fa fa-location-arrow" :title="`${sp.VMDR.toFixed(0)}º`" :style="arrowStyle(sp.VMDR, true)"></i>
                <span v-if="sp.VTM02 != null" class="pd-reading" :class="{ clickable: $gui.isUnitSwitchable('VTM02') }"
                  :title="readingTitle('Wave period', 'VTM02', sp.VTM02)"
                  @click="cycle('VTM02')">{{ format('VTM02', sp.VTM02) }}</span>
              </span>
            </div>
            <!-- The same three for the biggest wave of the interval, from the spectral
                 peak. Fetched only when a cell is clicked (see
                 DTAPBuoys.fetchDetailVariables), so this chip appears a moment
                 after the panel opens, and only for buoys that publish it -->
            <div class="pd-value-item" :title="groupTitle([{ label: 'Max wave height', code: 'VZMX', value: maxWave, labelCode: maxWaveCode }, { label: 'Direction', code: 'VPED', value: sp.VPED, bearing: true }, { label: 'Peak period', code: 'VTPK', value: sp.VTPK }])" v-if="maxWave != null || hasAny(['VPED', 'VTPK'])"
              :style="{ background: $gui.colorFor('VZMX', maxWave) }">
              <span class="pd-value-label">{{ $t('Max wave') }}</span>
              <span class="pd-value-number">
                <span v-if="maxWave != null" class="pd-reading" :class="{ clickable: $gui.isUnitSwitchable('VZMX') }"
                  :title="readingTitle('Max wave height', 'VZMX', maxWave, maxWaveCode)"
                  @click="cycle('VZMX')">{{ format('VZMX', maxWave) }}</span>
                <i v-if="sp.VPED != null" class="fa fa-location-arrow" :title="`${sp.VPED.toFixed(0)}º`" :style="arrowStyle(sp.VPED, true)"></i>
                <span v-if="sp.VTPK != null" class="pd-reading" :class="{ clickable: $gui.isUnitSwitchable('VTPK') }"
                  :title="readingTitle('Peak period', 'VTPK', sp.VTPK)"
                  @click="cycle('VTPK')">{{ format('VTPK', sp.VTPK) }}</span>
              </span>
            </div>
            <!-- Wind speed + direction arrow (FROM direction: rotate dir+135) -->
            <div class="pd-value-item" :title="groupTitle([{ label: 'Wind speed', code: 'WSPD', value: sp.WSPD }, { label: 'Direction', code: 'WDIR', value: sp.WDIR, bearing: true }])" v-if="sp.WSPD != null"
              :style="{ background: $gui.colorFor('WSPD', sp.WSPD) }">
              <span class="pd-value-label">{{ $t('Wind speed') }}</span>
              <span class="pd-value-number">
                <span class="pd-reading" :class="{ clickable: $gui.isUnitSwitchable('WSPD') }"
                  :title="readingTitle('Wind speed', 'WSPD', sp.WSPD)"
                  @click="cycle('WSPD')">{{ format('WSPD', sp.WSPD) }}</span>
                <i v-if="sp.WDIR != null" class="fa fa-location-arrow" :title="`${sp.WDIR.toFixed(0)}º`" :style="arrowStyle(sp.WDIR, true)"></i>
              </span>
            </div>
            <div class="pd-value-item" :title="groupTitle([{ label: 'Wind gust', code: 'GSPD', value: sp.GSPD }, { label: 'Direction', code: 'GDIR', value: sp.GDIR, bearing: true }])" v-if="sp.GSPD != null"
              :style="{ background: $gui.colorFor('GSPD', sp.GSPD) }">
              <span class="pd-value-label">{{ $t('Wind gust') }}</span>
              <span class="pd-value-number">
                <span class="pd-reading" :class="{ clickable: $gui.isUnitSwitchable('GSPD') }"
                  :title="readingTitle('Wind gust', 'GSPD', sp.GSPD)"
                  @click="cycle('GSPD')">{{ format('GSPD', sp.GSPD) }}</span>
                <i v-if="sp.GDIR != null" class="fa fa-location-arrow" :title="`${sp.GDIR.toFixed(0)}º`" :style="arrowStyle(sp.GDIR, true)"></i>
              </span>
            </div>
            <!-- Current speed + direction arrow (TO direction: rotate dir-45) -->
            <div class="pd-value-item" :title="groupTitle([{ label: 'Current speed', code: 'HCSP', value: sp.HCSP }, { label: 'Direction', code: 'HCDT', value: sp.HCDT, bearing: true }])" v-if="sp.HCSP != null"
              :style="{ background: $gui.colorFor('HCSP', sp.HCSP) }">
              <span class="pd-value-label">{{ $t('Current') }}</span>
              <span class="pd-value-number">
                <span class="pd-reading" :class="{ clickable: $gui.isUnitSwitchable('HCSP') }"
                  :title="readingTitle('Current speed', 'HCSP', sp.HCSP)"
                  @click="cycle('HCSP')">{{ format('HCSP', sp.HCSP) }}</span>
                <i v-if="sp.HCDT != null" class="fa fa-location-arrow" :title="`${sp.HCDT.toFixed(0)}º`" :style="arrowStyle(sp.HCDT, false)"></i>
              </span>
            </div>
            <div class="pd-value-item" :title="groupTitle([{ label: 'Temperature', code: 'TEMP', value: sp.TEMP }])" v-if="sp.TEMP != null"
              :style="{ background: $gui.colorFor('TEMP', sp.TEMP) }">
              <span class="pd-value-label">{{ $t('Temperature') }}</span>
              <span class="pd-value-number"><span class="pd-reading" :class="{ clickable: $gui.isUnitSwitchable('TEMP') }"
                  :title="readingTitle('Temperature', 'TEMP', sp.TEMP)"
                  @click="cycle('TEMP')">{{ format('TEMP', sp.TEMP) }}</span></span>
            </div>
            <div class="pd-value-item" :title="`Salinity (${codeLabel('PSAL')}): ${sp.PSAL.toFixed(1)} PSU`" v-if="sp.PSAL != null"
              :style="{ background: $gui.colorFor('PSAL', sp.PSAL) }">
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
  // The buoy catalogue this panel reads position/status from - static first
  // (synchronous, so whatever's already selected resolves immediately),
  // refined once the live sources (ERDDAP/MSM/SOMO) resolve and can supply a
  // real endDate for the status dot. Same two-step pattern as
  // MapOverlayBuoys.vue and DTAPBuoys.vue. This component mounts once per
  // visit to the Buoys All-Platforms view (see DTPlatformDetail.vue's
  // isBuoysView), not once per buoy click, so this only runs once.
  created() {
    this.map = undefined;
    this.markerOverlay = undefined;
    this.buoys = this.$dataService.buoys.getBuoys();
    this.$dataService.buoys.loadBuoys()
      .then(buoys => { this.buoys = buoys; })
      .catch(error => console.error('Error loading buoys for the platform detail panel:', error));
  },
  mounted() {
    if (!this.station) return;
    this.initMap();
    this._onDocMouseMove = (e) => {
      if (!this.isDragging) return;
      // Past a few pixels this is a scroll, not a click on a reading - see
      // cycle(), which would otherwise change units every time the list is
      // dragged sideways.
      if (Math.abs(e.pageX - this.dragStartX) > 3) this.didDrag = true;
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
      didDrag: false,   // this drag actually moved; see cycle()
      dragStartX: 0,
      dragScrollLeft: 0,
      buoys: [],
    }
  },
  methods: {
    // Clicking a reading switches the unit of its QUANTITY, app-wide - the same
    // gesture and the same GUIManager.cycleUnit as the timeline's variable bar,
    // so putting wind into knots here puts it into knots there too. Only
    // quantities with somewhere to go respond.
    //
    // The guard is for the drag-to-scroll on this row: a drag ends in a click
    // event over whatever reading happened to be under the cursor, which would
    // change units every time someone scrolled the list.
    // "VHM0; Hm0" - the standard code, and the name the source published it
    // under where that differs. Which spelling a value arrived as is the first
    // thing worth knowing when a number looks wrong, and it is not otherwise
    // visible anywhere in the app.
    codeLabel(code) {
      const raw = this.sp?.raw?.[code];
      return raw && raw !== code ? `${code}; ${raw}` : code;
    },
    // The whole chip in one tooltip: every reading it shows, with its standard
    // code, the name the source published it under, and its unit - then the
    // instrument and server they came from. Same shape as the map's circle
    // arrows, so a reading reads the same wherever it is hovered.
    //
    // On the chip rather than only on the numbers, because the label and the
    // padding are most of a chip's hover area, and sensor/source were not
    // visible anywhere in this list before.
    //
    // `entries` are { label, code, value, bearing, labelCode } - a bearing is
    // printed in degrees rather than run through a unit, and labelCode names a
    // value whose own code differs from the one its unit comes from.
    groupTitle(entries) {
      const lines = entries
        .filter(entry => entry.value != null && isFinite(entry.value))
        .map(entry => `${this.$t(entry.label)} (${this.codeLabel(entry.labelCode ?? entry.code)}): `
          + (entry.bearing ? `${entry.value.toFixed(0)}º` : this.format(entry.code, entry.value)));
      const first = entries[0];
      (this.sp?.from?.[first?.labelCode ?? first?.code] ?? []).forEach(({ sensor, instrument, source }) => {
        lines.push(`${this.$t('Sensor')}: ${sensor}${instrument ? ` (${instrument})` : ''}`);
        lines.push(`${this.$t('Source')}: ${source}`);
      });
      return lines.join('\n');
    },
    // The whole reading in one line, plus the hint that it can be clicked.
    // `labelCode` where the value's own code differs from the one its unit is
    // taken from - a maximum wave height is formatted on VZMX's scale whichever
    // of CF's four spellings it actually arrived as.
    readingTitle(label, code, value, labelCode) {
      const line = `${this.$t(label)} (${this.codeLabel(labelCode ?? code)}): ${this.format(code, value)}`;
      return this.$gui.isUnitSwitchable(code) ? `${line}\n${this.$t('Click to change units')}` : line;
    },
    cycle(code) {
      if (this.didDrag || !this.$gui.isUnitSwitchable(code)) return;
      this.$gui.cycleUnit(code);
    },
    // Written in whatever unit the user has picked for that quantity; the
    // values themselves are STANDARD (see data/variables.js). Hardcoding these
    // is what had the wind reading "km/h" over a value in m/s.
    // Whether a group has anything worth showing. A group chip appears as soon
    // as ONE of its three parts arrives, rather than waiting for all of them -
    // the detail variables land after the timeline's own, and a buoy may
    // publish a height but no period at all.
    hasAny(codes) {
      return codes.some(code => this.sp?.[code] != null);
    },
    format(code, value) {
      const { unit, decimals, toDisplay } = this.$gui.unitFor(code);
      return `${toDisplay(value).toFixed(decimals)} ${unit}`;
    },
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
          center: ol.proj.fromLonLat([this.station.longitude, this.station.latitude]),
          zoom: 9
        })
      });
    },
    centerMainMap() {
      const mainMap = this.$gui.olMap;
      if (!mainMap || !this.station) return;
      const view = mainMap.getView();
      const coords = ol.proj.fromLonLat([this.station.longitude, this.station.latitude]);
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
      const text = `${this.station.latitude.toFixed(2)}, ${this.station.longitude.toFixed(2)}`;
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
      this.didDrag = false;
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
      return this.buoys.find(b => b.id === this.$gui.selectedPlatform.stationId) ?? null;
    },
    sp() { return this.$gui.selectedPlatform; },
    formattedDate() {
      const date = this.sp?.date;
      if (!date) return '';
      const opts = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', hour12: true};
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
    // Same thresholds as MapOverlayBuoys.vue's buoyStatus() - active <3h,
    // delayed up to 24h, otherwise inactive. That map also has an 'offline'
    // bucket beyond 30 days; this panel's CSS draws it identically to
    // 'inactive' (see platformDetails.css), so there's nothing gained by
    // telling them apart here.
    ageHours() {
      if (!this.station?.endDate) return null;
      return (Date.now() - new Date(this.station.endDate).getTime()) / 3600000;
    },
    status() {
      if (this.ageHours == null) return 'inactive';
      if (this.ageHours < 3) return 'active';
      if (this.ageHours <= 24) return 'delayed';
      return 'inactive';
    },
    statusLabel() {
      return { active: 'Active', delayed: 'Delayed', inactive: 'Inactive' }[this.status] ?? 'Inactive';
    },
    lastUpdateText() {
      return this.ageHours == null ? '' : this.formatTimeAgo(this.ageHours);
    },
    buoysDashboard() {
      return this.$gui.dashboards.find(d => d.id === 'buoys') ?? { icon: '', name: 'Buoys' };
    },
    anyData() {
      const p = this.sp;
      return p && (p.VHM0 != null || p.WSPD != null || p.HCSP != null || p.TEMP != null);
    },
    // The maximum wave height under whichever of CF's four spellings this buoy
    // publishes (see GUIManager.buoyDetailVariables). They all mean
    // sea_surface_wave_maximum_height, so the first one present is the answer,
    // and VZMX's scale colours it whichever one it turned out to be.
    maxWaveCode() {
      return ['VZMX', 'VCMX', 'VHMH', 'VEMH'].find(c => this.sp?.[c] != null);
    },
    maxWave() {
      return this.maxWaveCode ? this.sp[this.maxWaveCode] : null;
    },
    // What the circle arrows put in their tooltips: the second reading beside
    // each magnitude, and `from` - the sensor and server DTAPBuoys recorded
    // for it. No `?? 0` on the extra readings, unlike the directions: a
    // bearing of 0 is due north and the arrow needs a number either way, but a
    // gust or period of 0 is not a measurement, and the tooltip drops what is
    // missing rather than printing it as zero.
    wind()    { const p = this.sp; return p?.WSPD != null ? { speed: p.WSPD, dir: p.WDIR ?? 0, gust: p.GSPD, from: p.from?.WSPD, raw: p.raw } : null; },
    waves()   { const p = this.sp; return p?.VHM0 != null ? { height: p.VHM0, dir: p.VMDR ?? 0, period: p.VTM02, from: p.from?.VHM0, raw: p.raw } : null; },
    current() { const p = this.sp; return p?.HCSP != null ? { speed: p.HCSP, dir: p.HCDT ?? 0, from: p.from?.HCSP, raw: p.raw } : null; },
  },
  watch: {
    '$gui.selectedPlatform'() {
      if (!this.map || !this.station) return;
      const coords = ol.proj.fromLonLat([this.station.longitude, this.station.latitude]);
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

/* Underlined only where there is another unit to switch to - the same signal
   the timeline's variable bar uses for the same gesture. */
.pd-reading.clickable {
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
