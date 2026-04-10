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

        

        <!-- Short timeline -->
        <ShortTimeline v-if="!isFullTimeline"></ShortTimeline>
      </div>

    </div>
  </span>
</template>


<script>
import ShortTimeline from './ShortTimeline.vue';


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
      date.setHours(date.getHours() - (this.rangeOfDays - 1) * 24);
      date.setHours(0);
      return date;
    },
    endDate() {
      const date = new Date();
      date.setHours(date.getHours() + 1);
      date.setMinutes(0);
      date.setSeconds(0);
      return date;
    },
    rangeOfDays() {
      const selectedDashboard = this.$gui.dashboards.find(d => d.id === this.$gui.selectedDashboard);
      return selectedDashboard ? selectedDashboard.latestDaysRange : this.$gui.defaultTimelineDays;
    },
    percentageInTimeline() {
      return this.hoursInSlider / (24 * (this.rangeOfDays - 1)) * 100;
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
          width: i == 0 ? (24 - startDate.getHours()) / 24 * 100 : i == rangeOfDays - 1 ? startDate.getHours()/ 24 * 100 : 100,
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
  components: {
    ShortTimeline
  }
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


:deep(.timeline-slider) {
  position: absolute;
  width: 100%;
  height: 40px;
  opacity: 0; /* Make it invisible */
  cursor: pointer;
  z-index: 5;
}


:deep(.timeline-days-container) {
  display: flex;
  width: 100%;
}

:deep(.timeline-day) {
  display: flex;
  justify-content: center;
  border-right: solid 1px var(--blue);
  border-left: solid 1px var(--blue);
  font-size: small;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>