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
    <div class="timeline-days-container" v-if="zoomLevel < 4">
      <div v-for="month in timelineMonths" :key="month.month" class="timeline-day"
        :style="{ width: month.width + '%'}">
        <!-- Close zoom - Month and year -->
        <span v-if="zoomLevel === 0">{{ month.text }}</span>
        <!-- 6 months zoom - Month -->
        <span v-else-if="zoomLevel === 1">{{ month.text }}</span>
        <!-- Middle zoom - Month abbr -->
        <span v-else-if="zoomLevel === 2">{{ month.textShort }}</span>
        <!-- Far zoom - Short month -->
        <span v-else-if="zoomLevel === 3">{{ month.textXShort }}</span>
      </div>
    </div>

    <!-- Days -->
    <div class="timeline-days-container" v-if="zoomLevel === 0">
      <div v-for="day in timelineDays" :key="day.day" class="timeline-day"
        :style="{ width: day.width + '%'}">
        <span>{{ day.text }}</span>
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
    hoursInYear(year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year + 1, 0, 1);
      return (endDate - startDate) / (1000 * 60 * 60);
    },
    hoursFromStartOfYear(date) {
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      return (date - startOfYear) / (1000 * 60 * 60);
    },
    hoursFromStartOfMonth(date) {
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      return (date - startOfMonth) / (1000 * 60 * 60);
    },
  },
  computed: {
    limitStartDate() {
      return new Date(2023, 0, 1);
    },
    limitEndDate() {
      return new Date(2023, 2, 1);
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
    startMonth() {
      return this.startDate.getMonth();
    },
    endMonth() {
      return this.endDate.getMonth();
    },
    hoursInTimeline() {
      return (this.endDate - this.startDate) / (1000 * 60 * 60);
    },
    zoomLevel() {
      const hours = this.hoursInTimeline;
      if (hours < 24 * 31 * 3) { // 3 months
        return 0;
      } else if (hours < 24 * 31 * 6) { // 6 months
        return 1;
      } else if (hours < 24 * 31 * 15) { // 15 months
        return 2;
      } else if (hours < 24 * 31 * 12 * 3 ) { // 2 years
        return 3;
      } else {
        return 4;
      }
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
    // Timeline months
    timelineMonths() {
      const startYear = this.startYear;
      const endYear = this.endYear;
      const timelineMonths = [];
      for (let year = startYear; year <= endYear; year++) {
        const startMonth = year == startYear ? this.startMonth : 0;
        const endMonth = year == endYear ? this.endMonth : 11;
        for (let month = startMonth; month <= endMonth; month++) {
          const daysInAMonth = new Date(year, month + 1, 0).getDate();
          const hoursInMonth = year == startYear && month == startMonth ? (daysInAMonth * 24 - this.hoursFromStartOfMonth(this.startDate)) :
           year == endYear && month == endMonth ? this.hoursFromStartOfMonth(this.endDate) :
            daysInAMonth * 24;
          
          timelineMonths.push({
            month: `${year}-${month}`,
            textLong: new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' }),
            text: new Date(year, month).toLocaleString('default', { month: 'long' }),
            textShort: new Date(year, month).toLocaleString('default', { month: 'short' }),
            textXShort: new Date(year, month).toLocaleString('default', { month: 'narrow' }),
            width: hoursInMonth / (daysInAMonth * 24) * 100
          });
        }
      }
      return timelineMonths;
    },
    // Timeline days
    timelineDays() {
      
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