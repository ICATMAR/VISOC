<template>
  <DTAPHFRTotalsPlatformDetail v-if="isTotalsView"></DTAPHFRTotalsPlatformDetail>
  <DTAPHFRPlatformDetail v-else-if="isHFRView"></DTAPHFRPlatformDetail>
  <DTAPBuoysPlatformDetail v-else-if="isBuoysView"></DTAPBuoysPlatformDetail>
  <PlatformDetail v-else></PlatformDetail>
</template>


<script>
import PlatformDetail from './PlatformDetail.vue';
import DTAPHFRPlatformDetail from './AllPlatforms/PlatformDetails/DTAPHFRPlatformDetail.vue';
import DTAPHFRTotalsPlatformDetail from './AllPlatforms/PlatformDetails/DTAPHFRTotalsPlatformDetail.vue';
import DTAPBuoysPlatformDetail from './AllPlatforms/PlatformDetails/DTAPBuoysPlatformDetail.vue';

export default {
  name: "DTPlatformDetail",
  computed: {
    isTotalsView() {
      return this.$gui.selectedDashboard === 'platforms'
        && this.$gui.timelineDashboardId === 'hfr'
        && this.$gui.selectedPlatform?.stationId === 'TOTALS';
    },
    isHFRView() {
      return this.$gui.selectedDashboard === 'platforms'
        && this.$gui.timelineDashboardId === 'hfr'
        && this.$gui.selectedPlatform?.stationId !== 'TOTALS';
    },
    isBuoysView() {
      return this.$gui.selectedDashboard === 'platforms' && this.$gui.timelineDashboardId === 'buoys';
    },
  },
  components: {
    PlatformDetail,
    DTAPHFRPlatformDetail,
    DTAPHFRTotalsPlatformDetail,
    DTAPBuoysPlatformDetail,
  }
}

</script>
