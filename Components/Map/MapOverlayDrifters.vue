<template>

  <!-- Overlay container -->
  <div class="overlay-container">

    <!-- Drifter icon (placed at latest known location) -->
    <div class="platform-icon-container" v-for="drifter in drifters" :ref="drifter.id" :id="drifter.id">
      <img class="platform-icon clickable" :class="{ selected: isIconSelected(drifter) }" :src="iconURL(drifter)" alt="Drifter icon" @click="platformClicked($event, drifter)">
      <!-- Status indicator -->
      <div class="platform-status-indicator" :class="drifterStatus(drifter)"></div>
      <!-- ICATMAR marker -->
      <div class="platform-marker-indicator">
        <img :src="icatmarLogoURL" alt="">
      </div>
    </div>

  </div>

</template>



<script>

export default {
  name: "MapOverlayDrifters",
  created() {
    this.map = undefined;
    this.trajLayer = undefined;
  },
  mounted() {
    this.$nextTick(() => {
      if (this.map == undefined) {
        this.map = this.$parent.map; // Access the map instance from the parent component
      }

      // Trajectory vector layer (drawn for the selected drifter only).
      this.trajLayer = new ol.layer.Vector({
        source: new ol.source.Vector(),
        style: new ol.style.Style({
          stroke: new ol.style.Stroke({ color: 'rgb(20, 120, 167)', width: 1 }),
        }),
      });
      this.map.addLayer(this.trajLayer);

      // Create an overlay per drifter at its latest location.
      for (const drifter of this.drifters) {
        const pos = this.latestPosition(drifter);
        if (!pos) continue;
        const olOverlay = new ol.Overlay({
          element: this.$refs[drifter.id]?.[0],
          positioning: 'center-center',
          position: ol.proj.fromLonLat(pos),
          stopEvent: false,
        });
        const overlayEl = olOverlay.getElement();
        overlayEl.classList.add('no-pointer-events');
        overlayEl.parentElement.classList.add('no-pointer-events');
        olOverlay.element.classList.add('no-pointer-events');
        this.map.addOverlay(olOverlay);
      }

      this.updateTrajectory();
    });
  },
  beforeUnmount() {
    if (this.trajLayer) this.map?.removeLayer(this.trajLayer);
  },
  data() {
    return {
      icatmarLogoURL: './Assets/Icons/icatmar-mini.png',
      driftIconURL:  './Assets/Icons/drifter.svg',
      codeIconURL:   './Assets/Icons/code.svg',
      svpIconURL:    './Assets/Icons/svp.svg',
    }
  },
  methods: {
    iconURL(drifter) {
      if (drifter.type === 'CODE') return this.codeIconURL;
      if (drifter.type === 'SVP')  return this.svpIconURL;
      return this.driftIconURL;
    },
    trajectory(drifter) {
      return this.$requests.getDrifterTrajectory(drifter.id);
    },
    latestPosition(drifter) {
      const traj = this.trajectory(drifter);
      if (!traj.length) return null;
      const p = traj[traj.length - 1];
      return [p.lon, p.lat];
    },
    drifterStatus(drifter) {
      return this.$requests.getStationStatus(drifter.id, 'drifter');
    },
    isDrifterContext() {
      return this.$gui.selectedDashboard === 'drifters'
        || (this.$gui.selectedDashboard === 'platforms' && this.$gui.timelineDashboardId === 'drifters');
    },
    isIconSelected(drifter) {
      if (!this.isDrifterContext()) return false;
      return this.$gui.selectedPlatform?.stationId === drifter.id;
    },
    updateTrajectory() {
      if (!this.trajLayer) return;
      const source = this.trajLayer.getSource();
      source.clear();
      if (!this.isDrifterContext()) return;
      const id = this.$gui.selectedPlatform?.stationId;
      const drifter = id && this.$requests.getDrifterStation(id);
      if (!drifter) return;
      const traj = this.trajectory(drifter);
      if (traj.length < 2) return;
      const coords = traj.map(p => ol.proj.fromLonLat([p.lon, p.lat]));
      source.addFeature(new ol.Feature(new ol.geom.LineString(coords)));
    },
    updateZIndices() {
      for (const drifter of this.drifters) {
        const wrapper = this.$refs[drifter.id]?.[0]?.parentElement;
        if (wrapper) wrapper.style.zIndex = this.isIconSelected(drifter) ? '10' : '';
      }
    },
    platformClicked(e, drifter) {
      e.stopPropagation();
      this.$gui.timelineDashboardId = 'drifters';
      this.$gui.selectedPlatform = { stationId: drifter.id };
      this.$gui.selectedDashboard = 'platforms';
      this.$gui.isDataTimelineOpen = true;
      this.$gui.isPlatformDetailOpen = true;
      this.$gui.isMenuOpen = false;
    }
  },
  computed: {
    drifters() {
      return this.$requests.drifterStations;
    }
  },
  watch: {
    '$gui.selectedPlatform'()    { this.$nextTick(() => { this.updateZIndices(); this.updateTrajectory(); }); },
    '$gui.selectedDashboard'()   { this.$nextTick(() => { this.updateZIndices(); this.updateTrajectory(); }); },
    '$gui.timelineDashboardId'() { this.$nextTick(() => { this.updateZIndices(); this.updateTrajectory(); }); },
  },
}

</script>



<style scoped>
  .platform-icon-container {
    position: relative;
    display: flex;
  }
</style>
