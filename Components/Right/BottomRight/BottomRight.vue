<template>
  <div class="bottom-right-container">
    <!-- HFR currents -->
    <template v-if="$gui.selectedDashboard == 'hfr'">
      <BRHFRcurrents></BRHFRcurrents>
    </template>
    <!-- Buoys -->
    <template v-else-if="$gui.selectedDashboard == 'buoys'">
      <BRBuoys></BRBuoys>
    </template>
      


  </div>

</template>



<script>
import BRHFRcurrents from './BRHFRcurrents.vue';
import BRBuoys from './BRBuoys.vue';

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
    BRHFRcurrents,
    BRBuoys,
  }
}

</script>




<style scoped>
:deep(*){
  font-size: x-small;
}

:deep(.options-container) {
  gap: 5px 20px;
  padding: 5px;
}

:deep(.gray-container) {
  background: var(--lightGray);
  border-radius: 10px;
  margin-bottom: 10px;
}

:deep(.onoff-option) {
  gap: 5px;
}
</style>