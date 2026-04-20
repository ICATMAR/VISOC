<template>
  <Transition name="slideBottom-fade">
    <!-- Vertical container -->
    <div class="vertical datatimeline-pane-section" v-show="$gui.isDataTimelineOpen && !$gui.isMenuOpen">

      <!-- Cross and top-left icons -->
      <div><i class="clickable close-x fa fa-xmark" v-on:click="() => { $gui.isDataTimelineOpen = false }"></i></div>

      <!-- Data and timeline section -->
      <div class="horizontal">
        <!-- Variables -->
        <div class="horizontal variable-names-container">
          <!-- Variable names -->
          <div class="vertical variable-names-subcontainer">
            <span>Temperature</span>
            <span>Salinity</span>
          </div>
          <!-- Variable units -->
          <div class="vertical variable-names-subcontainer">
            <span class="clickable" style="text-decoration: underline;">ºC</span>
            <span class="clickable" style="text-decoration: underline;">PSU</span>
          </div>
        </div>

        <!-- Data timeline and info -->
        <div class="horizontal table-and-info-container" ref="tableSlidingContainer"
          @mousedown="startDragging"
          @touchstart="startDragging">
          <!-- Timeline container -->
          <div class="horizontal table-container">
            <!-- Background canvas? -->
            
            <!-- Timetable -->
            <table>
              <tbody>
                <!-- Days of week -->
                <tr>
                  <td v-for="day in timelineDays" :key="day.date" :colspan="day.hoursInDay / hourlyInterval"
                    class="weekDayCell">
                    <span>{{ day.textLong }}</span>
                  </td>
                </tr>
                <!-- Time of day -->
                <tr>
                  <td v-for="hour in timelineHours" :key="hour" class="hourCell">
                    <span>{{ hour % 24 }}</span>
                  </td>
                </tr>
                <!-- Data points -->
                <tr v-for="(varDataPoints, index) in timelineData" :key="index">
                  <td v-for="(dataPoint, index) in varDataPoints" :key="index" style="font-size: small">
                    <span>{{ dataPoint }}ºC</span>
                  </td>
                </tr>
              </tbody>
            </table>

          </div>

          <!-- Info section -->
          <div class="info-section"><span>This is the info section where information about the platform is provided. Location, update rate...</span></div>
        </div>

      
      </div>

      <!-- Bottom options -->
      <!-- <div class="horizontal bottom-bar">
        <span>Default view</span>
        <span>Compare with models</span>
        <span>Detail currents</span>
      </div> -->

      <div class="horizontal wrap button-group bottom-bar">
        <button v-for="opt in bottomOptions" :key="opt" class="clickable" :class="{ 'selectedOption': selectedOption == opt }"
          @click="selectedOption = opt"><span>{{ $t(opt) }}</span></button>
      </div>
      

      <!-- Platform detail -->
      <section class="platform-pane-container" v-show="$gui.isPlatformDetailOpen">
        <div>Map</div>
        <div>Platform name</div>
        <button v-on:click="() => { $gui.isPlatformDetailOpen = false }">Close platform detail</button>
      </section>


    </div>
  </Transition>
</template>





<script>

