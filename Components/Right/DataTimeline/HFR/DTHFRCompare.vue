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

// Text that was UTF-8, read as Latin-1 and saved again ("DirecciÃ³" for
// "Direcció" - the EU HFR Node's metadata has it): re-read as UTF-8. escape()
// gives the Latin-1 bytes back and decodeURIComponent reads them as UTF-8; on
// text that was right to begin with ("Política"), that is not valid UTF-8 and
// throws, so it is kept as it was.
const repairEncoding = text => {
  try { return /[\u00c0-\u00ff][\u0080-\u00bf]/.test(text) ? decodeURIComponent(escape(text)) : text; }
  catch { return text; }
};

// Hourly only: a cell is one hour, and the circle arrows and the detail
// panel show exactly what is in it
const INTERVAL_OPTIONS = [{ label: 'Hourly', minutes: 60 }];

// Sea water velocity at one place (GUIManager.hfrPoint), from every source
// there is for it, side by side over the timeline's range: the buoy or drifter
// that was clicked, the HF radars (ICATMAR's own and the EU HFR Node's), and
// ICATMAR's model. CMEMS is listed, to come (Phase 5).
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
          .then(result => done(provider, Object.values(result.data), { cell: result.cell, used: result.used }))
          .catch(failed(provider));
      });
      const modelPoint = { id: `hfr:${point.lat.toFixed(4)},${point.lon.toFixed(4)}`, latitude: point.lat, longitude: point.lon };
      this.$dataService.ssforecast.getPointForecast(modelPoint, start, end)
        .then(result => done('model', this.fromCodes(result.data), { series: result.series }))
        .catch(failed('model'));
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
    // model's from the forecast series; CMEMS, still to come, as a placeholder.
    async describe(row) {
      const key = row.key;
      const hours = (this.series[key] ?? []).length;
      const window = this.cells.length;
      if (key === 'ICATMAR' || key === 'EU') {
        const provenance = this.provenance[key];
        const used = provenance?.used ?? [];
        const info = {
          key, title: row.name, subtitle: key === 'ICATMAR' ? 'ICATMAR' : 'EU HFR Node',
          loading: true,
          rows: this.hfrBaseRows(key, provenance, hours, window),
        };
        this.$gui.hfrSourceInfo = info;
        const described = await Promise.all(used.map(entry =>
          this.$dataService.hfrtotals.getDatasetMetadata(key, entry.source, entry.dataset).catch(() => ({}))));
        if (this.$gui.hfrSourceInfo?.key !== key) return; // another source was picked meanwhile
        const metadata = described[0] ?? {};
        this.$gui.hfrSourceInfo = { ...info, loading: false, rows: [
          ...info.rows,
          ...used.map((entry, i) => ({ label: 'Dataset', value: `${entry.dataset} (${entry.source}, ${entry.hours} h)`, url: described[i]?.infoUrl })),
          ...this.metadataRows(metadata),
        ] };
        return;
      }
      if (key === 'model') {
        const series = this.provenance.model?.series?.[0];
        const source = this.$dataService.ssforecast.sources[0];
        const metadata = source?.metadata ?? {};
        this.$gui.hfrSourceInfo = {
          key, title: row.name, subtitle: series?.label ?? source?.label,
          rows: [
            { label: 'Model', value: [series?.model ?? source?.model, series?.resolution ?? source?.resolution].filter(Boolean).join(' · ') },
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
      // CMEMS: still to come (Phase 5)
      const ibi = key === 'cmems-ibi';
      this.$gui.hfrSourceInfo = {
        key, title: row.name, subtitle: 'Copernicus Marine Service',
        rows: [
          { label: 'Product', value: ibi ? 'IBI_ANALYSISFORECAST_PHY_005_001' : 'MEDSEA_ANALYSISFORECAST_PHY_006_013',
            url: `https://data.marine.copernicus.eu/product/${ibi ? 'IBI_ANALYSISFORECAST_PHY_005_001' : 'MEDSEA_ANALYSISFORECAST_PHY_006_013'}/description` },
          { label: 'Institution', value: 'Copernicus Marine Service (Mercator Ocean International)' },
          { label: 'Resolution', value: ibi ? '1/36º (~2.8 km)' : '1/24º (~4.2 km)' },
          { label: 'Depth', value: this.$t('Surface (the model\'s top layer)') },
          { label: 'Status', value: this.$t('Coming soon') },
        ],
      };
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
    // The parts of an ERDDAP dataset's NC_GLOBAL worth showing
    metadataRows(metadata) {
      const rows = [];
      const add = (label, value, long) => {
        // Placeholders some datasets write instead of leaving it out
        if (value == undefined || /^(|void|none|unknown|n\/a)$/i.test(String(value).trim())) return;
        rows.push({ label, value: repairEncoding(String(value)).replace(/\s+/g, ' ').trim(), long });
      };
      add('Title', metadata.title, true);
      // Some list one institution twice ('A, B, B')
      add('Institution', metadata.institution && [...new Set(repairEncoding(String(metadata.institution)).split(/\s*,\s*/))].join(', '));
      add('Network', metadata.network ?? metadata.site_code);
      add('Source', metadata.source);
      add('Processing level', metadata.processing_level);
      add('Time step', this.formatDuration(metadata.time_coverage_resolution));
      add('Updated', metadata.update_interval);
      if (metadata.geospatial_lat_resolution)
        add('Resolution', `${Number(metadata.geospatial_lat_resolution).toFixed(3)}º × ${Number(metadata.geospatial_lon_resolution).toFixed(3)}º`);
      if (metadata.time_coverage_start)
        add('Coverage', `${String(metadata.time_coverage_start).substring(0, 10)} – ${String(metadata.time_coverage_end ?? '').substring(0, 10)}`);
      add('License', metadata.license, true);
      add('Acknowledgement', metadata.acknowledgement ?? metadata.citation, true);
      return rows;
    },
    // ISO 8601 durations as ERDDAP writes them: 'PT1H' -> '1 h', 'P1D' -> '1 d'
    formatDuration(value) {
      const match = String(value ?? '').match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
      if (!match || !match.slice(1).some(Boolean)) return value;
      const [, d, h, m, sec] = match;
      return [d && `${d} d`, h && `${h} h`, m && `${m} min`, sec && `${sec} s`].filter(Boolean).join(' ');
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
        { key: 'model', name: 'Model ICATMAR', circle: 'Model ROMS ICATMAR' },
        { key: 'cmems-med', name: 'CMEMS MEDSEA', placeholder: true },
        { key: 'cmems-ibi', name: 'CMEMS IBI', placeholder: true },
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
    selectionKey() {
      return this.selectedIndex + '|' + this.$gui.timelineEffectiveIntervalMinutes + '|' + Object.keys(this.series).join(',');
    },
  },
  watch: {
    '$gui.hfrPoint'() { this.load(); },
    selectionKey: { immediate: true, handler() { this.publishSelection(); } },
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
