<template>

  <!-- Overlay container -->
  <div class="overlay-container">

    <!-- Platform icon -->
    <!-- v-show, not v-if: OpenLayers holds on to each element (see createOverlays) -->
    <div class="platform-icon-container" v-for="buoy in buoys" :ref="buoy.id" :id="buoy.id" v-show="isVisible">
      <img class="platform-icon clickable" :class="{ selected: isIconSelected(buoy), offline: buoyStatus(buoy) === 'offline', loading: buoyStatus(buoy) === 'loading' }" :src="iconURL" alt="Platform icon" @click="platformClicked($event, buoy)">
      <!-- Status indicator -->
      <div class="platform-status-indicator" :class="buoyStatus(buoy)" v-if="buoyStatus(buoy) != 'offline'"></div>
      <!-- ICATMAR marker - only for ICATMAR's own buoys -->
      <div class="platform-marker-indicator" v-if="isICATMARBuoy(buoy)">
        <img :src="icatmarLogoURL" alt="">
      </div>
    </div>

  </div>


</template>



<script>

export default {
  name: "MapOverlayBuoys",
  mounted() {

    this.$nextTick(() => {
      if (this.map == undefined) {
        this.map = this.$parent.map; // Access the map instance from the parent component
      }
      this.loadBuoys();
    });
  },
  data() {
    return {
      iconURL: './Assets/Icons/buoy.svg',
      icatmarLogoURL: './Assets/Icons/icatmar-mini.png',
      buoys: [],
      // Until the live fetch answers, a buoy with no dates is still loading,
      // not offline
      isLiveLoaded: false,
    }
  },
  methods: {
    // Static data first (fast - shown on the map right away, no request).
    // Overlays are only created once, from that static set - the live
    // ERDDAP fetch afterward just fills in start-end dates on those same
    // buoy objects (in place, same array/positions) for buoyStatus() to use,
    // it doesn't add/remove/reposition anything.
    async loadBuoys() {
      this.buoys = this.$dataService.buoys.getBuoys();
      await this.$nextTick(); // wait for the v-for to render before refs exist
      this.createOverlays();

      try {
        const liveBuoys = await this.$dataService.buoys.loadBuoys();
        const liveById = new Map(liveBuoys.map(b => [b.id, b]));
        this.buoys.forEach(buoy => {
          const live = liveById.get(buoy.id);
          if (live) {
            buoy.startDate = live.startDate;
            buoy.endDate = live.endDate;
          }
        });
      } finally {
        this.isLiveLoaded = true;
      }
    },
    createOverlays() {
      for (let i = 0; i < this.buoys.length; i++) {
        let buoy = this.buoys[i];
        const olOverlay = new ol.Overlay({
          element: this.$refs[buoy.id]?.[0],
          positioning: 'center-center',
          position: ol.proj.fromLonLat([buoy.longitude, buoy.latitude]),
          stopEvent: false,
        });
        const overlayEl = olOverlay.getElement();
        overlayEl.classList.add('no-pointer-events');
        overlayEl.parentElement.classList.add('no-pointer-events');
        olOverlay.element.classList.add('no-pointer-events');
        this.map.addOverlay(olOverlay);
      }
    },
    // Based on how stale endDate is: <3h active, up to 1 day delayed, up to
    // 30 days inactive, older (or no date at all - static-only) offline.
    // 'loading' while the live fetch that would bring the date is in flight.
    buoyStatus(buoy) {
      if (!buoy.endDate) return this.isLiveLoaded ? 'offline' : 'loading';

      const ageHours = (Date.now() - new Date(buoy.endDate).getTime()) / 3600000;
      if (ageHours < 3) return 'active';
      if (ageHours <= 24) return 'delayed';
      if (ageHours <= 24 * 30) return 'inactive';
      return 'offline';
    },
    isICATMARBuoy(buoy) {
      return buoy.institution === 'ICATMAR';
    },
    isIconSelected(buoy) {
      return this.$gui.isPlatformSelected('buoys', buoy.id);
    },
    updateZIndices() {
      for (const buoy of this.buoys) {
        const wrapper = this.$refs[buoy.id]?.[0]?.parentElement;
        if (wrapper) wrapper.style.zIndex = this.isIconSelected(buoy) ? '10' : '';
      }
    },
    platformClicked(e, buoy) {
      e.stopPropagation();
      this.$gui.selectPlatform('buoys', buoy.id);
    }
  },
  computed: {
    // Buoys belong on All platforms and their own dashboard, and on the HFR
    // dashboard only when asked for there
    isVisible() {
      const dashboard = this.$gui.selectedDashboard;
      return dashboard === 'platforms' || dashboard === 'buoys' || (dashboard === 'hfr' && this.$gui.hfrShowBuoys);
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
