<template>
  <!-- A value measured at a platform, on the map: a current (where the water
       goes and how fast), a wind, a wave height, a temperature... on its
       variable's colour scale - for a current the same one the HF radar
       particles are painted with, so the two can be compared at a glance. -->
  <!-- The number alone: the unit is in the tooltip and on the legend -->
  <div class="value-chip" :style="{ background: color }" :title="title">
    <i v-if="direction != null" class="fa fa-location-arrow value-chip-arrow" :style="{ rotate: (direction - 45) + 'deg' }"></i>
    <span>{{ number }}</span>
  </div>
</template>


<script>
export default {
  name: "ValueChip",
  props: {
    code: { type: String, default: 'HCSP' },  // the variable's standard code
    value: { type: Number, required: true },   // in the code's standard unit
    direction: Number,                         // degrees the arrow points TO (where the water/wind/waves go)
    range: Array,                              // the colour range, when not the code's own
    label: String,                             // who measured it, for the tooltip
    time: Date,                                // when, for the tooltip
  },
  computed: {
    unit() { return this.$gui.unitFor(this.code); },
    number() {
      const { decimals, toDisplay } = this.unit;
      return toDisplay(this.value).toFixed(decimals);
    },
    withUnit() {
      return `${this.number} ${this.unit.unit}`;
    },
    color() {
      return this.$gui.colorFor(this.code, this.value, this.range) ?? 'white';
    },
    title() {
      const parts = [this.label, this.withUnit];
      if (this.direction != null) parts.push(`${Math.round(this.direction)}º`);
      if (this.time) parts.push(this.time.toLocaleString(this.$i18n.locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' }));
      return parts.filter(Boolean).join(' · ');
    },
  },
}
</script>


<style scoped>
.value-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0px 3px;
  border-radius: 10px;
  font-size: 0.7rem;
  color: black;
  text-shadow: none;
  white-space: nowrap;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.7);
}

/* Black and unshadowed, over the global span style (white with a shadow) */
.value-chip span,
.value-chip i {
  color: black;
  text-shadow: none;
}

/* fa-location-arrow points north-east, hence the -45º */
.value-chip-arrow {
  font-size: 0.65rem;
}
</style>
