<template>
  <DTLayout :variables="variables">
    <template #grid>
      <DTTimelineGrid :variables="variables" :intervalMinutes="180"></DTTimelineGrid>
    </template>
  </DTLayout>
</template>


<script>
import DTLayout from '../Shared/DTLayout.vue';
import DTTimelineGrid from '../Shared/DTTimelineGrid.vue';

export default {
  name: "DTHFRModels",
  data() {
    return {
      // Sea water velocity from radar compared to other models / networks
      variables: [
        { name: 'HF Radar', unit: 'm/s' },
        { name: 'ICATMAR', unit: 'm/s' },
        { name: 'CMEMS', unit: 'm/s' },
      ],
    }
  },
  components: {
    DTLayout,
    DTTimelineGrid
  }
}

</script>
