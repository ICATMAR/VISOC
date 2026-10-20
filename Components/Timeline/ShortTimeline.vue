<template>
  <!-- Timeline -->
  <div class="timeline" ref="timeline">

    <!-- Timeline handle -->
    <TimelineHandle :startDate="startDate" :endDate="endDate" :timelineEl="$refs.timeline" @stepInTime="stepInTime"></TimelineHandle>

    <div class="timeline-inner-container" @mousedown="onMouseDown">
      <!-- Slider -->
      <!-- <input type="range" min="0" :max="hoursInTimeline" step="1" v-model="hoursInSlider" class="timeline-slider"> -->

      <!-- Handel box -->
      <!-- <div style="display: none">
        {{ selectedTime }}
      </div> -->
      


      <!-- Where there is data: one line per HF radar network in view, red on
           the hours with a map, gray on those without (see availabilityRows) -->
      <div class="availability-rows" v-if="availabilityRows.length">
        <div v-for="row in availabilityRows" :key="row.network" class="availability-row"
          :title="row.network" :style="{ background: row.background }"></div>
      </div>

      <!-- Progress line -->
      <div class="timeline-progress" v-else>
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

import TimelineHandle from './TimelineHandle.vue';

// Availability rows (see availabilityRows)
const AVAILABILITY_FULL = 'rgb(255, 115, 105)'; // --red
const AVAILABILITY_LOW = 'rgb(176, 128, 124)';  // the red, grayed
const AVAILABILITY_NONE = 'rgb(78, 78, 78)';    // --gray
// Below this fraction of a network's fullest map, an hour counts as thin
const LOW_FRACTION = 0.7;

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
      percentageNotAvailable: 12,
      timelinePixelWidth: 2000,
    }
  },
  methods: {
    //onclick: function(e){},
    windowIsResizing() {
      this.timelinePixelWidth = this.$refs.timeline.offsetWidth;
    },
    // USER EVENTS
    // Dragging the timeline
    onMouseDown(e) {
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup', this.onMouseDragEnd);
      this.onMouseMove(e);
    },
    onMouseMove(e) {
      const timelineRect = this.$refs.timeline.getBoundingClientRect();
      const clickX = e.clientX - timelineRect.left;
      const percentage = Math.max(0, Math.min(1, clickX / timelineRect.width));
      const hoursFromStartDate = Math.round(percentage * this.hoursInTimeline);
      this.$gui.selectedTime = new Date(this.startDate.getTime() + (hoursFromStartDate * 3600 * 1000));
    },
    onMouseDragEnd() {
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('mouseup', this.onMouseDragEnd);
    },

    // COMPONENT EVENTS
    stepInTime(steps) {
      const timeStep = steps * 60 * 60 * 1000;

      const newSelectedTime = new Date(this.$gui.selectedTime.getTime() + timeStep);
      // Clamp to limits
      if (newSelectedTime < this.startDate) {
        this.$gui.selectedTime = new Date(this.startDate.getTime());
      } else if (newSelectedTime > this.endDate) {
        this.$gui.selectedTime = new Date(this.endDate.getTime());
      } else {
        this.$gui.selectedTime = newSelectedTime;
      }
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
    hoursInTimeline() {
      return Math.round((this.endDate.getTime() - this.startDate.getTime()) / (1000 * 3600));
    },
    percentageInTimeline() {
      const hoursFromStartDate = (this.$gui.selectedTime.getTime() - this.startDate.getTime()) / (1000 * 3600);
      return hoursFromStartDate / this.hoursInTimeline * 100;
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
    // selectedTime() {
    //   const selTime = new Date(this.startDate.getTime() + (this.hoursInSlider * 3600 * 1000));
    //   this.$gui.selectedTime = selTime;
    //   return selTime.toLocaleString(this.$i18n.locale, { hour: 'numeric', minute: 'numeric', day: 'numeric', month: 'short' });
    // },
    pixelsPerDay() {
      return this.timelinePixelWidth / this.timelineDays.length;
    },
    // One row per network with its hours coloured: red where it has a map,
    // a grayer red where the map is thin (fewer than LOW_FRACTION of the
    // network's fullest map in the range), gray where there is none. Each
    // hour is centred on its own tick - the handle sits on the hour - so
    // it spans half an hour either side. Drawn as one gradient per row with
    // hard stops, rather than an element per hour.
    availabilityRows() {
      if (this.$gui.selectedDashboard !== 'hfr') return [];
      const hours = this.hoursInTimeline;
      const start = this.startDate.getTime();
      return this.$gui.hfrAvailability.map(row => {
        const max = Math.max(0, ...Object.values(row.hours));
        const colors = [];
        for (let i = 0; i <= hours; i++) {
          const count = row.hours[new Date(start + i * 3600 * 1000).toISOString()] ?? 0;
          colors.push(count === 0 ? AVAILABILITY_NONE : count < LOW_FRACTION * max ? AVAILABILITY_LOW : AVAILABILITY_FULL);
        }
        const stops = [];
        colors.forEach((color, i) => {
          const from = Math.max(0, (i - 0.5) / hours * 100);
          const to = Math.min(100, (i + 0.5) / hours * 100);
          const last = stops[stops.length - 1];
          if (last && last.color === color) last.to = to;
          else stops.push({ color, from, to });
        });
        const gradient = stops.map(s => `${s.color} ${s.from}% ${s.to}%`).join(', ');
        return { network: row.network, background: `linear-gradient(to right, ${gradient})` };
      });
    },
  },
  components: {
    TimelineHandle
  }
}
</script>

<style scoped>

.timeline-inner-container {
  cursor: grab;
}


.timeline-progress {
  width: 100%;
  height: 4px;
  display: flex;
  justify-content: flex-end;
}

.availability-rows {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.availability-row {
  height: 4px;
  width: 100%;
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
  pointer-events: none;
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