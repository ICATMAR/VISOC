<template>
  <div class="gray-container">
    <!-- Variable selection -->
    <div class="horizontal wrap button-group">
      <button class="clickable" v-for="variable in variables"
        :class="{ 'selectedOption': selectedVariable == variable }" @click="selectedVariable = variable">{{ $t(variable) }}</button>
    </div>

    <!-- Time scale -->
    <div class="horizontal wrap button-group">
      <button class="clickable" v-for="timeScale in timeScales"
        :class="{ 'selectedOption': selectedTimeScale == timeScale }" @click="selectedTimeScale = timeScale">{{ $t(timeScale)
        }}</button>
    </div>
  </div>

  <!-- Map layers -->
  <div class="gray-container">
    <div class="horizontal wrap button-group">
      <button class="clickable" v-for="provider in providers"
        :class="{ 'selectedOption': selectedProvider == provider }" @click="selectedProvider = provider">{{ $t(provider)
        }}</button>
    </div>
    <!-- Model time scale -->
    <Transition name="slideBottom-fade">
      <div class="horizontal wrap button-group" v-if="selectedProvider != 'x' && selectedProvider != 'ICATMAR'">
        <button class="clickable" v-for="modelTimeScale in modelTimeScales"
          :class="{ 'selectedOption': selectedModelTimeScale == modelTimeScale }" @click="selectedModelTimeScale = modelTimeScale">{{ $t(modelTimeScale)
          }}</button>
      </div>
    </Transition>
  </div>
  
  
</template>


<script>
import OnOffButtonWithText from '../../Utils/OnOffButtonWithText.vue';


export default {
  name: 'BRRemoteSensing', // Caps, no -
  props: {
  },
  created() {
  },
  mounted() {

  },
  
  data (){
    return {
      timeScales: ['instant', 'daily'],
      selectedTimeScale: 'instant',

      variables: ['sea surface temperature', 'chlorophyll-a', 'sea surface height'],
      selectedVariable: 'sea surface temperature',

      providers: ['x', 'ICATMAR', 'CMEMS-MEDSEA', 'CMEMS-IBI'],
      selectedProvider: 'x',
      modelTimeScales: ['hourly', 'daily', 'monthly'],
      selectedModelTimeScale: 'hourly',
    }
  },
  methods: {
    //onclick: function(e){},
  },
  components: {
    OnOffButtonWithText
  }
}

</script>

<style scoped>
</style>