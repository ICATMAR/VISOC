<template>
  <DTHFRPlatformDetail v-if="isHFRPlatformView"></DTHFRPlatformDetail>
  <DTHFRDataPointDetail v-else-if="isHFRDataPointView"></DTHFRDataPointDetail>
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
import DTHFRDataPointDetail from './HFR/DTHFRDataPointDetail.vue';

export default {
  name: "DTPlatformDetail",
  computed: {
    // A platform's detail is the same in All platforms (on its view) and in
    // its own dashboard
    isViewOf() {
      return dashboardId => this.$gui.selectedDashboard === dashboardId
        || (this.$gui.selectedDashboard === 'platforms' && this.$gui.timelineDashboardId === dashboardId);
    },
    // A point compared on the HFR dashboard (GUIManager.openHFRPoint) - a
    // buoy or drifter chip, or a click on the map: the comparison map
    isHFRPlatformView() {
      const kind = this.$gui.selectedPlatform?.kind;
      return this.$gui.selectedDashboard === 'hfr' && ['buoy', 'drifter', 'point'].includes(kind) && this.$gui.hfrPoint != null;
    },
    // A data point clicked on the HFR map (GUIManager.openHFRDataPoint)
    isHFRDataPointView() {
      return this.$gui.selectedDashboard === 'hfr' && this.$gui.selectedPlatform?.kind === 'datapoint' && this.$gui.hfrDataPoint != null;
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
    DTHFRDataPointDetail,
  }
}

</script>
