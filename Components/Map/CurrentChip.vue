<template>
  <!-- A current measured at a platform, on the map: where the water goes (the
       arrow) and how fast, on the current-speed colour scale - the same one
       the HF radar particles are painted with, so the two can be compared at
       a glance. -->
  <div class="current-chip" :style="{ background: color }" :title="title">
    <i v-if="direction != null" class="fa fa-location-arrow current-chip-arrow" :style="{ rotate: (direction - 45) + 'deg' }"></i>
    <span>{{ value }}</span>
  </div>
</template>


<script>
export default {
  name: "CurrentChip",
  props: {
    speed: { type: Number, required: true },  // m/s
    direction: Number,                         // degrees, where the water goes TO
    label: String,                             // who measured it, for the tooltip
    time: Date,                                // when, for the tooltip
  },
  computed: {
    unit() { return this.$gui.unitFor('HCSP'); },
    value() {
      const { decimals, toDisplay, unit } = this.unit;
      return `${toDisplay(this.speed).toFixed(decimals)} ${unit}`;
    },
    color() {
      return this.$gui.colorFor('HCSP', this.speed) ?? 'white';
    },
    title() {
      const parts = [this.label, this.value];
      if (this.direction != null) parts.push(`${Math.round(this.direction)}º`);
      if (this.time) parts.push(this.time.toLocaleString(this.$i18n.locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' }));
      return parts.filter(Boolean).join(' · ');
    },
  },
}
</script>


<style scoped>
.current-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 7px;
  font-size: 0.7rem;
  font-weight: bold;
  color: black;
  text-shadow: none;
  white-space: nowrap;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.7);
}

/* fa-location-arrow points north-east, hence the -45º */
.current-chip-arrow {
  font-size: 0.65rem;
}
</style>
