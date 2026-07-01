<template>
  <!-- Data and timeline section -->
  <div class="horizontal data-timeline-container">
    <!-- Variables -->
    <div class="vertical variable-names-container">
      <!-- Interval picker (click to cycle) -->
      <div class="horizontal interval-picker">
        <span class="clickable" style="text-decoration: underline;" @click="cycleInterval" :title="$t('Time interval')">{{ currentIntervalLabel }}</span>
      </div>
      <!-- Timezone toggle -->
      <div class="horizontal interval-picker">
        <span class="clickable" style="text-decoration: underline;" @click="$gui.timelineUseLocalTime = !$gui.timelineUseLocalTime">{{ $gui.timelineTimezoneLabel }}</span>
      </div>
      <!-- Variable names and units -->
      <div class="horizontal variable-names-row">
        <div class="vertical variable-names-subcontainer">
          <span v-for="v in variables" :key="v.name"
            :class="{ 'active-var': v.name === activeVar, 'var-name-clickable': true }"
            @click="$emit('varClick', v)">{{ $t(v.name) }}</span>
        </div>
        <div class="vertical variable-names-subcontainer" v-if="hasUnits">
          <span v-for="v in variables" :key="v.name" class="clickable" style="text-decoration: underline;">{{ v.unit }}</span>
        </div>
      </div>
    </div>

    <!-- Data timeline and info -->
    <div class="horizontal table-and-info-container" ref="tableSlidingContainer"
      @mousedown="startDragging"
      @touchstart="startDragging">

      <!-- Load previous days -->
      <div class="button-next-prev-container">
        <button class="clickable button-next-previous-days"><span><i class="fa-solid fa-angle-up" style="padding-top: 10px;"></i>{{ $t('3 days before') }}</span></button>
      </div>

      <!-- Timeline container -->
      <div class="horizontal table-container" ref="tableContainer">
        <div class="vertical" style="align-self: flex-start">
          <slot name="grid"></slot>
        </div>
      </div>

      <!-- Load next days -->
      <div class="button-next-prev-container">
        <button class="clickable button-next-previous-days button-next-days"><span> <i class="fa-solid fa-angle-up" style="padding-top: 10px;"></i> {{ $t('3 days after') }}</span></button>
      </div>

      <!-- Info section -->
      <DTInfoSection></DTInfoSection>
    </div>
  </div>
</template>


<script>
import DTInfoSection from './DTInfoSection.vue';

export default {
  name: "DTLayout",
  emits: ['varClick'],
  props: {
    variables: Array, // [{ name, unit }]
    activeVar: String, // name of the variable to highlight in bold
  },
  mounted() {
    this.resetScroll();
  },
  // Clean up global listeners if component is destroyed
  beforeUnmount() {
    this.stopDragging();
  },
  data() {
    return {
      // Dragging variables
      isDragging: false,
      startX: 0,
      scrollLeft: 0,
      // Interval options
      intervalOptions: [
        { label: 'Daily', minutes: 1440 },
        { label: '3 hours', minutes: 180 },
        { label: 'Hourly', minutes: 60 },
        { label: '3 hours', minutes: 180 },
      ],
    }
  },
  methods: {
    //onclick: function(e){},
    cycleInterval() {
      if (this.intervalIdx == undefined){
        // Find intervalOptions index
        const minutesArray = this.intervalOptions.map(o => o.minutes);
        this.intervalIdx = minutesArray.indexOf(this.$gui.timelineEffectiveIntervalMinutes);
        this.intervalIdx++;
      }
      this.$gui.timelineIntervalMinutes = this.intervalOptions[this.intervalIdx++ % this.intervalOptions.length].minutes;
      this.resetScroll();
    },
    resetScroll() {
      // Reset scroll position so the latest time is visible
      this.$nextTick(() => {
        const infoAndTableContainer = this.$refs.tableSlidingContainer;
        const tableContainer = this.$refs.tableContainer;
        infoAndTableContainer.scrollLeft = Math.max(0, 20 + tableContainer.offsetWidth - infoAndTableContainer.offsetWidth);
      });
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
    hasUnits() {
      return this.variables.some(v => v.unit != undefined);
    },
    currentIntervalLabel() {
      const opt = this.intervalOptions.find(o => o.minutes === this.$gui.timelineEffectiveIntervalMinutes);
      return opt ? opt.label : '3 hours';
    },
    isComponentVisible() {
      return this.$gui.isDataTimelineOpen && !this.$gui.isMenuOpen;
    }
  },
  watch: {
    isComponentVisible(isVisible) {
      if (isVisible)
        this.resetScroll();
    }
  },
  components: {
    DTInfoSection
  }
}

</script>


<style scoped>
.data-timeline-container {
  min-width: 100%;
  background: var(--lightBlue);
}

.table-and-info-container {
  height: 100%;
  overflow: hidden;
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

.variable-names-container {
  width: 125px;
  font-size: x-small;
  height: 100%;
  background: var(--lightBlue);
  align-items: flex-end;
}

.interval-picker {
  height: 22px;
  width: 100%;
  justify-content: flex-end;
  align-items: center;
  padding-right: 10px;
  gap: 5px;
}

.interval-picker > span {
  color: black;
  text-shadow: none;
}

.variable-names-row {
  padding-right: 10px;
  text-align: right;
  align-self: flex-end;
}

.variable-names-subcontainer {
  align-self: flex-start;
}

.variable-names-subcontainer > span {
  color: black;
  text-shadow: none;
  height: 22px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding-left: 5px;
}

.active-var {
  font-weight: bold;
}

.var-name-clickable {
  cursor: pointer;
}
.var-name-clickable:hover {
  text-decoration: underline;
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

</style>
