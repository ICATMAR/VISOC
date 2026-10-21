<template>

  <!-- Overlay container -->
  <div class="overlay-container">

    <!-- Platform icon -->
    <!-- v-show, not v-if: OpenLayers holds on to each element (see createOverlays) -->
    <div class="platform-icon-container" v-for="buoy in buoys" :ref="buoy.id" :id="buoy.id"
      v-show="isVisible && isBuoyShown(buoy) && (!showsCurrents || (currents[buoy.id] && !$gui.isHFRPointChip('buoy', buoy.id)))">
      <!-- On the HFR dashboard: the current the buoy measured at the selected
           hour, to set against the radar's, instead of its icon -->
      <template v-if="showsCurrents">
        <CurrentChip v-if="currents[buoy.id]" class="clickable" @click="chipClicked($event, buoy)"
          :speed="currents[buoy.id].speed" :direction="currents[buoy.id].direction"
          :label="buoy.name" :time="currents[buoy.id].time"></CurrentChip>
      </template>
      <template v-else>
        <img class="platform-icon clickable" :class="{ selected: isIconSelected(buoy), offline: buoyStatus(buoy) === 'offline', loading: buoyStatus(buoy) === 'loading' }" :src="iconURL" alt="Platform icon" @click="platformClicked($event, buoy)">
        <!-- Status indicator -->
        <div class="platform-status-indicator" :class="buoyStatus(buoy)" v-if="buoyStatus(buoy) != 'offline'"></div>
        <!-- ICATMAR marker - only for ICATMAR's own buoys -->
        <div class="platform-marker-indicator" v-if="isICATMARBuoy(buoy)">
          <img :src="icatmarLogoURL" alt="">
        </div>
      </template>
    </div>

  </div>


</template>



<script>
import CurrentChip from './CurrentChip.vue';

// The hour a time belongs to: 9:30 up to (not including) 10:30 is 10:00
const HALF_HOUR_MS = 30 * 60 * 1000;
const roundToHour = time => new Date(Math.floor((time.getTime() + HALF_HOUR_MS) / 3600000) * 3600000);

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
      // HFR dashboard: buoy id -> { speed, direction, time } at the selected hour
      currents: {},
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
    // The current each buoy measured in the selected hour (9:30 to 10:30 for
    // 10:00), the reading closest to the hour. Through the same block cache
    // as the buoys timeline, so a buoy already loaded there costs nothing.
    async loadCurrents(hour) {
      const request = (this.currentsRequest ?? 0) + 1;
      this.currentsRequest = request;
      this.currents = {};
      if (!hour) { this.$gui.hfrBuoysLoading = false; return; }
      this.$gui.hfrBuoysLoading = true;
      const start = new Date(hour.getTime() - 2 * HALF_HOUR_MS);
      const end = new Date(hour.getTime() + 2 * HALF_HOUR_MS);
      let promises = [];
      try {
        ({ promises } = await this.$dataService.buoys.getVariablesData(['HCSP', 'HCDT'], start, end));
      } catch (error) {
        console.error('Could not load the buoys\' currents:', error);
      }
      // Loading until every buoy has answered (the toggle shows a spinner)
      Promise.allSettled(promises).then(() => {
        if (request === this.currentsRequest) this.$gui.hfrBuoysLoading = false;
      });
      promises.forEach(promise => promise.then(({ buoyId, data }) => {
        if (request !== this.currentsRequest) return;
        let best;
        Object.entries(data).forEach(([timestamp, values]) => {
          const time = new Date(timestamp);
          const speed = values.HCSP?.value;
          if (speed == null || !isFinite(speed)) return;
          if (time < hour.getTime() - HALF_HOUR_MS || time >= hour.getTime() + HALF_HOUR_MS) return;
          if (!best || Math.abs(time - hour) < Math.abs(best.time - hour))
            best = { speed, direction: values.HCDT?.value, time };
        });
        if (best) this.currents = { ...this.currents, [buoyId]: best };
      }).catch(() => {}));
    },
    // HFR dashboard: compare what the buoy measured with the radars and the
    // models, on the hour of its reading
    chipClicked(e, buoy) {
      e.stopPropagation();
      this.$gui.openHFRPoint(
        { lon: buoy.longitude, lat: buoy.latitude, kind: 'buoy', id: buoy.id, name: buoy.name },
        this.currents[buoy.id]?.time);
    },
    platformClicked(e, buoy) {
      e.stopPropagation();
      this.$gui.selectPlatform('buoys', buoy.id);
    },
    // All platforms leaves other institutions' buoys out unless asked for
    isBuoyShown(buoy) {
      return this.$gui.selectedDashboard !== 'platforms' || this.$gui.isPlatformShown(buoy.institution);
    },
  },
  computed: {
    // On the HFR dashboard a buoy shows its current rather than its icon
    showsCurrents() {
      return this.$gui.selectedDashboard === 'hfr';
    },
    // What the currents depend on: the hour, while they are being shown
    currentsHour() {
      if (!this.showsCurrents || !this.$gui.hfrShowBuoys) return null;
      return roundToHour(new Date(this.$gui.selectedTime)).toISOString();
    },
    // Buoys belong on All platforms and their own dashboard, and on the HFR
    // dashboard only when asked for there
    isVisible() {
      const dashboard = this.$gui.selectedDashboard;
      return dashboard === 'platforms' || dashboard === 'buoys' || (dashboard === 'hfr' && this.$gui.hfrShowBuoys);
    },
  },
  watch: {
    currentsHour(hour) { this.loadCurrents(hour ? new Date(hour) : null); },
    '$gui.selectedPlatform'()    { this.$nextTick(() => this.updateZIndices()); },
    '$gui.selectedDashboard'()   { this.$nextTick(() => this.updateZIndices()); },
    '$gui.timelineDashboardId'() { this.$nextTick(() => this.updateZIndices()); },
  },
  components: { CurrentChip },
}

</script>



<style scoped>
  .platform-icon-container {
    position: relative;
    display: flex;
  }



</style>
