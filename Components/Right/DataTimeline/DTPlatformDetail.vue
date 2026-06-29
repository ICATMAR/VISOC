<template>
  <DTAPHFRPlatformDetail v-if="isHFRView"></DTAPHFRPlatformDetail>
  <DTAPBuoysPlatformDetail v-else-if="isBuoysView"></DTAPBuoysPlatformDetail>
  <PlatformDetail v-else></PlatformDetail>
</template>


<script>
import PlatformDetail from './PlatformDetail.vue';
import DTAPHFRPlatformDetail from './AllPlatforms/PlatformDetails/DTAPHFRPlatformDetail.vue';
import DTAPBuoysPlatformDetail from './AllPlatforms/PlatformDetails/DTAPBuoysPlatformDetail.vue';

export default {
  name: "DTPlatformDetail",
  computed: {
    isHFRView() {
      return this.$gui.selectedDashboard === 'platforms' && this.$gui.timelineDashboardId === 'hfr';
    },
    isBuoysView() {
      return this.$gui.selectedDashboard === 'platforms' && this.$gui.timelineDashboardId === 'buoys';
    },
  },
  components: {
    PlatformDetail,
    DTAPHFRPlatformDetail,
    DTAPBuoysPlatformDetail,
  }
}

</script>
