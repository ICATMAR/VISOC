<template>

  <!-- Timeline -->
  <div class="timeline" ref="timeline">

    <TimelineHandle :startDate="startDate" :endDate="endDate" @stepInTime="stepInTime"></TimelineHandle>

    <!-- timeline container -->
    <div class="timeline-inner-container">

      <!-- Progress line -->
      <div class="timeline-progress">
        <!-- <div class="timeline-progress-completion"
          :style="{ width: (100 - percentageInTimeline - percentageNotAvailable) + '%' }"></div> -->
        <!-- <div class="timeline-progress-not-available" :style="{ width: percentageNotAvailable + '%' }"></div> -->
        <!-- <div class="timeline-progress-not-available" :style="{ width: 100 + '%' }"></div> -->
      </div>


      <!-- Years -->
      <div class="timeline-elements-container">
        <div v-for="year in timelineYears" :key="year.year" class="timeline-element"
          :style="{ width: year.width + '%'}" @click="yearClicked($event, year.year)">
          <span>{{ year.text }}</span>
        </div>
      </div>

      <!-- Months -->
      <div class="timeline-elements-container" v-if="pixelsPerMonth > 12">
        <div v-for="month in timelineMonths" :key="month.monthId" class="timeline-element"
          :style="{ width: month.width + '%'}" @click="monthClicked($event, month.month, month.year)">
          <!-- One letter -->
          <span v-if="pixelsPerMonth < 25">{{ month.textXShort }}</span>
          <!-- Abbr -->
          <span v-else-if="pixelsPerMonth < 80">{{ month.textShort }}</span>
          <!-- full month -->
          <span v-else >{{ month.text }}</span>
        </div>
      </div>
      <!-- Month empty bar -->
      <div v-else class="timeline-ghost-bar" @mousemove="moveGhost" @mouseleave="ghostX = -1000" @click="ghostClicked">
        <div class="timeline-ghost-slide" :style="{ transform: `translateX(${ghostX}px)` }"></div>
      </div>

      <!-- Days -->
      <div class="timeline-elements-container" v-if="pixelsPerDay > 15">
        <div v-for="day in timelineDays" :key="day.dayId" class="timeline-element"
          :style="{ width: day.width + '%'}" @click="dayClicked($event, day.day, day.month, day.year)">
          <span>{{ day.text }}</span>
        </div>
      </div>
      <!-- Day empty bar -->
      <div v-else class="timeline-ghost-bar" @mousemove="moveGhost" @mouseleave="ghostX = -1000" @click="ghostClicked">
        <div class="timeline-ghost-slide" :style="{ transform: `translateX(${ghostX}px)` }"></div>
      </div>

    </div>

  </div>

</template>


<script>
import TimelineHandle from './TimelineHandle.vue';


