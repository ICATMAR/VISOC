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
import DTHFRDefault from './DTHFRDefault.vue';
import DTHFRModels from './DTHFRModels.vue';

export default {
  name: "DTHFR",
  data() {
    return {
      bottomOptions: ['Default view', 'Compare with models', 'Detail currents'],
      selectedOption: 'Default view',
    }
  },
  computed: {
    currentView() {
      return this.selectedOption == 'Compare with models' ? 'DTHFRModels' : 'DTHFRDefault';
    }
  },
  components: {
    DTHFRDefault,
    DTHFRModels
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
