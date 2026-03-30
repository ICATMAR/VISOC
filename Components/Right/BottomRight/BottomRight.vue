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
    <!-- Drifters -->
    <template v-else-if="$gui.selectedDashboard == 'drifters'">
      <BRDrifters></BRDrifters>
    </template>
    <!-- Argos -->
    <template v-else-if="$gui.selectedDashboard == 'argos'">
      <BRArgos></BRArgos>
    </template>
    <!-- Satellites -->
    <template v-else-if="$gui.selectedDashboard == 'remoteSensing'">
      <BRRemoteSensing></BRRemoteSensing>
    </template>
      


  </div>

</template>



<script>
import BRHFRcurrents from './BRHFRcurrents.vue';
import BRBuoys from './BRBuoys.vue';
import BRDrifters from './BRDrifters.vue';
import BRArgos from './BRArgos.vue';
import BRRemoteSensing from './BRRemoteSensing.vue';

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
    BRDrifters,
    BRArgos,
    BRRemoteSensing
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

:deep(.button-group){
    display: flex;
    justify-content: flex-start;
    padding: 4px;
}
:deep(.button-group) > button {
  border-radius: 10px;
  padding: 0px 12px;
  border: none;
  background: rgb(0 0 0 / 0%);
}
:deep(.button-group) > button.selectedOption {
  background: var(--red);
  box-shadow: 0 0 4px black;
}
</style>