<template>

  <!-- Timeline -->
  <div class="timeline">

    <!-- Years -->
    <div class="timeline-days-container">
      <div v-for="year in timelineYears" :key="year.year" class="timeline-day"
        :style="{ width: year.width + '%'}"
      >
        <span>{{ year.text }}</span>
      </div>
    </div>


  </div>

</template>


<script>

export default {
  name: "FullTimeline",
  created() {

  },
  mounted() {
  },
  data() {
    return {
      
    }
  },
  methods: {
    //onclick: function(e){},
  },
  computed: {
    startDate() {
      return new Date(2023, 0, 1);
    },
    endDate() {
      const date = new Date();
      date.setHours(date.getHours() + 1);
      date.setMinutes(0);
      date.setSeconds(0);
      date.setMilliseconds(0);
      return date;
    },
    timelineYears() {
      const startYear = this.startDate.getFullYear();
      const endYear = this.endDate.getFullYear();
      const timelineYears = [];
      for (let year = startYear; year <= endYear; year++) {
        timelineYears.push({
          year: year,
          text: year.toString(),
          width: 100
        });
      }
      return timelineYears;
    },
  },
  components: {
    
  }
}
</script>


<style scoped>


.timeline-years-container {
  display: flex;
  width: 100%;
}
</style>