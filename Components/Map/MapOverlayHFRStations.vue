<template>

  <!-- Overlay container -->
  <div class="overlay-container">
  
  DO THE V-FOR FOR STATIONS
    <!-- Platform icon -->
    <div class="platform-icon-container" ref="platformIcon">
      <img class="platform-icon clickable" :src="iconURL" alt="Platform icon" @click="platformClicked($event)">
      <!-- Indicator marker -->
      <div class="platform-marker-indicator"></div>
    </div>
  
  </div>
  

</template>



<script>

export default {
  name: "MapOverlayHFRStations",
  created() {
    
  },
  mounted() {

    this.$nextTick(() => {
      if (this.map == undefined) {
        this.map = this.$parent.map; // Access the map instance from the parent component
      }
      // Create overlay
      const olOverlay = new ol.Overlay({
        element: this.$refs.platformIcon,
        positioning: 'center-center',
        position: ol.proj.fromLonLat([2.191653, 41.369982]),
        stopEvent: false,
      });
      const overlayEl = olOverlay.getElement();
      overlayEl.classList.add('no-pointer-events');
      overlayEl.parentElement.classList.add('no-pointer-events');
      olOverlay.element.classList.add('no-pointer-events');
      this.map.addOverlay(olOverlay);
    });
  },
  data (){
    return {
      iconURL: './Assets/Icons/radar.svg',
      stations: [
        {
          name: 'CNET',
          lat: 42,
          lon: 3,
        },
        {
          name: 'CREU',
          lat: 42,
          lon: 2,
        },
        {
          name: 'TOSS',
          lat: 41,
          lon: 2,
        },
      ]
    }
  },
  methods: {
    //onclick: function(e){},
    platformClicked: function(e) {
      e.stopPropagation();
      this.$gui.isDataTimelineOpen = true; 
      this.$gui.isPlatformDetailOpen = true;
      this.$gui.isMenuOpen = false
    }
  },
  computed: {
    
  },
}

</script>



<style scoped>
  .platform-icon-container {
    position: relative;
    display: flex;
    /* align-items: center; */
  }

  

</style>

