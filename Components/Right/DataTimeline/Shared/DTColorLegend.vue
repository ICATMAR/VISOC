<template>
  <!-- The colour scale a set of cells is painted with, labelled where the
       colours actually change. No unit picker of its own: wherever this is
       placed the unit is already on show next to it, and two controls for one
       setting is one too many. The tick numbers still follow whatever unit is
       chosen - see ticks().

       Give it a `code` (which legend) and a `range` IN STANDARD UNITS (what
       the gradient spans). -->
  <div class="horizontal legend" :class="{ 'legend-full': fullWidth }">
    <!-- showUnit: the unit inside the bar, on the left, as Windy writes it -
         clickable like every unit in the app (GUIManager.cycleUnit) -->
    <span v-if="showUnit" class="legend-unit-cap" :style="{ background: endColor(0) }"
      :class="{ clickable: $gui.isUnitSwitchable(code) }"
      :title="$gui.isUnitSwitchable(code) ? $t('Click to change units') : ''"
      @click.stop="$gui.cycleUnit(code)">{{ unit.unit }}</span>
    <span class="legend-cap" :style="{ background: endColor(0) }"></span>
    <div class="legend-scale" :style="{ background: gradient }">
      <span v-for="tick in ticks" :key="tick.percent" class="legend-tick"
        :style="{ left: tick.percent + '%' }">{{ tick.label }}</span>
    </div>
    <span class="legend-cap" :style="{ background: endColor(1) }"></span>
  </div>
</template>


<script>

export default {
  name: "DTColorLegend",
  props: {
    code: { type: String, required: true },  // standard code - picks the legend
    range: { type: Array, required: true },  // [min, max] in STANDARD units
    showUnit: Boolean,   // write the unit inside the bar, on the left
    fullWidth: Boolean,  // take the container's whole width (no 200px cap)
  },
  methods: {
    // The flat colour the gradient starts and ends on. The caps carry it a
    // little past each end, which is what gives the first and last tick
    // somewhere to sit: centred on their own value they would otherwise hang
    // half off the bar, and shoving them inward puts them over the wrong
    // colour.
    endColor(end) {
      const [, [r, g, b]] = end === 0 ? this.stops[0] : this.stops[this.stops.length - 1];
      return `rgb(${r}, ${g}, ${b})`;
    },
  },
  computed: {
    stops() {
      return this.$gui.colorLegend(this.code);
    },
    unit() {
      return this.$gui.unitFor(this.code);
    },
    // The legend's distinct stop values (t, 0..1), each given an EQUAL share
    // of the bar: { t: position % } - so every stop gets a readable tick
    // however close its value is to the next (the wind/currents scale's
    // 0.10, 0.175, 0.25). A sharp colour step (two stops at one t, as in the
    // waves scale) is one tick.
    positions() {
      const values = [...new Set(this.stops.map(([t]) => t))];
      return new Map(values.map((t, i) => [t, values.length > 1 ? (i / (values.length - 1)) * 100 : 0]));
    },
    // Built straight from the legend's own [t, [r,g,b]] stops, so it always
    // matches colorLegends.js - each colour at its stop's EQUALLY SPACED place
    // (see positions), and the grading between two stops stretched or
    // squeezed to fit. A stop's colour is exact at its tick; the cells, chips
    // and map keep painting by value (GUIManager.colorFor).
    gradient() {
      const colors = this.stops.map(([t, [r, g, b]]) => `rgb(${r}, ${g}, ${b}) ${this.positions.get(t)}%`);
      return `linear-gradient(to right, ${colors.join(', ')})`;
    },
    // One tick per stop, equally spaced, each labelled with its value: the
    // stops are where the colour changes, so that is where a number is worth
    // reading off.
    //
    // The range is standard, so the LABELS convert while the gradient behind
    // them doesn't move: the colours mean the same thing in any unit, only the
    // numbers written on them change.
    ticks() {
      const [min, max] = this.range;
      const { toDisplay } = this.unit;
      // Whole numbers when the scale's top is above 25 (in the unit shown),
      // one decimal otherwise - rounded, trailing zero dropped. (+1e-9: 0.25
      // is held as 0.2499..., which would round down.)
      const top = toDisplay(max);
      const label = value => top > 25 ? String(Math.round(value)) : String(Number((value + 1e-9).toFixed(1)));
      return [...this.positions].map(([t, percent]) => ({
        percent,
        label: label(toDisplay(min + t * (max - min))),
      }));
    },
  },
}

</script>


<style scoped>
.legend {
  max-width: 200px;
  width: 100%;
  height: 14px;
  margin-left: 10px;
  border-radius: 9px;
  overflow: hidden;
  align-self: center;
}

.legend-full {
  max-width: none;
  margin-left: 0;
}

/* The unit, inside the bar on its first colour */
.legend-unit-cap {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 0 4px 0 8px;
  font-size: 0.6rem;
  font-style: italic;
  color: rgba(0, 0, 0, 0.8);
  text-shadow: none;
}
.legend-unit-cap.clickable {
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

/* Flat run of the end colour, so the outermost labels have a readable place to
   sit without being pushed off the value they mark. */
.legend-cap {
  flex: 0 0 12px;
  height: 100%;
}

.legend-scale {
  position: relative;
  flex: 1;
  height: 100%;
}

/* Centred on the value it marks, so a label sits over its own colour - the
   caps are what make that safe at both ends. */
.legend-tick {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.6rem;
  color: rgba(0, 0, 0, 0.8);
  text-shadow: none;
  white-space: nowrap;
  pointer-events: none;
}
</style>