export default {
  name: "DataTimeline",
  created() {
    
  },
  mounted() {
    // EVENTS
  },
  // Clean up global listeners if component is destroyed
  beforeUnmount() {
    this.stopDragging();
  },
  data (){
    return {
      hourlyInterval: 3,
      bottomOptions: ['Default view', 'Compare with models', 'Detail currents'],
      selectedOption: 'Default view',
      // Dragging variables
      isDragging: false,
      startX: 0,
      scrollLeft: 0,
    }
  },
  methods: {
    //onclick: function(e){},
    // DRAGGING THE TIMELINE
    startDragging(e) {
      this.isDragging = true;
      
      // Get the initial X position (support both Mouse and Touch)
      const pageX = e.type === 'touchstart' ? e.touches[0].pageX : e.pageX;
      
      const container = this.$refs.tableSlidingContainer;
      this.startX = pageX - container.offsetLeft;
      this.scrollLeft = container.scrollLeft;

      // Add global listeners so dragging continues even if mouse leaves the div
      window.addEventListener('mousemove', this.onDragging);
      window.addEventListener('touchmove', this.onDragging);
      window.addEventListener('mouseup', this.stopDragging);
      window.addEventListener('touchend', this.stopDragging);
    },
    onDragging(e) {
      if (!this.isDragging) return;

      // Prevent default behavior to stop text selection or page bounce
      if (e.cancelable) e.preventDefault();

      const pageX = e.type === 'touchmove' ? e.touches[0].pageX : e.pageX;
      const container = this.$refs.tableSlidingContainer;
      
      const x = pageX - container.offsetLeft;
      // Multiplier makes the scroll speed feel more responsive
      const walk = (x - this.startX) * 1.5; 
      container.scrollLeft = this.scrollLeft - walk;

      console.log("dragging")
    },
    stopDragging() {
      this.isDragging = false;
      window.removeEventListener('mousemove', this.onDragging);
      window.removeEventListener('touchmove', this.onDragging);
      window.removeEventListener('mouseup', this.stopDragging);
      window.removeEventListener('touchend', this.stopDragging);
    },
  },
  computed: {
    startDate() {
      let date = new Date(this.endDate.getTime());
      date.setDate(date.getDate() - this.rangeOfDays);
      date.setHours(0,0,0,0);
      return date;
    },
    endDate() {
      let date = new Date();
      date.setMinutes(0,0,0);
      return date;
    },
    rangeOfDays() {
      const selectedDashboard = this.$gui.dashboards.find(d => d.id === this.$gui.selectedDashboard);
      return selectedDashboard ? selectedDashboard.latestDaysRange : this.$gui.defaultTimelineDays;
    },
    timelineDays() {
      const timelineDays = [];
      const rangeOfDays = this.rangeOfDays + 1;
      let movingDate = new Date(this.startDate.getTime());
      for (let i = 0; i < rangeOfDays; i++) {
        timelineDays.push({
          date: new Date(movingDate.getTime()),
          day: movingDate.getDate(),
          hoursInDay: i == 0 ? 24 - movingDate.getHours() : i == rangeOfDays - 1 ? this.endDate.getHours() : 24,
          width: i == 0 ? (24 - movingDate.getHours()) / 24 * 100 : i == rangeOfDays - 1 ? this.endDate.getHours() / 24 * 100 : 100,
          textXShort: movingDate.toLocaleString(this.$i18n.locale, { day: 'numeric' }),
          textShort: movingDate.toLocaleString(this.$i18n.locale, { weekday: 'short', day: 'numeric' }),
          textLong: movingDate.toLocaleString(this.$i18n.locale, { weekday: 'long', day: 'numeric' }),
        });
        movingDate.setDate(movingDate.getDate() + 1);
      }
      return timelineDays;
    },
    timelineHours(){
      let totalHours = Math.round((this.endDate.getTime() - this.startDate.getTime()) / (1000 * 3600));
      let timelineHours = [];
      for (let i = 0; i < totalHours; i++) {
        if (i % this.hourlyInterval === 0) 
          timelineHours.push(i);
      }
      return timelineHours;
    },
    timelineData(){
      let variablesDataPoints = [];
      for (let vI = 0; vI < 2; vI++) {
        variablesDataPoints[vI] = [];
        for (let i = 0; i < this.timelineHours.length; i++) {
          // Generate random data points for now
          variablesDataPoints[vI][i] = Math.floor(Math.random() * 10);
        }
      }
      return variablesDataPoints;
    },
  },
  components: {
    
  }
}

</script>







<style scoped>
.datatimeline-pane-section {
  align-self: flex-start;
  position: relative;
  pointer-events: auto;

  font-size: small;
}

.datatimeline-pane-container {
  margin: 0;
  padding: 0;
  left: 0;
  right: 0;
  width: 100vw;
  min-height: 100px;
  position: relative;
  pointer-events: auto;
  overflow: unset;
  -webkit-transition: margin-bottom .3s ease-in-out;
  transition: margin-bottom .3s ease-in-out;
}

.platform-pane-container {
  position: absolute;
  top: initial;
  height: initial;
  bottom: 100%;
  width: 750px;
  padding: 0;
  margin-left: 0;
  left: calc((100vw - 750px) / 2);
  background: orange;
}


.table-and-info-container {
  overflow: hidden;
  /* overflow-x: scroll; */
  /* -webkit-overflow-scrolling: touch; */
  /* scrollbar-width: none; */
  cursor: grab;
  user-select: none;
  scroll-behavior: auto;
  width: calc(100vw - 125px);
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
.table-and-info-container:active {
  cursor: grabbing;
}

.table-container {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.85);
}

td {
  width: 30px;
  text-align: center;
}

td > * {
  color: black;
  text-shadow: none;
}

.weekDayCell {
  text-align: left;
  padding-left: 15px;
}

.hourCell {
  font-size: x-small;
}

.variable-names-container {
  width: 125px;
  justify-content: flex-end;
  font-size: x-small;
  height: 100%;
  background: var(--lightBlue);
}

.variable-names-container > div {
  padding-top: 50px;
  padding-right: 10px;
  text-align: right;
}

.variable-names-subcontainer > span {
  color: black;
  text-shadow: none;
  height: 22px;
}



.info-section {
  width: 250px;
  min-width: 250px;
}

.bottom-bar {
  border-top: 1px white solid;
  background: var(--blue);
}
.bottom-bar > * {
  padding-left: 10px;
  font-size: x-small;
}

.close-x {
  position: absolute;
  width: 30px;
  height: 30px;
  top: -15px;
  left: 25px;
  
  background: var(--red);
  color: white;
  box-shadow: 0 0 4px black;
  border-radius: 50%;
  
  display: flex;
  justify-content: center;
  align-items: center;
    
}

</style>