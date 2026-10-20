<template>
  <!-- Every platform of the current dashboard, north to south. A click opens
       it the same way its map marker does (GUIManager.selectPlatform). -->
  <div class="platform-list" v-if="dashboardId">
    <!-- HF radar: name, id, last report, then valid points in its latest hour -->
    <template v-if="dashboardId === 'hfr'">
      <div class="dashboard-section-text">{{ $t('HF radar stations') }}</div>
      <div class="platform-row clickable" v-for="platform in rows" :key="platform.id"
        :class="{ 'platform-row-selected': $gui.isPlatformSelected(dashboardId, platform.id) }"
        @click="select(platform)">
        <div class="platform-row-head">
          <div class="pd-status-dot" :class="platform.status"></div>
          <span class="platform-name">{{ platform.name }}</span>
          <span class="platform-id">{{ platform.id }}</span>
          <span class="platform-updated">{{ platform.updated }}</span>
        </div>
        <div class="platform-row-data">
          <span class="platform-pending" v-if="isLoading && validPoints[platform.id] === undefined">
            <span class="platform-loading spinner-border"></span>{{ $t('Loading') }}
          </span>
          <span class="platform-reading" v-else-if="validPoints[platform.id] != null">
            {{ validPoints[platform.id] }} {{ $t('valid points') }}
          </span>
          <span class="platform-no-data" v-else>{{ $t('No data available') }}</span>
        </div>
      </div>
    </template>

    <!-- Buoys: a table, one line per buoy. The header names each column and
         carries its unit (whichever the user picked), so a cell only needs the
         number and, for wind, waves and currents, the arrow. -->
    <div class="buoy-table" v-else>
      <!-- The section title takes the name column's place in the header row -->
      <div class="buoy-table-header">
        <span class="dashboard-section-text buoy-table-title">{{ $t('Buoys') }}</span>
        <span v-for="column in buoyColumns" :key="column.code" class="buoy-column-title">
          {{ $t(column.label) }}<span class="buoy-column-unit" :class="{ clickable: $gui.isUnitSwitchable(column.code) }"
            :title="$gui.isUnitSwitchable(column.code) ? $t('Click to change units') : ''"
            @click="$gui.cycleUnit(column.code)">{{ $gui.unitFor(column.code).unit }}</span>
        </span>
      </div>

      <div class="buoy-table-row clickable" v-for="platform in rows" :key="platform.id"
        :class="{ 'platform-row-selected': $gui.isPlatformSelected(dashboardId, platform.id) }"
        @click="select(platform)">
        <!-- Name on top, id and last report below -->
        <div class="buoy-name-cell">
          <div class="platform-row-head">
            <div class="pd-status-dot" :class="platform.status"></div>
            <span class="platform-name">{{ platform.name }}</span>
          </div>
          <span class="buoy-subline">{{ platform.id }}<template v-if="platform.updated"> · {{ platform.updated }}</template></span>
        </div>
        <!-- One cell per variable, coloured by its legend -->
        <span v-for="column in buoyColumns" :key="column.code" class="buoy-cell"
          :style="{ background: $gui.colorFor(column.code, reading(platform.id, column.code)) }"
          :title="cellTitle(platform.id, column)">
          <span class="platform-loading spinner-border" v-if="isLoading && readings[platform.id] === undefined"></span>
          <template v-else-if="reading(platform.id, column.code) != null">
            {{ number(column.code, reading(platform.id, column.code)) }}
            <i v-if="column.directionCode && reading(platform.id, column.directionCode) != null" class="fa fa-location-arrow"
              :style="arrowStyle(column, reading(platform.id, column.directionCode))"></i>
          </template>
          <span class="buoy-cell-empty" v-else>–</span>
        </span>
      </div>
    </div>

    <!-- Separates the list from the dashboards below it -->
    <div class="divider-small platform-list-divider"></div>
  </div>
</template>


<script>
// The buoy table's columns
const BUOY_COLUMNS = [
  { label: 'Wind', code: 'WSPD', directionCode: 'WDIR', fromDirection: true },
  { label: 'Waves', code: 'VHM0', directionCode: 'VMDR', fromDirection: true },
  { label: 'Current', code: 'HCSP', directionCode: 'HCDT' },
  { label: 'Water', code: 'TEMP', longLabel: 'Water temperature' },
];

// Each column shows its own latest reading, and only if it is at most
// MAX_AGE_HOURS old - an older one is not shown at all ("–"). The request
// window is a little longer than that because it is snapped to whole hours
// (see window()), which would otherwise cut off readings still young enough.
const MAX_AGE_HOURS = 2;
const LOOKBACK_HOURS = 3;

