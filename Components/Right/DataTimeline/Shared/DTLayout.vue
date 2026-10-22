<template>
  <!-- Data and timeline section: [names] [timeline, scrolls both ways] [info, fixed] -->
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
      <!-- Variable names and units. Clipped rather than scrolled: its
           scrollTop follows the timeline's (see onTableScroll), so the names
           stay level with their rows. A wheel over the names scrolls the
           timeline, which brings the names along. -->
      <div class="horizontal variable-names-row" ref="namesScroller" @wheel="onNamesWheel">
        <!-- Also what the per-row spinners are positioned against: these
             names line up with the grid's rows, so measuring them is how the
             overlay knows where each row sits (see measureRows). -->
        <div class="vertical variable-names-subcontainer" ref="namesColumn">
          <span v-for="v in variables" :key="v.name"
            :class="{ 'active-var': v.name === activeVar || v.name === selectedVar, 'var-name-clickable': true }"
            :title="v.title"
            @click="$emit('varClick', v)"><span v-if="v.loading" class="spinner-border name-spinner"></span>{{ $t(v.name) }}</span>
        </div>
        <div class="vertical variable-names-subcontainer" v-if="hasUnits">
          <!-- A row that names its variable (`code`) switches that quantity's
               unit app-wide on a click (GUIManager.cycleUnit), and is
               underlined only where there is another unit to go to -->
          <!-- A row can take the click itself instead (`onUnitClick`: the
               Station view cycles a row's statistic there) -->
          <span v-for="v in variables" :key="v.name" class="clickable unit-cell"
            :class="{ 'unit-switchable': v.onUnitClick || !v.code || $gui.isUnitSwitchable(v.code) }"
            :title="v.unitTitle ?? (v.code && $gui.isUnitSwitchable(v.code) ? $t('Click to change units') : '')"
            @click.stop="v.onUnitClick ? v.onUnitClick() : (v.code && $gui.cycleUnit(v.code))">{{ v.unit }}</span>
        </div>
      </div>
    </div>

    <!-- Data timeline. Scrolls horizontally by dragging and vertically by the
         wheel, a drag or its scrollbar; the day and hour rows stick to the
         top (see DTTimelineGrid). -->
    <div class="horizontal table-scroll-container" ref="tableSlidingContainer"
      @mousedown="startDragging"
      @touchstart="startDragging"
      @scroll="onTableScroll">

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
    </div>

    <!-- Info section: outside the scroller, so it stays put while the
         timeline moves under the user's hand -->
    <DTInfoSection class="dt-info-fixed"></DTInfoSection>

    <!-- One spinner per row still waiting on its data, each sitting on its own
         row and centred on the visible timeline.
         Deliberately a sibling of the scrolling container rather than a child
         of it: anything inside the scroller is laid out against the CONTENT,
         so it slides away as the timeline is scrolled - at the hourly zoom the
         grid is thousands of pixels wide. Rows are re-measured on a vertical
         scroll instead, and the ones scrolled out of view are left out. -->
    <div class="timeline-loading">
      <span v-for="row in loadingRows" :key="row.name"
        class="spinner-border row-spinner" :style="{ top: row.top + 'px' }"></span>
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
    variables: Array, // [{ name, unit, code }] - `code` makes the unit switchable
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
    this.measureRows();
    // Rows shift when the pane is resized, and nothing else tells us
    this.onResize = () => { this.measureCell(); this.measureRows(); };
    window.addEventListener('resize', this.onResize);
    this.nowTimer = setInterval(() => { this.now = Date.now(); }, NOW_TICK_MS);
  },
  // Clean up global listeners if component is destroyed
  beforeUnmount() {
    this.stopDragging();
    window.removeEventListener('resize', this.onResize);
    clearInterval(this.nowTimer);
  },
  data() {
    return {
      // Dragging variables
      isDragging: false,
      startX: 0,
      startY: 0,
      scrollLeft: 0,
      scrollTop: 0,
      // Now-line
      now: Date.now(),
      cellWidth: CELL_WIDTH_PX,
      rowTops: [], // middle of each row, in px - see measureRows
      visibleRowBand: [0, Infinity], // [top, bottom] rows can be seen in, same frame
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
    // The vertical middle of each row, relative to this component's own box -
    // taken from the names column, whose entries line up one-for-one with the
    // grid's rows. Measured rather than worked out from row heights and header
    // heights, which are spread across two stylesheets and would go stale the
    // moment either changed.
    measureRows() {
      this.$nextTick(() => {
        const names = this.$refs.namesColumn;
        const scroller = this.$refs.namesScroller;
        if (!names || !scroller || !this.$el?.getBoundingClientRect) return;
        const top = this.$el.getBoundingClientRect().top;
        // The band rows are visible in - anything scrolled above or below it
        // gets no spinner
        const band = scroller.getBoundingClientRect();
        this.visibleRowBand = [band.top - top, band.bottom - top];
        this.rowTops = [...names.children].map(row => {
          const box = row.getBoundingClientRect();
          return box.top - top + box.height / 2;
        });
      });
    },
    // The names column has no scroll of its own: it mirrors the timeline's
    onTableScroll() {
      const scroller = this.$refs.tableSlidingContainer;
      const names = this.$refs.namesScroller;
      if (!scroller || !names) return;
      if (names.scrollTop !== scroller.scrollTop) {
        names.scrollTop = scroller.scrollTop;
        this.measureRows();
      }
    },
    onNamesWheel(e) {
      const scroller = this.$refs.tableSlidingContainer;
      if (!scroller || scroller.scrollHeight <= scroller.clientHeight) return;
      scroller.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      e.preventDefault();
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
      // On the HFR dashboard, the selected hour in the middle; elsewhere the
      // latest time in view
      if (this.centersOnSelected) { this.scrollToSelected(false); return; }
      this.$nextTick(() => {
        const scroller = this.$refs.tableSlidingContainer;
        if (scroller) scroller.scrollLeft = scroller.scrollWidth;
      });
    },
    // The selected time's column in the middle of the view. With
    // `onlyIfHidden`, only when it is off screen (or at its very edge) - a
    // click on a cell in view doesn't move the timeline under the mouse.
    scrollToSelected(onlyIfHidden) {
      this.$nextTick(() => {
        const scroller = this.$refs.tableSlidingContainer;
        const table = this.$refs.tableContainer;
        if (!scroller || !table || !scroller.clientWidth) return;
        const cell = table.querySelector('.dt-table td.hourCell');
        const cellWidth = cell?.offsetWidth || this.cellWidth;
        const stepMs = this.$gui.timelineEffectiveIntervalMinutes * 60 * 1000;
        // The column ending at the selected hour (see the views' cells)
        const elapsed = new Date(this.$gui.selectedTime).getTime() - this.$gui.timelineStartDate.getTime();
        // Where the grid starts within the scrolled content (past the
        // "days before" button), whatever element positions it
        const gridLeft = table.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
        const x = gridLeft + (elapsed / stepMs) * cellWidth - cellWidth / 2;
        if (onlyIfHidden) {
          const margin = cellWidth * 2;
          if (x >= scroller.scrollLeft + margin && x <= scroller.scrollLeft + scroller.clientWidth - margin) return;
        }
        scroller.scrollLeft = Math.max(0, x - scroller.clientWidth / 2);
      });
    },

    // DRAGGING THE TIMELINE
    startDragging(e) {
      this.isDragging = true;

      // Get the initial position (support both Mouse and Touch)
      const pageX = e.type === 'touchstart' ? e.touches[0].pageX : e.pageX;
      const pageY = e.type === 'touchstart' ? e.touches[0].pageY : e.pageY;

      const container = this.$refs.tableSlidingContainer;
      this.startX = pageX - container.offsetLeft;
      this.startY = pageY;
      this.scrollLeft = container.scrollLeft;
      this.scrollTop = container.scrollTop;

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
      const pageY = e.type === 'touchmove' ? e.touches[0].pageY : e.pageY;
      const container = this.$refs.tableSlidingContainer;

      const x = pageX - container.offsetLeft;
      // Multiplier makes the scroll speed feel more responsive
      const walk = (x - this.startX) * 1.5;
      container.scrollLeft = this.scrollLeft - walk;
      // Vertically one to one: rows are short, and the pane rarely holds more
      // than a screenful of them
      container.scrollTop = this.scrollTop - (pageY - this.startY);
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
    // Rows still waiting, each with the y it should be drawn at. Read off the
    // rows themselves (`loading`), so a view only has to say it once - HFR's
    // stations and totals already carry that flag, and DTAPBuoys sets its own.
    // A row whose position hasn't been measured yet is skipped rather than
    // drawn at the top of the table.
    loadingRows() {
      return (this.variables ?? [])
        .map((variable, index) => ({ name: variable.name, loading: variable.loading, top: this.rowTops[index] }))
        .filter(row => row.loading && row.top != undefined
          && row.top >= this.visibleRowBand[0] && row.top <= this.visibleRowBand[1]);
    },
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
    },
    // The HFR dashboard's views open on the selected hour, and keep it in view
    centersOnSelected() {
      return this.$gui.selectedDashboard === 'hfr';
    }
  },
  watch: {
    isComponentVisible(isVisible) {
      if (isVisible) {
        this.resetScroll();
        // Nothing has a size while the pane is hidden, so both measurements
        // have to be taken again once it is back
        this.measureCell();
        this.measureRows();
      }
    },
    // The grid relays out on a zoom, so the column width is worth taking again
    '$gui.timelineEffectiveIntervalMinutes'() {
      this.measureCell();
    },
    // A selected time out of view (the time handle, a click on the map at
    // another hour) is brought to the middle
    '$gui.selectedTime'() {
      if (this.centersOnSelected) this.scrollToSelected(true);
    },
    // Rows appearing or disappearing move everything below them
    variables() {
      this.measureRows();
    },
  },
  components: {
    DTInfoSection
  }
}

