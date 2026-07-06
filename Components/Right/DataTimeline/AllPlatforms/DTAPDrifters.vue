<template>
  <div class="dt-drifters vertical">

    <div class="drifter-main">

      <!-- Scrollable timeline: horizontal (days) + vertical (drifters).
           Header row and the two left columns are position:sticky. -->
      <div class="drifter-scroll" ref="scroll"
        @mousedown="startDragging" @touchstart="startDragging">
        <table class="drifter-table">
          <tbody>

            <!-- Weekday header -->
            <tr class="hdr-row hdr-weekday">
              <td class="corner corner-controls" colspan="2">
                <div class="horizontal zoom-group">
                  <button class="zoom-btn clickable" :disabled="!canZoomOut" @click="zoomOut" title="Zoom out">
                    <i class="fa-solid fa-magnifying-glass-minus"></i>
                  </button>
                  <button class="zoom-btn clickable" :disabled="!canZoomIn" @click="zoomIn" title="Zoom in">
                    <i class="fa-solid fa-magnifying-glass-plus"></i>
                  </button>
                </div>
              </td>
              <td v-for="day in days" :key="day.date.getTime()" :colspan="day.span" class="weekDayCell">
                <span>{{ day.textLong }}</span>
              </td>
            </tr>

            <!-- Hours header -->
            <tr class="hdr-row hdr-hours">
              <td class="corner corner-tz" colspan="2">
                <span class="tz-toggle clickable" @click="$gui.timelineUseLocalTime = !$gui.timelineUseLocalTime">{{ $gui.timelineTimezoneLabel }}</span>
              </td>
              <td v-for="(cell, index) in cells" :key="index" class="hourCell">
                <template v-if="$gui.timelineEffectiveIntervalMinutes < 1440">
                  <span :style="{ opacity: ($gui.timelineHours(cell) < 6 || $gui.timelineHours(cell) >= 21) ? '0.4' : '1' }">{{ $gui.timelineHours(cell) }}</span>
                </template>
                <template v-else>
                  <span>0</span>
                  <span class="hourCell-noon">12</span>
                </template>
              </td>
            </tr>

            <!-- Two rows per drifter: current (coloured) + temperature -->
            <template v-for="drifter in drifters" :key="drifter.id">
              <!-- Current row -->
              <tr class="drifter-row current-row" :ref="'row_' + drifter.id" :class="{ 'row-selected': isDrifterSelected(drifter) }"
                @mouseenter="hoveredDrifter = drifter.id" @mouseleave="hoveredDrifter = null">
                <td class="drifter-id-cell" rowspan="2"
                  :class="{ 'id-active': hoveredDrifter === drifter.id || isDrifterSelected(drifter) }"
                  @click="drifterNameClicked(drifter)">
                  <span>{{ drifter.id }}</span>
                </td>
                <td class="var-label-cell">{{ $t('Current') }}</td>
                <td v-for="(cell, cellIndex) in cells" :key="cellIndex"
                  class="data-cell current-cell clickable"
                  :class="{ 'cell-selected': isCellSelected(drifter, cellIndex) }"
                  @click="cellClicked(drifter, cellIndex)">
                  <div class="color-strip">
                    <div v-for="(seg, si) in segments(drifter, cellIndex)" :key="si"
                      class="color-seg" :style="{ background: seg }"></div>
                  </div>
                  <template v-for="(a, ai) in anchors(drifter, cellIndex)" :key="ai">
                    <i v-if="a.HCDT != null" class="fa fa-location-arrow current-arrow"
                      :style="{ left: a.leftPct + '%', transform: `translate(-50%,-50%) rotate(${a.HCDT - 45}deg)` }"></i>
                  </template>
                </td>
              </tr>
              <!-- Temperature row (transparent background) -->
              <tr class="drifter-row temp-row" :class="{ 'row-selected': isDrifterSelected(drifter) }"
                @mouseenter="hoveredDrifter = drifter.id" @mouseleave="hoveredDrifter = null">
                <td class="var-label-cell temp-label">{{ $t('Temperature') }} <span class="temp-unit clickable"><u>°C</u></span></td>
                <td v-for="(cell, cellIndex) in cells" :key="cellIndex"
                  class="data-cell temp-cell clickable"
                  :class="{ 'cell-selected': isCellSelected(drifter, cellIndex) }"
                  @click="cellClicked(drifter, cellIndex)">
                  <template v-for="(a, ai) in anchors(drifter, cellIndex)" :key="ai">
                    <span v-if="a.TEMP != null" class="temp-text" :style="{ left: a.leftPct + '%' }">{{ a.TEMP.toFixed(1) }}</span>
                  </template>
                </td>
              </tr>
            </template>

          </tbody>
        </table>
      </div>

      <!-- Info section (fixed on the right) -->
      <DTInfoSection></DTInfoSection>
    </div>

    <!-- Current-speed colour legend (bottom) -->
    <div class="drifter-legend horizontal">
      <span class="legend-title">{{ $t('Current speed') }}</span>
      <span class="legend-num">0</span>
      <div class="legend-gradient"></div>
      <span class="legend-num">1 m/s</span>
    </div>
  </div>
