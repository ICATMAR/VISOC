<template>
  
  <div class="bottom-right-container">
  <template v-if="$gui.selectedDashboard == 'hfr'">
    <BRHFRcurrents></BRHFRcurrents>
  </template>
  
    
  </div>

</template>



<script>
import BRHFRcurrents from './BRHFRcurrents.vue';

export default {
  name: 'bottomRight', // Caps, no -
  props: {
  },
  created() {
  },
  mounted() {

  },
  
  data (){
    return {
    }
  },
  methods: {
    //onclick: function(e){},
  },
  components: {
    BRHFRcurrents
  }
}

</script>




<style scoped>
:deep(.options-container) {
  font-size: x-small;
  gap: 20px;
  padding: 5px;
}

:deep(.onoff-option) {
  gap: 5px;
}
</style>