<template>

  <!-- Overlay container -->
  <div class="overlay-container">
  
  
    <!-- Platform icon -->
    <div class="platform-icon-container" ref="mockupPlatform">
      <img class="platform-icon clickable" :src="mockupIconURL" alt="Platform icon" @click="platformClicked($event)">
      <!-- Indicator marker -->
      <div class="platform-marker-indicator"></div>

    </div>
  
  </div>
  

</template>



<script>

export default {
  name: "MapOverlayMockup",
  created() {
    
  },
  mounted() {

    this.$nextTick(() => {
      if (this.map == undefined) {
        this.map = this.$parent.map; // Access the map instance from the parent component
      }
      // Create overlay
      const mockupOverlay = new ol.Overlay({
        element: this.$refs.mockupPlatform,
        positioning: 'center-center',
        position: ol.proj.fromLonLat([2.191653, 41.369982]),
        stopEvent: false,
      });
      const mockupEl = mockupOverlay.getElement();
      mockupEl.classList.add('no-pointer-events');
      mockupEl.parentElement.classList.add('no-pointer-events');
      mockupOverlay.element.classList.add('no-pointer-events');
      this.map.addOverlay(mockupOverlay);
    });
  },
  data (){
    return {
      mockupIconURL: './Assets/Icons/buoy.svg'
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
  

</style>

