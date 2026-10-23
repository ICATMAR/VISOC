<template>
  <!-- One data point of the HF radars, hour by hour: a grid point of the
       totals (velocity, its errors, GDOP, QC...) or one radial bin of a
       station (RDVA, its quality measures, QC). The sea water velocity only,
       until the technical table is asked for: then every row the dataset
       holds; a name tells its ERDDAP metadata on hover. -->
  <DTLayout v-if="point" :variables="rowVariables" :interval-options="intervalOptions">
    <template #grid>
      <DTTimelineGrid v-slot="{ cells }">
        <template v-for="(row, rowIndex) in shownRows" :key="row.key">
        <tr>
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
        <!-- Under the sea water velocity: the technical table's toggle, kept
             in the middle of the visible timeline however it is dragged (a
             sticky box as wide as the timeline's view; see visibleWidth) -->
        <tr v-if="rowIndex === 0 && hasTechnical" class="toggle-row">
          <td :colspan="cells.length">
            <div class="toggle-sticky" :style="{ width: visibleWidth ? visibleWidth + 'px' : '100%' }">
              <button class="technical-toggle clickable" @click="$gui.hfrPointShowTechnical = !$gui.hfrPointShowTechnical">
                <i class="fa-solid" :class="$gui.hfrPointShowTechnical ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                {{ $t($gui.hfrPointShowTechnical ? 'Hide technical table' : 'Show technical table') }}
              </button>
            </div>
          </td>
        </tr>
        </template>
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
      visibleWidth: 0, // the timeline's visible width, px (see watchTimelineWidth)
    }
  },
  mounted() {
    this.previousInterval = this.$gui.timelineIntervalMinutes;
    this.$gui.timelineIntervalMinutes = 60;
    this.load();
    this.watchTimelineWidth();
  },
  updated() {
    this.watchTimelineWidth();
  },
  beforeUnmount() {
    this.timelineObserver?.disconnect();
    this.$gui.timelineIntervalMinutes = this.previousInterval;
    this.$gui.hfrDataPointValues = [];
    this.$gui.hfrDataPointOrigin = null;
    this.$gui.hfrDataPointSourceInfo = null;
    this.$gui.hfrPointLoading = false;
  },
  methods: {
    // The width of the timeline's view, kept up to date: what the toggle's
    // sticky box spans, so the button sits in its middle
    watchTimelineWidth() {
      const scroller = this.$el?.querySelector?.('.table-scroll-container');
      if (!scroller || scroller === this.timelineScroller) return;
      this.timelineObserver?.disconnect();
      this.timelineScroller = scroller;
      this.timelineObserver = new ResizeObserver(() => { this.visibleWidth = scroller.clientWidth; });
      this.timelineObserver.observe(scroller);
    },
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
      // The hours no ERDDAP has - or only the static files, which come after
      // GitHub (see the catalogue's order)
      const fromStatic = key => s.origins?.[key]?.source === 'Static files';
      const todo = hours.filter(key => s.data[velocityName]?.[key] == undefined || fromStatic(key)).slice(-(p.kind === 'radial' ? GITHUB_FILL_RADIAL_HOURS : GITHUB_FILL_HOURS));
      // The files' values go under whatever this series calls the same
      // quantity (EWCT is ICATMAR's ERDDAP's u)
      const nameOf = name => p.kind === 'radial' ? name : this.$dataService.hfrtotals.seriesName(s, name);
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
        // A static file's hour: nothing of it left
        if (fromStatic(key)) Object.values(s.data).forEach(values => { delete values[key]; });
        Object.entries(found.values).forEach(([name, value]) => {
          const target = nameOf(name);
          if (s.data[target]) s.data[target][key] = value;
        });
        (s.origins ??= {})[key] = { ...found.origin, source: 'GitHub', cell: found.cell };
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
      this.$gui.hfrDataPointValues = !this.series || index < 0 ? [] : this.shownRows.map(row => {
        const value = this.binned[row.key]?.[index];
        return {
          label: row.name, value: this.format(row, value), missing: value == undefined, title: this.metadataTitle(row),
          speed: row.kind === 'velocity' ? value?.speed : undefined, direction: row.kind === 'velocity' ? value?.direction : undefined,
          flag: row.kind === 'qc' ? value : undefined,
        };
      });
      // Where the selected hour came from: its own origin (sources fill the
      // series hour by hour - ICATMAR's ERDDAP, the EU HFR Node, GitHub, the
      // static files), or the series' ERDDAP dataset
      const s = this.series;
      const key = index >= 0 && index < this.cells.length ? new Date(this.cells[index] + 3600000).toISOString() : null;
      const hourOrigin = key && s?.origins?.[key];
      // An hour with no value anywhere has no source to name
      const hasValue = index >= 0 && this.rows.some(row => this.binned[row.key]?.[index] != undefined);
      // `source`: the data source's own label, for the detail's grid (see
      // DPHFRTotals.getGridPoints)
      const ownLabel = source => source === 'EU HFR Node' ? 'EU HFR Node ERDDAP' : source;
      const origin = !hasValue ? null : hourOrigin ? { ...hourOrigin, label: hourOrigin.source === 'EU HFR Node' ? ownLabel(hourOrigin.source) : hourOrigin.label } : s?.dataset ? {
        label: ownLabel(s.source), source: s.source, dataset: s.dataset, cell: s.cell,
        url: `${s.source === 'ICATMAR ERDDAP' ? 'https://erddap.icatmar.cat' : 'https://erddap.hfrnode.eu'}/erddap/info/${s.dataset}/index.html`,
      } : null;
      // The dataset or file itself, before the cell is written into it below
      if (origin) origin.datasetId = origin.dataset;
      // Where on its grid. No distance to the point: the point is snapped to
      // the grid, so it would always read 0
      if (origin?.cell && this.point) {
        origin.dataset = `${origin.dataset} · ${this.$t('cell')} ${Number(origin.cell.latitude).toFixed(4)}º N, ${Number(origin.cell.longitude).toFixed(4)}º E`;
      }
      this.$gui.hfrDataPointOrigin = origin;
      this.describeSource(origin, key);
    },
    // A radial bin's range and bearing from its antenna, as info panel rows
    radialRows(p) {
      const geometry = window.radialRangeBearing(p);
      if (!geometry) return [];
      const note = geometry.computed ? ` (${this.$t('from the station position')})` : '';
      return [
        // One decimal at any range - the bins are ~1.7 km apart
        { label: 'Range', value: `${geometry.range.toFixed(1)} km`, amount: { code: 'HDIST', value: geometry.range, decimals: 1 } },
        { label: 'Bearing', value: `${Math.round(geometry.bearing)}º${note}` },
        // Its range cell (or range ring): how many range resolutions out from
        // the antenna it is - a .ruv's SPRC
        ...(geometry.rangeCell != undefined ? [{ label: 'Range cell', value: `R${geometry.rangeCell}` }] : []),
      ];
    },
    // The selected hour's source, described in the info panel
    // (GUIManager.hfrDataPointSourceInfo): ICATMAR's GitHub file - with what
    // its header says - or the ERDDAP dataset - with its metadata. Sources
    // process the same radars each their own way, so it matters which one
    // the hour's values are from. Redone only when the source changes.
    async describeSource(origin, hourKey) {
      const p = this.point;
      if (!origin || !p) {
        this.describedKey = null;
        this.$gui.hfrDataPointSourceInfo = null;
        return;
      }
      const fromGithub = origin.source === 'GitHub';
      const isRadial = p.kind === 'radial';
      // A GitHub hour is its own file; an ERDDAP dataset is the same for every hour
      const id = `${this.pointKey}|${origin.source}|${origin.datasetId}|${fromGithub || origin.source === 'Static files' ? hourKey : ''}`;
      if (id === this.describedKey) {
        // Same source: only "This hour" follows the hour
        const info = this.$gui.hfrDataPointSourceInfo;
        if (info) this.$gui.hfrDataPointSourceInfo = { ...info, rows: info.rows.map(r => r.id === 'thisHour' ? this.thisHourRow(origin) : r) };
        return;
      }
      this.describedKey = id;
      const network = String(p.network ?? '').replace(/^HFR-/, '');
      const cell = origin.cell ? `${Number(origin.cell.latitude).toFixed(4)}º N, ${Number(origin.cell.longitude).toFixed(4)}º E` : `${p.lat.toFixed(4)}º N, ${p.lon.toFixed(4)}º E`;
      const base = {
        key: id,
        title: fromGithub ? 'ICATMAR GitHub' : origin.label,
        subtitle: network ? `${this.$t('Network')} ${network}` : undefined,
        rows: [
          this.thisHourRow(origin),
          { label: 'Processing', value: this.$t(origin.source !== 'EU HFR Node'
            ? "ICATMAR's own processing of its radars"
            : "The EU HFR Node's processing of the network's radars"), long: true },
          ...(isRadial
            ? [
              { label: 'Radial bin', value: `${p.station} · ${p.lat.toFixed(4)}º N, ${p.lon.toFixed(4)}º E` },
              // Range (distance from the antenna) in the unit picked for
              // horizontal distances (clicked to switch it - see
              // DTInfoSection), and bearing - the dataset's own, or worked out
              // from the station's position for one gridded in lat/lon
              ...this.radialRows(p),
            ]
            : [{ label: 'Grid cell used', value: cell }]),
          // An HF radar sees the current in the top layer the radar's Bragg
          // waves move with - about λ/8π: 0.9 m for ICATMAR's 13.5 MHz SeaSondes
          { label: 'Depth', value: network === 'ICATMAR'
            ? this.$t('Top ~0.9 m of the water column (13.5 MHz SeaSonde, λ/8π)')
            : this.$t('Top ~1 m of the water column (depends on the radar frequency)') },
        ],
      };
      this.$gui.hfrDataPointSourceInfo = { ...base, loading: true };
      let more = [];
      try {
        if (fromGithub) {
          const hour = new Date(hourKey);
          const header = isRadial
            ? await this.$dataService.hfrstations.getGithubRadialHeader(p.station, hour)
            : await this.$dataService.hfrtotals.getGithubFileHeader(hour);
          more = [
            { label: 'Repository', value: 'ICATMAR/data', url: 'https://github.com/ICATMAR/data' },
            ...window.hfrSourceInfo.fileHeaderRows(header ?? {}),
          ];
        } else {
          const metadata = isRadial
            ? await this.$dataService.hfrstations.getDatasetMetadata(p.network, p.station, origin.datasetId)
            : await this.$dataService.hfrtotals.getDatasetMetadata(p.provider, origin.source, origin.datasetId);
          more = [
            { label: 'Dataset', value: origin.datasetId, url: metadata?.infoUrl ?? origin.url },
            ...window.hfrSourceInfo.metadataRows(metadata ?? {}),
          ];
        }
      } catch (error) {
        console.error('Point view, source description:', error);
      }
      if (this.describedKey !== id) return; // another source meanwhile
      this.$gui.hfrDataPointSourceInfo = { ...base, rows: [...base.rows, ...more], loading: false };
    },
    // "This hour": the file or dataset the selected hour's values came from
    thisHourRow(origin) {
      return { id: 'thisHour', label: 'This hour', value: origin.datasetId ?? origin.label, url: origin.url };
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
    // Whether there is more than the velocity, for the technical table
    hasTechnical() {
      return this.rows.length > 1;
    },
    // The sea water velocity, or with the technical table every row
    shownRows() {
      return this.$gui.hfrPointShowTechnical ? this.rows : this.rows.filter(row => row.kind === 'velocity');
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
      const names = this.shownRows.map(row => ({
        name: row.name, title: this.metadataTitle(row),
        // A speed's unit switches app-wide on a click, as every unit
        unit: row.kind === 'qc' ? '' : this.unitOf(row),
        code: row.kind === 'velocity' || this.isSpeed(row) || this.isSpeedSquared(row) ? 'HCSP' : undefined,
      }));
      // The toggle's row, level with it in the grid
      if (this.hasTechnical) names.splice(1, 0, { name: '', unit: '' });
      return names;
    },
    pointKey() {
      const p = this.point;
      return p ? `${p.kind}|${p.network}|${p.station ?? ''}|${p.lon}|${p.lat}` : null;
    },
  },
  watch: {
    pointKey() { this.load(); },
    // A spinner at the place on the map while its series is on its way
    loading: { immediate: true, handler(loading) { this.$gui.hfrPointLoading = loading; } },
    selectedIndex() { this.publish(); },
    '$gui.hfrPointShowTechnical'() { this.publish(); },
  },
  components: { DTLayout, DTTimelineGrid },
}
</script>


<style scoped>
/* No padding: a row as tall as its name (23px), so names and rows stay level */
.value-cell {
  padding: 0;
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
  padding: 0;
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

/* The technical table's toggle, a row as tall as a name */
.toggle-row td {
  padding: 0;
  height: 23px;
}
/* As wide as the timeline's view and stuck to its left edge: the button in
   its middle stays in the middle of what is visible. Never wider than the
   row (a short timeline) */
.toggle-sticky {
  position: sticky;
  left: 0;
  max-width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.technical-toggle {
  white-space: nowrap;
  padding: 2px 10px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.35);
  color: #123;
  text-shadow: none;
  font-size: 0.7rem;
  line-height: 1.2;
}
.technical-toggle:hover {
  background: rgba(255, 255, 255, 0.6);
}

.point-placeholder {
  width: 100vw;
  height: 90px;
  align-items: center;
  justify-content: center;
  background: var(--lightBlue);
  font-size: small;
}
</style>
