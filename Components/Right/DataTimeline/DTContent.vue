<template>
  <!-- All platforms -->
  <template v-if="$gui.selectedDashboard == 'platforms'">
    <DTAllPlatforms></DTAllPlatforms>
  </template>
  <!-- HFR currents -->
  <template v-else-if="$gui.selectedDashboard == 'hfr'">
    <DTHFR></DTHFR>
  </template>
  <!-- Buoys -->
  <template v-else-if="$gui.selectedDashboard == 'buoys'">
    <DTBuoys></DTBuoys>
  </template>
</template>


<script>
import DTAllPlatforms from './AllPlatforms/DTAllPlatforms.vue';
import DTHFR from './HFR/DTHFR.vue';
import DTBuoys from './Buoys/DTBuoys.vue';

export default {
  name: "DTContent",
  components: {
    DTAllPlatforms,
    DTHFR,
    DTBuoys
  }
}

</script>
