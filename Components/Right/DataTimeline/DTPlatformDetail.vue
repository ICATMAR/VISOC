<template>
  <DTHFRPlatformDetail v-if="isHFRPlatformView"></DTHFRPlatformDetail>
  <DTAPHFRTotalsPlatformDetail v-else-if="isTotalsView"></DTAPHFRTotalsPlatformDetail>
  <DTAPHFRPlatformDetail v-else-if="isHFRView"></DTAPHFRPlatformDetail>
  <DTAPBuoysPlatformDetail v-else-if="isBuoysView"></DTAPBuoysPlatformDetail>
  <DTAPDriftersPlatformDetail v-else-if="isDriftersView"></DTAPDriftersPlatformDetail>
  <PlatformDetail v-else></PlatformDetail>
</template>


<script>
import PlatformDetail from './PlatformDetail.vue';
import DTAPHFRPlatformDetail from './AllPlatforms/PlatformDetails/DTAPHFRPlatformDetail.vue';
import DTAPHFRTotalsPlatformDetail from './AllPlatforms/PlatformDetails/DTAPHFRTotalsPlatformDetail.vue';
import DTAPBuoysPlatformDetail from './AllPlatforms/PlatformDetails/DTAPBuoysPlatformDetail.vue';
import DTAPDriftersPlatformDetail from './AllPlatforms/PlatformDetails/DTAPDriftersPlatformDetail.vue';
import DTHFRPlatformDetail from './HFR/DTHFRPlatformDetail.vue';

export default {
  name: "DTPlatformDetail",
  computed: {
    // A platform's detail is the same in All platforms (on its view) and in
    // its own dashboard
    isViewOf() {
      return dashboardId => this.$gui.selectedDashboard === dashboardId
        || (this.$gui.selectedDashboard === 'platforms' && this.$gui.timelineDashboardId === dashboardId);
    },
    // A buoy or drifter chip clicked on the HFR dashboard (GUIManager.openHFRPoint)
    isHFRPlatformView() {
      const kind = this.$gui.selectedPlatform?.kind;
      return this.$gui.selectedDashboard === 'hfr' && (kind === 'buoy' || kind === 'drifter') && this.$gui.hfrPoint != null;
    },
    isTotalsView() {
      return this.isViewOf('hfr') && this.$gui.selectedPlatform?.stationId === 'TOTALS';
    },
    isHFRView() {
      return this.isViewOf('hfr') && this.$gui.selectedPlatform?.stationId !== 'TOTALS';
    },
    isBuoysView() {
      return this.isViewOf('buoys');
    },
    isDriftersView() {
      return (this.$gui.selectedDashboard === 'platforms' && this.$gui.timelineDashboardId === 'drifters')
        || this.$gui.selectedDashboard === 'drifters';
    },
  },
  components: {
    PlatformDetail,
    DTAPHFRPlatformDetail,
    DTAPHFRTotalsPlatformDetail,
    DTAPBuoysPlatformDetail,
    DTAPDriftersPlatformDetail,
    DTHFRPlatformDetail,
  }
}

</script>
