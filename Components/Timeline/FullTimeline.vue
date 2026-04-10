<template>

  <!-- Timeline -->
  <div class="timeline">

    <!-- Years -->
    <div class="timeline-days-container">
      <div v-for="year in timelineYears" :key="year.year" class="timeline-day"
        :style="{ width: year.width + '%'}">
        <span>{{ year.text }}</span>
      </div>
    </div>

    <!-- Months -->


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
    hoursInYear(year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year + 1, 0, 1);
      return (endDate - startDate) / (1000 * 60 * 60);
    },
    hoursFromStartOfYear(date) {
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      return (date - startOfYear) / (1000 * 60 * 60);
    },
  },
  computed: {
    limitStartDate() {
      return new Date(2023, 0, 1);
    },
    limitEndDate() {
      const date = new Date();
      date.setHours(date.getHours() + 1);
      date.setMinutes(0);
      date.setSeconds(0);
      date.setMilliseconds(0);
      return date;
    },
    // Visible timeline range
    startDate() {
      return this.limitStartDate;
    },
    endDate() {
      return this.limitEndDate;
    },
    startYear() {
      return this.startDate.getFullYear();
    },
    endYear() {
      return this.endDate.getFullYear();
    },
    startDay() {
      return this.startDate.getDate();
    },
    endDay(){
      return this.endDate.getDate();
    },
    hoursInTimeline() {
      return (this.endDate - this.startDate) / (1000 * 60 * 60);
    },
    timelineYears() {
      const startYear = this.startYear;
      const endYear = this.endYear;
      const timelineYears = [];
      for (let year = startYear; year <= endYear; year++) {
        timelineYears.push({
          year: year,
          text: year.toString(),
          width: year == startYear ? (1 - (this.hoursFromStartOfYear(this.startDate) / this.hoursInYear(year))) * 100 : year == endYear ? this.hoursFromStartOfYear(this.endDate) / this.hoursInYear(year) * 100 : 100
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