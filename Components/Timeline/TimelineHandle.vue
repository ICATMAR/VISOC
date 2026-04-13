<template>
  <div class="timeline-handle" :style="{ left: (percentageInTimeline) + '%' }">

    <!-- Horizontal container -->
    <div class="horizontal">
      <!-- -24h -->
      <!-- -1h -->

    <!-- Time string -->
      <div class="vertical timecode-container">
        
        <div class="timecode-string-container">
          <span>{{ timecodeString }}</span>
          <!-- <span class="time-ago">-{{ timeAgo }}</span> -->
        </div>
        <span class="timeline-handle-triangle">▾</span>

      </div>

      <!-- +1h -->
      <!-- +24h -->
    </div>

  </div>
</template>


<script>

export default {
  name: "TimelineHandle",
  props: {
    startDate: Date,
    endDate: Date,
  },
  created() {
  },
  mounted() {
  },
  unmounted() {
  },
  data() {
    return {
      
    }
  },
  methods: {
  },
  computed: {
    percentageInTimeline() {
      if(this.startDate == undefined || this.endDate == undefined)
        return 0;
      const totalTime = this.endDate.getTime() - this.startDate.getTime();
      const timeFromStart = this.$gui.selectedTime.getTime() - this.startDate.getTime();
      return Math.max(0, Math.min(100, (timeFromStart / totalTime) * 100));
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
}

.timecode-container {
  align-items: center;
  transform: translateX(-50%);
  cursor: grab;
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
}

.timeline-handle-triangle {
  margin: -20px;
  font-size: xx-large;
  color: var(--lightBlue);
  z-index: 5;
}

.time-ago {
  font-size: xx-small;
}

</style>