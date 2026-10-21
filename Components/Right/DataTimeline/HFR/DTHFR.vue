<template>
  <!-- Selected view: Compare once a buoy, drifter or point has been picked on
       the map; until then (and for the views still to come) what to do -->
  <DTHFRCompare v-if="$gui.hfrTab === 'Compare' && $gui.hfrPoint"></DTHFRCompare>
  <div v-else class="horizontal hfr-placeholder">
    <span>{{ $t(placeholder) }}</span>
  </div>

  <!-- Bottom options -->
  <div class="horizontal wrap button-group bottom-bar">
    <button v-for="tab in tabs" :key="tab" class="clickable" :class="{ 'selectedOption': $gui.hfrTab == tab }"
      @click="$gui.hfrTab = tab"><span>{{ $t(tab) }}</span></button>
  </div>
</template>


<script>
import DTHFRCompare from './DTHFRCompare.vue';

// The HFR dashboard's bottom section, about one place (GUIManager.hfrPoint):
// the current measured there, the radials behind it, and how the radars,
// the platforms and the models compare.
export default {
  name: "DTHFR",
  data() {
    return {
      tabs: ['Currents', 'Radials', 'Compare'],
    }
  },
  computed: {
    placeholder() {
      if (this.$gui.hfrTab === 'Compare') return 'Click a buoy or a drifter on the map to compare it with the HF radars and the models';
      return 'Coming soon: click a point on the map to see the currents and radials there';
    },
  },
  components: {
    DTHFRCompare,
  }
}

</script>


<style scoped>
.bottom-bar {
  border-top: 1px white solid;
  background: var(--blue);
}
.bottom-bar > * {
  padding-left: 10px;
  font-size: small;
}

.hfr-placeholder {
  width: 100vw;
  height: 90px;
  align-items: center;
  justify-content: center;
  background: var(--lightBlue);
  font-size: small;
}
</style>
