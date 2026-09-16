<template>
  <!-- Data and timeline section -->
  <div class="horizontal data-timeline-container">
    <!-- Variables -->
    <div class="vertical variable-names-container">
      <!-- Interval zoom buttons -->
      <div class="horizontal interval-picker">
        <button class="zoom-btn clickable" :disabled="!canZoomOut" @click="zoomOut" title="Zoom out">
          <i class="fa-solid fa-magnifying-glass-minus"></i>
        </button>
        <button class="zoom-btn clickable" :disabled="!canZoomIn" @click="zoomIn" title="Zoom in">
          <i class="fa-solid fa-magnifying-glass-plus"></i>
        </button>
      </div>
      <!-- Timezone toggle -->
      <div class="horizontal interval-picker">
        <span class="clickable" style="text-decoration: underline;" @click="$gui.timelineUseLocalTime = !$gui.timelineUseLocalTime">{{ $gui.timelineTimezoneLabel }}</span>
      </div>
      <!-- Variable names and units -->
      <div class="horizontal variable-names-row">
        <div class="vertical variable-names-subcontainer">
          <span v-for="v in variables" :key="v.name"
            :class="{ 'active-var': v.name === activeVar || v.name === selectedVar, 'var-name-clickable': true }"
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
        <div class="vertical timeline-inner">
          <slot name="grid"></slot>
          <!-- Where "now" falls on the timeline. Lives here rather than in
               each view so every timeline gets it from one place, and sits
               inside the scrolling container so it travels with the columns
               it marks. Non-interactive, and hidden when now is outside the
               range the timeline is showing. -->
          <div v-if="isNowInRange" class="now-line" :style="{ left: nowLineLeft + 'px' }"></div>
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

// Fallback width of one timeline column, in px - the real one is measured off
// a rendered cell (see measureCell), this only covers the moment before the
// grid exists. Keep it in step with .dt-table td in DTTimelineGrid.vue.
const CELL_WIDTH_PX = 38;

// How often the now-line is moved. Deliberately not requestAnimationFrame:
// at the finest zoom a column is an hour wide, so the line travels about
// 0.6 px per MINUTE - repainting 60 times a second would burn battery to
// animate something that cannot be seen to move. Half a minute is already
// sub-pixel.
const NOW_TICK_MS = 30000;

