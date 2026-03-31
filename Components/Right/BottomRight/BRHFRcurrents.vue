<template>
  <!-- Animation -->
 <div class="horizontal wrap options-container">
    <OnOffButtonWithText ref="" :checked="true" :text="$t('particle animation')" :inSize="'8px'"
      @change="toggleShowDataPoints($event)"></OnOffButtonWithText>
    <OnOffButtonWithText ref="toggleAnimation" :checked="false" :text="$t('data points')" :inSize="'8px'"
      @change="toggleAnimation($event)"></OnOffButtonWithText>

  </div>


  <div class="filled-container">
    <!-- Currents or radials -->
    <div class="horizontal wrap button-group">
      <button class="clickable" :class="{ 'selectedOption': selectedHFRProduct == 'currents' }"
        @click="selectedHFRProduct = 'currents'"><span>{{ $t('Currents') }}</span></button>
      <button class="clickable" :class="{ 'selectedOption': selectedHFRProduct == 'radials' }"
        @click="selectedHFRProduct = 'radials'"><span>{{ $t('Radials') }}</span></button>
    </div>

    <!-- Radial antennas on/off -->
    <Transition name="slideBottom-fade">
      <div class="horizontal wrap options-container" v-if="selectedHFRProduct == 'radials'">
        <OnOffButtonWithText v-for="radial in radials" :key="radial" :checked="true" :text="$t(radial)" :inSize="'8px'"
          @change="toggleShowRadial($event, radial)"></OnOffButtonWithText>
      </div>
    </Transition>


  </div>

  <div class="filled-container">
    <!-- On/Off options -->
    <div class="horizontal wrap options-container">
      <OnOffButtonWithText ref="toggleShowBuoys" :checked="false" :text="$t('buoys')" :inSize="'8px'"
        @toggle="toggleShowBuoys($event)"></OnOffButtonWithText>
      <OnOffButtonWithText ref="toggleShowDrifters" :checked="false" :text="$t('drifters')" :inSize="'8px'"
        @change="toggleShowDrifters($event)"></OnOffButtonWithText>
    </div>
  </div>

  <!-- Data source -->
  <div class="filled-container">
    <div class="horizontal wrap button-group">
      <button class="clickable" :class="{ 'selectedOption': selectedSource == 'ICATMAR' }"
        @click="selectedSource = 'ICATMAR'"><span>{{ $t('ICATMAR') }}</span></button>
      <button class="clickable" :class="{ 'selectedOption': selectedSource == 'EU HFR Node' }"
        @click="selectedSource = 'EU HFR Node'"><span>{{ $t('EU HFR Node') }}</span></button>
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
      radials: ['CNET', 'CREU', 'BEGU', 'TOSS', 'AREN', 'PBCN', 'GNST', 'SCAL'],
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
    },
    toggleShowRadial(e, radial) {
      this.$emit('toggleShowRadial', radial);
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

</style>