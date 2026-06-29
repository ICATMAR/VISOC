<template>
  <DTLayout :variables="variables">
    <template #grid>
      <DataTimelineRadarAvailability :startTmst="$gui.timelineStartTmst" :endTmst="$gui.timelineEndTmst" :hourlyInterval="3"></DataTimelineRadarAvailability>
    </template>
  </DTLayout>
</template>


<script>
import DTLayout from '../Shared/DTLayout.vue';
import DataTimelineRadarAvailability from '../DataTimelineRadarAvailability.vue';

export default {
  name: "DTAllPlatforms",
  data() {
    return {
      // HFR stations (number of valid points per radial)
      variables: [
        { name: 'CNET' }, { name: 'CREU' }, { name: 'BEGU' }, { name: 'TOSS' },
        { name: 'AREN' }, { name: 'PBCN' }, { name: 'GNST' }, { name: 'SVLR' },
      ],
    }
  },
  components: {
    DTLayout,
    DataTimelineRadarAvailability
  }
}

</script>
