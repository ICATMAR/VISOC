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
      // Copied, so the live merge below writes to these and not to the static
      // file's own objects - that module is shared with everything else reading it.
      this.stations = this.$dataService.hfrnetwork.getIcatmarNetwork().stations.map(station => ({ ...station }));
      await this.$nextTick(); // wait for the v-for to render before refs exist
      this.createOverlays();
      // Get live data for all networks, so that the status of each station can be determined.
      const networks = await this.$dataService.hfrnetwork.getAllNetworks(this.$dataService.hfrstations);

      // Create new stations or merge static ones. The static ones already have
      // an overlay each, so they are updated in place - same objects, same
      // positions - instead of being replaced by the live copies; the stations
      // only the live sources know about (the other networks on the EU HFR
      // Node) are appended, and get their overlay once the v-for has rendered
      // them.
      const newStations = [];
      networks.flatMap(network => network.stations).forEach(live => {
        const station = this.stations.find(s => s.id === live.id);
        // Nothing static is lost by assigning: getAllNetworks() has already
        // merged the two for the ICATMAR network, static winning (see
        // mergeKeepingStatic), so what arrives here is static plus whatever
        // only the live sources know - the fresh time_coverage_end above all.
        if (station) Object.assign(station, live);
        else newStations.push(live);
      });
      if (newStations.length === 0) return;

      this.stations = [...this.stations, ...newStations];
      await this.$nextTick();
      this.createOverlays(newStations); // only the new ones - the rest already have theirs
    },
    // Defaults to every station, but takes a subset so stations that arrive
    // later don't get a second overlay stacked on the one they already have.
    createOverlays(stations = this.stations) {
      for (let i = 0; i < stations.length; i++) {
        let station = stations[i];
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