</template>


<script>
import DTInfoSection from '../Shared/DTInfoSection.vue';

// Current-speed colour scale (m/s, 0..1): white → cyan → green → yellow → red.
const COLOR_STOPS = [
  [0.00, [255, 255, 255]],
  [0.25, [0, 255, 255]],
  [0.50, [0, 180, 0]],
  [0.75, [255, 255, 0]],
  [1.00, [255, 0, 0]],
];

export default {
  name: "DTAPDrifters",
  created() {
    const totalHours = Math.round(
      (this.$gui.timelineEndDate.getTime() - this.$gui.timelineStartDate.getTime()) / (1000 * 3600)
    );
    this.totalHours = totalHours;
    for (const d of this.$requests.drifterStations) {
      const h = this.$requests.getDrifterHourly(d.id, this.$gui.timelineStartDate, totalHours);
      this.drifters.push({
        id: d.id, type: d.type,
        HCSP: h.HCSP, HCDT: h.HCDT, TEMP: h.TEMP, lat: h.lat, lon: h.lon,
      });
    }
  },
  mounted() {
    // Start scrolled to the end (most recent data).
    this.resetScroll();
    // If a drifter is already selected (opened from a map icon), scroll to it.
    const id = this.$gui.selectedPlatform?.stationId;
    if (id && this.drifters.some(d => d.id === id)) {
      this._lastScrolledId = id;
      this.scrollToDrifter(id);
    }
  },
  data() {
    return {
      drifters: [],
      totalHours: 0,
      hoveredDrifter: null,
      selectedCell: null, // { id, cellIndex }
      isDragging: false,
      intervalOptions: [
        { label: 'Daily',   minutes: 1440 },
        { label: '3 hours', minutes: 180  },
        { label: 'Hourly',  minutes: 60   },
      ],
    }
  },
  methods: {
    // ---- colour ----
    colorForSpeed(v) {
      if (v == null) return '#d9d9d9';
      const t = Math.min(Math.max(v, 0), 1);
      for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
        const [t0, c0] = COLOR_STOPS[i];
        const [t1, c1] = COLOR_STOPS[i + 1];
        if (t <= t1) {
          const f = (t - t0) / (t1 - t0 || 1);
          const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
          const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
          const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
          return `rgb(${r}, ${g}, ${b})`;
        }
      }
      return 'rgb(255, 0, 0)';
    },
    // ---- per-cell rendering ----
    // Hourly colour segments filling one timeline cell.
    segments(drifter, cellIndex) {
      const n = this.barsPerCell;
      const out = [];
      for (let s = 0; s < n; s++) {
        const i = cellIndex * n + s;
        out.push(this.colorForSpeed(i < this.totalHours ? drifter.HCSP[i] : null));
      }
      return out;
    },
    // Arrow / temperature anchors within one cell (1 per cell, or every 12 h when daily).
    anchors(drifter, cellIndex) {
      const n = this.barsPerCell;
      const count = this.anchorsPerCell;
      const out = [];
      for (let k = 0; k < count; k++) {
        const frac = (k + 0.5) / count;
        const hourOffset = Math.floor(frac * n);
        const i = cellIndex * n + hourOffset;
        if (i >= this.totalHours) continue;
        out.push({
          leftPct: frac * 100,
          HCDT: drifter.HCDT[i],
          TEMP: drifter.TEMP[i],
          HCSP: drifter.HCSP[i],
          hourIndex: i,
        });
      }
      return out;
    },
    // ---- selection ----
    // Clicking a drifter ID opens its platform detail (whole trajectory, no data point).
    drifterNameClicked(drifter) {
      this.selectedCell = null;
      this.$gui.selectedPlatform = { stationId: drifter.id };
      this.$gui.isPlatformDetailOpen = true;
    },
    cellClicked(drifter, cellIndex) {
      const a = this.anchors(drifter, cellIndex)[0];
      const i = a ? a.hourIndex : cellIndex * this.barsPerCell;
      const date = new Date(this.$gui.timelineStartDate.getTime() + i * 3600 * 1000);
      this.$gui.selectedPlatform = {
        stationId: drifter.id,
        date,
        lat: drifter.lat[i], lon: drifter.lon[i],
        HCSP: drifter.HCSP[i], HCDT: drifter.HCDT[i], TEMP: drifter.TEMP[i],
      };
      this.selectedCell = { id: drifter.id, cellIndex };
      this.$gui.isPlatformDetailOpen = true;
    },
    isCellSelected(drifter, cellIndex) {
      return this.selectedCell?.id === drifter.id && this.selectedCell?.cellIndex === cellIndex;
    },
    isDrifterSelected(drifter) {
      return this.$gui.isPlatformDetailOpen && this.$gui.selectedPlatform?.stationId === drifter.id;
    },
    // ---- zoom ----
    currentIntervalIdx() {
      const idx = this.intervalOptions.findIndex(o => o.minutes === this.$gui.timelineEffectiveIntervalMinutes);
      return idx >= 0 ? idx : 0;
    },
    zoomIn() {
      const idx = this.currentIntervalIdx();
      if (idx < this.intervalOptions.length - 1) this.$gui.timelineIntervalMinutes = this.intervalOptions[idx + 1].minutes;
    },
    zoomOut() {
      const idx = this.currentIntervalIdx();
      if (idx > 0) this.$gui.timelineIntervalMinutes = this.intervalOptions[idx - 1].minutes;
    },
    // ---- horizontal drag scroll ----
    // Uses only pageX deltas (no per-move offsetLeft reads → no layout thrash)
    // and applies scrollLeft once per animation frame (batched) so a heavy
    // sticky table scrolls smoothly instead of jittering.
    startDragging(e) {
      // Ignore drags starting on the sticky controls
      if (e.target.closest('.corner')) return;
      this.isDragging = true;
      this._dragStartPageX = e.type === 'touchstart' ? e.touches[0].pageX : e.pageX;
      this._dragStartScrollLeft = this.$refs.scroll.scrollLeft;
      this._dragTargetScrollLeft = this._dragStartScrollLeft;
      window.addEventListener('mousemove', this.onDragging);
      window.addEventListener('touchmove', this.onDragging, { passive: false });
      window.addEventListener('mouseup', this.stopDragging);
      window.addEventListener('touchend', this.stopDragging);
    },
    onDragging(e) {
      if (!this.isDragging) return;
      if (e.cancelable) e.preventDefault();
      const pageX = e.type === 'touchmove' ? e.touches[0].pageX : e.pageX;
      this._dragTargetScrollLeft = this._dragStartScrollLeft - (pageX - this._dragStartPageX) * 1.5;
      if (this._dragRaf == null) {
        this._dragRaf = requestAnimationFrame(() => {
          this._dragRaf = null;
          const s = this.$refs.scroll;
          if (s) s.scrollLeft = this._dragTargetScrollLeft;
        });
      }
    },
    stopDragging() {
      this.isDragging = false;
      if (this._dragRaf != null) {
        cancelAnimationFrame(this._dragRaf);
        this._dragRaf = null;
      }
      window.removeEventListener('mousemove', this.onDragging);
      window.removeEventListener('touchmove', this.onDragging);
      window.removeEventListener('mouseup', this.stopDragging);
      window.removeEventListener('touchend', this.stopDragging);
    },
    // Horizontally scroll to the end so the most recent data is visible.
    resetScroll() {
      this.$nextTick(() => {
        const scroll = this.$refs.scroll;
        if (scroll) scroll.scrollLeft = scroll.scrollWidth;
      });
    },
    // Vertically scroll the selected drifter's two rows into the middle of the view.
    scrollToDrifter(id) {
      this.$nextTick(() => {
        const scroll = this.$refs.scroll;
        const rowRef = this.$refs['row_' + id];
        const row = Array.isArray(rowRef) ? rowRef[0] : rowRef;
        if (!scroll || !row) return;
        const groupHeight = 44; // current + temperature rows
        const rowRect = row.getBoundingClientRect();
        const scrollRect = scroll.getBoundingClientRect();
        const centerWithinView = (rowRect.top - scrollRect.top) + groupHeight / 2;
        const target = scroll.scrollTop + centerWithinView - scroll.clientHeight / 2;
        scroll.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      });
    },
  },
  beforeUnmount() {
    this.stopDragging();
  },
  computed: {
    barsPerCell() {
      return Math.round(this.$gui.timelineEffectiveIntervalMinutes / 60);
    },
    anchorsPerCell() {
      return this.$gui.timelineEffectiveIntervalMinutes >= 1440 ? 2 : 1;
    },
    cells() {
      const startTime = this.$gui.timelineStartDate.getTime();
      const endTime = this.$gui.timelineEndDate.getTime();
      const stepMs = this.$gui.timelineEffectiveIntervalMinutes * 60 * 1000;
      const cells = [];
      for (let t = startTime; t < endTime; t += stepMs) cells.push(new Date(t));
      return cells;
    },
    days() {
      const days = [];
      for (const cell of this.cells) {
        const last = days[days.length - 1];
        if (last && this.$gui.timelineDate(last.date) === this.$gui.timelineDate(cell)) last.span++;
        else days.push({ date: cell, span: 1, textLong: this.$gui.timelineFormatDay(cell, this.$i18n.locale) });
      }
      return days;
    },
    canZoomIn() {
      return this.currentIntervalIdx() < this.intervalOptions.length - 1;
    },
    canZoomOut() {
      return this.currentIntervalIdx() > 0;
    },
    isComponentVisible() {
      return this.$gui.isDataTimelineOpen && !this.$gui.isMenuOpen;
    },
  },
  watch: {
    '$gui.isPlatformDetailOpen'(isOpen) {
      if (!isOpen) this.selectedCell = null;
    },
    '$gui.timelineEffectiveIntervalMinutes'() {
      this.selectedCell = null;
      this.resetScroll(); // cell count changed → keep the latest data in view
    },
    isComponentVisible(isVisible) {
      if (isVisible) this.resetScroll(); // reopening the pane → scroll to most recent
    },
    // When a drifter is selected (e.g. from a map icon), scroll it into view.
    '$gui.selectedPlatform'(newP) {
      const id = newP?.stationId;
      if (!id || id === this._lastScrolledId) return;
      if (!this.drifters.some(d => d.id === id)) return;
      this._lastScrolledId = id;
      this.scrollToDrifter(id);
    },
  },
  components: {
    DTInfoSection,
  }
}
</script>


