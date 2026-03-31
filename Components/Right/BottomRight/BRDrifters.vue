<template>

  <!-- Show trajectories -->
  <div class="filled-container">
    <!-- On off -->
    <div class="horizontal wrap options-container">
      <OnOffButtonWithText :checked="true" :text="$t('Show trajectories')" :inSize="'8px'" @change="() => { }">
      </OnOffButtonWithText>
    </div>
    <!-- Time scale -->
    <div class="horizontal wrap button-group">
      <button class="clickable" v-for="timeScale in timeScales"
        :class="{ 'selectedOption': selectedTimeScale == timeScale }" @click="selectedTimeScale = timeScale"><span>{{ $t(timeScale)}}</span></button>
    </div>


  </div>

  <!-- Drifters types -->
  <div class="filled-container">
    <!-- Drifer types -->
    <div class="horizontal wrap options-container">
      <OnOffButtonWithText v-for="type in drifterTypes" :key="type" :checked="true" :text="$t(type)" :inSize="'8px'"
        @change="toggleDrifterType($event, type)"></OnOffButtonWithText>
    </div>
    <!-- Map layers -->
    <!-- Variable type -->
    <div class="horizontal wrap button-group">
      <button class="clickable" v-for="variable in variables"
        :class="{ 'selectedOption': selectedVariable == variable }" @click="selectedVariable = variable"><span>{{ $t(variable)}}</span></button>
    </div>
    <!-- Provider -->
    <Transition name="slideBottom-fade">
      <div class="horizontal wrap button-group" v-if="selectedVariable != 'x'">
        <button class="clickable" v-for="provider in currentsProviders"
          :class="{ 'selectedOption': selectedProvider == provider }" @click="selectedProvider = provider"><span>{{ $t(provider)  }}</span></button>
      </div>
    </Transition>
    <!-- Model time scale -->
    <Transition name="slideBottom-fade">
      <div class="horizontal wrap button-group" v-if="selectedVariable != 'x' && selectedProvider != 'ICATMAR'">
        <button class="clickable" v-for="modelTimeScale in modelTimeScales"
          :class="{ 'selectedOption': selectedModelTimeScale == modelTimeScale }" @click="selectedModelTimeScale = modelTimeScale"><span>{{ $t(modelTimeScale)  }}</span></button>
      </div>
    </Transition>

  </div>

  


</template>


<script>
import OnOffButtonWithText from '../../Utils/OnOffButtonWithText.vue';

export default {
  name: 'BRDrifters', // Caps, no -
  props: {
  },
  created() {
  },
  mounted() {

  },
  
  data (){
    return {
      drifterTypes: ['SVP', 'CODE', 'Stokes','Others'],

      variables: ['x','currents', 'sea surface temperature'],
      selectedVariable: 'x',

      currentsProviders: ['ICATMAR', 'CMEMS-MEDSEA', 'CMEMS-IBI'],
      selectedProvider: 'ICATMAR',
      modelTimeScales: ['hourly', 'daily', 'monthly'],
      selectedModelTimeScale: 'hourly',

      timeScales: ['1 day', '7 days', '15 days', '1 month'],
      selectedTimeScale: '7 days',
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