</script>


<style scoped>
/* --dt-max-height caps the timeline (header rows included); taller content
   scrolls inside it. --dt-info-width is the fixed info column. */
.data-timeline-container {
  --dt-max-height: min(400px, 45vh);
  --dt-info-width: min(620px, 45vw);
  width: 100vw;
  background: var(--lightBlue);
  position: relative; /* what .timeline-loading is centred against */
  align-items: stretch;
}

/* Centred on the visible timeline, above everything (the now-line is 3, the
   sticky header 4, the drifters' sticky labels go to 6). Transparent to the
   mouse so the timeline underneath can still be dragged while it loads. */
.timeline-loading {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 125px;
  right: var(--dt-info-width);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 8;
}

/* One per waiting row: `top` is set inline from the measured row middle, and
   translate(-50%,-50%) is what actually centres it on that point. On a disc so
   it reads against both the pale table and the blue names column behind it. */
.row-spinner {
  position: absolute;
  width: 10px;
  height: 10px;
  margin-top: -5px;
  border-width: 3px;
  color: black;
  border-radius: 50%;
}

/* Horizontal overflow is hidden (it is scrolled by dragging), vertical shows
   a thin scrollbar so it is clear there are more rows. */
.table-scroll-container {
  flex: 1 1 auto;
  min-width: 0;
  max-height: var(--dt-max-height);
  overflow-x: hidden;
  overflow-y: auto;
  align-items: flex-start;
  cursor: grab;
  user-select: none;
  scroll-behavior: auto;
  scrollbar-width: thin;
}
.table-scroll-container:active {
  cursor: grabbing;
}

