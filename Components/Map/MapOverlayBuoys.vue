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
        <ValueChip v-if="currents[buoy.id]" class="clickable" @click="chipClicked($event, buoy)"
          code="HCSP" :value="currents[buoy.id].speed" :direction="currents[buoy.id].direction"
          :label="buoy.name" :time="currents[buoy.id].time"></ValueChip>
      </template>
      <!-- On the Buoys dashboard: the value of the variable picked (bottom
           right) in the time handle's cell, the one the timeline draws -->
      <ValueChip v-else-if="showsValues && values[buoy.id]" class="clickable buoy-value-chip"
        :class="{ selected: isIconSelected(buoy) }" @click="platformClicked($event, buoy)"
        :code="$gui.selectedBuoyVariable.code" :range="$gui.selectedBuoyVariable.range"
        :value="values[buoy.id].value" :direction="values[buoy.id].direction"
        :label="buoy.name" :time="values[buoy.id].time"></ValueChip>
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
import ValueChip from './ValueChip.vue';

// The hour a time belongs to: 9:30 up to (not including) 10:30 is 10:00
const HALF_HOUR_MS = 30 * 60 * 1000;
const roundToHour = time => new Date(Math.floor((time.getTime() + HALF_HOUR_MS) / 3600000) * 3600000);

export default {
  name: "MapOverlayBuoys",
  // New readings found while the page is open (DPBuoys.refresh)
  mixins: [window.dataProductMixin({ buoys: 'onBuoysChanged' })],
  mounted() {

    this.$nextTick(() => {
      if (this.map == undefined) {
        this.map = this.$parent.map; // Access the map instance from the parent component
      }
      this.loadBuoys();
      if (this.showsValues) this.loadValues();
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
      // Buoys dashboard: buoy id -> { value, direction (the arrow's), time }
      // of the picked variable in the time handle's cell
      values: {},
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
        await this.updateDates();
      } finally {
        this.isLiveLoaded = true;
      }
    },
    // The live sources' dates, onto the same buoy objects (see loadBuoys)
    async updateDates() {
      const liveBuoys = await this.$dataService.buoys.loadBuoys();
      const liveById = new Map(liveBuoys.map(b => [b.id, b]));
      this.buoys.forEach(buoy => {
        const live = liveById.get(buoy.id);
        if (live) {
          buoy.startDate = live.startDate;
          buoy.endDate = live.endDate;
        }
      });
    },
    // New readings: each buoy's status again (its newest reading), and the
    // currents shown at the hour, if any
    async onBuoysChanged() {
      await this.updateDates().catch(error => console.error('Could not refresh the buoys:', error));
      this.buoys = [...this.buoys]; // the dates were written in place - the status re-reads them
      if (this.currentsHour) this.loadCurrents(new Date(this.currentsHour), { keep: true });
      if (this.showsValues) this.loadValues({ keep: true });
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
    // The picked variable's value in the time handle's cell, per buoy - binned
    // as the timelines bin it (buoyCells.js), the cache answering first so the
    // chips paint at once. `keep`: what is shown stays until the new values
    // are in (new readings, not another cell).
    async loadValues({ keep = false } = {}) {
      const request = (this.valuesRequest ?? 0) + 1;
      this.valuesRequest = request;
      const cell = this.valuesCell;
      if (!cell) { this.values = {}; return; }
      if (!keep) this.values = {};
      const variable = this.$gui.selectedBuoyVariable;
      const codes = [variable.code, variable.directionCode].filter(Boolean);
      const start = new Date(cell.start), end = new Date(cell.end);
      const apply = ({ buoyId, data }) => {
        if (request !== this.valuesRequest) return;
        const [bin] = window.buoyCells.binVariable(window.buoyCells.byCode(data), variable, [start], cell.start, cell.end - cell.start, this.$gui.rangeFor(variable.code));
        const value = bin?.value == undefined ? null
          : { value: bin.value, direction: window.buoyCells.arrowBearing(bin.direction, variable.fromDirection), time: start };
        this.values = { ...this.values, [buoyId]: value };
      };
      this.$dataService.buoys.readVariablesData(codes, start, end).forEach(apply);
      try {
        const { promises } = await this.$dataService.buoys.getVariablesData(codes, start, end);
        promises.forEach(promise => promise.then(apply).catch(() => {}));
      } catch (error) {
        console.error('Could not load the buoys\' values:', error);
      }
    },
    // `keep`: what is shown stays until the new values are in (new readings
    // for the same hour - not another hour)
    async loadCurrents(hour, { keep = false } = {}) {
      const request = (this.currentsRequest ?? 0) + 1;
      this.currentsRequest = request;
      if (!keep) this.currents = {};
      if (!hour) { this.$gui.hfrBuoysLoading = false; return; }
      if (!keep) this.$gui.hfrBuoysLoading = true;
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
    // On the Buoys dashboard a buoy shows the picked variable's value
    showsValues() {
      return this.$gui.selectedDashboard === 'buoys';
    },
    // The timeline cell the time handle is in ({ start, end } ms), while the
    // values are shown - the cells DTTimelineGrid lays out
    valuesCell() {
      if (!this.showsValues) return null;
      const stepMs = this.$gui.timelineEffectiveIntervalMinutes * 60000;
      const origin = this.$gui.timelineStartDate.getTime();
      const start = origin + Math.floor((new Date(this.$gui.selectedTime).getTime() - origin) / stepMs) * stepMs;
      return { start, end: start + stepMs };
    },
    valuesKey() {
      return this.valuesCell ? `${this.$gui.selectedBuoyVariableCode}|${this.valuesCell.start}|${this.valuesCell.end}` : null;
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
    valuesKey() { this.loadValues(); },
    currentsHour(hour) { this.loadCurrents(hour ? new Date(hour) : null); },
    '$gui.selectedPlatform'()    { this.$nextTick(() => this.updateZIndices()); },
    '$gui.selectedDashboard'()   { this.$nextTick(() => this.updateZIndices()); },
    '$gui.timelineDashboardId'() { this.$nextTick(() => this.updateZIndices()); },
  },
  components: { ValueChip },
}

</script>



<style scoped>
  .platform-icon-container {
    position: relative;
    display: flex;
  }



/* A selected buoy's chip stands out as its icon would */
.buoy-value-chip.selected {
  outline: 2px solid var(--red);
  outline-offset: 1px;
}
</style>