export default {
  name: "DTLayout",
  emits: ['varClick'],
  props: {
    variables: Array, // [{ name, unit }]
    activeVar: String,   // name of the variable to highlight in bold (hover)
    selectedVar: String, // name of the selected station — kept bold while selected
    // Time steps the zoom buttons step through, coarse → fine. A view whose
    // cells mean something different can pass its own: the buoys timeline
    // averages into its cells, so it offers 12h/3h/1h rather than a daily
    // step that would flatten a whole day into one number.
    intervalOptions: {
      type: Array,
      default: () => ([
        { label: 'Daily',   minutes: 1440 },
        { label: '3 hours', minutes: 180  },
        { label: 'Hourly',  minutes: 60   },
      ]),
    },
  },
  mounted() {
    this.resetScroll();
    this.measureCell();
    this.nowTimer = setInterval(() => { this.now = Date.now(); }, NOW_TICK_MS);
  },
  // Clean up global listeners if component is destroyed
  beforeUnmount() {
    this.stopDragging();
    clearInterval(this.nowTimer);
  },
  data() {
    return {
      // Dragging variables
      isDragging: false,
      startX: 0,
      scrollLeft: 0,
      // Now-line
      now: Date.now(),
      cellWidth: CELL_WIDTH_PX,
    }
  },
  methods: {
    // Takes the column width from a cell the grid actually rendered, rather
    // than trusting a constant here to stay in step with a stylesheet in
    // another file.
    //
    // Specifically an .hourCell: that row has exactly one cell per column,
    // whereas the day row above it spans a whole day per cell (colspan) and
    // the data rows below can span the lot (a loading or no-data message).
    // Measuring any of those would scale the line by however many columns
    // that cell happened to cover.
    measureCell() {
      this.$nextTick(() => {
        const cell = this.$refs.tableContainer?.querySelector('.dt-table td.hourCell');
        if (cell?.offsetWidth) this.cellWidth = cell.offsetWidth;
      });
    },
    currentIntervalIdx() {
      const idx = this.intervalOptions.findIndex(o => o.minutes === this.$gui.timelineEffectiveIntervalMinutes);
      return idx >= 0 ? idx : 0;
    },
    zoomIn() {
      const idx = this.currentIntervalIdx();
      if (idx < this.intervalOptions.length - 1) {
        this.$gui.timelineIntervalMinutes = this.intervalOptions[idx + 1].minutes;
        this.resetScroll();
      }
    },
    zoomOut() {
      const idx = this.currentIntervalIdx();
      if (idx > 0) {
        this.$gui.timelineIntervalMinutes = this.intervalOptions[idx - 1].minutes;
        this.resetScroll();
      }
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
    isNowInRange() {
      return this.now >= this.$gui.timelineStartDate.getTime()
        && this.now <= this.$gui.timelineEndDate.getTime();
    },
    // How far along the grid "now" falls, in px. Counted in COLUMNS rather
    // than as a fraction of the range: the grid lays out one column per step
    // from the start, so its last column can run past the end date when the
    // range isn't a whole number of steps - a percentage of the total width
    // would then sit up to a column off.
    nowLineLeft() {
      const elapsedMs = this.now - this.$gui.timelineStartDate.getTime();
      const stepMs = this.$gui.timelineEffectiveIntervalMinutes * 60 * 1000;
      return (elapsedMs / stepMs) * this.cellWidth;
    },
    hasUnits() {
      return this.variables.some(v => v.unit != undefined);
    },
    currentIntervalLabel() {
      const opt = this.intervalOptions.find(o => o.minutes === this.$gui.timelineEffectiveIntervalMinutes);
      return opt ? opt.label : '3 hours';
    },
    canZoomIn() {
      return this.intervalOptions.findIndex(o => o.minutes === this.$gui.timelineEffectiveIntervalMinutes) < this.intervalOptions.length - 1;
    },
    canZoomOut() {
      return this.intervalOptions.findIndex(o => o.minutes === this.$gui.timelineEffectiveIntervalMinutes) > 0;
    },
    isComponentVisible() {
      return this.$gui.isDataTimelineOpen && !this.$gui.isMenuOpen;
    }
  },
  watch: {
    isComponentVisible(isVisible) {
      if (isVisible) {
        this.resetScroll();
        this.measureCell(); // nothing has a width while the pane is hidden
      }
    },
    // The grid relays out on a zoom, so the column width is worth taking again
    '$gui.timelineEffectiveIntervalMinutes'() {
      this.measureCell();
    },
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

.timeline-inner {
  align-self: flex-start;
  position: relative; /* what the now-line is positioned against */
}

/* Above the ordinary cells, below the drifters' sticky row labels (which go
   up to 6) - the line should pass behind a label that is pinned to the left
   edge rather than cut across it. */
.now-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--red);
  pointer-events: none;
  z-index: 3;
  opacity: 0.6;
}

.table-container {
  height: 100%;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.85);
}

.variable-names-container {
  width: 125px;
  font-size: 0.7rem;
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
}

.zoom-btn {
  background: none;
  border: none;
  padding: 2px 3px;
  font-size: small;
  color: white;
  text-shadow: 0 0 4px black;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  line-height: 1;
}

.zoom-btn:disabled {
  color: rgba(255, 255, 255, 0.8);
  text-shadow: none;
  cursor: default;
  transform: none;
}

.zoom-btn:not(:disabled):hover {
  background: rgba(0, 0, 0, 0.1);
}

.variable-names-row {
  padding-right: 10px;
  text-align: right;
  align-self: flex-end;
}

.variable-names-subcontainer {
  align-self: flex-start;
  padding-top: 3px;
}

.variable-names-subcontainer > span {
  color: black;
  text-shadow: none;
  height: 23px;
  display: flow-root;
  align-items: flex-end;
  align-content: center;
  padding-left: 5px;
  max-width: 110px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
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
  font-size: 0.7rem;
  text-transform: uppercase;
  border-radius: 10px 0px 0px 10px;
  padding-inline: 10px;
}

.button-next-days {
  rotate: 180deg;
}

</style>
