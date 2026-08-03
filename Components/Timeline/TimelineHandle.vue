<template>
  <div class="timeline-handle" :style="{ left: (percentageInTimeline) + '%' }">

    <!-- Horizontal container -->
    <div class="horizontal">
      

    <!-- Time string -->
      <div class="vertical timecode-container">


        <div class="horizontal">
          <!-- -24h -->
          <div v-if="hoursToStart >= 24" class="clickable time-control" @click="stepInTime(-24)" title="-24h"><span>≪</span></div>
          <!-- -1h -->
          <div v-if="hoursToStart >= 1" class="clickable time-control" @click="stepInTime(-1)" title="-1h"><span>&lt;</span></div>

          <div class="timecode-string-container" @mousedown="onMouseDown">
            <span>{{ timecodeString }}</span>
            <!-- <span class="time-ago">-{{ timeAgo }}</span> -->
          </div>

          <!-- +1h -->
          <div v-if="hoursToEnd >= 1" class="clickable time-control" @click="stepInTime(1)" title="+1h"><span>&gt;</span></div>
          <!-- +24h -->
          <div v-if="hoursToEnd >= 24" class="clickable time-control" @click="stepInTime(24)" title="+24h"><span>≫</span></div>
          

        </div>
        <span class="timeline-handle-triangle">▾</span>

      </div>

    </div>

  </div>
</template>


<script>

export default {
  name: "TimelineHandle",
  props: {
    startDate: Date,
    endDate: Date,
    timelineEl: HTMLElement,
  },
  created() {
  },
  mounted() {
    // EVENTS
    // keyboard press (left, right)
    window.addEventListener('keydown', this.keydownHandler);
  },
  unmounted() {
    window.removeEventListener('keydown', this.keydownHandler);
  },
  data() {
    return {
    }
  },
  methods: {
    stepInTime(steps) {
      this.$emit('stepInTime', steps);
    },
    // USER EVENTS
    // Dragging the timeline handle
    onMouseDown(e) {
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup', this.onMouseDragEnd);
      this.onMouseMove(e);
    },
    onMouseMove(e) {
      const timelineRect = this.timelineEl.getBoundingClientRect();
      const clickX = e.clientX - timelineRect.left;
      const percentage = Math.max(0, Math.min(1, clickX / timelineRect.width));
      // Could emit or compute here
      const hoursInSlide = Math.round(percentage * this.hoursInTimeline);
      this.$gui.selectedTime = new Date(this.startDate.getTime() + (hoursInSlide * 3600 * 1000));
    },
    onMouseDragEnd(e) {
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('mouseup', this.onMouseDragEnd);
    },
    keydownHandler(event) {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return; // Ignore key presses when focused on input or textarea
      }
      // Left - right
      if (event.key === 'ArrowLeft') {
        this.stepInTime(-1);
      } else if (event.key === 'ArrowRight') {
        this.stepInTime(1);
      }
      // Ctrl + left - right
      if (event.ctrlKey && event.key === 'ArrowLeft') {
        this.stepInTime(-24);
      } else if (event.ctrlKey && event.key === 'ArrowRight') {
        this.stepInTime(24);
      }
    },
  },
  computed: {
    percentageInTimeline() {
      if(this.startDate == undefined || this.endDate == undefined)
        return 0;
      const totalTime = this.endDate.getTime() - this.startDate.getTime();
      const timeFromStart = this.$gui.selectedTime.getTime() - this.startDate.getTime();
      return Math.max(0, Math.min(100, (timeFromStart / totalTime) * 100));
    },
    hoursInTimeline() {
      return Math.round((this.endDate.getTime() - this.startDate.getTime()) / (1000 * 3600));
    },
    hoursToStart(){
      return Math.round((this.$gui.selectedTime.getTime() - this.startDate.getTime()) / (1000 * 3600));
    },
    hoursToEnd() {
      return Math.round((this.endDate.getTime() - this.$gui.selectedTime.getTime()) / (1000 * 3600));
    },
    timelineDays() {
      const totalTime = this.endDate.getTime() - this.startDate.getTime();
      return totalTime / (1000 * 60 * 60 * 24);
    },
    timecodeString() {
      return this.$gui.selectedTime.toLocaleString(this.$i18n.locale, { hour: 'numeric', minute: 'numeric', day: 'numeric', month: 'short' });
    },
    timeAgo() {
      // Add time difference from now
      let now = new Date();
      let timeDiff = this.$gui.selectedTime.getTime() - now.getTime();
      let hoursDiff = Math.floor(timeDiff/(60*60*1000));
      let minDiff = 60 - Math.floor(timeDiff/(60*1000) - hoursDiff*60);

      if (hoursDiff < -24 * 31){
        return "";
      }
      else if (hoursDiff < -24){
        let daysDiff = Math.floor(hoursDiff / 24);
        hoursDiff = hoursDiff - daysDiff*24;
        return daysDiff + "d " + Math.abs(hoursDiff+1) + "h";
      } else if (hoursDiff < 0) {
        return minDiff + "min"; 
      } else
        return (hoursDiff+1) + "h " + minDiff + "min";
    },
    

  }
}

</script>



<style scoped>
.timeline-handle {
  position: relative;
  z-index: 6;
  font-size: small;
}

.timecode-container {
  align-items: center;
  transform: translateX(-50%);
  pointer-events: all;
}


.time-control {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgb(82 181 217 / 68%);
  font-size: 0.7rem;
  margin: 5px;
  margin-bottom: -10px;
  margin-top: -10px;
  box-shadow: 0 0 4px black;
}

.timecode-string-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--lightBlue);
  padding-left: 5px;
  padding-right: 5px;
  box-shadow: 0 0px 4px black;
  border-radius: 5px;
  z-index: 6;
  cursor: grab;
}

.timeline-handle-triangle {
  margin-top: -14px;
  margin-bottom: -14px;
  font-size: x-large;
  color: var(--lightBlue);
  z-index: 5;
}

.time-ago {
  font-size: x0.7rem;
}

</style>