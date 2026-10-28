<template>
  <!-- Which variable the buoys show on the map (each marker's value at the
       time handle - see MapOverlayBuoys) and its colour scale. The same
       choice as All platforms' buoys timeline (GUIManager.selectedBuoyVariableCode). -->
  <div class="filled-container">
    <div class="horizontal wrap button-group">
      <button v-for="variable in $gui.buoyVariables" :key="variable.code" class="clickable"
        :class="{ 'selectedOption': variable.code === $gui.selectedBuoyVariableCode }"
        @click="$gui.selectedBuoyVariableCode = variable.code"><span>{{ $t(variable.label) }}</span></button>
    </div>
    <DTColorLegend :code="selected.code" :range="selected.range ?? $gui.rangeFor(selected.code)"
      :showUnit="true" :fullWidth="true"></DTColorLegend>
  </div>
</template>


<script>
import DTColorLegend from '../DataTimeline/Shared/DTColorLegend.vue';

// The Buoys dashboard's bottom-right panel. (Model fields on the map - wave
// height, currents, sea temperature - are a later phase.)
export default {
  name: 'BRBuoys',
  computed: {
    selected() {
      return this.$gui.selectedBuoyVariable;
    },
  },
  components: { DTColorLegend },
}
</script>
