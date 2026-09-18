<template>
  <!-- The colour scale a set of cells is painted with, labelled where the
       colours actually change. No unit picker of its own: wherever this is
       placed the unit is already on show next to it, and two controls for one
       setting is one too many. The tick numbers still follow whatever unit is
       chosen - see ticks().

       Give it a `code` (which legend) and a `range` IN STANDARD UNITS (what
       the gradient spans). -->
  <div class="horizontal legend">
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
    // Built straight from the legend's own [t, [r,g,b]] stops (t already
    // normalized 0..1), so this always matches colorLegends.js without a
    // second copy of the stops to keep in sync.
    gradient() {
      const colors = this.stops.map(([t, [r, g, b]]) => `rgb(${r}, ${g}, ${b}) ${t * 100}%`);
      return `linear-gradient(to right, ${colors.join(', ')})`;
    },
    // Labelled at the legend's OWN stops rather than at even intervals - the
    // stops are where the colour changes, so that is where a number is worth
    // reading off.
    //
    // The range is standard, so the LABELS convert while the gradient behind
    // them doesn't move: the colours mean the same thing in any unit, only the
    // numbers written on them change.
    ticks() {
      const [min, max] = this.range;
      const { toDisplay, decimals } = this.unit;
      const span = toDisplay(max) - toDisplay(min);
      return this.stops.map(([t]) => ({
        percent: t * 100,
        label: toDisplay(min + t * (max - min)).toFixed(span > 10 ? 0 : decimals),
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
