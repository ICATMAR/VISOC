<template>
  <!-- The buoy against the models, for one variable group (wind, waves,
       currents, water temperature): one row per source, each cell its average
       over the cell on the variable's colour scale, with an arrow where it is
       directional. A source's name describes it in the info panel. -->
  <DTLayout :variables="rowVariables" :interval-options="intervalOptions"
    :selected-var="selectedRowName" @var-click="rowClicked">
    <template #grid>
      <DTTimelineGrid v-slot="{ cells }">
        <tr v-for="row in rows" :key="row.key">
          <td v-for="(cell, index) in cells" :key="index" class="value-cell clickable"
            :class="{ 'cell-selected': index === selectedIndex }"
            :style="{ background: cellColor(row, index) }"
            :title="cellTitle(row, cell, index)" @click="cellClicked(index, cell)">
            <template v-if="binOf(row, index)?.value != undefined">
              <i v-if="arrowOf(index, row) != undefined" class="fa-solid fa-location-arrow cell-arrow"
                :style="{ transform: `rotate(${arrowOf(index, row) - 45}deg)` }"></i>
              <span class="cell-value">{{ cellText(row, index) }}</span>
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

const INTERVAL_OPTIONS = [
  { label: '12 hours', minutes: 720 },
  { label: '3 hours',  minutes: 180 },
  { label: 'Hourly',   minutes: 60  },
];

