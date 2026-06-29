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
  name: "DTHFRDefault",
  data() {
    return {
      variables: [
        { name: 'Sea water velocity', unit: 'm/s' },
        { name: 'GDOP', unit: '-' },
      ],
    }
  },
  components: {
    DTLayout,
    DTTimelineGrid
  }
}

</script>
