<template>
  <!-- A source's name, clicked, describes that source in the info panel
       (GUIManager.hfrSourceInfo); the platform's own name brings its panel back -->
  <DTLayout :variables="rowVariables" :interval-options="intervalOptions"
    :selected-var="selectedSourceName" @var-click="sourceClicked">
    <template #grid>
      <DTTimelineGrid v-slot="{ cells }">
        <!-- One row per source - the platform that was clicked, the two HF
             radar providers, the model - one cell per HOUR, the AVERAGE of
             what was measured in it, coloured on the current-speed legend with
             the direction as an arrow (as the buoys timeline draws).
             A cell is the hour ENDING at its right tick: what sits between
             the 4 and the 5 is 5h (see binRow). The selected column is the
             hour the map shows, and the circle arrows and the detail panel
             show that same cell's values. -->
        <tr v-for="row in rows" :key="row.key">
          <td v-for="(cell, index) in cells" :key="index"
            class="value-cell"
            :class="{
              'cell-selected': index === selectedIndex && !row.placeholder,
              'cell-unmeasured': row.placeholder,
              'clickable': !row.placeholder,
            }"
            :style="{ background: cellColor(row, index) }"
            :title="cellTitle(row, index)"
            @click="!row.placeholder && cellClicked(row, index)">
            <template v-if="!row.placeholder && bin(row, index)?.value != undefined">
              <i v-if="bin(row, index).direction != undefined"
                class="fa-solid fa-location-arrow cell-arrow"
                :style="{ transform: `rotate(${bin(row, index).direction - 45}deg)` }"></i>
              <span class="cell-value">{{ number(bin(row, index).value) }}</span>
            </template>
          </td>
        </tr>
      </DTTimelineGrid>
    </template>
  </DTLayout>
</template>


<script>
import DTLayout from '../Shared/DTLayout.vue';
import DTTimelineGrid from '../Shared/DTTimelineGrid.vue';

// The hour a time belongs to: 9:30 up to (not including) 10:30 is 10:00 -
// the same rule the maps and the chips use
const roundToHour = time => new Date(Math.floor((time.getTime() + 1800 * 1000) / 3600000) * 3600000);

// Each compared product's colour on the comparison map (DTHFRPlatformDetail)
const COMPARE_COLORS = { platform: '#ffffff', ICATMAR: '#ff9f43', EU: '#54a0ff', model: '#1dd1a1', 'cmems-med': '#c56cf0', 'cmems-ibi': '#ff6b81' };

// Great-circle distance, km
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

// The most hours a point's table is filled with from ICATMAR's GitHub, one
// .tuv each - the newest (as many as SourceGithubHFR keeps in memory)
const GITHUB_FILL_HOURS = 24;

// Hourly only: a cell is one hour, and the circle arrows and the detail
// panel show exactly what is in it
const INTERVAL_OPTIONS = [{ label: 'Hourly', minutes: 60 }];