/* Sized to sit inside a 23px name row without pushing it taller */
.name-spinner {
  width: 9px;
  height: 9px;
  border-width: 2px;
  margin-right: 4px;
  color: black;
  vertical-align: middle;
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
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.85);
}

.variable-names-container {
  width: 125px;
  flex-shrink: 0;
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

/* 44px: the two header rows above (interval picker and timezone) */
/* Never wider than the column: the names give way (with an ellipsis, see
   below) so the units beside them always fit. Without the width cap the row
   overflowed to the LEFT - right-aligned - and the clipping cut off the start
   of a long name instead of its end. */
.variable-names-row {
  padding-right: 10px;
  text-align: right;
  align-self: flex-end;
  max-height: calc(var(--dt-max-height) - 44px);
  overflow: hidden;
  max-width: 100%;
  box-sizing: border-box;
}

.variable-names-subcontainer {
  align-self: flex-start;
  padding-top: 3px;
  flex-shrink: 0;
}

/* The names column shrinks, the units one doesn't */
.variable-names-subcontainer:first-child {
  flex-shrink: 1;
  min-width: 0;
}

.variable-names-subcontainer > span {
  color: black;
  text-shadow: none;
  height: 23px;
  display: flow-root;
  align-items: flex-end;
  align-content: center;
  padding-left: 5px;
  max-width: min(110px, 100%);
  box-sizing: border-box;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}


.unit-cell {
  font-style: italic;
}
.unit-switchable {
  text-decoration: underline;
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

/* Full height of the visible timeline, and kept there while the rows scroll */
.button-next-prev-container {
  align-self: stretch;
  position: sticky;
  top: 0;
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
