<template>

  <!-- Overlay container -->
  <div class="overlay-container">

    <!-- Platform icon -->
    <div class="platform-icon-container" v-for="buoy in buoys" :ref="buoy.id" :id="buoy.id">
      <img class="platform-icon clickable" :src="iconURL" alt="Platform icon" @click="platformClicked($event, buoy)">
      <!-- Indicator marker -->
      <div class="platform-marker-indicator"></div>
    </div>

  </div>


</template>



<script>

export default {
  name: "MapOverlayBuoys",
  created() {

  },
  mounted() {

    this.$nextTick(() => {
      if (this.map == undefined) {
        this.map = this.$parent.map; // Access the map instance from the parent component
      }
      // Create overlays
      for (let i = 0; i < this.buoys.length; i++) {
        let buoy = this.buoys[i];
        const olOverlay = new ol.Overlay({
          element: this.$refs[buoy.id]?.[0],
          positioning: 'center-center',
          position: ol.proj.fromLonLat([buoy.lon, buoy.lat]),
          stopEvent: false,
        });
        const overlayEl = olOverlay.getElement();
        overlayEl.classList.add('no-pointer-events');
        overlayEl.parentElement.classList.add('no-pointer-events');
        olOverlay.element.classList.add('no-pointer-events');
        this.map.addOverlay(olOverlay);
      }

    });
  },
  data() {
    return {
      iconURL: './Assets/Icons/buoy.svg',
    }
  },
  methods: {
    //onclick: function(e){},
    platformClicked(e, buoy) {
      e.stopPropagation();
      // Set timelineDashboardId BEFORE selectedDashboard so DTAllPlatforms can read it in created()
      this.$gui.timelineDashboardId = 'buoys';
      this.$gui.selectedPlatform = { stationId: buoy.id };
      this.$gui.selectedDashboard = 'platforms';
      this.$gui.isDataTimelineOpen = true;
      this.$gui.isPlatformDetailOpen = true;
      this.$gui.isMenuOpen = false;
    }
  },
  computed: {
    buoys() {
      return this.$requests.buoyStations;
    }
  },
}

</script>



<style scoped>
  .platform-icon-container {
    position: relative;
    display: flex;
  }



</style>
