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

</template>


  <script>
import OnOffButtonWithText from '../../Utils/OnOffButtonWithText.vue';


  export default {
    name: 'BRArgos', // Caps, no -
    props: {
    },
    created() {
    },
    mounted() {

    },

    data() {
      return {
        timeScales: ['10 days', '1 month', '3 months'],
        selectedTimeScale: '10 days',
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