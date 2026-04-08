<template>
  <span class="bottom-section">
    <!-- Timeline -->
    <div class="timeline-container">

      <div class="timeline-content">

        <div class="vertical">
          <!-- Swith to full timeline -->
          <Transition name="scale-fade" mode="out-in">
            <button class="full-timeline-switch" key="fulltime" v-if="!isFullTimeline" @click="isFullTimeline = !isFullTimeline">2018 - now</button>
            <button class="full-timeline-switch" key="lastweek" v-else @click="isFullTimeline = !isFullTimeline">Lastest week</button>
          </Transition>
          <!-- Play button -->
          <button class="play-button"><span class="fa fa-play"></span></button>
        </div>

        

        <!-- Timeline -->
        <div class="timeline">

          <!-- Slider -->
          <input type="range" min="0" :max="(this.$gui.shortTimelineDays - 1) * 24" step="1" v-model="hoursInSlider" class="timeline-slider">

          <!-- Handel -->
          <div class="timeline-handle" :style="{ left: (percentageInTimeline) + '%' }">
            <!-- Icon -->
            <div class="timeline-handle-triangle">▾</div>
            <!-- Handel box -->
            <div class="timeline-handle-timecode">
              {{ selectedTime }}
            </div>
          </div>

          <!-- Progress line -->
          <div class="timeline-progress">
            <div class="timeline-progress-completion" :style="{ width: (100 - percentageInTimeline - percentageNotAvailable) + '%' }"></div>
            <div class="timeline-progress-not-available" :style="{ width: percentageNotAvailable + '%' }"></div>
          </div>

          <!-- Days -->
          <div class="timeline-days-container">
            <div v-for="day in timelineDays" :key="day.day" class="timeline-day" :title="day.textLong" :style="{ width: day.width + '%' }">
              {{ day.textShort }}             
            </div>
          </div>
        </div>
      </div>

    </div>
  </span>
</template>


<script>

export default {
  name: "Timeline",
  created() {
    
  },
  mounted() {
  },
  data (){
    return {
      isFullTimeline: false,
      hoursInSlider: 50,
      percentageNotAvailable: 12,
    }
  },
  methods: {
    //onclick: function(e){},
  },
  computed: {
    startDate() {
      const date = new Date(this.endDate.getTime());
      date.setHours(date.getHours() - (this.$gui.shortTimelineDays - 1) * 24);
      return date;
    },
    endDate() {
      const date = new Date();
      date.setHours(date.getHours() + 1);
      date.setMinutes(0);
      date.setSeconds(0);
      return date;
    },
    percentageInTimeline() {
      return this.hoursInSlider / (24 * (this.$gui.shortTimelineDays - 1)) * 100;
    },
    timelineDays() {
      // Get the date of X days ago
      let rangeOfDays = this.$gui.shortTimelineDays
      const timelineDays = [];
      let startDate = new Date(this.startDate.getTime());
      for (let i = 0; i < rangeOfDays; i++) {
        timelineDays.push({
          date: new Date(startDate.getTime()),
          day: startDate.getDate(),
          width: i == 0 ? startDate.getHours() / 24 * 100 : i == rangeOfDays - 1 ? startDate.getHours() / 24 * 100 : 100,
          textXShort: startDate.toLocaleString(this.$i18n.locale, {day: 'numeric' }),
          textShort: startDate.toLocaleString(this.$i18n.locale, { weekday: 'short', day: 'numeric' }),
          textLong: startDate.toLocaleString(this.$i18n.locale, { weekday: 'long', day: 'numeric'}),
        });
        startDate.setHours(startDate.getHours() + 24);
      }
      return timelineDays;
    },
    selectedTime() {
      const startDate = new Date(this.startDate.getTime() + (this.hoursInSlider * 3600 * 1000));
      return startDate.toLocaleString(this.$i18n.locale, { hour: 'numeric', minute:'numeric', day: 'numeric', month: 'short' });
    }
  },
}
</script>




<style scoped>
.bottom-section {
  position: fixed;
  bottom: 0px;
  left: 0px;
  right: 0px;
  margin-right: 330px;
  background-color: yellow;
}

.timeline-container {
  position: relative;
  margin: 0 30px;
  padding: 0;
}

.timeline-content {
  max-width: 1800px;
  position: relative;
  width: 100%;
  padding: 0;
  margin: 0 auto;
  display: flex;
  flex-direction: row;
  align-items: flex-end;
}

.full-timeline-switch {
  margin-left: -16px;
  margin-bottom: 8px;

  width: 50px;
  height: 50px;
  font-size: x-small;
  border-radius: 50%;

  display: flex;
  align-items: center;
  justify-content: center;
}
.play-button {
  margin-right: 8px;
  margin-bottom: 8px;

  width: 30px;
  height: 30px;
  border-radius: 50%;

  display: flex;
  align-items: center;
  justify-content: center;
}

.timeline {
  width: calc(100%);
  background: var(--lightBlue);
  display: flex;
  flex-direction: column;
  position: relative;
  box-shadow: 0 0 4px black;
}



.timeline-slider {
  position: absolute;
  width: 100%;
  height: 40px;
  opacity: 0.1; /* Make it invisible */
  cursor: pointer;
  z-index: 5;
}


.timeline-days-container {
  display: flex;
  width: 100%;
}

.timeline-day {
  display: flex;
  justify-content: center;
  border-right: solid 1px var(--blue);
  border-left: solid 1px var(--blue);
  font-size: small;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}


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