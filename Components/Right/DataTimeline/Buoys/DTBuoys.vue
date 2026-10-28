<template>
  <!-- The Buoys dashboard's bottom section: the selected buoy, in one of four
       views. General: the main variables. By variable ▸: one group's every
       variable. By sensor ▸: one instrument's every variable. Compare ▸: the
       buoy against the models (DTBuoysCompare). -->
  <template v-if="buoyId">
    <DTBuoysCompare v-if="mode === 'compare'" :buoyId="buoyId" :group="compareGroup"></DTBuoysCompare>
    <DTLayout v-else :variables="rowVariables" :interval-options="intervalOptions"
      :selected-var="null" @var-click="() => {}">
      <template #grid>
        <DTTimelineGrid v-slot="{ cells }">
          <tr v-for="row in rows" :key="row.key">
            <td v-for="(cell, index) in cells" :key="index" class="value-cell clickable"
              :class="{ 'cell-selected': index === selectedIndex }"
              :style="{ background: cellColor(row, index) }"
              :title="cellTitle(row, cell, index)" @click="cellClicked(index, cell)">
              <template v-if="binOf(row, index)?.value != undefined">
                <i v-if="arrowOf(row, index) != undefined" class="fa-solid fa-location-arrow cell-arrow"
                  :style="{ transform: `rotate(${arrowOf(row, index) - 45}deg)` }"></i>
                <span class="cell-value">{{ cellText(row, index) }}</span>
              </template>
            </td>
          </tr>
        </DTTimelineGrid>
      </template>
    </DTLayout>
  </template>
  <div v-else class="horizontal buoys-placeholder">
    <span>{{ $t('Click a buoy on the map or in the list') }}</span>
  </div>

  <!-- Bottom options: the four views; a ▸ view opens its choices below -->
  <div class="horizontal wrap button-group bottom-bar">
    <button v-for="option in modes" :key="option.id" class="clickable"
      :class="{ 'selectedOption': mode === option.id }" @click="setMode(option.id)">
      <span>{{ $t(option.label) }}<template v-if="option.picks"> ▸</template></span>
    </button>
    <div v-if="choices.length" class="horizontal wrap button-group buoys-choices">
      <button v-for="choice in choices" :key="choice.id" class="clickable"
        :class="{ 'selectedOption': choice.id === group }" @click="setGroup(choice.id)"
        :title="choice.title"><span>{{ $t(choice.label) }}</span></button>
    </div>
  </div>
</template>


<script>
import DTLayout from '../Shared/DTLayout.vue';
import DTTimelineGrid from '../Shared/DTTimelineGrid.vue';
import DTBuoysCompare from './DTBuoysCompare.vue';

// A cell is an average: a whole day in one would flatten a sea breeze into
// nothing - hence 12 h at the coarsest (as All platforms' buoys)
const INTERVAL_OPTIONS = [
  { label: '12 hours', minutes: 720 },
  { label: '3 hours',  minutes: 180 },
  { label: 'Hourly',   minutes: 60  },
];
const MODES = [
  { id: 'general', label: 'General' },
  { id: 'variable', label: 'By variable', picks: true },
  { id: 'sensor', label: 'By sensor', picks: true },
  { id: 'compare', label: 'Compare', picks: true },
];
// A heading that goes with a magnitude, for a sensor's rows (By sensor):
// the arrow on the magnitude's row rather than a row of degrees
const DIRECTION_OF = { WSPD: 'WDIR', GSPD: 'GDIR', VHM0: 'VMDR', VZMX: 'VPED', HCSP: 'HCDT', VSWH: 'VSWD', VMWH: 'VMWD' };
// Directions reported as where they come FROM (wind, waves) - not currents
const FROM_DIRECTIONS = new Set(['WDIR', 'GDIR', 'VMDR', 'VPED', 'VSWD', 'VMWD']);

