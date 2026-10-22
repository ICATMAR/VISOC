<template>
  <!-- The buoy or drifter the HFR Compare view is about: what it is, which
       instrument measured the current and how deep, the readings behind the
       selected cell, and a way over to its own dashboard on the same day. -->
  <div class="horizontal pd-container hfr-pd" v-if="point">
    <i class="fa fa-xmark close-x pd-close-btn clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <div class="pd-info">
      <!-- Line 1: type · lat/lon [copy] -->
      <div class="pd-header">
        <span>{{ $t(point.kind === 'buoy' ? 'Buoy' : 'Drifter') }}</span>
        <span>·</span>
        <span class="pd-coords">{{ point.lat.toFixed(2) }}° N, {{ point.lon.toFixed(2) }}° E</span>
        <button class="pd-copy-btn clickable" @click="copyCoords" :title="$t('Copy coordinates')">
          <i class="fa fa-copy"></i>
        </button>
      </div>

      <!-- Line 2: name and id -->
      <span class="pd-station-name">{{ point.name }}<span class="pd-id" v-if="point.name !== point.id">{{ point.id }}</span></span>

      <!-- Line 3: the selected hour, the instrument and its depth -->
      <div class="pd-facts">
        <span class="pd-date">{{ formattedDate }}</span>
        <span class="pd-fact"><span class="pd-fact-label">{{ $t('Sensor') }}</span>{{ sensorText }}</span>
        <span class="pd-fact"><span class="pd-fact-label">{{ $t('Depth') }}</span>{{ depthText }}</span>
      </div>

      <!-- Line 4: every reading that went into the selected cell - its time,
           speed (unit clickable, app-wide) and direction - coloured on the
           current-speed legend, as the buoys' detail panel draws them -->
      <div class="pd-values-wrapper">
        <div class="pd-values-scroll">
          <template v-if="readings.length">
            <div class="pd-value-item" v-for="reading in readings" :key="reading.time.getTime()"
              :style="{ background: $gui.colorFor('HCSP', reading.speed) }"
              :title="readingTitle(reading)">
              <span class="pd-value-label">{{ formatTime(reading.time) }} · {{ $t('Current') }}</span>
              <span class="pd-value-number">
                <span class="pd-reading" :class="{ clickable: $gui.isUnitSwitchable('HCSP') }"
                  @click="$gui.cycleUnit('HCSP')">{{ format(reading.speed) }}</span>
                <i v-if="reading.direction != undefined" class="fa fa-location-arrow"
                  :style="{ transform: `rotate(${reading.direction - 45}deg)`, display: 'inline-block' }"></i>
              </span>
            </div>
          </template>
          <span class="pd-no-data" v-else>{{ $t('No data available') }}</span>
        </div>
      </div>

      <!-- Where the selected cell's readings came from -->
      <PDSourceLine v-if="readings.length" :origins="origins" :sources="sources" :note="sourceNote"></PDSourceLine>

      <!-- Switch to the platform's own dashboard, on the same day -->
      <button class="pd-switch-btn clickable" v-if="point.kind === 'buoy'" @click="switchToDashboard">
        <div class="pd-switch-btn-circle">
          <img :src="buoysDashboard.icon" class="pd-switch-btn-icon" alt="">
        </div>
        <span class="pd-switch-btn-label">{{ $t('Switch to dashboard') }}</span>
      </button>
    </div>
  </div>
</template>


<script>
import PDSourceLine from '../Shared/PDSourceLine.vue';

