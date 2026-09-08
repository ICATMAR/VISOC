<template>
  <!-- Which variable the buoy rows' colours read as, and what those colours
       mean. Sits below DTAllPlatforms' HFR currents/Buoys/Drifters tabs -
       only relevant to the Buoys view, so it isn't part of that shared bar.
       UI only for now: picking an item doesn't yet change what the timeline
       draws (see DTAPBuoys.vue). -->
  <div class="vertical variable-bar">
    <div class="horizontal wrap button-group variable-menu">
      <button v-for="item in items" :key="item.code" class="clickable"
        :class="{ 'selectedOption': selected === item }"
        @click="selected = item"><span>{{ $t(item.label) }}</span></button>
    </div>
    <div class="horizontal legend-row">
      <div class="legend-gradient" :style="{ background: legendGradient }"></div>
    </div>
  </div>
</template>


<script>
// Standard code each button reads its colour scale under (see
// styles/colorLegends.js and GUIManager.colorLegend). Water temp. and Air
// temp. share one palette there (TEMPERATURE) but are kept as separate
// buttons - they're different sensors/codes (TEMP vs DRYT), the shared look
// is incidental.
const ITEMS = [
  { label: 'Wind', code: 'WSPD' },
  { label: 'Waves', code: 'VHM0' },
  { label: 'Water temp.', code: 'TEMP' },
  { label: 'Air temp.', code: 'DRYT' },
];

export default {
  name: "DTAPBuoysVariableBar",
  data() {
    return {
      items: ITEMS,
      selected: ITEMS[0],
    }
  },
  computed: {
    // A CSS gradient built straight from the legend's own [t, [r,g,b]] stops
    // (t already normalized 0..1), so this always matches colorLegends.js
    // without a second copy of the stops to keep in sync.
    legendGradient() {
      const stops = this.$gui.colorLegend(this.selected.code);
      const colors = stops.map(([t, [r, g, b]]) => `rgb(${r}, ${g}, ${b}) ${t * 100}%`);
      return `linear-gradient(to right, ${colors.join(', ')})`;
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

.legend-row {
  padding: 0 4px;
}

.legend-gradient {
  height: 10px;
  width: 100%;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.4);
}
</style>