// The Buoys dashboard's timeline for the selected buoy (GUIManager.selectedPlatform),
// in the view GUIManager.buoysView says. Data from DPBuoys - every code the
// views can show, for this one buoy over the window, in one go (the block
// cache keeps it); a sensor's own readings from DPBuoys.getSensorData.
export default {
  name: "DTBuoys",
  // New readings while the page is open (DPBuoys.refresh)
  mixins: [window.dataProductMixin({ buoys: 'onBuoysChanged' })],
  created() {
    this.load();
  },
  data() {
    return {
      buoy: null,        // the merged buoy (DPBuoys.loadBuoys), for its sensors
      values: {},        // { code: { '<ISO>': point } } - the buoy's readings
      sensorValues: {},  // the same, of the sensor picked (By sensor)
      sensorCodes: [],   // what that sensor publishes
      selectedIndex: -1, // the cell clicked
    }
  },
  methods: {
    async load({ keep = false } = {}) {
      const request = (this.request ?? 0) + 1;
      this.request = request;
      const id = this.buoyId;
      if (!keep) { this.values = {}; this.sensorValues = {}; this.selectedIndex = -1; }
      if (!id) { this.buoy = null; return; }
      const start = this.$gui.timelineStartDate, end = this.$gui.timelineEndDate;
      const buoys = this.$dataService.buoys;
      // What the cache already holds first, so the rows paint at once
      const cached = buoys.readVariablesData(this.allCodes, start, end).find(result => result.buoyId === id);
      if (cached && !keep) this.values = window.buoyCells.byCode(cached.data);
      buoys.loadBuoys().then(list => {
        if (request === this.request) this.buoy = list.find(b => b.id === id) ?? null;
      }).catch(() => {});
      try {
        const result = await buoys.getBuoyDetailData(id, this.allCodes, start, end);
        if (request === this.request) this.values = window.buoyCells.byCode(result.data);
      } catch (error) {
        console.error(`Buoys timeline: could not load '${id}':`, error);
      }
      if (this.mode === 'sensor') this.loadSensor({ keep });
    },
    // One sensor's own readings (By sensor)
    async loadSensor({ keep = false } = {}) {
      const id = this.buoyId, sensorId = this.group;
      if (!id || !sensorId) return;
      const request = (this.sensorRequest ?? 0) + 1;
      this.sensorRequest = request;
      if (!keep) { this.sensorValues = {}; this.sensorCodes = []; }
      try {
        const result = await this.$dataService.buoys.getSensorData(id, sensorId, this.$gui.timelineStartDate, this.$gui.timelineEndDate);
        if (request !== this.sensorRequest) return;
        this.sensorCodes = result.codes;
        this.sensorValues = window.buoyCells.byCode(result.data);
      } catch (error) {
        console.error(`Buoys timeline: could not load sensor '${sensorId}' of '${id}':`, error);
      }
    },
    // New readings for this buoy: its rows again, in place
    onBuoysChanged({ buoys = [] } = {}) {
      if (buoys.includes(this.buoyId)) this.load({ keep: true });
    },
    setMode(mode) {
      const firstChoice = {
        variable: this.$gui.buoyDetailGroups[0]?.id,
        sensor: this.sensors[0]?.id,
        compare: this.$gui.buoyCompareGroups[0]?.id,
      }[mode];
      // A ▸ view keeps its last choice when it is one of its own
      const keepGroup = this.$gui.buoysView?.mode === mode;
      this.$gui.buoysView = mode === 'general' ? null : { mode, group: keepGroup ? this.group : firstChoice };
    },
    setGroup(group) {
      this.$gui.buoysView = { mode: this.mode, group };
    },
    binOf(row, index) {
      return this.binned[row.key]?.[index];
    },
    arrowOf(row, index) {
      return window.buoyCells.arrowBearing(this.binOf(row, index)?.direction, row.fromDirection);
    },
    cellText(row, index) {
      const unit = this.$gui.unitFor(row.code);
      return unit.toDisplay(this.binOf(row, index).value).toFixed(unit.decimals);
    },
    cellColor(row, index) {
      const bin = this.binOf(row, index);
      if (bin?.value == undefined) return 'transparent';
      return this.$gui.colorFor(row.code, bin.value, row.range) ?? 'rgba(255, 255, 255, 0.5)';
    },
    cellTitle(row, cell, index) {
      const bin = this.binOf(row, index);
      if (bin?.value == undefined) return `${row.name}: ${this.$t('No data available')}`;
      const unit = this.$gui.unitFor(row.code);
      const heading = bin.direction == undefined ? '' : ` · ${bin.direction.toFixed(0)}º`;
      const from = (bin.from ?? []).map(({ sensor, instrument, source }) => `Sensor: ${sensor}${instrument ? ` (${instrument})` : ''} \nSource: ${source}`);
      return [cell.toISOString(), `${row.name}: ${unit.toDisplay(bin.value).toFixed(unit.decimals)} ${unit.unit}${heading}`, ...from].join('\n');
    },
    // The cell's hour on the time handle (the map's chips follow it) and the
    // buoy's every value in it on the detail panel - the shape All
    // platforms' buoys hand it (see DTAPBuoys.buoyClicked)
    cellClicked(index, cell) {
      const stepMs = this.$gui.timelineEffectiveIntervalMinutes * 60000;
      this.selectedIndex = index;
      this.$gui.selectedTime = new Date(cell.getTime() + stepMs / 2);
      const platform = { stationId: this.buoyId, date: cell, from: {}, raw: {} };
      const variables = [...this.$gui.buoyVariables, ...this.$gui.buoyDetailVariables];
      variables.forEach(variable => {
        const [bin] = window.buoyCells.binVariable(this.values, variable, [cell], cell.getTime(), stepMs, this.$gui.rangeFor(variable.code));
        if (bin?.value != undefined) platform[variable.code] = bin.value;
        if (variable.directionCode && bin?.direction != undefined) platform[variable.directionCode] = bin.direction;
        if (bin?.from?.length) platform.from[variable.code] = bin.from;
        Object.assign(platform.raw, bin?.raw);
      });
      this.$gui.selectedPlatform = platform;
      this.$gui.isPlatformDetailOpen = true;
    },
    // A row for `code`, its title what the variables catalogue says of it
    rowOf(entry) {
      const variable = this.$gui.variableOf(entry.code);
      return {
        ...entry, key: entry.code,
        name: entry.label ?? entry.code,
        range: entry.range ?? this.$gui.rangeFor(entry.code),
        title: [entry.code, variable?.longName, variable?.standardName].filter(Boolean).join('\n'),
      };
    },
  },
  computed: {
    intervalOptions() { return INTERVAL_OPTIONS; },
    modes() { return MODES; },
    buoyId() {
      return this.$gui.selectedPlatform?.stationId ?? null;
    },
    mode() { return this.$gui.buoysView?.mode ?? 'general'; },
    group() { return this.$gui.buoysView?.group; },
    compareGroup() {
      return this.$gui.buoyCompareGroups.find(g => g.id === this.group) ?? this.$gui.buoyCompareGroups[0];
    },
    // Every code a view of this buoy can show - fetched together
    allCodes() {
      const codes = new Set(this.$gui.buoyVariableCodes);
      this.$gui.buoyDetailCodes.forEach(code => codes.add(code));
      this.$gui.buoyDetailGroups.forEach(group => group.rows.forEach(row => [row.code, row.directionCode].filter(Boolean).forEach(code => codes.add(code))));
      return [...codes];
    },
    // What the buoy's sensors publish (the merged buoy)
    publishedCodes() {
      return new Set((this.buoy?.sensors ?? []).flatMap(sensor => Object.keys(sensor.variables ?? {})));
    },
    sensors() {
      return (this.buoy?.sensors ?? []).map(sensor => ({ id: sensor.id, label: sensor.id, title: sensor.instrument ?? '' }));
    },
    // The ▸ view's choices
    choices() {
      if (this.mode === 'variable') return this.$gui.buoyDetailGroups.map(g => ({ id: g.id, label: g.label }));
      if (this.mode === 'sensor') return this.sensors;
      if (this.mode === 'compare') return this.$gui.buoyCompareGroups.map(g => ({ id: g.id, label: g.label }));
      return [];
    },
    rows() {
      if (this.mode === 'general') {
        return this.$gui.buoyVariables.map(variable => this.rowOf(variable));
      }
      if (this.mode === 'variable') {
        const group = this.$gui.buoyDetailGroups.find(g => g.id === this.group) ?? this.$gui.buoyDetailGroups[0];
        // Only what the buoy publishes - once its sensors are known
        return group.rows
          .filter(row => !this.buoy || this.publishedCodes.has(row.code))
          .map(row => this.rowOf({ ...row, label: row.code }));
      }
      if (this.mode === 'sensor') {
        const codes = this.sensorCodes;
        const directions = new Set(codes.filter(code => Object.entries(DIRECTION_OF).some(([magnitude, direction]) => direction === code && codes.includes(magnitude))));
        return codes.filter(code => !directions.has(code)).map(code => {
          const direction = DIRECTION_OF[code] && codes.includes(DIRECTION_OF[code]) ? DIRECTION_OF[code] : undefined;
          return this.rowOf({ code, directionCode: direction, fromDirection: direction ? FROM_DIRECTIONS.has(direction) : FROM_DIRECTIONS.has(code), label: code });
        });
      }
      return [];
    },
    rowVariables() {
      // A group or sensor with nothing this buoy measures says so, rather
      // than an empty table
      if (this.rows.length === 0 && this.buoy)
        return [{ name: this.$t(this.mode === 'sensor' && !this.sensorCodes.length ? 'Loading' : 'Not measured by this buoy') }];
      return this.rows.map(row => ({
        name: row.name, title: row.title, code: row.code,
        unit: this.$gui.unitFor(row.code).unit,
      }));
    },
    cells() {
      return window.buoyCells.cellsOf(this.$gui.timelineStartDate, this.$gui.timelineEndDate, this.$gui.timelineEffectiveIntervalMinutes * 60000);
    },
    // { rowKey: [bin per cell] } - the buoy's readings, or the sensor's
    binned() {
      const cells = this.cells;
      if (!cells.length) return {};
      const stepMs = this.$gui.timelineEffectiveIntervalMinutes * 60000;
      const values = this.mode === 'sensor' ? this.sensorValues : this.values;
      const binned = {};
      this.rows.forEach(row => {
        binned[row.key] = window.buoyCells.binVariable(values, row, cells, cells[0].getTime(), stepMs, row.range);
      });
      return binned;
    },
    // What a reload depends on: the buoy and the window
    loadKey() {
      return `${this.buoyId}|${this.$gui.timelineStartDate.getTime()}|${this.$gui.timelineEndDate.getTime()}`;
    },
  },
  watch: {
    loadKey() { this.load(); },
    // A sensor picked (By sensor): its readings
    group() { if (this.mode === 'sensor') this.loadSensor(); },
    mode(mode) { if (mode === 'sensor') this.loadSensor(); },
    '$gui.timelineEffectiveIntervalMinutes'() { this.selectedIndex = -1; },
    '$gui.isPlatformDetailOpen'(open) { if (!open) this.selectedIndex = -1; },
  },
  components: { DTLayout, DTTimelineGrid, DTBuoysCompare },
}
</script>


<style scoped>
.value-cell {
  padding: 0;
  height: 23px;
  text-align: center;
  white-space: nowrap;
  font-size: 0.65rem;
  color: #222;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.cell-value {
  color: #222;
  text-shadow: none;
}
.cell-arrow {
  font-size: 0.55rem;
  margin-right: 2px;
  color: #222;
  text-shadow: none;
}
.cell-selected {
  outline: 2px solid var(--red);
  outline-offset: -2px;
}
.buoys-placeholder {
  width: 100vw;
  height: 90px;
  align-items: center;
  justify-content: center;
  background: var(--lightBlue);
  font-size: small;
}
.bottom-bar {
  border-top: 1px white solid;
  background: var(--blue);
}
.bottom-bar > * {
  padding-left: 10px;
  font-size: small;
}
/* A ▸ view's choices, on their own row under the views */
.buoys-choices {
  width: 100%;
  padding: 2px 0 2px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.3);
}
.buoys-choices > button {
  font-size: small;
}
</style>
