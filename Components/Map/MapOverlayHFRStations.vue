<template>

  <!-- Overlay container -->
  <div class="overlay-container">

    <!-- Platform icon -->
    <!-- v-show, not v-if: OpenLayers holds on to each element (see createOverlays) -->
    <!-- Keyed by network AND code: the same code can be in two networks
         (ALFA is ICATMAR's and DeltaEbro's) -->
    <div class="platform-icon-container" v-for="station in stations" :key="keyOf(station)" :ref="keyOf(station)" :id="keyOf(station)" v-show="isStationVisible(station)">
      <img class="platform-icon clickable" :class="{ selected: isIconSelected(station), offline: stationStatus(station) === 'offline', loading: stationStatus(station) === 'loading' }" :src="iconURL" alt="Platform icon" @click="platformClicked($event, station)">
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

// Stations in ICATMAR's network that other institutions run
const NON_ICATMAR_INSTITUTIONS = ['CEFREM', 'Puertos del Estado'];

export default {
  name: "MapOverlayHFRStations",
  // Stations with new data while the page is open (DPHFRStations.refresh)
  mixins: [window.dataProductMixin({ hfrstations: 'onStationsChanged' })],
  mounted() {

    this.$nextTick(() => {
      if (this.map == undefined) {
        this.map = this.$parent.map; // Access the map instance from the parent component
      }
      this.loadStations();
    });
    // Any view asking for a station's data shows on its marker
    this.onStationsLoading = () => { this.loadingVersion++; };
    this.$dataService.hfrstations.loadingEvents.addEventListener('loading', this.onStationsLoading);
  },
  beforeUnmount() {
    this.$dataService.hfrstations.loadingEvents.removeEventListener('loading', this.onStationsLoading);
  },
  data (){
    return {
      iconURL: './Assets/Icons/radar.svg',
      icatmarLogoURL: './Assets/Icons/icatmar-mini.png',
      stations: [],
      // Until the live fetch answers, a station with no coverage end is still
      // loading, not inactive
      isLiveLoaded: false,
      // Bumped whenever a station's requests start or end (see
      // DPHFRStations.trackLoading), so the markers re-read it
      loadingVersion: 0,
    }
  },
  methods: {
    // Their newest data moved on: each marker's status again, from the
    // networks as they are now (see DPHFRNetwork.applyStationEnds) - the same
    // markers, so nothing is re-created on the map
    async onStationsChanged() {
      const networks = await this.$dataService.hfrnetwork.getAllNetworks(this.$dataService.hfrstations);
      networks.flatMap(network => network.stations).forEach(live => {
        const station = this.stations.find(s => this.keyOf(s) === this.keyOf(live));
        if (station) station.metadata = { ...live.metadata };
      });
    },
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
      let networks;
      try {
        networks = await this.$dataService.hfrnetwork.getAllNetworks(this.$dataService.hfrstations);
      } finally {
        this.isLiveLoaded = true;
      }

      // Create new stations or merge static ones. The static ones already have
      // an overlay each, so they are updated in place - same objects, same
      // positions - instead of being replaced by the live copies; the stations
      // only the live sources know about (the other networks on the EU HFR
      // Node) are appended, and get their overlay once the v-for has rendered
      // them.
      const newStations = [];
      networks.flatMap(network => network.stations).forEach(live => {
        const station = this.stations.find(s => this.keyOf(s) === this.keyOf(live));
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
          element: this.$refs[this.keyOf(station)]?.[0],
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
    // Loading while any of its data is being requested; otherwise based on
    // how stale time_coverage_end is: <3h active, up to 1 day delayed, up to
    // 30 days inactive, older than that offline.
    stationStatus(station) {
      if (this.loadingVersion >= 0 && this.$dataService.hfrstations.isStationLoading(station.metadata?.network, station.id)) return 'loading';
      const endStr = station.metadata?.time_coverage_end;
      if (!endStr) return this.isLiveLoaded ? 'inactive' : 'loading';

      const ageHours = (Date.now() - new Date(endStr).getTime()) / 3600000;
      if (ageHours < 3) return 'active';
      if (ageHours <= 24) return 'delayed';
      if (ageHours <= 24 * 30) return 'inactive';
      return 'offline';
    },
    // ICATMAR's logo only on the stations ICATMAR runs: the network also
    // takes in CEFREM's CNET and Puertos del Estado's ALFA, SALO and VINA
    isICATMARStation(station) {
      return station.metadata?.network === 'HFR-ICATMAR'
        && !NON_ICATMAR_INSTITUTIONS.includes(station.metadata?.institution);
    },
    isIconSelected(station) {
      // Only in the selected station's network (ICATMAR's when none is
      // named) - codes repeat across networks
      const network = this.$gui.selectedPlatform?.network ?? 'HFR-ICATMAR';
      if (station.metadata?.network !== network) return false;
      // TOTALS stands for the whole network, so it lights up every station
      return this.$gui.isPlatformSelected('hfr', station.id) || this.$gui.isPlatformSelected('hfr', 'TOTALS');
    },
    // A station's identity: its network and its code
    keyOf(station) {
      return `${station.metadata?.network ?? ''}:${station.id}`;
    },
    // Stations belong on All platforms and the HFR dashboard. On the HFR
    // dashboard, the source picked there decides: ICATMAR's network only
    // (Puertos del Estado's stations it uses included), or what the EU HFR
    // Node publishes - every network, but not the stations only ICATMAR has
    // (SCAL, and ALFA/SALO/VINA, which the node lists under DeltaEbro).
    isStationVisible(station) {
      const dashboard = this.$gui.selectedDashboard;
      if (dashboard !== 'platforms' && dashboard !== 'hfr') return false;
      const isICATMARNetwork = station.metadata?.network === 'HFR-ICATMAR';
      // All platforms: ICATMAR's network (the stations of other institutions
      // it uses included). With external platforms, every network too, each
      // station once - one ICATMAR's network lists (Puertos del Estado's) as
      // ICATMAR's, not again as DeltaEbro's
      if (dashboard === 'platforms')
        return isICATMARNetwork || (this.$gui.platformsShowExternal && !this.icatmarIds.has(station.id));
      // HFR: ICATMAR's network, or what the EU node publishes
      if (this.$gui.hfrSource === 'EU') return !station.notOnEUNode;
      return isICATMARNetwork;
    },
    updateZIndices() {
      for (const station of this.stations) {
        const wrapper = this.$refs[this.keyOf(station)]?.[0]?.parentElement;
        if (wrapper) wrapper.style.zIndex = this.isIconSelected(station) ? '10' : '';
      }
    },
    platformClicked: function(e, station) {
      e.stopPropagation();
      this.$gui.selectPlatform('hfr', station.id, { network: station.metadata?.network });
    }
  },
  computed: {
    // The codes of the stations in ICATMAR's network
    icatmarIds() {
      return new Set(this.stations.filter(s => s.metadata?.network === 'HFR-ICATMAR').map(s => s.id));
    },
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
