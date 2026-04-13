<template>
  <div class="timeline-handle" :style="{ left: (percentageInTimeline) + '%' }">

    <!-- Horizontal container -->
    <div class="horizontal">
      

    <!-- Time string -->
      <div class="vertical timecode-container">


        <div class="horizontal">
          <!-- -24h -->
          <div class="clickable time-control"><span>≪</span></div>
          <!-- -1h -->
          <div class="clickable time-control"><span>&lt;</span></div>

          <div class="timecode-string-container">
            <span>{{ timecodeString }}</span>
            <!-- <span class="time-ago">-{{ timeAgo }}</span> -->
          </div>

          <!-- +1h -->
          <div class="clickable time-control"><span>&gt;</span></div>
          <!-- +24h -->
          <div class="clickable time-control"><span>≫</span></div>
          

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
  font-size: small;
}

.timecode-container {
  align-items: center;
  transform: translateX(-50%);
  cursor: grab;
}


.time-control {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgb(82 181 217 / 68%);
  font-size: x-small;
  margin: 5px;
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
}

.timeline-handle-triangle {
  margin-top: -18px;
  margin-bottom: -14px;
  font-size: x-large;
  color: var(--lightBlue);
  z-index: 5;
}

.time-ago {
  font-size: xx-small;
}

</style>