<template>
  <!-- Animation -->
  <div class="horizontal wrap options-container">
    <OnOffButtonWithText ref="toggleAnimation" :checked="false" :text="$t('data points')" :inSize="'10px'"
      @change="toggleAnimation($event)"></OnOffButtonWithText>
    <OnOffButtonWithText ref="" :checked="false" :text="$t('particle animation')" :inSize="'10px'"
      @change="toggleShowDataPoints($event)"></OnOffButtonWithText>
  </div>

  <!-- Currents or radials -->
  <div class="horizontal wrap button-group">
    <button class="clickable" :class="{'selectedProduct': selectedHFRProduct == 'currents'}" @click="selectedHFRProduct = 'currents'">Currents</button>
    <button class="clickable" :class="{'selectedProduct': selectedHFRProduct == 'radials'}" @click="selectedHFRProduct = 'radials'">Radials</button>
  </div>

  <!-- On/Off options -->
  <div class="horizontal wrap options-container">
    <OnOffButtonWithText ref="toggleShowBuoys" :checked="false" :text="$t('buoys')" :inSize="'10px'"
      @toggle="toggleShowBuoys($event)"></OnOffButtonWithText>
    <OnOffButtonWithText ref="toggleShowDrifters" :checked="false" :text="$t('drifters')" :inSize="'10px'"
      @change="toggleShowDrifters($event)"></OnOffButtonWithText>
  </div>

  

  <!-- External data -->
  <div class="horizontal wrap options-container">
    <OnOffButtonWithText ref="toggleExternalSources" :checked="false" :text="$t('EU HFR Node data')" :inSize="'10px'"
      @change="toggleExternalSources($event)"></OnOffButtonWithText>
  </div>

  <div class="divider-small"></div>

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
      selectedHFRProduct: 'currents'
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
.divider-small {
  height: 1px;
  margin: 8px;
  background: var(--lightGray);
}

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
    background: var(--lightGray);
    border-radius: 10px;
    display: flex;
    justify-content: flex-start;
}
.button-group > button {
  border-radius: 10px;
  padding: 0px 12px;
  border: none;
  background: rgb(0 0 0 / 0%);
}
.button-group > button.selectedProduct {
  background: var(--red);
  box-shadow: 0 0 4px black;
}
</style>