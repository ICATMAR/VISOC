<template>
  <!-- Timeline -->
  <div class="timeline" ref="timeline">

    <div class="timeline-inner-container">
      <!-- Slider -->
      <input type="range" min="0" :max="totalHours" step="1" v-model="hoursInSlider" class="timeline-slider">

      <!-- Handel -->
      <div class="timeline-handle" :style="{ left: (percentageInTimeline) + '%' }">
        <!-- Icon -->
        <div class="timeline-handle-triangle">▾</div>
        <!-- Handel box -->
        <div class="timeline-handle-timecode">
          {{ selectedTime }}
        </div>
      </div>

      <TimeHandle :startDate="startDate" :endDate="endDate" @stepInTime="stepInTime"></TimeHandle>

      <!-- Progress line -->
      <div class="timeline-progress">
        <div class="timeline-progress-completion"
          :style="{ width: (100 - percentageInTimeline - percentageNotAvailable) + '%' }"></div>
        <div class="timeline-progress-not-available" :style="{ width: percentageNotAvailable + '%' }"></div>
      </div>

      <!-- Days -->
      <div class="timeline-elements-container">
        <div v-for="day in timelineDays" :key="day.day" class="timeline-element" :title="day.textLong"
          :style="{ width: day.width + '%' }">
          <span v-if="pixelsPerDay > 150">
            {{ day.textLong }}
          </span>
          <span v-else-if="pixelsPerDay > 90">
            {{ day.textShort }}
          </span>
          <span v-else>
            {{ day.textXShort }}
          </span>

        </div>
      </div>

    </div>
  </div>
</template>




<script>

export default {
  name: "ShortTimeline",
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
      isFullTimeline: false,
      hoursInSlider: 50,
      percentageNotAvailable: 12,
      timelinePixelWidth: 2000,
    }
  },
  methods: {
    //onclick: function(e){},
    windowIsResizing() {
      this.timelinePixelWidth = this.$refs.timeline.offsetWidth;
    },
  },
  computed: {
    startDate() {
      const date = new Date(this.endDate.getTime());
      date.setHours(date.getHours() - (this.rangeOfDays - 1) * 24);
      date.setHours(0);
      return date;
    },
    endDate() {
      const date = new Date();
      date.setHours(date.getHours() + 1);
      date.setMinutes(0);
      date.setSeconds(0);
      date.setMilliseconds(0);
      return date;
    },
    rangeOfDays() {
      const selectedDashboard = this.$gui.dashboards.find(d => d.id === this.$gui.selectedDashboard);
      return selectedDashboard ? selectedDashboard.latestDaysRange : this.$gui.defaultTimelineDays;
    },
    totalHours() {
      return Math.round((this.endDate.getTime() - this.startDate.getTime()) / (1000 * 3600));
    },
    percentageInTimeline() {
      return this.hoursInSlider / this.totalHours * 100;
    },
    timelineDays() {
      // Get the date of X days ago
      let rangeOfDays = this.rangeOfDays;
      const timelineDays = [];
      let startDate = new Date(this.startDate.getTime());
      for (let i = 0; i < rangeOfDays; i++) {
        timelineDays.push({
          date: new Date(startDate.getTime()),
          day: startDate.getDate(),
          width: i == 0 ? (24 - startDate.getHours()) / 24 * 100 : i == rangeOfDays - 1 ? this.endDate.getHours() / 24 * 100 : 100,
          textXShort: startDate.toLocaleString(this.$i18n.locale, { day: 'numeric' }),
          textShort: startDate.toLocaleString(this.$i18n.locale, { weekday: 'short', day: 'numeric' }),
          textLong: startDate.toLocaleString(this.$i18n.locale, { weekday: 'long', day: 'numeric' }),
        });
        startDate.setHours(startDate.getHours() + 24);
      }
      return timelineDays;
    },
    selectedTime() {
      const startDate = new Date(this.startDate.getTime() + (this.hoursInSlider * 3600 * 1000));
      return startDate.toLocaleString(this.$i18n.locale, { hour: 'numeric', minute: 'numeric', day: 'numeric', month: 'short' });
    },
    pixelsPerDay() {
      return this.timelinePixelWidth / this.timelineDays.length;
    },
  },
}
</script>

<style scoped>




.timeline-progress {
  width: 100%;
  height: 4px;
  display: flex;
  justify-content: flex-end;
}

.timeline-progress-completion {
  height: 100%;
  background: var(--red);
}

.timeline-progress-not-available {
  height: 100%;
  background: var(--gray);
}


.timeline-handle {
  position: relative;
}

.timeline-handle-triangle {
  position: absolute;
  left: -10px;
  top: -24px;
  font-size: x-large;
  color: var(--lightBlue);
}

.timeline-handle-timecode {
  position: absolute;
  top: -34px;
  left: -20px;
  background: var(--lightBlue);
  border-radius: 5px;
  padding: 2px 10px 2px 10px;
  box-shadow: 0 0 4px black;
  font-size: small;
}
</style>