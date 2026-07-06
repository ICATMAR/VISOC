<template>

  <!-- Overlay container -->
  <div class="overlay-container">

    <!-- Platform icon -->
    <div class="platform-icon-container" v-for="buoy in buoys" :ref="buoy.id" :id="buoy.id">
      <img class="platform-icon clickable" :class="{ selected: isIconSelected(buoy) }" :src="iconURL" alt="Platform icon" @click="platformClicked($event, buoy)">
      <!-- Status indicator -->
      <div class="platform-status-indicator" :class="buoyStatus(buoy)"></div>
      <!-- ICATMAR marker -->
      <div class="platform-marker-indicator">
        <img :src="icatmarLogoURL" alt="">
      </div>
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
      icatmarLogoURL: './Assets/Icons/icatmar-mini.png',
    }
  },
  methods: {
    buoyStatus(buoy) {
      return this.$requests.getStationStatus(buoy.id, 'buoy');
    },
    isIconSelected(buoy) {
      if (this.$gui.selectedDashboard !== 'platforms' || this.$gui.timelineDashboardId !== 'buoys') return false;
      return this.$gui.selectedPlatform?.stationId === buoy.id;
    },
    updateZIndices() {
      for (const buoy of this.buoys) {
        const wrapper = this.$refs[buoy.id]?.[0]?.parentElement;
        if (wrapper) wrapper.style.zIndex = this.isIconSelected(buoy) ? '10' : '';
      }
    },
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