// Sea water velocity at one place (GUIManager.hfrPoint), from every source
// there is for it, side by side over the timeline's range: the buoy or drifter
// that was clicked, the HF radars (ICATMAR's own and the EU HFR Node's), and
// the models of the sea surface forecast - ICATMAR's ROMS, CMEMS MEDSEA and
// CMEMS IBI - each in its own row (a row with a `model` is filled with that
// model's series).
//
// Also tells the map what to draw at the point (GUIManager.hfrPointArrows,
// see MapOverlayPoint) and the detail panel what the platform measured
// (hfrPointReading), for the selected hour.
export default {
  name: "DTHFRCompare",
  data() {
    return {
      series: {},   // row key -> [{ time, speed, direction, meta }], every reading
      provenance: {}, // row key -> where its data came from (see describe)
      loading: {},  // row key -> true while its series is on its way
    }
  },
  // New HF radar maps found while the page is open (DPHFRTotals.refresh)
  mixins: [window.dataProductMixin({ hfrtotals: 'onTotalsChanged' })],
  mounted() {
    // Hourly while this view is open; the timeline's own choice is put back
    this.previousInterval = this.$gui.timelineIntervalMinutes;
    this.$gui.timelineIntervalMinutes = 60;
    this.load();
  },
  beforeUnmount() {
    this.$gui.timelineIntervalMinutes = this.previousInterval;
    this.$gui.hfrSourceInfo = null;
    this.$gui.hfrPointArrows = [];
    this.$gui.hfrPointReading = null;
    this.$gui.hfrComparePoints = [];
    this.$gui.hfrPointLoading = false;
  },
  methods: {
    // Every source at once; each row fills in as its own answer lands
    load() {
      const point = this.$gui.hfrPoint;
      if (!point) return;
      const request = (this.request ?? 0) + 1;
      this.request = request;
      const start = this.$gui.timelineStartDate;
      const end = this.$gui.timelineEndDate;
      this.series = {};
      this.provenance = {};
      this.githubFilled = false;
      this.$gui.hfrSourceInfo = null;
      this.loading = Object.fromEntries(this.rows.filter(r => !r.placeholder).map(r => [r.key, true]));
      const done = (key, data, provenance) => {
        if (request !== this.request) return;
        this.series = { ...this.series, [key]: data };
        if (provenance) this.provenance = { ...this.provenance, [key]: provenance };
        this.loading = { ...this.loading, [key]: false };
      };
      const failed = key => error => { console.error(`Compare: ${key}`, error); done(key, {}); };

      if (point.kind === 'buoy') {
        this.$dataService.buoys.getBuoyDetailData(point.id, ['HCSP', 'HCDT'], start, end)
          .then(result => done('platform', this.fromCodes(result.data)))
          .catch(failed('platform'));
      } else if (point.kind === 'drifter') {
        done('platform', this.fromDrifter(point.id));
      }
      ['ICATMAR', 'EU'].forEach(provider => {
        this.$dataService.hfrtotals.getPointSeries(provider, point.lon, point.lat, start, end)
          .then(result => done(provider, Object.values(result.data), { cell: result.cell, cells: result.cells, used: result.used }))
          .catch(failed(provider));
      });
      // Every model on its own, not merged - one call for all of them
      const modelPoint = { id: `hfr:${point.lat.toFixed(4)},${point.lon.toFixed(4)}`, latitude: point.lat, longitude: point.lon };
      const modelRows = this.rows.filter(r => r.model && !r.placeholder);
      this.$dataService.ssforecast.getPointSeriesBySource(modelPoint, start, end)
        .then(result => modelRows.forEach(row => {
          const series = result.series.find(entry => entry.model === row.model);
          done(row.key, this.fromCodes(series?.data), { series: series ? [series] : [] });
        }))
        .catch(error => modelRows.forEach(row => failed(row.key)(error)));
    },
    // New maps (see DPHFRTotals.refresh): the HF radar rows again, and
    // GitHub's newest hours into ICATMAR's - the other rows, the point and the
    // selected cell stay as they are
    onTotalsChanged() {
      const point = this.$gui.hfrPoint;
      if (!point) return;
      const request = this.request;
      const start = this.$gui.timelineStartDate, end = this.$gui.timelineEndDate;
      ['ICATMAR', 'EU'].forEach(provider => {
        this.$dataService.hfrtotals.getPointSeries(provider, point.lon, point.lat, start, end)
          .then(result => {
            if (request !== this.request) return;
            this.series = { ...this.series, [provider]: Object.values(result.data) };
            this.provenance = { ...this.provenance, [provider]: { cell: result.cell, cells: result.cells, used: result.used } };
            if (provider === 'ICATMAR') { this.githubFilled = false; this.fillFromGithub(); }
          })
          .catch(error => console.error(`Compare: ${provider}, refresh`, error));
      });
    },
    // { '<ISO>': { HCSP: { value, ... }, HCDT: { value } } } -> every reading,
    // keeping what it says about itself (sensor, instrument, depth)
    fromCodes(data) {
      return Object.entries(data ?? {})
        .filter(([, codes]) => codes.HCSP?.value != undefined && isFinite(codes.HCSP.value))
        .map(([timestamp, codes]) => ({ time: new Date(timestamp), speed: codes.HCSP.value, direction: codes.HCDT?.value, meta: codes.HCSP }))
        .sort((a, b) => a.time - b.time);
    },
    // Drifters are still mock data (RequestsManager / DriftersMockData)
    fromDrifter(id) {
      const drifter = this.$requests.getDrifterStation(id);
      const meta = { sensor: drifter?.type, depth: drifter ? -drifter.depth : undefined };
      return this.$requests.getDrifterTrajectory(id)
        .filter(point => point.cspd != undefined)
        .map(point => ({ time: new Date(point.t), speed: point.cspd, direction: point.cdir, meta }));
    },
    // A row's value in each cell: the mean speed, and the direction as a
    // vector mean weighted by the speed (averaging 350º and 10º as numbers
    // would give 180º). A cell is the hour ENDING at its right edge - a reading
    // at 4:10 or at 5:00 is 5h - and keeps the readings it was made from.
    binRow(readings) {
      const start = this.$gui.timelineStartDate.getTime();
      const step = this.$gui.timelineEffectiveIntervalMinutes * 60000;
      const bins = this.cells.map(() => ({ readings: [], total: 0, x: 0, y: 0 }));
      (readings ?? []).forEach(reading => {
        const index = Math.ceil((reading.time.getTime() - start) / step) - 1;
        const bin = bins[index];
        if (!bin) return;
        bin.readings.push(reading);
        bin.total += reading.speed;
        if (reading.direction != undefined && isFinite(reading.direction)) {
          bin.x += Math.cos(reading.direction * Math.PI / 180) * reading.speed;
          bin.y += Math.sin(reading.direction * Math.PI / 180) * reading.speed;
        }
      });
      return bins.map(bin => ({
        readings: bin.readings,
        value: bin.readings.length ? bin.total / bin.readings.length : undefined,
        direction: bin.x || bin.y ? (Math.atan2(bin.y, bin.x) * 180 / Math.PI + 360) % 360 : undefined,
      }));
    },
    bin(row, index) {
      return this.binned[row.key]?.[index];
    },
    number(speed) {
      const { decimals, toDisplay } = this.$gui.unitFor('HCSP');
      return toDisplay(speed).toFixed(decimals);
    },
    cellColor(row, index) {
      if (row.placeholder) return undefined;
      const value = this.bin(row, index)?.value;
      return value == undefined ? 'transparent' : this.$gui.colorFor('HCSP', value);
    },
    cellTitle(row, index) {
      if (row.placeholder) return this.$t('Coming soon');
      const bin = this.bin(row, index);
      if (bin?.value == undefined) return this.$t('No data available');
      const { unit } = this.$gui.unitFor('HCSP');
      return `${this.$t(row.name)}: ${this.number(bin.value)} ${unit}`
        + (bin.direction != undefined ? ` · ${Math.round(bin.direction)}º` : '')
        + (bin.readings.length > 1 ? `\n${this.$t('Average of')} ${bin.readings.length} ${this.$t('readings')}` : '');
    },
    // A cell picks the hour the map shows - the hour it ends at - and its row:
    // a source's cell describes that source in the info panel (as its name
    // does), the platform's brings the platform's own panel back
    cellClicked(row, index) {
      this.$gui.selectedTime = new Date(this.cells[index] + this.$gui.timelineEffectiveIntervalMinutes * 60000);
      this.$gui.isPlatformDetailOpen = true;
      if (row.key === 'platform') this.$gui.hfrSourceInfo = null;
      else if (this.$gui.hfrSourceInfo?.key !== row.key) this.describe(row);
    },
    // A name clicked in the names column: that source described in the info
    // panel, or - for the platform - the platform's own panel back
    sourceClicked(variable) {
      const row = this.rows.find(r => r.name === variable.name);
      if (!row || row.key === 'platform') { this.$gui.hfrSourceInfo = null; return; }
      this.describe(row);
    },
    // What is known about a source, shown as rows of label / value. The HF
    // radars' from their ERDDAP datasets' own metadata (NC_GLOBAL); the
    // models' from their forecast series; a source still to come (a
    // `placeholder` row), as such.
    async describe(row) {
      const key = row.key;
      // Hours of the window with a value - not the readings, which can fall
      // outside it (a reading at the start is the hour before the first cell)
      const hours = (this.binned[key] ?? []).filter(bin => bin?.value != undefined).length;
      const window = this.cells.length;
      if (key === 'ICATMAR' || key === 'EU') {
        const provenance = this.provenance[key];
        const used = provenance?.used ?? [];
        const info = {
          key, title: row.name, subtitle: key === 'ICATMAR' ? 'ICATMAR' : 'EU HFR Node',
          loading: true,
          rows: [...this.originRows(row), ...this.hfrBaseRows(key, provenance, hours, window)],
        };
        this.$gui.hfrSourceInfo = info;
        const described = await Promise.all(used.map(entry =>
          this.$dataService.hfrtotals.getDatasetMetadata(key, entry.source, entry.dataset).catch(() => ({}))));
        if (this.$gui.hfrSourceInfo?.key !== key) return; // another source was picked meanwhile
        const metadata = described[0] ?? {};
        this.$gui.hfrSourceInfo = { ...info, loading: false, rows: [
          // "This hour" as it is now - the hour may have moved meanwhile
          ...info.rows.map(r => r.id === 'thisHour' ? { ...r, value: this.thisHourOrigin(row) } : r),
          ...used.map((entry, i) => ({ label: 'Dataset', value: `${entry.dataset} (${entry.source}, ${entry.hours} h)`, url: described[i]?.infoUrl })),
          ...this.metadataRows(metadata),
        ] };
        return;
      }
      if (row.model && this.modelSource(row)?.product) {
        // CMEMS: what the product's STAC metadata said about the dataset read
        const series = this.provenance[key]?.series?.[0];
        const source = this.modelSource(row);
        const dataset = source.datasets?.find(d => d.id === series?.datasets?.[0]);
        const intervals = { PT15M: '15 minutes', PT1H: 'Hourly', P1D: 'Daily', P1M: 'Monthly' };
        const interval = series?.interval ?? source.intervals?.[0];
        this.$gui.hfrSourceInfo = {
          key, title: row.name, subtitle: series?.label ?? source.label,
          rows: [
            ...this.originRows(row),
            { label: 'Product', value: source.product, url: source.src },
            { label: 'Dataset', value: series?.dataset ?? '–', url: source.src },
            { label: 'Model', value: dataset?.metadata?.source ?? source.label },
            this.gridSpacingRow(series?.resolution ?? source.resolution),
            { label: 'Institution', value: 'Copernicus Marine Service (Mercator Ocean International)' },
            { label: 'Produced by', value: dataset?.metadata?.institution ?? '–' },
            { label: 'Time step', value: [this.$t(intervals[interval] ?? interval ?? '–'), series?.statistic ? this.$t(series.statistic) : undefined].filter(Boolean).join(' · ') },
            { label: 'Depth', value: this.$t('Surface (the model\'s top layer)') },
            { label: 'Grid cell used', value: this.formatCell(series?.cell) },
            { label: 'Updated', value: this.formatRun(series?.run?.publishedAt) },
            { label: 'Hours with data', value: `${hours} / ${window}` },
          ],
        };
        return;
      }
      if (row.model) {
        const series = this.provenance[key]?.series?.[0];
        const source = this.modelSource(row);
        const metadata = source?.metadata ?? {};
        this.$gui.hfrSourceInfo = {
          key, title: row.name, subtitle: series?.label ?? source?.label,
          rows: [
            ...this.originRows(row),
            { label: 'Model', value: series?.model ?? source?.model ?? '–' },
            this.gridSpacingRow(series?.resolution ?? source?.resolution),
            { label: 'Institution', value: series?.institution ?? source?.institution ?? '–' },
            { label: 'Depth', value: this.$t('Surface (the model\'s top layer)') },
            { label: 'Grid cell used', value: this.formatCell(series?.cell) },
            { label: 'Run', value: this.formatRun(series?.run) },
            { label: 'Hours with data', value: `${hours} / ${window}` },
            { label: 'Dataset', value: source?.dataset ?? '–', url: source ? `${source.baseUrl}/info/${source.dataset}/index.html` : undefined },
            // What the forecast series already said isn't repeated
            ...this.metadataRows(metadata).filter(r => r.label !== 'Institution' && r.value !== this.formatRun(series?.run)),
          ],
        };
        return;
      }
      // A source still to come
      this.$gui.hfrSourceInfo = {
        key, title: row.name,
        rows: [{ label: 'Status', value: this.$t('Coming soon') }],
      };
    },
    // Where a source's data comes from, first in its panel: the selected
    // hour's origin, and every origin the row draws on - ICATMAR's ERDDAP and
    // the EU HFR Node process the same radars each their own way, so the
    // values differ, and it matters which one an hour is from
    originRows(row) {
      return [
        { id: 'thisHour', label: 'This hour', value: this.thisHourOrigin(row) },
        { label: 'Sources', value: this.sourcesOf(row), long: true },
      ];
    },
    thisHourOrigin(row) {
      const bin = this.bin(row, this.selectedIndex);
      if (!bin?.readings.length) return this.$t('No data');
      if (row.model) {
        const source = this.modelSource(row);
        if (source?.product) return `Copernicus Marine · ${this.provenance[row.key]?.series?.[0]?.dataset ?? source.product}`;
        return `ICATMAR ERDDAP · ${source?.dataset ?? ''}`;
      }
      const used = this.provenance[row.key]?.used ?? [];
      // A reading from GitHub names its own file
      return [...new Set(bin.readings.map(r => [r.source, r.dataset ?? used.find(u => u.source === r.source)?.dataset].filter(Boolean).join(' · ')))]
        .join('; ');
    },
    // Where a row's selected hour came from, as links: the ERDDAP dataset's
    // page, the GitHub file, the model's dataset, the buoy's source
    originLinks(row, bin) {
      if (!bin?.readings?.length) return [];
      if (row.key === 'platform') {
        const origin = this.$dataService.buoys.originOf(bin.readings[0]?.meta?.source);
        return origin ? [origin] : [];
      }
      if (row.model) {
        const source = this.modelSource(row);
        if (source?.product)
          return [{ label: 'Copernicus Marine', dataset: this.provenance[row.key]?.series?.[0]?.dataset ?? source.product, url: source.src }];
        return source ? [{ label: "ICATMAR's ERDDAP", dataset: source.dataset, url: `${source.baseUrl}/info/${source.dataset}/index.html` }] : [];
      }
      const sources = this.$dataService.hfrtotals.mapSources(row.key);
      const links = [];
      bin.readings.forEach(reading => {
        const dataset = reading.dataset ?? this.provenance[row.key]?.used?.find(u => u.source === reading.source)?.dataset;
        let url = reading.url;
        if (!url && dataset) {
          const base = sources.find(s => s.label === reading.source)?.baseUrl;
          if (base) url = `${base}/info/${dataset}/index.html`;
        }
        const label = { 'EU HFR Node': 'EU HFR Node ERDDAP', 'ICATMAR ERDDAP': "ICATMAR's ERDDAP", 'GitHub': 'ICATMAR GitHub' }[reading.source] ?? reading.source;
        if (!links.some(l => l.label === label && l.dataset === dataset)) links.push({ label, dataset, url });
      });
      return links;
    },
    // The sea surface forecast's source a model row reads (see rows)
    modelSource(row) {
      return this.$dataService.ssforecast.sources.find(source => source.model === row.model);
    },
    sourcesOf(row) {
      if (row.model && this.modelSource(row)?.product)
        return `${this.$t('Copernicus Marine Service')}: ${this.modelSource(row).label}, ${this.$t('read from its ARCO Zarr store')}`;
      if (row.model)
        return this.$t('ICATMAR ERDDAP: the ROMS forecast run by ICATMAR');
      const notes = {
        'ICATMAR ERDDAP': this.$t("ICATMAR's ERDDAP (ICATMAR's processing)"),
        'EU HFR Node': this.$t("the EU HFR Node's ERDDAP (the node's processing)"),
        'GitHub': this.$t("ICATMAR's GitHub for the newest hours (ICATMAR's processing)"),
        'Static files': this.$t("the app's own files, when every other source fails"),
      };
      // The ERDDAPs' series, and for ICATMAR the GitHub files of the hours
      // they don't have yet (see fillFromGithub)
      const labels = [...new Set(this.$dataService.hfrtotals.mapSources(row.key)
        .filter(s => typeof s.getPointSeries === 'function' || (row.key === 'ICATMAR' && typeof s.getTotalsCell === 'function'))
        .map(s => s.label))];
      const list = labels.map(label => notes[label] ?? label);
      const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')}${this.$t(' and ')}${list[list.length - 1]}` : list[0];
      const text = labels.length > 1
        ? `${joined} ${this.$t('are used in this data product, in that order, hour by hour. They process the radars each their own way, so their values can differ.')}`
        : `${list[0] ?? '–'}.`;
      return text.charAt(0).toUpperCase() + text.slice(1);
    },
    // What every HF radar row says before its datasets' metadata arrives
    hfrBaseRows(key, provenance, hours, window) {
      return [
        // An HF radar sees the current in the top layer the radar's Bragg
        // waves move with - about λ/8π for a radar wavelength λ: 0.9 m for
        // ICATMAR's 13.5 MHz SeaSondes. Other networks run other frequencies.
        { label: 'Depth', value: key === 'ICATMAR'
          ? this.$t('Top ~0.9 m of the water column (13.5 MHz SeaSonde, λ/8π)')
          : this.$t('Top ~1 m of the water column (depends on the radar frequency)') },
        { label: 'Grid cell used', value: this.formatCell(provenance?.cell) },
        { label: 'Hours with data', value: `${hours} / ${window}` },
      ];
    },
    // The parts of an ERDDAP dataset's NC_GLOBAL worth showing (see
    // hfrSourceInfo.js)
    metadataRows(metadata) {
      return window.hfrSourceInfo.metadataRows(metadata);
    },
    // A model's grid spacing, as the catalogue gives it ('4.2 km', '0.125°'):
    // a distance in km is a measure the user can switch to nautical miles in
    // the panel (see DTInfoSection), anything else is shown as written
    gridSpacingRow(resolution) {
      const km = /^\s*([\d.]+)\s*km\s*$/.exec(resolution ?? '')?.[1];
      return km != undefined
        ? { label: 'Grid spacing', value: resolution, amount: { code: 'HDIST', value: Number(km) } }
        : { label: 'Grid spacing', value: resolution ?? '–' };
    },
    formatCell(cell) {
      if (!cell) return '–';
      return `${Number(cell.latitude).toFixed(3)}º N, ${Number(cell.longitude).toFixed(3)}º E`;
    },
    formatRun(run) {
      if (!run) return '–';
      if (run instanceof Date) return run.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
      if (typeof run === 'object') return Object.values(run).filter(v => v != undefined).map(v => v instanceof Date ? v.toISOString().substring(0, 16) : String(v)).join(' · ');
      return String(run);
    },
    // What the map and the detail panel show for the selected hour: the
    // selected cell itself, so all three always agree - each source's
    // average, and the platform's readings it was made from
    publishSelection() {
      const index = this.selectedIndex;
      this.$gui.hfrPointArrows = this.rows
        .filter(row => !row.placeholder && this.binned[row.key]?.[index]?.value != undefined)
        .map(row => {
          const bin = this.binned[row.key][index];
          return { name: row.circle, code: 'HCSP', speed: bin.value, direction: bin.direction };
        });
      const readings = this.binned.platform?.[index]?.readings ?? [];
      const first = readings[0]?.meta;
      this.$gui.hfrPointReading = readings.length
        ? { sensor: first?.sensor, instrument: first?.instrument, depth: first?.depth, source: first?.source,
            readings: readings.map(r => ({ time: r.time, speed: r.speed, direction: r.direction })) }
        : null;
      this.$gui.hfrComparePoints = this.comparePoints(index);
    },
    // The HFR ICATMAR row's hours its ERDDAPs don't have (the newest ones,
    // which the map draws from GitHub), filled from ICATMAR's GitHub: the
    // hours the manifest lists, each read from its .tuv (the files the map
    // shares) at the cell nearest the point. Once per point, after the row's
    // own series has answered; the newest GITHUB_FILL_HOURS at most.
    async fillFromGithub() {
      const point = this.$gui.hfrPoint;
      if (!point || this.loading.ICATMAR !== false || this.githubFilled) return;
      this.githubFilled = true;
      const request = this.request;
      const start = this.$gui.timelineStartDate, end = this.$gui.timelineEndDate;
      const have = new Set((this.series.ICATMAR ?? []).map(r => roundToHour(r.time).toISOString()));
      let hours = [];
      try {
        hours = await this.$dataService.hfrtotals.getGithubHours(start, end);
      } catch (error) {
        console.error('Compare, GitHub hours:', error);
      }
      const todo = hours.filter(hour => !have.has(hour)).slice(-GITHUB_FILL_HOURS);
      const readings = [];
      await Promise.all(todo.map(async key => {
        try {
          const hour = new Date(key);
          const found = await this.$dataService.hfrtotals.getGithubCell(hour, point.lon, point.lat);
          if (!found || found.values.EWCT == undefined || found.values.NSCT == undefined) return;
          const u = found.values.EWCT, v = found.values.NSCT;
          readings.push({ u, v, speed: Math.hypot(u, v), direction: (Math.atan2(u, v) * 180 / Math.PI + 360) % 360, time: hour,
            source: 'GitHub', dataset: found.origin.dataset, url: found.origin.url, cell: found.cell });
        } catch (error) {
          console.error(`Compare, GitHub ${key}:`, error);
        }
      }));
      if (request !== this.request || !readings.length) return;
      this.series = { ...this.series, ICATMAR: [...(this.series.ICATMAR ?? []), ...readings] };
      const provenance = this.provenance.ICATMAR ?? { used: [] };
      this.provenance = { ...this.provenance, ICATMAR: {
        ...provenance,
        cell: provenance.cell ?? readings[0].cell,
        used: [...(provenance.used ?? []), { source: 'GitHub', dataset: 'ICATMAR/data · L3/tuv (one file per hour)', hours: readings.length }],
      } };
    },
    // Each compared product's grid point nearest the compared point, how far
    // it is, and its value at the column - what the comparison map draws
    comparePoints(index) {
      const point = this.$gui.hfrPoint;
      if (!point) return [];
      return this.rows.filter(row => !row.placeholder).map(row => {
        let cell, cells;
        const bin = this.bin(row, index);
        if (row.key === 'platform') cell = { latitude: point.lat, longitude: point.lon };
        else if (row.model) cell = this.provenance[row.key]?.series?.[0]?.cell;
        // The cell the selected hour was read at - each source has its own
        // grid - or, for an hour with no data, the row's first
        else ({ cell, cells } = bin?.readings?.[0]?.cell ? { cell: bin.readings[0].cell } : (this.provenance[row.key] ?? {}));
        if (!cell) return null;
        const lat = Number(cell.latitude), lon = Number(cell.longitude);
        return {
          key: row.key, name: row.name, color: COMPARE_COLORS[row.key] ?? 'white', lat, lon,
          cells: cells?.map(c => ({ lat: c.latitude, lon: c.longitude, weight: c.weight })),
          distanceKm: haversineKm(point.lat, point.lon, lat, lon),
          speed: bin?.value, direction: bin?.direction,
          origin: row.key === 'platform' ? undefined : this.thisHourOrigin(row),
          origins: this.originLinks(row, bin),
        };
      }).filter(Boolean);
    },
  },
  computed: {
    rows() {
      const point = this.$gui.hfrPoint;
      const rows = [];
      if (point && point.kind !== 'point')
        rows.push({ key: 'platform', name: point.name ?? point.id, circle: `${point.kind === 'buoy' ? 'Buoy' : 'Drifter'} ${point.id}` });
      rows.push(
        { key: 'ICATMAR', name: 'HFR ICATMAR', circle: 'HFR ICATMAR' },
        { key: 'EU', name: 'HFR EU Node', circle: 'HFR EU Node' },
        { key: 'model', name: 'Model ICATMAR', circle: 'Model ROMS ICATMAR', model: 'ROMS' },
        { key: 'cmems-med', name: 'CMEMS MEDSEA', circle: 'CMEMS MEDSEA', model: 'CMEMS-MEDSEA' },
        { key: 'cmems-ibi', name: 'CMEMS IBI', circle: 'CMEMS IBI', model: 'CMEMS-IBI' },
      );
      return rows;
    },
    rowVariables() {
      const unit = this.$gui.unitFor('HCSP').unit;
      return this.rows.map(row => ({ name: row.name, unit: row.placeholder ? '' : unit, code: row.placeholder ? undefined : 'HCSP', loading: !!this.loading[row.key] }));
    },
    // The timeline's columns, as DTTimelineGrid lays them out
    cells() {
      const start = this.$gui.timelineStartDate.getTime();
      const end = this.$gui.timelineEndDate.getTime();
      const step = this.$gui.timelineEffectiveIntervalMinutes * 60000;
      const cells = [];
      for (let t = start; t < end; t += step) cells.push(t);
      return cells;
    },
    binned() {
      const binned = {};
      this.rows.forEach(row => { if (!row.placeholder) binned[row.key] = this.binRow(this.series[row.key]); });
      return binned;
    },
    // The column ending at the hour the map shows
    selectedIndex() {
      const step = this.$gui.timelineEffectiveIntervalMinutes * 60000;
      const hour = roundToHour(new Date(this.$gui.selectedTime)).getTime();
      return Math.round((hour - this.$gui.timelineStartDate.getTime()) / step) - 1;
    },
    intervalOptions() { return INTERVAL_OPTIONS; },
    // The source the info panel describes, in bold in the names column
    selectedSourceName() {
      const key = this.$gui.hfrSourceInfo?.key;
      return this.rows.find(r => r.key === key)?.name;
    },
    // How many readings the row described in the info panel has
    describedRowReadings() {
      const key = this.$gui.hfrSourceInfo?.key;
      return key ? `${key}:${this.series[key]?.length ?? 0}:${Object.keys(this.provenance[key] ?? {}).length}` : null;
    },
    // What the circle arrows and the detail depend on: the column, and every
    // row's readings - counted, so readings added to a row that already had
    // some (the GitHub fill) republish them too, whatever arrived last
    selectionKey() {
      return this.selectedIndex + '|' + this.$gui.timelineEffectiveIntervalMinutes + '|'
        + Object.entries(this.series).map(([key, readings]) => `${key}:${readings?.length ?? 0}`).join(',')
        + '|' + Object.keys(this.provenance).join(',');
    },
  },
  watch: {
    '$gui.hfrPoint'() { this.load(); },
    // A spinner at the place on the map while any of its rows is on its way
    loading: { immediate: true, handler(loading) { this.$gui.hfrPointLoading = Object.values(loading).some(Boolean); } },
    selectionKey: { immediate: true, handler() { this.publishSelection(); this.fillFromGithub(); } },
    // The source described in the info panel, built from its row's data when
    // it was clicked: built again when that row's readings change (its
    // series arriving, the GitHub fill) - datasets, hours, sources, this hour
    describedRowReadings() {
      const info = this.$gui.hfrSourceInfo;
      const row = info && this.rows.find(r => r.key === info.key);
      if (row && !row.placeholder) this.describe(row);
    },
    // The described source's "This hour" follows the selected hour
    selectedIndex() {
      const info = this.$gui.hfrSourceInfo;
      const row = info && this.rows.find(r => r.key === info.key);
      if (!row || row.placeholder) return;
      this.$gui.hfrSourceInfo = { ...info, rows: info.rows.map(r => r.id === 'thisHour' ? { ...r, value: this.thisHourOrigin(row) } : r) };
    },
  },
  components: {
    DTLayout,
    DTTimelineGrid,
  }
}
</script>


<style scoped>
.value-cell {
  border-bottom: 1px solid #0000002e;
  padding: 0;
  position: relative;
}

.cell-value {
  font-size: 0.65rem;
  color: black;
  text-shadow: none;
  padding: 0px 1px;
}

.cell-arrow {
  font-size: 11px;
  margin-right: 3px;
  color: rgba(0, 0, 0, 0.75);
}

/* The selected column - outlined, so the legend's colour stays readable */
.cell-selected {
  outline: 2px solid var(--red);
  outline-offset: -2px;
}

.value-cell.clickable:hover {
  filter: brightness(0.85);
}

/* A source still to come - flat grey, nothing to click */
.cell-unmeasured {
  background: rgba(0, 0, 0, 0.12);
  cursor: default;
}
</style>