export default {
  name: "MenuPlatformList",
  data() {
    return {
      stations: [],     // HFR: static first, then live (all networks)
      buoys: [],        // static first, then with live endDate
      validPoints: {},  // HFR station id -> count in its latest hour (null: none)
      readings: {},     // buoy id -> { code: value } latest per code
      isLoading: false,
    }
  },
  methods: {
    // Loaded each time the list is shown: everything goes through the same
    // caches as the timelines (FetchManager, the buoys' block cache), so
    // re-opening the menu is cheap.
    async load() {
      this.isLoading = true;
      try {
        if (this.dashboardId === 'hfr') await this.loadHFR();
        else await this.loadBuoys();
      } catch (error) {
        console.error('Could not load the platform list:', error);
      } finally {
        this.isLoading = false;
      }
    },
    async loadHFR() {
      const { start, end } = this.window();
      if (this.stations.length === 0)
        this.stations = this.$dataService.hfrnetwork.getIcatmarNetwork().stations;

      const countsPromise = this.$dataService.hfrnetwork.getNumberOfValidPointsPerNetwork(
        this.$dataService.hfrstations, this.$dataService.hfrtotals, start, end);
      const networks = await this.$dataService.hfrnetwork.getAllNetworks(this.$dataService.hfrstations);
      this.stations = networks.flatMap(network => network.stations);

      // One promise per station; each row fills in as its own answer lands,
      // and the list counts as loading until the last one has - a station
      // with no answer yet is still loading, not without data
      await Promise.allSettled((await countsPromise).map(promise => promise.then(({ id, points }) => {
        const latest = Object.keys(points ?? {}).sort().pop();
        this.validPoints = { ...this.validPoints, [id]: latest ? points[latest] : null };
      })));
    },
    async loadBuoys() {
      const { start, end } = this.window();
      if (this.buoys.length === 0) this.buoys = this.$dataService.buoys.getBuoys();
      const codes = BUOY_COLUMNS.flatMap(r => [r.code, r.directionCode].filter(Boolean));

      // What the cache already holds first, so the rows don't spin for data
      // the app already has
      this.$dataService.buoys.readVariablesData(codes, start, end).forEach(result => this.applyBuoyResult(result));

      this.buoys = await this.$dataService.buoys.loadBuoys();
      const { promises } = await this.$dataService.buoys.getVariablesData(codes, start, end);
      // Same as the HFR counts: loading until every buoy has answered
      await Promise.allSettled(promises.map(promise => promise.then(result => this.applyBuoyResult(result))));
    },
    // The latest value of each code, from a getVariablesData-shaped result
    applyBuoyResult({ buoyId, data }) {
      const latest = {};
      Object.keys(data).sort().forEach(timestamp => {
        Object.entries(data[timestamp]).forEach(([code, point]) => {
          if (point?.value != null && isFinite(point.value)) latest[code] = { value: point.value, time: timestamp };
        });
      });
      this.readings = { ...this.readings, [buoyId]: latest };
    },
    // The last LOOKBACK_HOURS, on whole hours so the request URLs repeat
    window() {
      const end = new Date();
      end.setMinutes(0, 0, 0);
      end.setHours(end.getHours() + 1);
      return { start: new Date(end.getTime() - LOOKBACK_HOURS * 3600 * 1000), end };
    },
    // The latest value of a code, or undefined if it is older than
    // MAX_AGE_HOURS - too old to pass for the buoy's current reading
    reading(buoyId, code) {
      const latest = this.readings[buoyId]?.[code];
      if (latest == null) return undefined;
      const ageMs = Date.now() - new Date(latest.time).getTime();
      return ageMs <= MAX_AGE_HOURS * 3600 * 1000 ? latest.value : undefined;
    },
    // The number alone: the unit is in the column header
    number(code, value) {
      const { decimals, toDisplay } = this.$gui.unitFor(code);
      return toDisplay(value).toFixed(decimals);
    },
    cellTitle(buoyId, column) {
      const value = this.reading(buoyId, column.code);
      if (value == null) return this.$t(column.longLabel ?? column.label);
      const { unit } = this.$gui.unitFor(column.code);
      const direction = column.directionCode ? this.reading(buoyId, column.directionCode) : null;
      return `${this.$t(column.longLabel ?? column.label)}: ${this.number(column.code, value)} ${unit}`
        + (direction != null ? ` · ${direction.toFixed(0)}º` : '')
        + `\n${this.$t('Measured')} ${this.readingAge(this.readings[buoyId][column.code].time)}`;
    },
    // How long ago a reading was measured, to the minute: a cell is at most
    // MAX_AGE_HOURS old, so whole hours alone would say little ("1h ago" for
    // anything from 60 to 119 minutes)
    readingAge(time) {
      const minutes = Math.max(1, Math.floor((Date.now() - new Date(time).getTime()) / 60000));
      if (minutes < 60) return `${minutes} ${this.$t('min ago')}`;
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return rest ? `${hours}h ${rest} ${this.$t('min ago')}` : `${hours}${this.$t('h ago')}`;
    },
    // fa-location-arrow points NE; a FROM direction (wind, waves) is turned
    // half round so the arrow shows where it is going
    arrowStyle(column, direction) {
      const angle = column.fromDirection ? direction + 135 : direction - 45;
      return { transform: `rotate(${angle}deg)` };
    },
    // Same thresholds as the map markers
    status(endDate) {
      if (!endDate) return 'inactive';
      const ageHours = (Date.now() - new Date(endDate).getTime()) / 3600000;
      if (ageHours < 3) return 'active';
      if (ageHours <= 24) return 'delayed';
      return 'inactive';
    },
    timeAgo(endDate) {
      if (!endDate) return '';
      const hours = (Date.now() - new Date(endDate).getTime()) / 3600000;
      if (hours < 1) return Math.max(1, Math.floor(hours * 60)) + ' ' + this.$t('min ago');
      if (hours < 24) return Math.floor(hours) + this.$t('h ago');
      return Math.floor(hours / 24) + ' ' + this.$t('days ago');
    },
    select(platform) {
      this.$gui.selectPlatform(this.dashboardId, platform.id);
      this.$nextTick(() => this.$gui.centerMainMapOn(platform.longitude, platform.latitude));
    },
  },
  computed: {
    buoyColumns() { return BUOY_COLUMNS; },
    dashboardId() {
      const id = this.$gui.selectedDashboard;
      return id === 'hfr' || id === 'buoys' ? id : null;
    },
    // North to south, whatever the dashboard
    rows() {
      const platforms = this.dashboardId === 'hfr'
        ? this.stations
          .filter(s => this.$gui.hfrSource === 'EU' || s.metadata?.network === 'HFR-ICATMAR')
          .map(s => ({ id: s.id, name: s.name, latitude: s.latitude, longitude: s.longitude, endDate: s.metadata?.time_coverage_end }))
        : this.buoys.map(b => ({ id: b.id, name: b.name, latitude: b.latitude, longitude: b.longitude, endDate: b.endDate }));
      return platforms
        .map(p => ({ ...p, status: this.status(p.endDate), updated: this.timeAgo(p.endDate) }))
        .sort((a, b) => b.latitude - a.latitude);
    },
    shouldLoad() {
      return this.$gui.isMenuOpen && this.dashboardId != null ? this.dashboardId : null;
    },
  },
  watch: {
    shouldLoad: {
      immediate: true,
      handler(dashboardId) {
        if (dashboardId) this.load();
      },
    },
  },
}
</script>


