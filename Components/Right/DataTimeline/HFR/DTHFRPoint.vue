<template>
  <!-- One data point of the HF radars, hour by hour: a grid point of the
       totals (velocity, its errors, GDOP, QC...) or one radial bin of a
       station (RDVA, its quality measures, QC). The rows are what the
       dataset holds; a name tells its ERDDAP metadata on hover. -->
  <DTLayout v-if="point" :variables="rowVariables" :interval-options="intervalOptions">
    <template #grid>
      <DTTimelineGrid v-slot="{ cells }">
        <tr v-for="row in rows" :key="row.key">
          <template v-for="(cell, index) in cells" :key="index">
            <!-- The velocity: coloured on the current-speed legend, its arrow -->
            <td v-if="row.kind === 'velocity'" class="value-cell clickable"
              :class="{ 'cell-selected': index === selectedIndex }"
              :style="{ background: velocityAt(row, index) ? $gui.colorFor('HCSP', velocityAt(row, index).speed) : 'transparent' }"
              :title="cellTitle(row, index)" @click="cellClicked(index)">
              <template v-if="velocityAt(row, index)">
                <i v-if="velocityAt(row, index).direction != undefined" class="fa-solid fa-location-arrow cell-arrow"
                  :style="{ transform: `rotate(${velocityAt(row, index).direction - 45}deg)` }"></i>
                <span class="cell-value">{{ number(velocityAt(row, index).speed) }}</span>
              </template>
            </td>
            <!-- A QC flag: its colour (good, bad, or anything else) -->
            <td v-else-if="row.kind === 'qc'" class="flag-cell clickable"
              :class="{ 'cell-selected': index === selectedIndex }"
              :title="cellTitle(row, index)" @click="cellClicked(index)">
              <span v-if="valueAt(row, index) != undefined" class="flag" :class="flagClass(valueAt(row, index))">{{ valueAt(row, index) }}</span>
            </td>
            <!-- Any other measure: its value, in the unit the units column
                 shows (a speed in the app's current-speed unit) -->
            <td v-else class="value-cell measure-cell clickable"
              :class="{ 'cell-selected': index === selectedIndex }"
              :title="cellTitle(row, index)" @click="cellClicked(index)">
              <span class="cell-value" v-if="valueAt(row, index) != undefined">{{ number(row, valueAt(row, index)) }}</span>
            </td>
          </template>
        </tr>
      </DTTimelineGrid>
    </template>
  </DTLayout>
  <div v-else class="horizontal point-placeholder">
    <span>{{ $t('Click on the map to see the nearest HF radar data point, hour by hour') }}</span>
  </div>
</template>


<script>
import DTLayout from '../Shared/DTLayout.vue';
import DTTimelineGrid from '../Shared/DTTimelineGrid.vue';

const roundToHour = time => new Date(Math.floor((time.getTime() + 1800 * 1000) / 3600000) * 3600000);
const INTERVAL_OPTIONS = [{ label: 'Hourly', minutes: 60 }];
// The most hours a data point's table is filled with from ICATMAR's GitHub,
// one file each - the newest (as many as SourceGithubHFR keeps in memory)
const GITHUB_FILL_HOURS = 24;
const GITHUB_FILL_RADIAL_HOURS = 48;
const isQC = name => name === 'QCflag' || name === 'qcflag' || name.endsWith('_QC');
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// The HFR dashboard's Point view (GUIManager.hfrDataPoint): a totals grid
// point from DPHFRTotals.getCellSeries, a radial bin from
// DPHFRStations.getRadialBinSeries. The velocity row first, then the other
// measures, then the QC flags.
export default {
  name: "DTHFRPoint",
  data() {
    return {
      series: null,   // the data point's series (see the top)
      loading: false,
      missing: false, // no series where this data point comes from
    }
  },
  mounted() {
    this.previousInterval = this.$gui.timelineIntervalMinutes;
    this.$gui.timelineIntervalMinutes = 60;
    this.load();
  },
  beforeUnmount() {
    this.$gui.timelineIntervalMinutes = this.previousInterval;
    this.$gui.hfrDataPointValues = [];
    this.$gui.hfrDataPointOrigin = null;
  },
  methods: {
    async load() {
      const request = (this.request ?? 0) + 1;
      this.request = request;
      this.series = null;
      this.missing = false;
      this.publish();
      const p = this.point;
      if (!p) return;
      this.loading = true;
      const start = this.$gui.timelineStartDate, end = this.$gui.timelineEndDate;
      let series;
      try {
        series = p.kind === 'radial'
          ? await this.$dataService.hfrstations.getRadialBinSeries(p.network, p.station, p.axisNames, p.a, p.b, start, end)
          : await this.$dataService.hfrtotals.getCellSeries(p.provider, p.network, p.lon, p.lat, start, end);
      } catch (error) {
        console.error('Point view:', error);
      }
      if (request !== this.request) return;
      this.loading = false;
      // A station or grid only ICATMAR's GitHub has (SCAL): an empty series
      // for its hours to fill in (see fillFromGithub)
      this.series = series ?? (this.githubCovers(p) ? this.emptySeries(p) : null);
      this.missing = !this.series;
      this.githubFilled = false;
      this.publish();
      this.fillFromGithub();
    },
    // Whether ICATMAR's GitHub can have this data point: ICATMAR's totals
    // grid (with ICATMAR as the source), or a radial bin of ICATMAR's stations
    githubCovers(p) {
      if (p.kind === 'radial') return p.axisNames?.[0] === 'RNGE';
      return p.provider === 'ICATMAR' && p.network === 'ICATMAR';
    },
    emptySeries(p) {
      const names = p.kind === 'radial' ? ['RDVA', 'ESPC', 'ETMP', 'MAXV', 'MINV', 'ERSC', 'ERTC', 'SPRC', 'QCflag']
        : ['EWCT', 'NSCT', 'EWCS', 'NSCS', 'CCOV', 'GDOP'];
      return {
        source: 'GitHub', dataset: undefined,
        ...(p.kind === 'radial' ? { velocity: 'RDVA' } : { eastward: 'EWCT', northward: 'NSCT' }),
        variables: names.map(name => ({ name, attributes: {} })),
        data: Object.fromEntries(names.map(name => [name, {}])),
      };
    },
    // The hours the ERDDAPs don't have (the newest, which the map draws from
    // GitHub), filled from ICATMAR's GitHub: the hours its manifest lists for
    // this grid / station, each read from its .tuv / .ruv (the files the maps
    // share) - under the same variables, with the file each came from. Once
    // per data point, the newest GITHUB_FILL_HOURS at most.
    async fillFromGithub() {
      const s = this.series, p = this.point;
      if (!s || !p || !this.githubCovers(p) || this.githubFilled) return;
      this.githubFilled = true;
      const request = this.request;
      const start = this.$gui.timelineStartDate, end = this.$gui.timelineEndDate;
      const velocityName = s.velocity ?? s.eastward;
      let hours = [];
      try {
        hours = p.kind === 'radial'
          ? await this.$dataService.hfrstations.getGithubRadialHours(p.station, start, end)
          : await this.$dataService.hfrtotals.getGithubHours(start, end);
      } catch (error) {
        console.error('Point view, GitHub hours:', error);
      }
      const todo = hours.filter(key => s.data[velocityName]?.[key] == undefined).slice(-(p.kind === 'radial' ? GITHUB_FILL_RADIAL_HOURS : GITHUB_FILL_HOURS));
      // The files' velocity components go under whatever this series calls them
      const rename = { EWCT: s.eastward, NSCT: s.northward };
      await Promise.all(todo.map(async key => {
        let found;
        try {
          const hour = new Date(key);
          found = p.kind === 'radial'
            ? await this.$dataService.hfrstations.getGithubRadialBin(p.station, hour, p.a, p.b)
            : await this.$dataService.hfrtotals.getGithubCell(hour, p.lon, p.lat);
        } catch (error) {
          console.error(`Point view, GitHub ${key}:`, error);
        }
        if (!found || request !== this.request || this.series !== s) return;
        Object.entries(found.values).forEach(([name, value]) => {
          const target = rename[name] ?? name;
          if (s.data[target]) s.data[target][key] = value;
        });
        (s.origins ??= {})[key] = { ...found.origin, cell: found.cell };
      }));
      if (request === this.request) this.publish();
    },
    // A speed in the app's current-speed unit; any other measure as
    // published, with as many decimals as its size needs
    number(rowOrSpeed, value) {
      if (value === undefined) {
        const { decimals, toDisplay } = this.$gui.unitFor('HCSP');
        return toDisplay(rowOrSpeed).toFixed(decimals);
      }
      // The quality measures in a speed unit (ESPC, ETMP, MAXV, EWCS...) are
      // small: up to two decimals more than a current speed gets, where the
      // source gives them - the EU HFR Node publishes 0.1 cm/s, GitHub's
      // files 0.001 cm/s - so no trailing zeros
      const upToTwoMore = shown => String(+shown.toFixed(this.$gui.unitFor('HCSP').decimals + 2));
      if (this.isSpeed(rowOrSpeed)) return upToTwoMore(this.$gui.unitFor('HCSP').toDisplay(value));
      if (this.isSpeedSquared(rowOrSpeed)) {
        // A covariance of the velocity (CCOV): in the speed unit, squared
        const factor = this.$gui.unitFor('HCSP').toDisplay(1);
        return upToTwoMore(value * factor * factor);
      }
      const size = Math.abs(value);
      return value.toFixed(size >= 100 || Number.isInteger(value) ? 0 : size >= 10 ? 1 : size >= 1 ? 2 : 3);
    },
    // A measure in m/s (ESPC, ETMP, MAXV, MINV, EWCS...): shown in the app's
    // current-speed unit, which its units column switches
    isSpeed(row) {
      return /^m ?s-1$|^m\/s$/.test(String(row.attributes?.units ?? '').trim());
    },
    // A measure in m2/s2 (CCOV): a squared speed, shown in the speed unit squared
    isSpeedSquared(row) {
      return /^m2 ?s-2$/.test(String(row.attributes?.units ?? '').trim());
    },
    // A row's unit for the units column ('' for counts and unitless measures)
    unitOf(row) {
      if (row.kind === 'velocity' || this.isSpeed(row)) return this.$gui.unitFor('HCSP').unit;
      if (this.isSpeedSquared(row)) return `(${this.$gui.unitFor('HCSP').unit})²`;
      const units = String(row.attributes?.units ?? '').trim();
      return units === '1' ? '' : units;
    },
    valueAt(row, index) {
      return this.binned[row.key]?.[index];
    },
    velocityAt(row, index) {
      return this.binned[row.key]?.[index];
    },
    flagClass(flag) {
      return flag === 1 ? 'flag-good' : flag === 4 ? 'flag-bad' : flag === 2 ? 'flag-good' : flag === 3 ? 'flag-suspect' : 'flag-other';
    },
    format(row, value) {
      if (value == undefined) return '–';
      if (row.kind === 'velocity') {
        const { unit } = this.$gui.unitFor('HCSP');
        return `${this.number(value.speed)} ${unit}` + (value.direction != undefined ? ` · ${Math.round(value.direction)}º` : '');
      }
      if (row.kind === 'qc') {
        const meaning = this.flagMeaning(row, value);
        return meaning ? `${value} (${meaning})` : String(value);
      }
      const unit = this.unitOf(row);
      return `${this.number(row, value)}${unit ? ` ${unit}` : ''}`;
    },
    flagMeaning(row, value) {
      const values = String(row.attributes?.flag_values ?? '').split(/[\s,]+/).filter(Boolean).map(Number);
      const meanings = String(row.attributes?.flag_meanings ?? '').split(/\s+/).filter(Boolean);
      return meanings[values.indexOf(value)];
    },
    cellTitle(row, index) {
      return `${row.name}: ${this.format(row, this.binned[row.key]?.[index])}`;
    },
    cellClicked(index) {
      this.$gui.selectedTime = new Date(this.cells[index] + 3600000);
      this.$gui.isPlatformDetailOpen = true;
    },
    metadataTitle(row) {
      const a = row.attributes ?? {};
      const lines = [row.name];
      ['long_name', 'standard_name', 'units', 'comment', 'flag_meanings'].forEach(key => {
        if (a[key] != undefined && a[key] !== '') lines.push(`${key}: ${a[key]}`);
      });
      return lines.join('\n');
    },
    // The selected hour's values and their source, for the detail
    publish() {
      const index = this.selectedIndex;
      this.$gui.hfrDataPointValues = !this.series || index < 0 ? [] : this.rows.map(row => {
        const value = this.binned[row.key]?.[index];
        return {
          label: row.name, value: this.format(row, value), missing: value == undefined, title: this.metadataTitle(row),
          speed: row.kind === 'velocity' ? value?.speed : undefined, direction: row.kind === 'velocity' ? value?.direction : undefined,
          flag: row.kind === 'qc' ? value : undefined,
        };
      });
      // Where the selected hour came from: the GitHub file it was filled from,
      // or the series' ERDDAP dataset
      const s = this.series;
      const key = index >= 0 && index < this.cells.length ? new Date(this.cells[index] + 3600000).toISOString() : null;
      const fromGithub = key && s?.origins?.[key];
      // An hour with no value anywhere has no source to name
      const hasValue = index >= 0 && this.rows.some(row => this.binned[row.key]?.[index] != undefined);
      const origin = !hasValue ? null : fromGithub ? { ...fromGithub } : s?.dataset ? {
        label: s.source === 'EU HFR Node' ? 'EU HFR Node ERDDAP' : s.source, dataset: s.dataset, cell: s.cell,
        url: `${s.source === 'ICATMAR ERDDAP' ? 'https://erddap.icatmar.cat' : 'https://erddap.hfrnode.eu'}/erddap/info/${s.dataset}/index.html`,
      } : null;
      // Where on its grid: sources grid the radars differently, so an hour
      // may be read at a cell next to the clicked one
      if (origin?.cell && this.point) {
        const km = haversineKm(this.point.lat, this.point.lon, origin.cell.latitude, origin.cell.longitude);
        origin.dataset = `${origin.dataset} · ${this.$t('cell')} ${Number(origin.cell.latitude).toFixed(4)}º N, ${Number(origin.cell.longitude).toFixed(4)}º E (${km < 0.05 ? '0' : km.toFixed(1)} km)`;
      }
      this.$gui.hfrDataPointOrigin = origin;
    },
  },
  computed: {
    point() { return this.$gui.hfrDataPoint; },
    intervalOptions() { return INTERVAL_OPTIONS; },
    cells() {
      const start = this.$gui.timelineStartDate.getTime();
      const end = this.$gui.timelineEndDate.getTime();
      const cells = [];
      for (let t = start; t < end; t += 3600000) cells.push(t);
      return cells;
    },
    // Velocity first, then the measures, then the QC flags
    rows() {
      const s = this.series;
      if (!s) return [];
      const rows = [];
      const vars = s.variables;
      if (s.velocity) {
        rows.push({ key: 'velocity', name: s.velocity, kind: 'velocity', attributes: vars.find(v => v.name === s.velocity)?.attributes });
      } else if (s.eastward && s.northward) {
        rows.push({ key: 'velocity', name: this.$t('Velocity'), kind: 'velocity',
          attributes: { long_name: `${s.eastward}, ${s.northward}`, units: vars.find(v => v.name === s.eastward)?.attributes?.units } });
      }
      const skip = new Set([s.velocity, s.eastward, s.northward].filter(Boolean));
      vars.filter(v => !skip.has(v.name) && !isQC(v.name)).forEach(v => rows.push({ key: v.name, name: v.name, kind: 'value', attributes: v.attributes }));
      vars.filter(v => !skip.has(v.name) && isQC(v.name)).forEach(v => rows.push({ key: v.name, name: v.name, kind: 'qc', attributes: v.attributes }));
      return rows;
    },
    // Each row's values by column: the hour ENDING at the column's right tick
    binned() {
      const s = this.series;
      if (!s) return {};
      const start = this.$gui.timelineStartDate.getTime();
      const indexOf = key => Math.ceil((new Date(key).getTime() - start) / 3600000) - 1;
      const binned = {};
      this.rows.forEach(row => {
        const values = new Array(this.cells.length);
        if (row.kind === 'velocity' && s.velocity) {
          // A radial: its speed along the radial, the arrow out from the
          // antenna (away) or in (towards)
          Object.entries(s.data[s.velocity] ?? {}).forEach(([key, v]) => {
            const i = indexOf(key);
            if (i >= 0 && i < values.length) values[i] = { speed: Math.abs(v), direction: this.point.direction != undefined ? (v >= 0 ? this.point.direction : (this.point.direction + 180) % 360) : undefined, signed: v };
          });
        } else if (row.kind === 'velocity') {
          Object.entries(s.data[s.eastward] ?? {}).forEach(([key, u]) => {
            const v = s.data[s.northward]?.[key];
            const i = indexOf(key);
            if (v == undefined || i < 0 || i >= values.length) return;
            values[i] = { speed: Math.hypot(u, v), direction: (Math.atan2(u, v) * 180 / Math.PI + 360) % 360 };
          });
        } else {
          Object.entries(s.data[row.name] ?? {}).forEach(([key, v]) => {
            const i = indexOf(key);
            if (i >= 0 && i < values.length) values[i] = v;
          });
        }
        binned[row.key] = values;
      });
      return binned;
    },
    selectedIndex() {
      const hour = roundToHour(new Date(this.$gui.selectedTime)).getTime();
      return Math.round((hour - this.$gui.timelineStartDate.getTime()) / 3600000) - 1;
    },
    rowVariables() {
      if (!this.rows.length)
        return [{ name: this.loading ? this.$t('Loading') : this.missing ? this.$t('No series for this data point') : '', loading: this.loading }];
      return this.rows.map(row => ({
        name: row.name, title: this.metadataTitle(row),
        // A speed's unit switches app-wide on a click, as every unit
        unit: row.kind === 'qc' ? '' : this.unitOf(row),
        code: row.kind === 'velocity' || this.isSpeed(row) || this.isSpeedSquared(row) ? 'HCSP' : undefined,
      }));
    },
    pointKey() {
      const p = this.point;
      return p ? `${p.kind}|${p.network}|${p.station ?? ''}|${p.lon}|${p.lat}` : null;
    },
  },
  watch: {
    pointKey() { this.load(); },
    selectedIndex() { this.publish(); },
  },
  components: { DTLayout, DTTimelineGrid },
}
</script>


<style scoped>
.value-cell {
  text-align: center;
  white-space: nowrap;
  height: 22px;
  font-size: 0.65rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.cell-arrow {
  font-size: 0.55rem;
  margin-right: 2px;
}
.measure-cell {
  color: #222;
}
.cell-selected {
  outline: 2px solid var(--red);
  outline-offset: -2px;
}

.flag-cell {
  text-align: center;
  height: 22px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.flag {
  display: inline-block;
  min-width: 14px;
  padding: 0 3px;
  border-radius: 3px;
  font-size: 0.6rem;
  line-height: 14px;
  color: white;
  text-shadow: none;
}
.flag-good    { background: #4caf50; }
.flag-suspect { background: #ffc107; color: #333; }
.flag-bad     { background: #e53935; }
.flag-other   { background: #9e9e9e; }

.point-placeholder {
  width: 100vw;
  height: 90px;
  align-items: center;
  justify-content: center;
  background: var(--lightBlue);
  font-size: small;
}
</style>
