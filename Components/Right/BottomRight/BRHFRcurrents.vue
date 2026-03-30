<template>
  <!-- Animation -->
  <div class="horizontal wrap options-container">
    <OnOffButtonWithText ref="toggleAnimation" :checked="false" :text="$t('data points')" :inSize="'8px'"
      @change="toggleAnimation($event)"></OnOffButtonWithText>
    <OnOffButtonWithText ref="" :checked="false" :text="$t('particle animation')" :inSize="'8px'"
      @change="toggleShowDataPoints($event)"></OnOffButtonWithText>
  </div>


<div class="gray-container">
    <!-- Currents or radials -->
    <div class="horizontal wrap button-group">
      <button class="clickable" :class="{ 'selectedOption': selectedHFRProduct == 'currents' }"
        @click="selectedHFRProduct = 'currents'">Currents</button>
      <button class="clickable" :class="{ 'selectedOption': selectedHFRProduct == 'radials' }"
        @click="selectedHFRProduct = 'radials'">Radials</button>
    </div>


    <!-- On/Off options -->
    <div class="horizontal wrap options-container">
      <OnOffButtonWithText ref="toggleShowBuoys" :checked="false" :text="$t('buoys')" :inSize="'8px'"
        @toggle="toggleShowBuoys($event)"></OnOffButtonWithText>
      <OnOffButtonWithText ref="toggleShowDrifters" :checked="false" :text="$t('drifters')" :inSize="'8px'"
        @change="toggleShowDrifters($event)"></OnOffButtonWithText>
    </div>

  </div>


  <!-- Data source -->
  <div class="gray-container">
    <div class="horizontal wrap button-group">
      <button class="clickable" :class="{ 'selectedOption': selectedSource == 'ICATMAR' }"
        @click="selectedSource = 'ICATMAR'">{{ $t('ICATMAR') }}</button>
      <button class="clickable" :class="{ 'selectedOption': selectedSource == 'EU HFR Node' }"
        @click="selectedSource = 'EU HFR Node'">{{ $t('EU HFR Node') }}</button>
      <!-- <OnOffButtonWithText ref="toggleExternalSources" :checked="false" :text="$t('EU HFR Node data')" :inSize="'8px'"
      @change="toggleExternalSources($event)"></OnOffButtonWithText> -->
    </div>
  </div>


  <!-- Color bar -->
  <div class="legend-container">
    <div class="colorbar"></div>
    <div class="legend-numbers">
      <span>0</span>
      <span>m/s</span>
      <span>1</span>
    </div>
  </div>

</template>

<script>
// Import components
import OnOffButton from '../../Utils/OnOffButton.vue';
import OnOffButtonWithText from '../../Utils/OnOffButtonWithText.vue';

export default {
  props: {
  },
  created() {
  },
  mounted() {

  },

  data() {
    return {
      selectedHFRProduct: 'currents',
      selectedSource: 'ICATMAR'
    }
  },
  methods: {
    //onclick: function(e){},
    toggleShowBuoys(e) {
      console.log(e);
      this.$emit('toggleShowBuoys');
    },
    toggleShowDrifters(e) {
      this.$emit('toggleShowDrifters');
    },
    toggleShowDataPoints(e) {
      this.$emit('toggleShowDataPoints');
    },
    toggleAnimation(e) {
      this.$emit('toggleAnimation');
    },
    toggleExternalSources(e) {
      this.$emit('toggleExternalSources');
    }
  },
  components: {
    OnOffButton,
    OnOffButtonWithText
  }
}
</script>

<style scoped>

.colorbar {
  height: 15px;
  margin: 5px 10px;
  background: linear-gradient(to right, blue, cyan, green, yellow, red);
  border-radius: 10px;
  box-shadow: 0 0 2px black;
}

.legend-numbers {
  display: flex;
  flex-wrap: nowrap;
  flex-direction: row;
  justify-content: space-between;
  margin: 0px 7px;
}


.button-group{
    display: flex;
    justify-content: flex-start;
    padding: 4px;
}
.button-group > button {
  border-radius: 10px;
  padding: 0px 12px;
  border: none;
  background: rgb(0 0 0 / 0%);
}
.button-group > button.selectedOption {
  background: var(--red);
  box-shadow: 0 0 4px black;
}
</style>