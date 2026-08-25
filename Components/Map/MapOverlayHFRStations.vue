<template>

  <!-- Overlay container -->
  <div class="overlay-container">

    <!-- Platform icon -->
    <div class="platform-icon-container" v-for="station in stations" :ref="station.id" :id="station.id">
      <img class="platform-icon clickable" :class="{ selected: isIconSelected(station), offline: stationStatus(station) === 'offline' }" :src="iconURL" alt="Platform icon" @click="platformClicked($event, station)">
      <!-- Status indicator -->
      <div class="platform-status-indicator" :class="stationStatus(station)" v-if="stationStatus(station) != 'offline'"></div>
      <!-- ICATMAR marker - only for ICATMAR's own stations -->
      <div class="platform-marker-indicator" v-if="isICATMARStation(station)">
        <img :src="icatmarLogoURL" alt="">
      </div>
    </div>

  </div>


</template>



<script>

export default {
  name: "MapOverlayHFRStations",
  mounted() {

    this.$nextTick(() => {
      if (this.map == undefined) {
        this.map = this.$parent.map; // Access the map instance from the parent component
      }
      this.loadStations();
    });
  },
  data (){
    return {
      iconURL: './Assets/Icons/radar.svg',
      icatmarLogoURL: './Assets/Icons/icatmar-mini.png',
      stations: [],
    }
  },
  methods: {
    // getAllNetworks() groups stations by network (each { total, stations })
    // - flattened here since the map just shows every station regardless of
    // which network it's on.
    async loadStations() {
      const groups = await this.$dataService.hfrnetwork.getAllNetworks(this.$dataService.hfrstations);
      this.stations = groups.flatMap(g => g.stations);

      await this.$nextTick(); // wait for the v-for to render before refs exist
      this.createOverlays();
    },
    createOverlays() {
      for (let i = 0; i < this.stations.length; i++) {
        let station = this.stations[i];
        const olOverlay = new ol.Overlay({
          element: this.$refs[station.id]?.[0],
          positioning: 'center-center',
          position: ol.proj.fromLonLat([station.longitude, station.latitude]),
          stopEvent: false,
        });
        const overlayEl = olOverlay.getElement();
        overlayEl.classList.add('no-pointer-events');
        overlayEl.parentElement.classList.add('no-pointer-events');
        olOverlay.element.classList.add('no-pointer-events');
        this.map.addOverlay(olOverlay);
      }
    },
    // Based on how stale time_coverage_end is: <3h active, up to 1 day
    // delayed, up to 30 days inactive, older than that offline.
    stationStatus(station) {
      const endStr = station.metadata?.time_coverage_end;
      if (!endStr) return 'inactive';

      const ageHours = (Date.now() - new Date(endStr).getTime()) / 3600000;
      if (ageHours < 3) return 'active';
      if (ageHours <= 24) return 'delayed';
      if (ageHours <= 24 * 30) return 'inactive';
      return 'offline';
    },
    isICATMARStation(station) {
      return station.metadata?.network === 'HFR-ICATMAR' && station.id != 'CNET';
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