<style scoped>
.dt-drifters {
  background: var(--lightBlue);
  /* Explicit bounded width (like the other timelines' calc(100vw - 125px))
     so the wide table overflows the scroll area instead of expanding the pane. */
  width: 100vw;
  max-width: 100vw;
}

/* ---- Legend ---- */
.drifter-legend {
  height: 22px;
  gap: 6px;
  padding: 0 12px;
  font-size: x-small;
  background: var(--blue);
}
.legend-title { color: white; text-shadow: none; margin-right: 4px; }
.legend-num { color: white; text-shadow: none; }
.legend-gradient {
  width: 120px;
  height: 10px;
  border-radius: 10px;
  box-shadow: 0 0 2px black;
  background: linear-gradient(to right, white, cyan, green, yellow, red);
}

.drifter-main {
  display: flex;
  flex-direction: row;
  align-items: stretch;
}

/* ---- Scroll area (both axes) ---- */
.drifter-scroll {
  flex: 1;
  min-width: 0; /* allow shrinking below content so the wide table scrolls inside */
  max-height: 280px;
  overflow: auto;
  scroll-behavior: auto; /* instant drag scroll (override any global smooth) */
  background: rgba(255, 255, 255, 0.9);
  cursor: grab;
  user-select: none;
}
.drifter-scroll:active { cursor: grabbing; }

