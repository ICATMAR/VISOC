<template>
  <DTLayout :variables="variables">
    <template #grid>
      <DTTimelineGrid :variables="variables"></DTTimelineGrid>
    </template>
  </DTLayout>
</template>


<script>
import DTLayout from '../Shared/DTLayout.vue';
import DTTimelineGrid from '../Shared/DTTimelineGrid.vue';

export default {
  name: "DTAPBuoys",
  data() {
    return {
      variables: [
        { name: 'Temperature', unit: 'ºC' },
        { name: 'Salinity', unit: 'PSU' },
      ],
    }
  },
  components: {
    DTLayout,
    DTTimelineGrid
  }
}

</script>
