<template>
  <!-- Selected view -->
  <component :is="currentView"></component>

  <!-- Bottom options -->
  <div class="horizontal wrap button-group bottom-bar">
    <button v-for="opt in bottomOptions" :key="opt" class="clickable" :class="{ 'selectedOption': selectedOption == opt }"
      @click="selectedOption = opt"><span>{{ $t(opt) }}</span></button>
  </div>
</template>


<script>
import DTAPHFR from './DTAPHFR.vue';
import DTAPBuoys from './DTAPBuoys.vue';
import DTAPDrifters from './DTAPDrifters.vue';
import DTAPArgos from './DTAPArgos.vue';

export default {
  name: "DTAllPlatforms",
  data() {
    return {
      bottomOptions: ['HF radars', 'Buoys', 'Drifters', 'Argos', 'Satellite'],
      selectedOption: 'HF radars',
    }
  },
  computed: {
    currentView() {
      const map = {
        'HF radars': 'DTAPHFR',
        'Buoys': 'DTAPBuoys',
        'Drifters': 'DTAPDrifters',
        'Argos': 'DTAPArgos',
      };
      return map[this.selectedOption] || 'DTAPHFR';
    }
  },
  components: {
    DTAPHFR,
    DTAPBuoys,
    DTAPDrifters,
    DTAPArgos
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
  font-size: x-small;
}

</style>