.drifter-table {
  border-collapse: separate;
  border-spacing: 0;
  /* Take natural width (auto layout) so the table overflows the scroll
     container horizontally instead of being squeezed to fit. */
  width: max-content;
}
/* Every timeline cell is a fixed 30px (like the other timelines); the
   hourly colour segments pack inside each cell. */
.drifter-table td {
  width: 30px;
  height: 22px;
  text-align: center;
  box-sizing: border-box;
  padding: 0;
}

/* ---- Header (sticky top) — white background / black text like other timelines ---- */
.hdr-row td {
  position: sticky;
  background: white;
}
/* Keep the sticky corner (zoom + timezone) above the day/hour cells, which
   would otherwise win on specificity (.hdr-weekday td) and paint over it. */
.hdr-row td.corner { background: var(--lightBlue); z-index: 6; }
.hdr-weekday td { top: 0; z-index: 3; }
.hdr-hours td { top: 22px; z-index: 3; }

.weekDayCell {
  text-align: left;
  padding-left: 15px !important;
  border-left: 1px solid gray;
  border-bottom: 1px solid gray;
  white-space: nowrap;
}
.weekDayCell span { color: black; text-shadow: none; }

.hourCell {
  font-size: x-small;
  border-bottom: 1px solid #0000002e;
  position: relative;
  overflow: visible;
}
.hourCell span {
  color: black;
  text-shadow: none;
  position: absolute;
  left: 0;
  top: 50%;
  transform: translate(-50%, -50%);
  white-space: nowrap;
}
.hourCell-noon { left: 50% !important; }