<style scoped>
.dashboard-section-text {
  font-size: 0.7rem;
  margin: 10px 0px 5px 10px;
  color: var(--lightBlue);
}

.platform-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px 4px;
}

/* Same 8px inset as the menu's other dividers - here it comes from the
   list's own padding - with some room above it */
.platform-list-divider {
  margin: 12px 0;
}

.platform-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
}
.platform-row:hover {
  background: rgba(255, 255, 255, 0.14);
}
.platform-row-selected {
  background: rgba(var(--redRGB), 0.5);
}

.platform-row-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  white-space: nowrap;
}

.platform-name {
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
}

.platform-id {
  opacity: 0.6;
  font-size: 0.7rem;
}

.platform-updated {
  margin-left: auto;
  opacity: 0.6;
  font-size: 0.7rem;
}

.platform-row-data {
  display: flex;
  flex-direction: row;
  gap: 4px;
  overflow: hidden;
  white-space: nowrap;
  min-height: 18px;
  align-items: center;
  padding-left: 13px;
}

.platform-reading {
  flex-shrink: 0;
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.15);
  color: black;
  text-shadow: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

/* No colour scale (the valid points): stays on the dark menu */
.platform-reading:not([style*="background"]) {
  color: white;
}

.platform-no-data {
  font-size: 0.7rem;
  opacity: 0.4;
}

.platform-loading {
  width: 10px;
  height: 10px;
  border-width: 2px;
}

.platform-pending {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  opacity: 0.7;
}

/* BUOY TABLE: name column takes what is left, four value columns of equal width */
.buoy-table {
  --buoy-columns: minmax(0, 1fr) repeat(4, 54px);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.buoy-table-header,
.buoy-table-row {
  display: grid;
  grid-template-columns: var(--buoy-columns);
  column-gap: 3px;
  align-items: center;
}

.buoy-table-header {
  padding: 10px 8px 2px;
}

/* Sits at the bottom of the header row, level with the units */
.buoy-table-title {
  margin: 0;
  align-self: end;
}

.buoy-column-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.7rem;
  line-height: 1.1;
  color: var(--lightBlue);
}

/* Like every unit in the app: quieter than its label, underlined where a
   click switches it (GUIManager.cycleUnit, app-wide) */
.buoy-column-unit {
  font-size: 0.65rem;
  font-style: italic;
  opacity: 0.8;
}
.buoy-column-unit.clickable {
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.buoy-table-row {
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
}
.buoy-table-row:hover {
  background: rgba(255, 255, 255, 0.14);
}
.buoy-table-row.platform-row-selected {
  background: rgba(var(--redRGB), 0.5);
}

.buoy-name-cell {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.buoy-subline {
  font-size: 0.65rem;
  opacity: 0.6;
  padding-left: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* A cell with no colour scale behind it stays on the dark menu */
.buoy-cell {
  height: 22px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 0.7rem;
  font-weight: bold;
  color: black;
  text-shadow: none;
  background: rgba(255, 255, 255, 0.08);
}

.buoy-cell .fa {
  font-size: 0.6rem;
}

.buoy-cell-empty {
  color: white;
  font-weight: normal;
  opacity: 0.35;
}
</style>
