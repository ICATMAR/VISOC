<template>

  <!-- Overlay container -->
  <div class="overlay-container">

    <!-- Platform icon -->
    <div class="platform-icon-container" v-for="station in stations" :ref="station.id" :id="station.id">
      <img class="platform-icon clickable" :class="{ selected: isIconSelected(station) }" :src="iconURL" alt="Platform icon" @click="platformClicked($event, station)">
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
      // Create overlays
      for (let i = 0 ; i < this.stations.length; i++) {
        let station = this.stations[i];
        const olOverlay = new ol.Overlay({
          element: this.$refs[station.id]?.[0],
          positioning: 'center-center',
          position: ol.proj.fromLonLat([station.lon, station.lat]),
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
  data (){
    return {
      iconURL: './Assets/Icons/radar.svg',
    }
  },
  methods: {
    isIconSelected(station) {
      const id = this.$gui.selectedPlatform?.stationId;
      return id === 'TOTALS' || id === station.id;
    },
    platformClicked: function(e, station) {
      e.stopPropagation();
      this.$gui.timelineDashboardId = 'hfr';
      this.$gui.selectedPlatform = { stationId: station.id };
      this.$gui.selectedDashboard = 'platforms';
      this.$gui.isDataTimelineOpen = true;
      this.$gui.isPlatformDetailOpen = true;
      this.$gui.isMenuOpen = false;
    }
  },
  computed: {
    stations() {
      return this.$requests.hfrStations;
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
