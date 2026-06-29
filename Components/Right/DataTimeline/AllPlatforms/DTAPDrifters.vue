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
  name: "DTAPDrifters",
  data() {
    return {
      variables: [],
    }
  },
  components: {
    DTLayout,
    DTTimelineGrid
  }
}

</script>
