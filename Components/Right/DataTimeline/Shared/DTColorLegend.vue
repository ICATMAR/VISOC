<template>
  <!-- The colour scale a set of cells is painted with: the unit, then the
       gradient with its stops labelled where they actually fall.
       Not currently placed anywhere - it was the buoys timeline's legend until
       the variable picker became a dropdown, and is kept whole for wherever it
       is wanted next. Give it a `code` (which legend and which unit) and a
       `range` IN STANDARD UNITS (what the gradient spans). -->
  <div class="horizontal legend">
    <span class="legend-unit" :class="{ clickable: switchable }"
      :title="switchable ? $t('Change units') : ''"
      @click="switchable && $gui.cycleUnit(code)">{{ unit.unit }}</span>
    <div class="legend-scale" :style="{ background: gradient }">
      <span v-for="tick in ticks" :key="tick.percent" class="legend-tick"
        :style="{ left: tick.percent + '%' }">{{ tick.label }}</span>
    </div>
  </div>
</template>


<script>

export default {
  name: "DTColorLegend",
  props: {
    code: { type: String, required: true },  // standard code - picks the legend and the unit
    range: { type: Array, required: true },  // [min, max] in STANDARD units
  },
  computed: {
    stops() {
      return this.$gui.colorLegend(this.code);
    },
    unit() {
      return this.$gui.unitFor(this.code);
    },
    switchable() {
      return this.$gui.isUnitSwitchable(this.code);
    },
    // Built straight from the legend's own [t, [r,g,b]] stops (t already
    // normalized 0..1), so this always matches colorLegends.js without a
    // second copy of the stops to keep in sync.
    gradient() {
      const colors = this.stops.map(([t, [r, g, b]]) => `rgb(${r}, ${g}, ${b}) ${t * 100}%`);
      return `linear-gradient(to right, ${colors.join(', ')})`;
    },
    // Labelled at the legend's OWN stops rather than at even intervals - the
    // stops are where the colour actually changes, so that is where a number
    // is worth reading off.
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
  max-width: 320px;
  width: 100%;
  height: 22px;
  border-radius: 11px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.25);
}

.legend-unit {
  flex: 0 0 auto;
  padding: 0 8px;
  font-size: 0.7rem;
  line-height: 22px;
  white-space: nowrap;
}

.legend-unit.clickable {
  text-decoration: underline;
}

.legend-scale {
  position: relative;
  flex: 1;
  height: 100%;
}

/* Centred on the value it marks, so a label sits over its own colour. The
   first and last would half-overflow the bar, so they are pulled inside. */
.legend-tick {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.65rem;
  color: rgba(0, 0, 0, 0.8);
  text-shadow: none;
  white-space: nowrap;
  pointer-events: none;
}

.legend-tick:first-child {
  transform: translate(0, -50%);
  padding-left: 2px;
}

.legend-tick:last-child {
  transform: translate(-100%, -50%);
  padding-right: 2px;
}
</style>
