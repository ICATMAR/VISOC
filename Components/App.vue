<template>
  <div id="app">
    <!-- MAP -->
    <section class="map-container">
      <Map></Map>
      <button v-on:click="()=>{$gui.isDataTimelineOpen = true; $gui.isMenuOpen = false}">On platform click</button>
    </section>

    <!-- RIGHT PANEL AND BOTTOM PANEL-->
    <RightPanel :class="$gui.isMenuOpen ? 'moveWhenMenuOpens':''"></RightPanel>

    <!-- MENU -->
    <Menu></Menu>

    <!-- Timeline -->
    <Transition name="slideBottom-fade">
      <Timeline v-show="!$gui.isMenuOpen && !$gui.isDataTimelineOpen && $gui.selectedDashboard != 'platforms'"></Timeline>
    </Transition>
  </div>
</template>


<script setup>
import Map from './Map/Map.vue';
import Menu from './Right/Menu.vue';
import RightPanel from './Right/RightPanel.vue';
import Timeline from './Timeline/Timeline.vue';
</script>


<script setup>
export default {
  name: "App",
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
  }
}
</script>


<style scoped>
#app {
  width: 100vw;
  height: 100dvh; /* Use 100dvh for better mobile viewport handling */
  height: 100vh;
  position: fixed;
  background: blue;
}

.map-container {
  position: relative;
  width: 100%;
  height: 100%;
}


.moveWhenMenuOpens {
  right: 400px !important;
}

.hideWhenDataTimelineOpens {
  opacity: 0;
  transition: opacity 0.5s ease;
}

</style>