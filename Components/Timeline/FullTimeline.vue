<template>

  <!-- Timeline -->
  <div class="timeline">

    <!-- Years -->
    <div class="timeline-elements-container">
      <div v-for="year in timelineYears" :key="year.year" class="timeline-element"
        :style="{ width: year.width + '%'}" @click="yearClicked(year.year)">
        <span>{{ year.text }}</span>
      </div>
    </div>

    <!-- Months -->
    <div class="timeline-elements-container" v-if="zoomLevel < 4">
      <div v-for="month in timelineMonths" :key="month.monthId" class="timeline-element"
        :style="{ width: month.width + '%'}" @click="monthClicked(month.month, month.year)">
        <!-- Close zoom - Month and year -->
        <span v-if="zoomLevel <= 0">{{ month.text }}</span>
        <!-- 6 months zoom - Month -->
        <span v-else-if="zoomLevel === 1">{{ month.text }}</span>
        <!-- Middle zoom - Month abbr -->
        <span v-else-if="zoomLevel === 2">{{ month.textShort }}</span>
        <!-- Far zoom - Short month -->
        <span v-else-if="zoomLevel === 3">{{ month.textXShort }}</span>
      </div>
    </div>
    <!-- Month empty bar -->
    <div v-else class="timeline-ghost-bar" @mousemove="moveGhost" @mouseleave="ghostX = -1000" @click="ghostClicked">
      <div class="timeline-ghost-slide" :style="{ transform: `translateX(${ghostX}px)` }"></div>
    </div>

    <!-- Days -->
    <div class="timeline-elements-container" v-if="zoomLevel == -1">
      <div v-for="day in timelineDays" :key="day.dayId" class="timeline-element"
        :style="{ width: day.width + '%'}" @click="dayClicked(day.day, day.month, day.year)">
        <span>{{ day.text }}</span>
      </div>
    </div>
    <!-- Day empty bar -->
    <div v-else class="timeline-ghost-bar" @mousemove="moveGhost" @mouseleave="ghostX = -1000" @click="ghostClicked">
      <div class="timeline-ghost-slide" :style="{ transform: `translateX(${ghostX}px)` }"></div>
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
      startDate: new Date(2023, 1, 1),
      endDate: new Date(2023, 2, 15),
      ghostX: -1000,
    }
  },
  methods: {
    moveGhost(event) {
      const rect = event.target.getBoundingClientRect();
      // Calculate mouse X relative to the container
      let x = event.clientX - rect.left;
      // Center the follower on the mouse 
      // Subtract half of the follower's width (e.g., ghost is 10% wide)
      const ghostWidth = rect.width * 0.1; 
      x = x - (ghostWidth / 2);
      // 4. Constrain the movement so it stays inside the container
      const maxX = rect.width - ghostWidth;
      this.ghostX = Math.max(0, Math.min(x, maxX));
    },
    ghostClicked(event) {
      const rect = event.target.getBoundingClientRect();
      let x = event.clientX - rect.left;
      const ghostWidth = rect.width * 0.1; 
      x = x - (ghostWidth / 2);
      const leftPercent = (Math.max(0, Math.min(x, rect.width - ghostWidth)) / rect.width) * 100;
      const rightPercent = leftPercent + 10;
      // Zoom to dates
      let newStartDate = new Date(this.startDate)
      newStartDate.setHours(this.startDate.getHours() + this.hoursInTimeline * leftPercent / 100);
      let newEndDate = new Date(this.startDate)
      newEndDate.setHours(this.startDate.getHours() + this.hoursInTimeline * rightPercent / 100);
      if (newStartDate < this.startDate) {debugger};
      if (newEndDate > this.endDate) {debugger };
      // Assign to start and end date
      this.startDate = newStartDate;
      this.endDate = newEndDate;
    },
    // Date interactions
    zoomToYear(year) {
      // Show days before and after the selected year
      let newStartDate = new Date(year, 0, 1); // Start of clicked year
      let newEndDate = new Date(year + 1, 0, 1); // End of clicked year
  
      // Add a little "padding" if you want to see the edges
      newStartDate.setDate(newStartDate.getDate() - 40);
      newEndDate.setDate(newEndDate.getDate() + 40);

      newStartDate = newStartDate < this.limitStartDate ? this.limitStartDate : newStartDate;
      newEndDate = newEndDate > this.limitEndDate ? this.limitEndDate : newEndDate;

      // When clicked twice (same timeline range), zoom out
      if (this.startDate.getTime() - newStartDate.getTime() == 0 && this.endDate.getTime() - newEndDate.getTime() == 0){
        this.startDate = this.limitStartDate;
        this.endDate = this.limitEndDate;
      } else {
        this.startDate = newStartDate;
        this.endDate = newEndDate;
      }
    },
    zoomToMonth(month, year) {
      let newStartDate = new Date(year, month, 1); // Start of clicked month
      let newEndDate = new Date(year, month + 1, 0); // End of clicked month

      // Add a little "padding" if you want to see the edges
      newStartDate.setDate(newStartDate.getDate() - 10);
      newEndDate.setDate(newEndDate.getDate() + 10);

      newStartDate = newStartDate < this.limitStartDate ? this.limitStartDate : newStartDate;
      newEndDate = newEndDate > this.limitEndDate ? this.limitEndDate : newEndDate;

      // When clicked twice (same timeline range), zoom out
      if (this.startDate.getTime() - newStartDate.getTime() == 0 && this.endDate.getTime() - newEndDate.getTime() == 0){
        this.zoomToYear(year);
      } else {
        this.startDate = newStartDate;
        this.endDate = newEndDate;
      }
    },
    zoomToDay(day, month, year) {
      let newStartDate = new Date(year, month, day - 1); // Start of clicked month
      let newEndDate = new Date(year, month, day + 2); // End of clicked month

      newStartDate = newStartDate < this.limitStartDate ? this.limitStartDate : newStartDate;
      newEndDate = newEndDate > this.limitEndDate ? this.limitEndDate : newEndDate;

      // When clicked twice (same timeline range), zoom out
      if (this.startDate.getTime() - newStartDate.getTime() == 0 && this.endDate.getTime() - newEndDate.getTime() == 0){
        this.zoomToMonth(month, year);
      } else {
        this.startDate = newStartDate;
        this.endDate = newEndDate;
      }
    },

    // Date calculations
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
    // EVENTS
    yearClicked(year) {
      this.zoomToYear(year);
    },
    monthClicked(month, year) {
      this.zoomToMonth(month, year);
    },
    dayClicked(day, month, year) {
      this.zoomToDay(day, month, year);
    },
  },
  computed: {
    limitStartDate() {
      return new Date(2023, 1, 1);
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
      if (hours < 24 * 31 * 2) { // 2 months
        return -1;
      } else if (hours < 24 * 31 * 3) { // 3 months
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
        let width = 100;
        // First year of the timeline
        if (year == startYear) {
          width = (1 - (this.hoursFromStartOfYear(this.startDate) / this.hoursInYear(year))) * 100;
        }
        // Last year of the timeline
        else if (year == endYear) {
          width = (this.hoursFromStartOfYear(this.endDate) / this.hoursInYear(year)) * 100;
        }
        // Exceptions
        // Only one year in the timeline
        if (startYear == endYear) {
          width = 100;
        }
        // First and last year only
        else if (endYear - startYear == 1) {
          if (year == startYear) {
            width = (this.hoursInYear(year) - this.hoursFromStartOfYear(this.startDate)) / this.hoursInTimeline * 100;
          } else {
            width = this.hoursFromStartOfYear(this.endDate) / this.hoursInTimeline * 100;
          }
        }
        timelineYears.push({
          year: year,
          text: year.toString(),
          width: width
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
          let hoursInMonth = year == startYear && month == startMonth ? (daysInAMonth * 24 - this.hoursFromStartOfMonth(this.startDate)) :
           year == endYear && month == endMonth ? this.hoursFromStartOfMonth(this.endDate) :
            daysInAMonth * 24;
          
          // Only one month in the timeline
          if (startYear == endYear && startMonth == endMonth) {
            hoursInMonth = 31 * 24;
          }
          
          timelineMonths.push({
            monthId: `${year}-${month}`,
            month: month,
            year: year,
            textLong: new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' }),
            text: new Date(year, month).toLocaleString('default', { month: 'long' }),
            textShort: new Date(year, month).toLocaleString('default', { month: 'short' }),
            textXShort: new Date(year, month).toLocaleString('default', { month: 'narrow' }),
            width: hoursInMonth / (31 * 24) * 100 // Use 31 days as a reference for width
          });
        }
      }
      return timelineMonths;
    },
    // Timeline days
    timelineDays() {
      const startYear = this.startYear;
      const endYear = this.endYear;
      const timelineDays = [];
      for (let year = startYear; year <= endYear; year++) {
        const startMonth = year == startYear ? this.startMonth : 0;
        const endMonth = year == endYear ? this.endMonth : 11;
        for (let month = startMonth; month <= endMonth; month++) {
          let startDay = year == startYear && month == this.startMonth ? this.startDate.getDate() : 1;
          let endDay = year == endYear && month == this.endMonth ? this.endDate.getDate() : new Date(year, month + 1, 0).getDate();
          for (let day = startDay; day <= endDay; day++) {
            let width = 100;
            // First day of the timeline
            if (year == startYear && month == startMonth && day == this.startDate.getDate()) {
              width = (24 - this.startDate.getHours()) / 24 * 100;
            }
            // Last day of the timeline
            else if (year == endYear && month == endMonth && day == this.endDate.getDate()) {
              width = this.endDate.getHours() / 24 * 100;
            }
            timelineDays.push({
              dayId: `${year}-${month}-${day}`,
              day: day,
              month: month,
              year: year,
              text: day.toString(),
              width: width
            });
          }
        }
      }
      return timelineDays;
    },
  },
  components: {
    
  }
}
</script>


<style scoped>

.timeline-elements-container {
  display: flex;
  width: 100%;
  /* Fix sub-pixel rendering gaps */
  justify-content: flex-start;
}


.timeline-element {
  border: 1px solid #0f306270;
  cursor: pointer;
  transition: width 0.3s ease;
}

.timeline-element:hover {
  background-color: #52b5d999;
}




.timeline-ghost-bar {
  width: 100%;
  height: 20px; /* Give it some height so you can hover it */
  background: var(--blue);
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.timeline-ghost-slide {
  width: 10%; /* Define a width */
  height: 20px;
  background: #52b5d999;
  border: 1px solid #0f306270;
  position: absolute;
  left: 0;
  border-radius: 10px;
  box-shadow: 0 0 4px black;
  pointer-events: none;
}

</style>