// The Buoys dashboard's Compare (GUIManager.buoyCompareGroups): the buoy's
// readings, each model of the group's forecast product at the buoy
// (getPointSeriesBySource - one row per model, not merged), and for the
// currents the HF radars' grid cell nearest the buoy (DPHFRTotals.getPointSeries).
export default {
  name: "DTBuoysCompare",
  props: {
    buoyId: { type: String, required: true },
    group: { type: Object, required: true }, // a buoyCompareGroups entry
  },
  // New readings, a model's new run, new HF radar maps: those rows again
  mixins: [window.dataProductMixin({
    buoys: 'onBuoysChanged', windforecast: 'onForecastChanged', waveforecast: 'onForecastChanged',
    ssforecast: 'onForecastChanged', hfrtotals: 'onHFRChanged',
  })],
  created() {
    this.load();
  },
  beforeUnmount() {
    this.$gui.buoySourceInfo = null;
  },
  data() {
    return {
      buoy: null,
      // key -> { name, kind: 'buoy' | 'model' | 'hfr', values: { code: { '<ISO>': point } }, meta, loading }
      sources: {},
      selectedIndex: -1,
    }
  },
  methods: {
    load() {
      const request = (this.request ?? 0) + 1;
      this.request = request;
      this.sources = {};
      this.selectedIndex = -1;
      this.$gui.buoySourceInfo = null;
      this.loadBuoyRow(request);
      this.loadModels(request);
      if (this.group.hfr) this.loadHFR(request);
    },
    setRow(key, row) {
      this.sources = { ...this.sources, [key]: { ...this.sources[key], ...row } };
    },
    async place() {
      this.buoy ??= (await this.$dataService.buoys.loadBuoys()).find(b => b.id === this.buoyId) ?? null;
      return this.buoy;
    },
    async loadBuoyRow(request) {
      this.setRow('buoy', { name: this.buoyId, kind: 'buoy', loading: true });
      const codes = [this.group.code, this.group.directionCode].filter(Boolean);
      try {
        const buoy = await this.place();
        const result = await this.$dataService.buoys.getBuoyDetailData(this.buoyId, codes, this.$gui.timelineStartDate, this.$gui.timelineEndDate);
        if (request !== this.request) return;
        this.setRow('buoy', { name: buoy?.name ?? this.buoyId, values: window.buoyCells.byCode(result.data), loading: false,
          meta: { sources: this.$dataService.buoys.sourcesOf(this.buoyId) } });
      } catch (error) {
        console.error(`Buoys Compare: ${this.buoyId}`, error);
        if (request === this.request) this.setRow('buoy', { loading: false });
      }
    },
    // Every model of the group's product at the buoy, each its own row
    async loadModels(request) {
      const product = this.$dataService[this.group.product];
      if (!product) return;
      this.setRow('models', { name: this.$t('Models'), kind: 'placeholder', loading: true });
      try {
        const buoy = await this.place();
        if (!buoy) return;
        const point = { id: buoy.id, latitude: buoy.latitude, longitude: buoy.longitude };
        const result = await product.getPointSeriesBySource(point, this.$gui.timelineStartDate, this.$gui.timelineEndDate);
        if (request !== this.request) return;
        const { models, ...rest } = this.sources;
        const rows = {};
        result.series
          .filter(series => Object.values(series.data).some(record => record[this.group.code] != undefined))
          .forEach(series => {
            rows[`model:${series.model ?? series.label}`] = {
              name: series.label ?? series.model, kind: 'model', meta: series, loading: false,
              values: window.buoyCells.byCode(series.data),
            };
          });
        this.sources = { ...rest, ...rows };
      } catch (error) {
        console.error(`Buoys Compare: models of ${this.group.product}`, error);
        if (request === this.request) { const { models, ...rest } = this.sources; this.sources = rest; }
      }
    },
    // The HF radars' grid cell nearest the buoy: ICATMAR's and the EU HFR Node's
    async loadHFR(request) {
      const buoy = await this.place();
      if (!buoy) return;
      [['hfr:ICATMAR', 'HFR ICATMAR', 'ICATMAR'], ['hfr:EU', 'HFR EU Node', 'EU']].forEach(async ([key, name, provider]) => {
        this.setRow(key, { name, kind: 'hfr', loading: true });
        try {
          const result = await this.$dataService.hfrtotals.getPointSeries(provider, buoy.longitude, buoy.latitude, this.$gui.timelineStartDate, this.$gui.timelineEndDate);
          if (request !== this.request) return;
          const data = {};
          Object.entries(result.data).forEach(([hour, reading]) => {
            data[hour] = { HCSP: { value: reading.speed, source: reading.source }, HCDT: { value: reading.direction, source: reading.source } };
          });
          this.setRow(key, { values: window.buoyCells.byCode(data), meta: { cell: result.cell, used: result.used }, loading: false });
        } catch (error) {
          console.error(`Buoys Compare: ${name}`, error);
          if (request === this.request) this.setRow(key, { loading: false });
        }
      });
    },
    onBuoysChanged({ buoys = [] } = {}) {
      if (buoys.includes(this.buoyId)) this.loadBuoyRow(this.request);
    },
    onForecastChanged() {
      this.loadModels(this.request);
    },
    onHFRChanged() {
      if (this.group.hfr) this.loadHFR(this.request);
    },
    binOf(row, index) {
      return this.binned[row.key]?.[index];
    },
    arrowOf(index, row) {
      return window.buoyCells.arrowBearing(this.binOf(row, index)?.direction, this.group.fromDirection);
    },
    cellText(row, index) {
      const unit = this.$gui.unitFor(this.group.code);
      return unit.toDisplay(this.binOf(row, index).value).toFixed(unit.decimals);
    },
    cellColor(row, index) {
      const bin = this.binOf(row, index);
      if (bin?.value == undefined) return 'transparent';
      return this.$gui.colorFor(this.group.code, bin.value, this.range) ?? 'rgba(255, 255, 255, 0.5)';
    },
    cellTitle(row, cell, index) {
      const bin = this.binOf(row, index);
      if (bin?.value == undefined) return `${row.name}: ${this.$t('No data available')}`;
      const unit = this.$gui.unitFor(this.group.code);
      const heading = bin.direction == undefined ? '' : ` · ${bin.direction.toFixed(0)}º`;
      return [cell.toISOString(), `${row.name}: ${unit.toDisplay(bin.value).toFixed(unit.decimals)} ${unit.unit}${heading}`].join('\n');
    },
    cellClicked(index, cell) {
      this.selectedIndex = index;
      this.$gui.selectedTime = new Date(cell.getTime() + this.$gui.timelineEffectiveIntervalMinutes * 60000 / 2);
    },
    // A source's name: what it is, in the info panel (the buoy's own card
    // for the buoy)
    rowClicked(variable) {
      const row = this.rows.find(r => r.name === variable.name);
      if (!row || row.kind === 'buoy') { this.$gui.buoySourceInfo = null; return; }
      const meta = row.meta ?? {};
      const hours = Object.keys(row.values?.[this.group.code] ?? {}).length;
      const cell = meta.cell && `${Number(meta.cell.latitude).toFixed(4)}º N, ${Number(meta.cell.longitude).toFixed(4)}º E`;
      const run = meta.run && [meta.run.referenceTime && `${this.$t('run')} ${meta.run.referenceTime.toISOString().substring(0, 16).replace('T', ' ')} UTC`,
        meta.run.publishedAt && `${this.$t('published')} ${meta.run.publishedAt.toISOString().substring(0, 16).replace('T', ' ')} UTC`, meta.run.note].filter(Boolean).join(' · ');
      const rows = row.kind === 'hfr'
        ? [
          { label: 'Grid cell used', value: cell ?? '–' },
          ...(meta.used ?? []).map(entry => ({ label: 'Dataset', value: `${entry.dataset} (${entry.source}, ${entry.hours} h)` })),
          { label: 'Hours with data', value: String(hours) },
        ]
        : [
          { label: 'Model', value: [meta.model, meta.resolution].filter(Boolean).join(' · ') || '–' },
          { label: 'Institution', value: meta.institution ?? '–' },
          { label: 'Run', value: run || '–', long: true },
          { label: 'Grid cell used', value: cell ?? '–' },
          { label: 'Hours with data', value: String(hours) },
        ];
      this.$gui.buoySourceInfo = { key: row.key, title: row.name, subtitle: this.$t(this.group.label), rows };
    },
  },
  computed: {
    intervalOptions() { return INTERVAL_OPTIONS; },
    range() {
      return this.$gui.rangeFor(this.group.code);
    },
    // The buoy first, then the models, then the radars
    rows() {
      const order = { buoy: 0, model: 1, placeholder: 1, hfr: 2 };
      return Object.entries(this.sources)
        .map(([key, source]) => ({ key, ...source }))
        .sort((a, b) => order[a.kind] - order[b.kind]);
    },
    rowVariables() {
      const unit = this.$gui.unitFor(this.group.code).unit;
      return this.rows.map(row => ({ name: row.name, unit, code: this.group.code, loading: !!row.loading }));
    },
    selectedRowName() {
      const key = this.$gui.buoySourceInfo?.key;
      return this.rows.find(r => r.key === key)?.name ?? null;
    },
    cells() {
      return window.buoyCells.cellsOf(this.$gui.timelineStartDate, this.$gui.timelineEndDate, this.$gui.timelineEffectiveIntervalMinutes * 60000);
    },
    binned() {
      const cells = this.cells;
      if (!cells.length) return {};
      const stepMs = this.$gui.timelineEffectiveIntervalMinutes * 60000;
      const variable = { code: this.group.code, directionCode: this.group.directionCode };
      const binned = {};
      this.rows.forEach(row => {
        binned[row.key] = window.buoyCells.binVariable(row.values, variable, cells, cells[0].getTime(), stepMs, this.range);
      });
      return binned;
    },
    loadKey() {
      return `${this.buoyId}|${this.group.id}|${this.$gui.timelineStartDate.getTime()}|${this.$gui.timelineEndDate.getTime()}`;
    },
  },
  watch: {
    loadKey() { this.buoy = null; this.load(); },
    '$gui.timelineEffectiveIntervalMinutes'() { this.selectedIndex = -1; },
  },
  components: { DTLayout, DTTimelineGrid },
}
</script>


<style scoped>
.value-cell {
  padding: 0;
  height: 23px;
  text-align: center;
  white-space: nowrap;
  font-size: 0.65rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.cell-value, .cell-arrow {
  color: #222;
  text-shadow: none;
}
.cell-arrow {
  font-size: 0.55rem;
  margin-right: 2px;
}
.cell-selected {
  outline: 2px solid var(--red);
  outline-offset: -2px;
}
</style>
