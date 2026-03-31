<template>
<!-- Variables to show -->
 <div class="horizontal wrap options-container filled-container">
 <!-- Make the first X variables on by default -->
    <OnOffButtonWithText v-for="(variable, index) in variables" :key="variable" :checked="index < 3" :text="$t(variable)" :inSize="'8px'"
      @change="toggleVariable($event, variable)"></OnOffButtonWithText>
  </div>

  <!-- Map layers -->
  <div class="filled-container">
    <!-- Variable type -->
    <div class="horizontal wrap button-group">
      <button class="clickable" v-for="variable in modelVariables"
        :class="{ 'selectedOption': selectedModelVariable == variable }" @click="selectedModelVariable = variable"><span>{{ $t(variable)}}</span></button>
    </div>
    <!-- Provider -->
    <Transition name="slideBottom-fade">
      <div class="horizontal wrap button-group" v-if="selectedModelVariable != 'x'">
        <button class="clickable" v-for="provider in modelProviders"
          :class="{ 'selectedOption': selectedModelProvider == provider }" @click="selectedModelProvider = provider"><span>{{ $t(provider)  }}</span></button>
      </div>
    </Transition>
    <!-- Model time scale -->
    <Transition name="slideBottom-fade">
      <div class="horizontal wrap button-group" v-if="selectedModelVariable != 'x' && selectedModelProvider != 'ICATMAR'">
        <button class="clickable" v-for="modelTimeScale in modelTimeScales"
          :class="{ 'selectedOption': selectedModelTimeScale == modelTimeScale }" @click="selectedModelTimeScale = modelTimeScale"><span>{{ $t(modelTimeScale)}}</span></button>
      </div>
    </Transition>
  </div>


</template>


<script>
import OnOffButtonWithText from '../../Utils/OnOffButtonWithText.vue';


export default {
  name: 'BRBuoys', // Caps, no -
  props: {
  },
  created() {
  },
  mounted() {

  },
  
  data (){
    return {
      variables: ['wind', 'waves', 'currents', 'sea surface temperature', 'salinity', 'air temperature', 'pressure', 'relative humidity'],

      modelVariables: ['x', 'wave height', 'currents', 'sea surface temperature'],
      selectedModelVariable: 'x',

      modelProviders: ['ICATMAR', 'CMEMS-MEDSEA', 'CMEMS-IBI'],
      selectedModelProvider: 'ICATMAR',
      modelTimeScales: ['hourly', 'daily', 'monthly'],
      selectedModelTimeScale: 'hourly',
    }
  },
  methods: {
    //onclick: function(e){},
    toggleVariable(e, variable) {
      // Implementation for toggling variable state
    }
  },
  components: {
    OnOffButtonWithText
  }
}
</script>