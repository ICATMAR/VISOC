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

          <!-- Load previous days -->
          <div class="button-next-prev-container">
            <button class="clickable button-next-previous-days"><span><i class="fa-solid fa-angle-up" style="padding-top: 10px;"></i>3 days before</span></button>
          </div>

          <!-- Timeline container -->
          <div class="horizontal table-container" ref="tableContainer">
            <!-- Background canvas? -->
            
            <!-- Timetable -->
            <table>
              <tbody>
                <!-- Days of week -->
                <tr>
                  <td v-for="day in timelineDays" :key="day.date" :colspan="Math.ceil(day.hoursInDay / hourlyInterval)"
                    class="weekDayCell">
                    <span>{{ day.textLong }}</span>
                  </td>
                </tr>
                <!-- Time of day -->
                <tr>
                  <td v-for="hour in timelineHours" :key="hour" class="hourCell">
                    <span :style="{ opacity: (hour % 24 < 6 || hour % 24 >= 21) ? '0.4' : '1' }">{{ hour % 24 }}</span>
                  </td>
                </tr>
                <!-- Data points -->
                <tr v-for="(varDataPoints, varIndex) in timelineData" :key="varIndex">
                  <td v-for="(dataPoint, index) in varDataPoints" :key="index" 
                  :style="getGradientStyle(index, varDataPoints)" style="font-size: small">
                    <span>{{ dataPoint }}º</span>
                  </td>
                </tr>
              </tbody>
            </table>

          </div>


          <!-- Load next days -->
          <div class="button-next-prev-container ">
          <button class="clickable button-next-previous-days button-next-days"><span> <i class="fa-solid fa-angle-up" style="padding-top: 10px;"></i> 3 days after</span></button>
          </div>

          <!-- Info section -->
          <div class="horizontal info-section">
            <img :src="imgSrc">
            <span>This is the info section where information about the platform is provided. Location, update rate...</span>
          </div>
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
      // Example image
      imgSrc: './Assets/Images/platforms/HFRCREU.png'
    }
  },
  methods: {
    //onclick: function(e){},
    // LEGEND COLORS
    // Helper to map temperature to a color (example logic)
    getColorFromValue(value) {
      if (value < 3) return 'white';
      if (value < 6) return 'yellow'; // Blue
      if (value < 9) return 'orange'; // Yellow
      return 'red'; // Orange
    },
    getGradientStyle(index, dataArray) {
      const currentVal = dataArray[index];
      // Use the current value as fallback if neighbor doesn't exist
      const prevVal = index > 0 ? dataArray[index - 1] : currentVal;
      const nextVal = index < dataArray.length - 1 ? dataArray[index + 1] : currentVal;

      const prevColor = this.getColorFromValue((prevVal + currentVal) / 2);
      const currColor = this.getColorFromValue(currentVal);
      const nextColor = this.getColorFromValue((nextVal + currentVal) / 2);

      return {
        background: `linear-gradient(to right, ${prevColor}, ${currColor}, ${nextColor})`
      };
    },

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
    isComponentVisible() {
      return this.$gui.isDataTimelineOpen && !this.$gui.isMenuOpen;
    }
  },
  watch: {
    isComponentVisible(isVisible) {
      if (isVisible) {
        // Reset scroll position when timeline is opened
        this.$nextTick(() => {
          const infoAndTableContainer = this.$refs.tableSlidingContainer;
          const tableContainer = this.$refs.tableContainer;
          infoAndTableContainer.scrollLeft = Math.max(0, 20 + tableContainer.offsetWidth - infoAndTableContainer.offsetWidth); // Start at the end (latest time)
        });
      }
    }
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
  height: 100%;
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
  height: 100%;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.85);
}

table {
  border-collapse: collapse;
  border-spacing: 0;
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
  border-left: 1px solid gray;
  border-bottom: 1px solid gray;
}

.hourCell {
  font-size: x-small;
  border-bottom: 1px solid #0000002e;
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

.button-next-prev-container {
  height: 100%;
  display: flex;
  align-items: center;
  background: #b3b3b3;
}

.button-next-previous-days {
  width: 20px;
  writing-mode: sideways-lr;
  text-orientation: mixed;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--red);
  border: none;
  padding: 0;
  font-size: x-small;
  text-transform: uppercase;
  border-radius: 10px 0px 0px 10px;
  padding-inline: 10px;
}

.button-next-days {
  rotate: 180deg;
}




.info-section {
  width: 400px;
  min-width: 400px;
  background: var(--lightBlue);
  padding-left: 10px;
  height: 100%;
}

.info-section > img {
  max-height: 160px;
  padding: 10px;
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