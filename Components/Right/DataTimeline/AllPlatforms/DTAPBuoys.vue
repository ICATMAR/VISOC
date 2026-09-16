<template>
  <DTLayout :variables="buoys" :interval-options="intervalOptions"
    :active-var="hoveredBuoy || (selectedCell && selectedCell.buoyId)"
    :selected-var="$gui.isPlatformDetailOpen ? $gui.selectedPlatform?.stationId : null"
    @var-click="buoyNameClicked">
    <template #grid>
      <DTTimelineGrid v-slot="{ cells }">
        <!-- One row per buoy, one cell per time step. A cell is the AVERAGE of
             everything that fell inside it (see binned), coloured by the
             variable's legend, with the direction as an arrow rather than a
             second number - same shape as boiasomorrostro's DataTimeline. -->
        <tr v-for="buoy in buoys" :key="buoy.id"
          :class="{ 'row-selected': isRowSelected(buoy.id) }"
          @mouseenter="hoveredBuoy = buoy.id"
          @mouseleave="hoveredBuoy = null">
          <!-- Each buoy's fetch resolves on its own, so a row spins until its
               own data lands rather than the whole table waiting for the
               slowest server (same as DTAPHFR's per-station rows). -->
          <td v-if="isLoading(buoy.id)" :colspan="cells.length" class="message-cell">
            <span class="spinner-border"></span>
          </td>
          <template v-else>
            <td v-for="(cell, index) in cells" :key="index"
              class="value-cell clickable"
              :class="{ 'cell-selected': isCellSelected(buoy.id, index) }"
              :style="{ background: cellColor(buoy, index) }"
              :title="cellTitle(buoy, cell, index)"
              @click="buoyClicked(buoy, index, cell)">
              <i v-if="arrowAngle(buoy, index) != undefined"
                class="fa-solid fa-location-arrow cell-arrow"
                :style="{ transform: `rotate(${arrowAngle(buoy, index) - 45}deg)` }"></i>
              <span class="cell-value">{{ cellText(buoy, index) }}</span>
            </td>
          </template>
        </tr>
      </DTTimelineGrid>
    </template>
  </DTLayout>
</template>


<script>
import DTLayout from '../Shared/DTLayout.vue';
import DTTimelineGrid from '../Shared/DTTimelineGrid.vue';
// pollMixin is a bare global (see main.js) - a .vue file's <script> block
// isn't a real ES module under vue3-sfc-loader, so importing a plain .js file
// directly here doesn't resolve, the same reason ol.Map works everywhere with
// no import.

// How often refreshVariableData() re-asks DPBuoys for fresh values.
const REFRESH_MINUTES = 5;

// A cell is an average now, so a whole day in one cell would flatten a sea
// breeze into nothing - hence 12h at the coarsest rather than daily.
const INTERVAL_OPTIONS = [
  { label: '12 hours', minutes: 720 },
  { label: '3 hours',  minutes: 180 },
  { label: 'Hourly',   minutes: 60  },
];

// A value this many times past the top of a variable's range is discarded as a
// fault rather than averaged in (see binVariable).
const OUT_OF_RANGE_FACTOR = 3;

export default {
  name: "DTAPBuoys",
  mixins: [pollMixin('refreshVariableData', REFRESH_MINUTES)],
  // Row list comes from the real buoy catalogue - static first (synchronous,
  // so there's something to show immediately), refined once the live sources
  // resolve and can add buoys the static file doesn't know about, the same
  // two-step pattern as MapOverlayBuoys.vue.
  created() {
    this.buildRows(this.$dataService.buoys.getBuoys());
    this.$dataService.buoys.loadBuoys()
      .then(buoys => this.buildRows(buoys))
      .catch(error => console.error('Error loading buoys for the timeline:', error));
  },
  data() {
    return {
      hoveredBuoy: null,
      selectedCell: null, // { buoyId, index }
      buoys: [],          // [{ id, name, latitude }] - one row each, north to south
      values: {},         // { buoyId: { code: { '<ISO>': value } } }, as measured
      loading: {},        // { buoyId: true } until that buoy's own fetch lands
      intervalOptions: INTERVAL_OPTIONS,
    }
  },
  methods: {
    buildRows(buoys) {
      // `name` is what DTLayout shows AND what it matches the hovered/selected
      // row by, and the map sets $gui.selectedPlatform.stationId to the buoy's
      // id - so the id has to be the name here for the two to line up.
      //
      // Sorted north to south so the rows read like the coast does on the map
      // above them. A buoy with no position sinks to the bottom rather than
      // jumping to the top, which is where NaN comparisons would put it.
      this.buoys = buoys
        .map(buoy => ({ id: buoy.id, name: buoy.id, latitude: buoy.latitude }))
        .sort((a, b) => (b.latitude ?? -Infinity) - (a.latitude ?? -Infinity));
    },
    isLoading(buoyId) {
      return this.loading[buoyId] === true;
    },

    // Asks for every variable the picker offers, not just the selected one:
    // it is a single plan, and DPBuoys' block cache means switching variable
    // afterwards costs nothing. Each buoy's promise is applied as it lands, so
    // rows fill in progressively rather than all at the end.
    refreshVariableData() {
      // Only rows with nothing to show yet spin - a refresh of a row that
      // already has data shouldn't blank it out and flash a spinner every
      // five minutes.
      const loading = { ...this.loading };
      this.buoys.forEach(buoy => { if (this.values[buoy.id] == undefined) loading[buoy.id] = true; });
      this.loading = loading;

      this.$dataService.buoys.getVariablesData(this.$gui.buoyVariableCodes, this.$gui.timelineStartDate, this.$gui.timelineEndDate)
        // Promise.all, not forEach: each row still stops spinning the moment
        // its OWN result lands (applyResult), but the sweep below has to wait
        // for all of them - getVariablesData itself resolves as soon as it has
        // planned the work, long before any data arrives.
        .then(({ promises }) => Promise.all(promises.map(promise => promise
          .then(result => this.applyResult(result))
          .catch(error => console.error('DTAPBuoys: a buoy failed outright:', error)))))
        .catch(error => console.error('DTAPBuoys: could not plan the variable request:', error))
        // A buoy no source could serve never gets a promise of its own, so it
        // would spin for ever without this.
        .finally(() => { this.loading = {}; });
    },
    // { '<ISO>': { code: point } } -> { code: { '<ISO>': point } }, which is the
    // shape the binning below walks. The WHOLE point is kept, not just its
    // value: each one carries the sensor, instrument and server it came from,
    // and a cell lists whatever contributed to it. Reassigned rather than
    // mutated so the computed rebuilds.
    applyResult(result) {
      const byCode = {};
      Object.entries(result.data).forEach(([timestamp, codes]) => {
        Object.entries(codes).forEach(([code, point]) => {
          if (byCode[code] == undefined) byCode[code] = {};
          byCode[code][timestamp] = point;
        });
      });
      this.values = { ...this.values, [result.buoyId]: byCode };
      this.loading = { ...this.loading, [result.buoyId]: false };
    },

    // One variable's cells for one buoy: the mean of the magnitudes that fell
    // in each, and the mean DIRECTION as a vector rather than a number -
    // averaging 350º and 10º arithmetically gives 180º, which points exactly
    // the wrong way. Weighted by the magnitude measured at the same moment,
    // so a heading recorded in a flat calm doesn't drag the arrow around.
    binVariable(byCode, variable, cells, startTime, stepMs) {
      const bins = cells.map(() => ({ count: 0, total: 0, x: 0, y: 0, directions: 0, from: new Map() }));
      const binOf = timestamp => {
        const index = Math.floor((new Date(timestamp).getTime() - startTime) / stepMs);
        return index >= 0 && index < bins.length ? bins[index] : undefined;
      };
      // Who contributed to a cell. A cell is an average over hours, so it can
      // mix sensors and servers - keyed by both so the same instrument served
      // by two servers is listed once per server, which is the distinction
      // that matters when a number looks wrong.
      const credit = (bin, point) => {
        if (point?.sensor == undefined && point?.source == undefined) return;
        bin.from.set(`${point.source}|${point.sensor}`, {
          sensor: point.sensor, source: point.source, instrument: point.instrument,
        });
      };

      // A reading far past the top of the legend's range is an instrument
      // fault, not weather - the SOMO logger writes 1000 m/s for a failed
      // anemometer (see SourceGithubSOMO), and one of those in a cell would
      // drag its average somewhere meaningless. Generous rather than tight:
      // three times the range still lets a genuinely extreme storm through.
      const ceiling = variable.range[1] * OUT_OF_RANGE_FACTOR;
      const magnitudes = {};
      const rejected = new Set();
      Object.entries(byCode?.[variable.code] ?? {}).forEach(([timestamp, point]) => {
        if (!isFinite(point?.value) || point.value > ceiling) { rejected.add(timestamp); return; }
        magnitudes[timestamp] = point;
      });

      Object.entries(magnitudes).forEach(([timestamp, point]) => {
        const bin = binOf(timestamp);
        if (!bin) return;
        bin.count++;
        bin.total += point.value;
        credit(bin, point);
      });

      if (variable.directionCode) {
        Object.entries(byCode?.[variable.directionCode] ?? {}).forEach(([timestamp, point]) => {
          const bin = binOf(timestamp);
          const degrees = point?.value;
          if (!bin || !isFinite(degrees)) return;
          // A heading recorded alongside a rejected magnitude goes with it:
          // the logger writes a perfectly plausible direction next to its
          // 1000 m/s fault marker, which is why SourceGithubSOMO drops the
          // whole wind block rather than just the speed.
          if (rejected.has(timestamp)) return;
          // Unweighted only where there is no magnitude to weight BY - not
          // where there was one and it was thrown away.
          const weight = isFinite(magnitudes[timestamp]?.value) ? magnitudes[timestamp].value : 1;
          const radians = degrees * Math.PI / 180;
          bin.x += Math.cos(radians) * weight;
          bin.y += Math.sin(radians) * weight;
          bin.directions++;
          credit(bin, point);
        });
      }

      return bins.map(bin => ({
        value: bin.count ? bin.total / bin.count : undefined,
        direction: bin.directions && (bin.x || bin.y)
          ? ((Math.atan2(bin.y, bin.x) * 180 / Math.PI) + 360) % 360
          : undefined,
        from: [...bin.from.values()],
      }));
    },

    binFor(buoy, index) {
      return this.binned[buoy.id]?.[this.$gui.selectedBuoyVariable.code]?.[index];
    },
    cellText(buoy, index) {
      const bin = this.binFor(buoy, index);
      if (bin?.value == undefined) return '';
      // Standard on the way in, the user's unit only here at the last moment
      const unit = this.$gui.unitFor(this.$gui.selectedBuoyVariable.code);
      return unit.toDisplay(bin.value).toFixed(unit.decimals);
    },
    // The compass bearing the arrow shows: where the wind/swell is GOING.
    // WDIR and VMDR are reported as where it comes FROM (fromDirection), so
    // they are turned around - a wind of 200º comes from the SSW and blows
    // towards 20º, and waves of 90º run towards 270º.
    //
    // The template rotates by this minus 45, because fa-location-arrow points
    // NE to begin with - the same offset DTAPBuoysPlatformDetail uses, so the
    // cell and the panel agree.
    arrowAngle(buoy, index) {
      const bin = this.binFor(buoy, index);
      if (bin?.direction == undefined) return undefined;
      const variable = this.$gui.selectedBuoyVariable;
      return ((variable.fromDirection ? bin.direction + 180 : bin.direction) % 360 + 360) % 360;
    },
    // The legend's own stops (see styles/colorLegends.js), interpolated over
    // the variable's range - the same scale the bar above the timeline draws.
    //
    // Both the value and the range are standard, so this needs no unit
    // conversion at all: a cell keeps its exact colour when the unit changes,
    // and nothing drifts on the rounding of a converted range.
    cellColor(buoy, index) {
      const bin = this.binFor(buoy, index);
      if (bin?.value == undefined) return 'transparent';

      const { range, code } = this.$gui.selectedBuoyVariable;
      const t = Math.min(Math.max((bin.value - range[0]) / (range[1] - range[0]), 0), 1);
      const stops = this.$gui.colorLegend(code);
      for (let i = 0; i < stops.length - 1; i++) {
        const [t0, from] = stops[i];
        const [t1, to] = stops[i + 1];
        if (t > t1) continue;
        const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
        const channel = j => Math.round(from[j] + (to[j] - from[j]) * f);
        return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
      }
      const [, last] = stops[stops.length - 1];
      return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
    },
    cellTitle(buoy, cell, index) {
      const bin = this.binFor(buoy, index);
      if (bin?.value == undefined) return this.$t('No data available');
      const variable = this.$gui.selectedBuoyVariable;
      // The direction as MEASURED - where the wind/swell comes FROM for WDIR
      // and VMDR - not the bearing the arrow is turned to. The tooltip is
      // there to read the data off, so it has to say what the source recorded;
      // the +180 belongs to the drawing, not to the number.
      const heading = bin.direction == undefined ? '' : ` · ${bin.direction.toFixed(0)}º`;
      // Where the cell's average actually came from - one line per contributor,
      // since a cell spans hours and can mix sensors and servers. The
      // instrument is only named where the source says what it is (ERDDAP
      // publishes one, the MSM API names its sensors after them; see
      // SourceGithubSOMO's INSTRUMENTS for the rest).
      const from = (bin.from ?? []).map(({ sensor, instrument, source }) =>
        `Sensor: ${sensor}${instrument ? ` (${instrument})` : ''} \nSource: ${source}`);

      const unit = this.$gui.unitFor(variable.code);
      return [
        cell.toISOString(),
        `${this.$t(variable.label)}: ${unit.toDisplay(bin.value).toFixed(unit.decimals)} ${unit.unit}${heading}`,
        ...from,
      ].join('\n');
    },

    isRowSelected(buoyId) {
      return this.$gui.isPlatformDetailOpen && this.$gui.selectedPlatform?.stationId === buoyId;
    },
    isCellSelected(buoyId, index) {
      return this.selectedCell?.buoyId === buoyId && this.selectedCell?.index === index;
    },
    buoyNameClicked(buoy) {
      this.$gui.selectedPlatform = { stationId: buoy.id };
      this.$gui.isPlatformDetailOpen = true;
    },
    // Hands the detail panel every variable's average for that cell, not just
    // the one on screen - the panel shows them all.
    buoyClicked(buoy, index, cell) {
      const platform = { stationId: buoy.id, date: cell };
      this.$gui.buoyVariables.forEach(variable => {
        const bin = this.binned[buoy.id]?.[variable.code]?.[index];
        if (bin?.value != undefined) platform[variable.code] = bin.value;
        if (variable.directionCode && bin?.direction != undefined) platform[variable.directionCode] = bin.direction;
      });

      this.$gui.selectedPlatform = platform;
      this.selectedCell = { buoyId: buoy.id, index };
      this.$gui.isPlatformDetailOpen = true;
    },
  },
  computed: {
    // Same steps DTTimelineGrid lays the columns out on - both read the same
    // $gui values, so they can't drift apart.
    cells() {
      const stepMs = this.$gui.timelineEffectiveIntervalMinutes * 60 * 1000;
      const endTime = this.$gui.timelineEndDate.getTime();
      const cells = [];
      for (let time = this.$gui.timelineStartDate.getTime(); time < endTime; time += stepMs) cells.push(new Date(time));
      return cells;
    },
    // { buoyId: { code: [{ value, direction } per cell] } } - rebuilt when the
    // data arrives or the step changes, so a zoom re-buckets what is already
    // held instead of asking for it again.
    binned() {
      const cells = this.cells;
      if (cells.length === 0) return {};
      const startTime = cells[0].getTime();
      const stepMs = this.$gui.timelineEffectiveIntervalMinutes * 60 * 1000;

      const binned = {};
      this.buoys.forEach(buoy => {
        const byVariable = {};
        this.$gui.buoyVariables.forEach(variable => {
          byVariable[variable.code] = this.binVariable(this.values[buoy.id], variable, cells, startTime, stepMs);
        });
        binned[buoy.id] = byVariable;
      });
      return binned;
    },
  },
  watch: {
    '$gui.isPlatformDetailOpen'(isOpen) {
      if (!isOpen) this.selectedCell = null;
    },
    // The columns mean something different after a zoom, so the selected one
    // no longer refers to what the user picked.
    '$gui.timelineEffectiveIntervalMinutes'() {
      this.selectedCell = null;
    },
    // A map icon click sets only the station id, which would leave the detail
    // panel without values. Keep the column that was already selected and
    // re-emit it for whichever buoy was clicked - a cell click carries its own
    // values already and is left alone.
    '$gui.selectedPlatform'(platform) {
      if (!this.selectedCell || platform?.date) return;
      const buoy = this.buoys.find(b => b.id === platform?.stationId);
      const cell = this.cells[this.selectedCell.index];
      if (buoy && cell) this.buoyClicked(buoy, this.selectedCell.index, cell);
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

/* Outlines the picked cell without moving anything - an outline rather than a
   border, which would change the cell's size and shift the row. */
.cell-selected {
  outline: 2px solid var(--red);
  outline-offset: -2px;
}

/* dtShared.css marks a selected row by flooding .dt-col with 40% red. These
   cells carry the legend's colours instead, and a wash over them would bury
   the scale they exist to show - so the row is banded top and bottom rather
   than filled. */
tr.row-selected .value-cell {
  box-shadow: inset 0 2px 0 var(--red), inset 0 -2px 0 var(--red);
}

.value-cell:hover {
  filter: brightness(0.85);
}

/* Same as DTAPHFR's, so a row waiting on its data looks the same everywhere */
.message-cell {
  padding: 0;
  height: 22px;
  text-align: center;
  font-size: x-small;
  color: rgba(0, 0, 0, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
</style>
