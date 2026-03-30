<template>
<!-- Variables to show -->
 <div class="horizontal wrap options-container gray-container">
    <OnOffButtonWithText v-for="variable in variables" :key="variable" :checked="false" :text="$t(variable)" :inSize="'8px'"
      @change="toggleVariable($event, variable)"></OnOffButtonWithText>
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
      variables: ['wind', 'waves', 'currents', 'sea surface temperature', 'salinity', 'air temperature', 'pressure', 'relative humidity']
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