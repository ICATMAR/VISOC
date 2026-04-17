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
  .platform-icon-container {
    position: relative;
    display: flex;
    /* align-items: center; */
  }

  .platform-icon {
    width: 25px;
    height: 25px;

    background: var(--lightBlue);
    border-radius: 50%;
    box-shadow: 0px 0px 5px black;

    margin-left: 3px;
    margin-right: 3px;
  }

  .platform-icon:hover {
    background-color: var(--blue);
  }

  .platform-marker-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--red);
    border: solid 1px black;
    translate: 22px;
    position: absolute;
  }

</style>

