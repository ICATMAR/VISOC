<template>
  <!-- Which variable the buoy rows draw, and what its colours mean. Sits below
       DTAllPlatforms' HFR currents/Buoys/Drifters tabs - only relevant to the
       Buoys view, so it isn't part of that shared bar. The selection lives on
       $gui because DTAPBuoys needs it too (see buoyVariables there). -->
  <div class="vertical variable-bar">
    <div class="horizontal wrap button-group variable-menu">
      <button v-for="item in $gui.buoyVariables" :key="item.code" class="clickable"
        :class="{ 'selectedOption': $gui.selectedBuoyVariableCode === item.code }"
        @click="$gui.selectedBuoyVariableCode = item.code"><span>{{ $t(item.label) }}</span></button>
    </div>

    <!-- The scale the cells are coloured by: unit first, then the gradient
         with its own stops labelled where they actually fall. -->
    <div class="horizontal legend">
      <!-- The unit doubles as its own picker, the way boiasomorrostro's
           DTLayout does it. Switching is by quantity, not by variable, so
           picking knots here puts every wind reading in the app into knots -
           and nothing is refetched, since only the drawing changes. -->
      <span class="legend-unit" :class="{ clickable: switchable }"
        :title="switchable ? $t('Change units') : ''"
        @click="switchable && $gui.cycleUnit(selected.code)">{{ unit.unit }}</span>
      <div class="legend-scale" :style="{ background: legendGradient }">
        <span v-for="tick in ticks" :key="tick.percent" class="legend-tick"
          :style="{ left: tick.percent + '%' }">{{ tick.label }}</span>
      </div>
    </div>
  </div>
</template>


<script>

export default {
  name: "DTAPBuoysVariableBar",
  computed: {
    selected() {
      return this.$gui.selectedBuoyVariable;
    },
    // { unit, decimals, toDisplay } for whatever the user has picked
    unit() {
      return this.$gui.unitFor(this.selected.code);
    },
    switchable() {
      return this.$gui.isUnitSwitchable(this.selected.code);
    },
    // A CSS gradient built straight from the legend's own [t, [r,g,b]] stops
    // (t already normalized 0..1), so this always matches colorLegends.js
    // without a second copy of the stops to keep in sync. The same scale the
    // cells are coloured by (see DTAPBuoys.cellColor).
    legendGradient() {
      const colors = this.stops.map(([t, [r, g, b]]) => `rgb(${r}, ${g}, ${b}) ${t * 100}%`);
      return `linear-gradient(to right, ${colors.join(', ')})`;
    },
    stops() {
      return this.$gui.colorLegend(this.selected.code);
    },
    // Labelled at the legend's OWN stops rather than at even intervals - the
    // stops are where the colour actually changes, so that is where a number
    // is worth reading off. Their positions are the same 0..1 the gradient
    // uses, mapped onto the variable's range.
    //
    // The range is standard, so the LABELS convert while the gradient behind
    // them doesn't move - the colours mean the same thing in any unit, only
    // the numbers written on them change.
    ticks() {
      const [min, max] = this.selected.range;
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
.variable-bar {
  background: var(--blue);
  border-top: 1px white solid;
  padding: 4px 10px 8px;
  gap: 4px;
}

.variable-menu {
  padding: 0;
}

.variable-menu > button {
  font-size: small;
}

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
   first and last would half-overflow the bar, so they are nudged inside by
   the same trick the ends of a slider use. */
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