/* ---- Left sticky columns ---- */
.drifter-id-cell,
.var-label-cell {
  position: sticky;
  z-index: 2;
  background: var(--lightBlue);
  font-size: x-small;
  color: black;
}
.drifter-table td.drifter-id-cell {
  left: 0;
  width: 42px;
  min-width: 42px;
  font-weight: bold;
  border-top: 1px solid rgba(255, 255, 255, 0.4);
  cursor: pointer;
}
.drifter-id-cell span { color: black; text-shadow: none; }
.drifter-id-cell.id-active span { color: var(--darkBlue); font-weight: bold; }

.drifter-table td.var-label-cell {
  left: 42px;
  width: 83px;
  min-width: 83px;
  text-align: right;
  padding-right: 8px !important;
  color: black;
}
.temp-unit { 
  cursor: pointer;
  color: black;
  text-shadow: none;
}

/* Sticky corner (controls) — above both header and left columns */
.corner {
  position: sticky;
  left: 0;
  z-index: 5;
  background: var(--lightBlue);
}
.corner-controls { top: 0; }
.corner-tz { top: 22px; }
.zoom-group { justify-content: flex-end; padding-right: 8px; gap: 2px; }
.tz-toggle {
  font-size: x-small;
  color: white;
  text-decoration: underline;
  padding-right: 8px;
  display: block;
  text-align: right;
}
.zoom-btn {
  background: none;
  border: none;
  padding: 2px 3px;
  font-size: small;
  color: white;
  text-shadow: 0 0 4px black;
  line-height: 1;
  border-radius: 4px;
}
.zoom-btn:disabled { color: rgba(255, 255, 255, 0.8); text-shadow: none; cursor: default; }
.zoom-btn:not(:disabled):hover { background: rgba(0, 0, 0, 0.1); }

/* ---- Data cells ---- */
.data-cell {
  position: relative;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  overflow: visible;
}
.temp-row .data-cell { border-bottom: 1px solid rgba(0, 0, 0, 0.18); }

.color-strip {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: row;
}
.color-seg { flex: 1; height: 100%; }

.current-arrow {
  position: absolute;
  top: 50%;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.75);
  pointer-events: none;
}

.temp-text {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: x-small;
  color: black;
  text-shadow: none;
  white-space: nowrap;
  pointer-events: none;
}

/* ---- Selection / hover ---- */
.data-cell.cell-selected {
  box-shadow: inset 0 0 0 9999px rgba(var(--redRGB), 0.35);
}
.drifter-row.row-selected .data-cell {
  box-shadow: inset 0 0 0 9999px rgba(var(--redRGB), 0.18);
}
.drifter-row.row-selected .data-cell.cell-selected {
  box-shadow: inset 0 0 0 9999px rgba(var(--redRGB), 0.4);
}
.data-cell:hover {
  box-shadow: inset 0 0 0 9999px rgba(var(--darkBlueRGB), 0.15);
}
</style>