export default {
  name: "DTHFRPlatformDetail",
  mixins: [window.pdFocusMixin],
  components: { PDSourceLine },
  methods: {
    format(speed) {
      const { unit, decimals, toDisplay } = this.$gui.unitFor('HCSP');
      return `${toDisplay(speed).toFixed(decimals)} ${unit}`;
    },
    formatTime(time) {
      // 24-hour, as the timeline writes its hours
      const options = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
      if (!this.$gui.timelineUseLocalTime) options.timeZone = 'UTC';
      return time.toLocaleTimeString(this.$i18n.locale, options);
    },
    readingTitle(reading) {
      return `${this.format(reading.speed)}`
        + (reading.direction != undefined ? ` · ${Math.round(reading.direction)}º` : '')
        + `\n${reading.time.toISOString().replace('T', ' ').substring(0, 16)} UTC`;
    },
    copyCoords() {
      navigator.clipboard?.writeText(`${this.point.lat}, ${this.point.lon}`);
    },
    centerMainMap() {
      if (this.point) this.$gui.centerMainMapOn(this.point.lon, this.point.lat);
    },
    // Over to the Buoys dashboard on this buoy and this hour, asking its
    // timeline to open on the currents (GUIManager.buoysView - honoured by the
    // buoys timeline once it has that view)
    switchToDashboard() {
      const { id } = this.point;
      const time = new Date(this.$gui.selectedTime);
      this.$gui.buoysView = { mode: 'variable', group: 'currents' };
      this.$gui.selectedDashboard = 'buoys';
      this.$gui.selectedTime = time;
      this.$gui.selectedPlatform = { stationId: id, date: time };
      this.$gui.isDataTimelineOpen = true;
      this.$gui.isPlatformDetailOpen = true;
    },
  },
  computed: {
    // Buoys: the source behind the cell's readings, and every source of the
    // buoy. Drifters are still simulated (RequestsManager / DriftersMockData).
    origins() {
      if (this.point?.kind === 'drifter') return [{ label: this.$t('Simulated data') }];
      const origin = this.$dataService.buoys.originOf(this.reading?.source);
      return origin ? [origin] : [];
    },
    sources() {
      return this.point?.kind === 'buoy' ? this.$dataService.buoys.sourcesOf(this.point.id) : [];
    },
    sourceNote() {
      return this.point?.kind === 'drifter'
        ? this.$t('Simulated trajectories: the drifters timeline does not read the drifter sources yet.')
        : this.$t('For each variable the first source with data for the hour is used; sources can process the same measurements differently.');
    },
    point() { return this.$gui.hfrPoint; },
    reading() { return this.$gui.hfrPointReading; },
    // The readings behind the selected cell (its average is what the timeline
    // and the circle arrows show)
    readings() { return this.reading?.readings ?? []; },
    // See pdFocusMixin
    mainMapFocusKey() { return this.point?.id; },
    // The selected cell: the hour ending at the selected time
    formattedDate() {
      const options = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
      if (!this.$gui.timelineUseLocalTime) options.timeZone = 'UTC';
      return new Date(this.$gui.selectedTime).toLocaleString(this.$i18n.locale, options)
        + (this.$gui.timelineUseLocalTime ? '' : ' UTC');
    },
    sensorText() {
      const r = this.reading;
      if (!r?.sensor) return '–';
      return r.instrument && r.instrument !== r.sensor ? `${r.sensor} (${r.instrument})` : r.sensor;
    },
    // Metres below the surface; published negative downward
    depthText() {
      const depth = this.reading?.depth;
      return depth == undefined || !isFinite(depth) ? '–' : `${Math.abs(depth).toFixed(1)} m`;
    },
    buoysDashboard() {
      return this.$gui.dashboards.find(d => d.id === 'buoys') ?? { icon: '' };
    },
  },
}
</script>


<style scoped>
/* No mini map on this one, so the text gets its own margin from the edge */
.hfr-pd .pd-info {
  padding-left: 22px;
  padding-right: 12px;
}

.pd-id {
  margin-left: 6px;
  font-weight: normal;
  opacity: 0.6;
  font-size: 0.8rem;
}

.pd-facts {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 14px;
  font-size: 0.7rem;
}

.pd-fact-label {
  color: rgba(255, 255, 255, 0.55);
  margin-right: 4px;
}

.pd-reading.clickable {
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
