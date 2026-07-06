<template>

  <!-- Overlay container -->
  <div class="overlay-container">

    <!-- Platform icon -->
    <div class="platform-icon-container" v-for="station in stations" :ref="station.id" :id="station.id">
      <img class="platform-icon clickable" :class="{ selected: isIconSelected(station) }" :src="iconURL" alt="Platform icon" @click="platformClicked($event, station)">
      <!-- Status indicator -->
      <div class="platform-status-indicator" :class="stationStatus(station)"></div>
      <!-- ICATMAR marker -->
      <div class="platform-marker-indicator">
        <img :src="icatmarLogoURL" alt="">
      </div>
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
      icatmarLogoURL: './Assets/Icons/icatmar-mini.png',
    }
  },
  methods: {
    stationStatus(station) {
      return this.$requests.getStationStatus(station.id, 'hfr');
    },
    isIconSelected(station) {
      if (this.$gui.selectedDashboard !== 'platforms' || this.$gui.timelineDashboardId !== 'hfr') return false;
      const id = this.$gui.selectedPlatform?.stationId;
      return id === 'TOTALS' || id === station.id;
    },
    updateZIndices() {
      for (const station of this.stations) {
        const wrapper = this.$refs[station.id]?.[0]?.parentElement;
        if (wrapper) wrapper.style.zIndex = this.isIconSelected(station) ? '10' : '';
      }
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
  watch: {
    '$gui.selectedPlatform'()    { this.$nextTick(() => this.updateZIndices()); },
    '$gui.selectedDashboard'()   { this.$nextTick(() => this.updateZIndices()); },
    '$gui.timelineDashboardId'() { this.$nextTick(() => this.updateZIndices()); },
  },
}

</script>



<style scoped>
  .platform-icon-container {
    position: relative;
    display: flex;
  }



</style>