export default {
  name: "FullTimeline",
  created() {

  },
  mounted() {
    this.timelinePixelWidth = this.$refs.timeline.offsetWidth;
    // EVENTS
    window.addEventListener('resize', this.windowIsResizing);
  },
  unmounted() {
    window.removeEventListener('resize', this.windowIsResizing);
  },
  data() {
    return {
      startDate: new Date(2023, 0, 1),
      endDate: new Date(),
      ghostX: -1000,
      timelinePixelWidth: 2000,
    }
  },
  methods: {
    windowIsResizing() {
      this.timelinePixelWidth = this.$refs.timeline.offsetWidth;
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
    // Timeline clicked, center on date
    timelineClicked(e) {
      const rect = this.$refs.timeline.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickPercent = clickX / rect.width;
      const hoursFromStart = Math.round(this.hoursInTimeline * clickPercent);
      this.$gui.selectedTime = new Date(this.startDate.getTime() + hoursFromStart * 60 * 60 * 1000);
    },
    // EVENTS
    yearClicked(e, year) {
      this.timelineClicked(e);
      this.zoomToYear(year);
    },
    monthClicked(e, month, year) {
      this.timelineClicked(e);
      this.zoomToMonth(month, year);
    },
    dayClicked(e, day, month, year) {
      this.timelineClicked(e);
      this.zoomToDay(day, month, year);
    },
    moveGhost(event) {
      const rect = event.target.getBoundingClientRect();
      // Calculate mouse X relative to the container
      let x = event.clientX - rect.left;
      // Center the follower on the mouse 
      // Subtract half of the follower's width (e.g., ghost is 10% wide)
      const ghostWidth = rect.width * 0.1; 
      x = x - (ghostWidth / 2);
      // Constrain the movement so it stays inside the container
      const maxX = rect.width - ghostWidth;
      this.ghostX = Math.max(0, Math.min(x, maxX));
    },
    ghostClicked(event) {
      this.timelineClicked(event);
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
    // EMITS
    stepInTime(steps) {
      // TODO: OTHER SYSTEMS MIGHT HAVE 15 min or 30 min time steps
      const timeStep = steps * 60 * 60 * 1000;

      const newSelectedTime = new Date(this.$gui.selectedTime.getTime() + timeStep);
      // Clamp to limits
      if (newSelectedTime < this.limitStartDate) {
        this.$gui.selectedTime = new Date(this.limitStartDate.getTime());
      } else if (newSelectedTime > this.limitEndDate) {
        this.$gui.selectedTime = new Date(this.limitEndDate.getTime());
      } else {
        this.$gui.selectedTime = newSelectedTime;
      }
      // If outside or close to the edge of the timeline, move the timeline as well
      const hoursDiffFromStart = (this.$gui.selectedTime.getTime() - this.startDate.getTime()) / (1000 * 60 * 60);
      const leftPercent = (hoursDiffFromStart / this.hoursInTimeline) * 100;
      const percentThreshold = 20;
      const movementFactor = 0.3; // How much to move the timeline when the edge is hit (0.5 means half of the visible range)
      if (leftPercent < percentThreshold) {
        const hoursToMove = this.hoursInTimeline * (movementFactor -  leftPercent / 100);
        this.startDate = new Date(this.startDate.getTime() - hoursToMove * 60 * 60 * 1000);
        this.endDate = new Date(this.endDate.getTime() - hoursToMove * 60 * 60 * 1000);
      } else if (leftPercent > (100 - percentThreshold)) {
        const hoursToMove = this.hoursInTimeline * (movementFactor - (100 - leftPercent) / 100);
        this.startDate = new Date(this.startDate.getTime() + hoursToMove * 60 * 60 * 1000);
        this.endDate = new Date(this.endDate.getTime() + hoursToMove * 60 * 60 * 1000);
      }
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
      const timelineMonths = [];

      // We loop through the years and months within our visible range
      for (let year = this.startYear; year <= this.endYear; year++) {
        const startM = (year === this.startYear) ? this.startMonth : 0;
        const endM = (year === this.endYear) ? this.endMonth : 11;

        for (let month = startM; month <= endM; month++) {
          // Define the actual boundaries of this specific month
          const monthStart = new Date(year, month, 1);
          const monthEnd = new Date(year, month + 1, 1);
          // Find the intersection: What part of this month is inside our [startDate, endDate]?
          const visibleStart = Math.max(this.startDate, monthStart);
          const visibleEnd = Math.min(this.endDate, monthEnd);
          // Calculate hours in this segment
          const hoursInSegment = (visibleEnd - visibleStart) / (1000 * 60 * 60);
          // 4. Calculate width relative to the whole visible timeline
          const width = (hoursInSegment / this.hoursInTimeline) * 100;

          // Skip pushing if the month has no visible hours (handles edge cases)
          if (width > 0) {
            timelineMonths.push({
              monthId: `${year}-${month}`,
              month: month,
              year: year,
              textLong: new Date(year, month).toLocaleString(this.$i18n.locale, { month: 'long', year: 'numeric' }),
              text: new Date(year, month).toLocaleString(this.$i18n.locale, { month: 'long' }),
              textShort: new Date(year, month).toLocaleString(this.$i18n.locale, { month: 'short' }),
              textXShort: new Date(year, month).toLocaleString(this.$i18n.locale, { month: 'narrow' }),
              width: width
            });
          }
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
    pixelsPerDay() {
      return this.timelinePixelWidth / this.timelineDays.length;
    },
    pixelsPerMonth() {
      return this.timelinePixelWidth / this.timelineMonths.length;
    }
  },
  components: {
    TimelineHandle,
  }
}
</script>


<style scoped>
.timeline-progress {
  width: 100%;
  height: 4px;
  display: flex;
  justify-content: flex-end;
  background: linear-gradient(to right, #52b5d9 0%, #52b5d9 15%, rgba(0,0,0,0) 15%, rgba(0,0,0,0) 25%, #52b5d9 25%, #52b5d9 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,0) 60%, #52b5d9 60%, #52b5d9 90%, rgba(0,0,0,0) 90%);
}


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