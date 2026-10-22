<template>
  <!-- One station's measures, hour by hour: how many radials it gave, how
       many each QC test flagged, and the quality measures of its radials.
       The rows are what the station's ERDDAP dataset holds. A row's name
       tells its ERDDAP metadata on hover; its unit column picks what the row
       shows (a QC row's flag, a measure's mean / min / max). -->
  <DTLayout v-if="station" :variables="rowVariables" :interval-options="intervalOptions">
    <template #grid>
      <DTTimelineGrid v-slot="{ cells }">
        <tr v-for="row in rows" :key="row.key">
          <td v-for="(cell, index) in cells" :key="index" class="bar-cell">
            <div class="dt-col clickable" :class="{ 'dt-col-selected': index === selectedIndex }"
              :title="cellTitle(row, index)" @click="cellClicked(index)">
              <div class="bar-inner" :class="{ 'bar-points': row.kind === 'points' }"
                :style="{ height: barHeight(row, index) + '%' }"></div>
              <div class="dt-col-overlay"></div>
            </div>
          </td>
        </tr>
      </DTTimelineGrid>
    </template>
  </DTLayout>
  <div v-else class="horizontal station-placeholder">
    <span>{{ $t('Select a station on the map or in the Network view') }}</span>
  </div>
</template>


<script>
import DTLayout from '../Shared/DTLayout.vue';
import DTTimelineGrid from '../Shared/DTTimelineGrid.vue';

// The hour a time belongs to: 9:30 up to (not including) 10:30 is 10:00
const roundToHour = time => new Date(Math.floor((time.getTime() + 1800 * 1000) / 3600000) * 3600000);

// Hourly only: a bar is one hour, the hour ending at its right tick
const INTERVAL_OPTIONS = [{ label: 'Hourly', minutes: 60 }];
const STATS = ['mean', 'min', 'max'];
const STAT_LABELS = { mean: 'avg', min: 'min', max: 'max' };
// The flag a QC row counts until another is picked: bad data
const DEFAULT_FLAG = 4;
// flag_meanings, shorter for the unit column
const FLAG_SHORT = {
  no_qc_performed: 'no QC', good_data: 'good', probably_good_data: 'prob. good',
  bad_data_that_are_potentially_correctable: 'correctable', bad_data: 'bad',
  value_changed: 'changed', value_below_detection: 'below det.', nominal_value: 'nominal',
  interpolated_value: 'interpolated', missing_value: 'missing',
};

