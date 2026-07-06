<template>
  <div class="dt-drifters vertical">

    <div class="drifter-main">

      <!-- LEFT: fixed names column (drifter IDs + variable labels).
           Its body scrolls vertically in sync with the data table. -->
      <div class="drifter-names">
        <!-- Controls (align with the weekday + hours header rows) -->
        <div class="names-header">
          <div class="horizontal zoom-group">
            <button class="zoom-btn clickable" :disabled="!canZoomOut" @click="zoomOut" title="Zoom out">
              <i class="fa-solid fa-magnifying-glass-minus"></i>
            </button>
            <button class="zoom-btn clickable" :disabled="!canZoomIn" @click="zoomIn" title="Zoom in">
              <i class="fa-solid fa-magnifying-glass-plus"></i>
            </button>
          </div>
          <div class="tz-row">
            <span class="tz-toggle clickable" @click="$gui.timelineUseLocalTime = !$gui.timelineUseLocalTime">{{ $gui.timelineTimezoneLabel }}</span>
          </div>
        </div>
        <!-- Scrollable names (synced with the data rows) -->
        <div class="names-body" ref="namesBody" @wheel.prevent="onNamesWheel">
          <div class="name-group" v-for="drifter in drifters" :key="drifter.id"
            @mouseenter="hoveredDrifter = drifter.id" @mouseleave="hoveredDrifter = null">
            <div class="name-id clickable"
              :class="{ 'id-hover': hoveredDrifter === drifter.id, 'id-selected': isDrifterSelected(drifter) }"
              @click="drifterNameClicked(drifter)">
              <span>{{ drifter.id }}</span>
            </div>
            <div class="name-vars">
              <div class="name-var">{{ $t('Current') }}</div>
              <div class="name-var">{{ $t('Temperature') }} <span class="temp-unit clickable"><u>°C</u></span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: horizontal scroll wrapping the data table AND the info.
           Dragging scrolls from the first date all the way to the DTInfo. -->
      <div class="drifter-hscroll" ref="scroll"
        @mousedown="startDragging" @touchstart="startDragging">
        <div class="drifter-hrow">

          <!-- Data table (vertical scroll; date header sticky on top) -->
          <div class="drifter-vscroll" ref="vbody">
            <table class="drifter-table">
              <tbody>
                <!-- Weekday header -->
                <tr class="hdr-row hdr-weekday">
                  <td v-for="day in days" :key="day.date.getTime()" :colspan="day.span" class="weekDayCell">
                    <span>{{ day.textLong }}</span>
                  </td>
                </tr>
                <!-- Hours header -->
                <tr class="hdr-row hdr-hours">
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
                  <tr class="drifter-row current-row" :ref="'row_' + drifter.id"
                    :class="{ 'row-selected': isDrifterSelected(drifter) }"
                    @mouseenter="hoveredDrifter = drifter.id" @mouseleave="hoveredDrifter = null">
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
                  <tr class="drifter-row temp-row"
                    :class="{ 'row-selected': isDrifterSelected(drifter) }"
                    @mouseenter="hoveredDrifter = drifter.id" @mouseleave="hoveredDrifter = null">
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

          <!-- Info section (at the end of the horizontal scroll) -->
          <DTInfoSection></DTInfoSection>
        </div>
      </div>
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
    // Keep the left names column vertically in sync with the data rows.
    if (this.$refs.vbody) this.$refs.vbody.addEventListener('scroll', this.syncNamesScroll, { passive: true });
    // Start scrolled to the end (most recent data).
    this.resetScroll();
    // If a drifter is already selected (opened from a map icon), scroll to it.
    const id = this.$gui.selectedPlatform?.stationId;
    if (id && this.drifters.some(d => d.id === id)) {
      this._lastScrolledId = id;
      this.scrollToDrifter(id);
    }
  },
  beforeUnmount() {
    this.stopDragging();
    if (this.$refs.vbody) this.$refs.vbody.removeEventListener('scroll', this.syncNamesScroll);
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
    // ---- vertical scroll sync (data rows → names column) ----
    syncNamesScroll() {
      const n = this.$refs.namesBody;
      const v = this.$refs.vbody;
      if (n && v) n.scrollTop = v.scrollTop;
    },
    onNamesWheel(e) {
      const v = this.$refs.vbody;
      if (v) v.scrollTop += e.deltaY; // triggers vbody scroll → syncNamesScroll
    },
    // ---- horizontal drag scroll ----
    // Uses only pageX deltas (no per-move offsetLeft reads → no layout thrash)
    // and applies scrollLeft once per animation frame (batched) for smoothness.
    startDragging(e) {
      // Don't hijack clicks on interactive info controls / links
      if (e.target.closest('a, button, input')) return;
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
    // Horizontally scroll so the most recent date sits at the right edge of the
    // view (the info panel is just beyond it, reached by scrolling further).
    resetScroll() {
      this.$nextTick(() => {
        const scroll = this.$refs.scroll;
        const table = this.$refs.vbody;
        if (!scroll || !table) return;
        scroll.scrollLeft = Math.max(0, table.offsetWidth - scroll.clientWidth);
      });
    },
    // Vertically scroll the selected drifter's two rows into the middle of the view.
    scrollToDrifter(id) {
      this.$nextTick(() => {
        const v = this.$refs.vbody;
        const rowRef = this.$refs['row_' + id];
        const row = Array.isArray(rowRef) ? rowRef[0] : rowRef;
        if (!v || !row) return;
        const rowRect = row.getBoundingClientRect();
        const vRect = v.getBoundingClientRect();
        const centerWithinView = (rowRect.top - vRect.top) + 22; // centre of the 44px group
        const target = v.scrollTop + centerWithinView - v.clientHeight / 2;
        v.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      });
    },
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
  /* Explicit bounded width (like the other timelines) so the wide content
     overflows the horizontal scroll area instead of expanding the pane. */
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
  height: 15px;
  border-radius: 10px;
  box-shadow: 0 0 2px black;
  background: linear-gradient(to right, white, cyan, green, yellow, red);
}

.drifter-main {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
}

/* ---- Left names column (fixed) ---- */
.drifter-names {
  width: 125px;
  min-width: 125px;
  flex-shrink: 0;
  background: var(--lightBlue);
  display: flex;
  flex-direction: column;
}
.names-header {
  height: 44px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}
.zoom-group {
  height: 22px;
  justify-content: flex-end;
  align-items: center;
  padding-right: 8px;
  gap: 2px;
}
.tz-row {
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
}
.tz-toggle {
  font-size: x-small;
  color: white;
  text-decoration: underline;
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

.names-body {
  max-height: 236px;   /* = vscroll max-height (280) − header (44) */
  overflow: hidden;    /* scroll is driven by the data table (synced) */
  scroll-behavior: auto;
}
.name-group {
  height: 44px;
  display: flex;
  flex-direction: row;
  align-items: stretch;
}
.name-id {
  width: 42px;
  min-width: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: x-small;
  border-top: 1px solid rgba(255, 255, 255, 0.4);
}
.name-id span { color: black; text-shadow: none; }
.name-id.id-hover span { text-decoration: underline; }
.name-id.id-selected span { font-weight: bold; }

.name-vars {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.name-var {
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  text-align: right;
  /* xx-small + 0.7 look via text alpha */
  font-size: xx-small;
  color: rgba(0, 0, 0, 0.7);
}
.temp-unit { cursor: pointer; color: inherit; text-shadow: none; }

/* ---- Horizontal scroll (data table + info) ---- */
.drifter-hscroll {
  flex: 1;
  min-width: 0;              /* allow shrinking so content overflows and scrolls */
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: auto;     /* instant drag scroll */
  cursor: grab;
  user-select: none;
}
.drifter-hscroll:active { cursor: grabbing; }

.drifter-hrow {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: max-content;
}

/* ---- Data table (vertical scroll) ---- */
.drifter-vscroll {
  max-height: 280px;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: auto;   /* instant → names column stays locked in sync */
  background: rgba(255, 255, 255, 0.9);
  flex-shrink: 0;
}

.drifter-table {
  border-collapse: separate;
  border-spacing: 0;
  width: max-content;
}
.drifter-table td {
  width: 30px;
  height: 22px;
  text-align: center;
  box-sizing: border-box;
  padding: 0;
}

/* Header (sticky top) — white background / black text like other timelines */
.hdr-row td {
  position: sticky;
  background: white;
}
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
