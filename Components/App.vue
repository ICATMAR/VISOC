<template>
  <div id="app">
    <!-- MAP -->
    <section class="map-container">

    </section>

    <!-- RIGHT PANEL -->
    <RightPanel :class="$gui.isMenuOpen ? 'move':''"></RightPanel>

    <!-- MENU -->
    <Menu></Menu>

    <!-- Timeline -->
    <Timeline :class="$gui.isMenuOpen ? 'move':''"></Timeline>
  </div>
</template>


<script setup>
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
  display: flex;
  flex-direction: column;
  background: green;
}


.move {
  right: 400px !important;
}


</style>