// The HFR dashboard's Station view (see the plan's "HFR bottom views"): the
// selected station's rows from its dataset on the EU HFR Node -
// - Nº points (the same counts the Network view draws);
// - per QC variable, how many radials carry the picked flag;
// - per quality measure (ESPC, ETMP, ERSC...), its hourly mean, min or max.
// A griddap-only station (Puertos del Estado's, other networks') gives Nº
// points and its QCflag; SCAL, on GitHub only, Nº points.
export default {
  name: "DTHFRStation",
  data() {
    return {
      rows: [],   // [{ key, name, kind: 'points'|'qc'|'value', variable, stat, flag, flags, attributes, data, loading }]
      profile: null,
    }
  },
  mounted() {
    this.previousInterval = this.$gui.timelineIntervalMinutes;
    this.$gui.timelineIntervalMinutes = 60;
    this.load();
  },
  beforeUnmount() {
    this.$gui.timelineIntervalMinutes = this.previousInterval;
    this.$gui.hfrStationValues = [];
  },
  methods: {
    async load() {
      const request = (this.request ?? 0) + 1; // another station supersedes this
      this.request = request;
      this.rows = [];
      this.profile = null;
      this.$gui.hfrStationValues = [];
      const station = this.station;
      if (!station) return;
      const { id, network } = station;
      const start = this.$gui.timelineStartDate, end = this.$gui.timelineEndDate;

      const points = { key: 'points', name: 'Nº points', kind: 'points', data: {}, loading: true,
        attributes: { long_name: 'Number of radial vectors in the hour (non-empty RDVA)' } };
      this.rows = [points];
      // The reactive copy, so its data arriving redraws the row
      this.loadPoints(this.rows[0], id, network, start, end, request);

      let profile;
      try {
        profile = await this.$dataService.hfrstations.getStationProfile(network, id);
      } catch (error) {
        console.error(`Station view: no profile for ${id}:`, error);
      }
      if (request !== this.request || !profile) return;
      this.profile = profile;
      const qc = profile.variables.filter(v => v.kind === 'qc')
        // The overall flag first, then each test
        .sort((a, b) => (a.name === 'QCflag' ? -1 : b.name === 'QCflag' ? 1 : 0));
      const values = profile.variables.filter(v => v.kind === 'value');
      this.rows = [
        points,
        ...qc.map(v => ({ key: v.name, name: v.name, kind: 'qc', variable: v.name, attributes: v.attributes,
          flags: this.flagsOf(v.attributes), flag: DEFAULT_FLAG, data: {}, loading: true })),
        ...values.map(v => ({ key: v.name, name: v.name, kind: 'value', variable: v.name, attributes: v.attributes,
          stat: 'mean', data: {}, loading: true })),
      ];
      this.rows.filter(row => row.kind !== 'points').forEach(row => this.loadRow(row, request));
    },
    // Nº points: the Network view's counts - ICATMAR's network with GitHub
    // filling the newest hours, another network as the node publishes it
    async loadPoints(row, id, network, start, end, request) {
      try {
        let promises;
        if (network === 'HFR-ICATMAR') {
          promises = await this.$dataService.hfrstations.getNumberOfValidPointsPerStations(undefined, start, end);
        } else {
          const networks = await this.$dataService.hfrnetwork.getAllNetworks(this.$dataService.hfrstations);
          const group = networks.find(n => this.$dataService.hfrnetwork.networkCode(n) === network);
          promises = group ? this.$dataService.hfrnetwork.getNumberOfValidPointsForEUNetwork(this.$dataService.hfrstations, group, start, end) : [];
        }
        promises.forEach(promise => promise.then(result => {
          if (request !== this.request || result.id !== id) return;
          row.data = result.points ?? {};
          row.loading = false;
          this.publishValues();
        }));
        if (!promises.length) row.loading = false;
      } catch (error) {
        console.error(`Station view: no counts for ${id}:`, error);
        row.loading = false;
      }
    },
    async loadRow(row, request) {
      row.loading = true;
      const stat = row.kind === 'qc' ? 'flags' : row.stat;
      try {
        const data = await this.$dataService.hfrstations.getStationStatistic(this.profile, row.variable, stat,
          this.$gui.timelineStartDate, this.$gui.timelineEndDate);
        if (request !== this.request) return;
        row.data = data;
      } catch (error) {
        console.error(`Station view: ${row.variable} (${stat}):`, error);
        row.data = {};
      }
      row.loading = false;
      this.publishValues();
    },
    // [{ value, label }] from a QC variable's flag_values / flag_meanings
    flagsOf(attributes) {
      const values = String(attributes.flag_values ?? '').split(/[\s,]+/).filter(Boolean).map(Number);
      const meanings = String(attributes.flag_meanings ?? '').split(/\s+/).filter(Boolean);
      return values.map((value, i) => ({ value, meaning: meanings[i] ?? String(value), label: FLAG_SHORT[meanings[i]] ?? meanings[i] ?? String(value) }));
    },
    // The unit column, clicked: the next flag that occurs in the data (any
    // flag the metadata lists, before the data is in), or the next statistic
    cycle(row) {
      if (row.kind === 'qc') {
        const seen = new Set(Object.values(row.data).flatMap(counts => Object.keys(counts).map(Number)));
        const options = row.flags.filter(f => seen.size === 0 || seen.has(f.value)).map(f => f.value);
        const list = options.length ? options : row.flags.map(f => f.value);
        row.flag = list[(list.indexOf(row.flag) + 1) % list.length];
        this.publishValues();
        return;
      }
      if (row.kind === 'value') {
        row.stat = STATS[(STATS.indexOf(row.stat) + 1) % STATS.length];
        this.loadRow(row, this.request);
      }
    },
    // A row's value at a time key, as its unit column says
    valueAt(row, time) {
      const entry = row.data[time];
      if (entry == undefined) return undefined;
      return row.kind === 'qc' ? (entry[row.flag] ?? 0) : entry;
    },
    // A row's values by column: the hour ENDING at the column's right tick
    binned(row) {
      const start = this.$gui.timelineStartDate.getTime();
      const values = new Array(this.cells.length);
      Object.keys(row.data).forEach(time => {
        const index = Math.ceil((new Date(time).getTime() - start) / 3600000) - 1;
        if (index >= 0 && index < values.length) values[index] = this.valueAt(row, time);
      });
      return values;
    },
    barHeight(row, index) {
      const values = this.binnedRows[row.key] ?? [];
      // By magnitude: some measures run negative (MAXV, the most negative
      // radial velocity in the hour)
      const value = values[index];
      if (value == undefined) return 0;
      const max = Math.max(...values.filter(v => v != undefined).map(Math.abs));
      return max > 0 ? Math.abs(value) / max * 100 : 0;
    },
    format(row, value) {
      if (value == undefined) return '–';
      if (row.kind !== 'value') return String(Math.round(value));
      const units = row.attributes.units && row.attributes.units !== '1' ? ` ${row.attributes.units}` : '';
      return (Math.abs(value) < 10 ? value.toFixed(3) : value.toFixed(1)) + units;
    },
    rowLabel(row) {
      if (row.kind === 'qc') return `${row.name} (${this.flagLabel(row)})`;
      if (row.kind === 'value') return `${row.name} (${STAT_LABELS[row.stat]})`;
      return this.$t(row.name);
    },
    flagLabel(row) {
      return row.flags.find(f => f.value === row.flag)?.label ?? String(row.flag);
    },
    cellTitle(row, index) {
      const value = this.binnedRows[row.key]?.[index];
      return `${this.rowLabel(row)}: ${this.format(row, value)}`;
    },
    // A bar picks its hour - the hour it ends at - for the map, the detail
    // and every view
    cellClicked(index) {
      this.$gui.selectedTime = new Date(this.cells[index] + 3600000);
      this.$gui.isPlatformDetailOpen = true;
    },
    // The selected hour's value of every row, for the station's detail, and
    // where they came from
    publishValues() {
      const index = this.selectedIndex;
      this.$gui.hfrStationValues = index < 0 ? [] : this.rows.map(row => {
        const value = this.binnedRows[row.key]?.[index];
        return { label: this.rowLabel(row), value: this.format(row, value), title: this.metadataTitle(row), missing: value == undefined };
      });
      const selection = this.$gui.selectedPlatform;
      if (!selection || index < 0) return;
      const date = new Date(this.cells[index] + 3600000);
      const origin = this.profile ? { label: 'EU HFR Node ERDDAP', dataset: this.profile.dataset,
        url: `https://erddap.hfrnode.eu/erddap/info/${this.profile.dataset}/index.html` } : selection.origin;
      if (selection.date?.getTime() !== date.getTime() || selection.origin?.dataset !== origin?.dataset)
        this.$gui.selectedPlatform = { ...selection, date, origin };
    },
    // A row's ERDDAP metadata, for its name's hover
    metadataTitle(row) {
      const a = row.attributes ?? {};
      const lines = [row.kind === 'points' ? this.$t(row.name) : row.name];
      ['long_name', 'standard_name', 'units', 'comment'].forEach(key => {
        if (a[key] != undefined && a[key] !== '') lines.push(`${key}: ${a[key]}`);
      });
      if (row.kind === 'qc' && row.flags.length) lines.push(`flags: ${row.flags.map(f => `${f.value} ${f.meaning}`).join(', ')}`);
      return lines.join('\n');
    },
  },
  computed: {
    // The station picked (map, menu, Network view) - not a buoy or drifter,
    // and not a network's TOTALS
    station() {
      const selection = this.$gui.selectedPlatform;
      if (!selection?.stationId || selection.kind || selection.stationId === 'TOTALS') return null;
      return { id: selection.stationId, network: selection.network ?? 'HFR-ICATMAR' };
    },
    stationKey() {
      return this.station ? `${this.station.network}:${this.station.id}` : null;
    },
    intervalOptions() { return INTERVAL_OPTIONS; },
    cells() {
      const start = this.$gui.timelineStartDate.getTime();
      const end = this.$gui.timelineEndDate.getTime();
      const cells = [];
      for (let t = start; t < end; t += 3600000) cells.push(t);
      return cells;
    },
    binnedRows() {
      return Object.fromEntries(this.rows.map(row => [row.key, this.binned(row)]));
    },
    // The column ending at the hour the map shows
    selectedIndex() {
      const hour = roundToHour(new Date(this.$gui.selectedTime)).getTime();
      return Math.round((hour - this.$gui.timelineStartDate.getTime()) / 3600000) - 1;
    },
    rowVariables() {
      return this.rows.map(row => ({
        name: row.name,
        title: this.metadataTitle(row),
        unit: row.kind === 'qc' ? this.flagLabel(row) : row.kind === 'value' ? STAT_LABELS[row.stat] : '',
        unitTitle: row.kind === 'qc' ? this.$t('Click to count another flag') : row.kind === 'value' ? this.$t('Click for mean, min or max') : '',
        onUnitClick: row.kind === 'points' ? undefined : () => this.cycle(row),
        loading: row.loading,
      }));
    },
  },
  watch: {
    stationKey() { this.load(); },
    selectedIndex() { this.publishValues(); },
  },
  components: { DTLayout, DTTimelineGrid },
}
</script>


<style scoped>
.bar-cell {
  padding: 0;
  vertical-align: bottom;
  height: 22px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.dt-col {
  height: 100%;
  position: relative;
  display: flex;
  align-items: flex-end;
}

.bar-inner {
  width: 90%;
  margin-left: 5%;
  background: var(--blue);
  border-radius: 2px 2px 0 0;
}
.bar-points {
  background: var(--lightBlue);
}

.station-placeholder {
  width: 100vw;
  height: 90px;
  align-items: center;
  justify-content: center;
  background: var(--lightBlue);
  font-size: small;
}
</style>
