<template>
  <div class="dt-drifters vertical">

    <!-- All scrolling is captured here and applied to every pane via transforms -->
    <div class="drifter-main"
      @wheel="onWheel"
      @mousedown="onMouseDown"
      @touchstart="onTouchStart"
      @dragstart.prevent>

      <!-- LEFT: fixed names column (drifter IDs + variable labels) -->
      <div class="drifter-names">
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
        <div class="names-viewport">
          <div class="names-inner" ref="namesInner">
            <div class="name-group" v-for="drifter in drifters" :key="drifter.id"
              @mouseenter="hoveredDrifter = drifter.id" @mouseleave="hoveredDrifter = null">
              <div class="name-id"
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
      </div>

      <!-- RIGHT: viewport that clips; its inner row (data table + info) is translated in X -->
      <div class="drifter-right" ref="rightViewport">
        <div class="right-inner" ref="rightInner">

          <div class="data-col" ref="dataCol">
            <!-- Date header (fixed vertically, moves with X) -->
            <table class="drifter-table header-table">
              <tbody>
                <tr class="hdr-row hdr-weekday">
                  <td v-for="day in days" :key="day.date.getTime()" :colspan="day.span" class="weekDayCell">
                    <span>{{ day.textLong }}</span>
                  </td>
                </tr>
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
              </tbody>
            </table>

            <!-- Data rows (clipped viewport; inner translated in Y) -->
            <div class="data-viewport" ref="dataViewport">
              <div class="data-inner" ref="dataInner">
                <table class="drifter-table">
                  <tbody>
                    <template v-for="drifter in drifters" :key="drifter.id">
                      <tr class="drifter-row current-row" :ref="'row_' + drifter.id"
                        :class="{ 'row-selected': isDrifterSelected(drifter) }"
                        @mouseenter="hoveredDrifter = drifter.id" @mouseleave="hoveredDrifter = null">
                        <td v-for="(cell, cellIndex) in cells" :key="cellIndex" class="data-cell current-cell">
                          <div class="color-strip">
                            <div v-for="(seg, si) in segments(drifter, cellIndex)" :key="si"
                              class="color-seg" :style="{ background: seg }"></div>
                          </div>
                          <div v-for="(a, ai) in anchors(drifter, cellIndex)" :key="ai"
                            class="anchor-hit"
                            :class="{ 'point-selected': isPointSelected(drifter, a.hourIndex) }"
                            :style="{ left: (a.leftPct - 50 / anchorsPerCell) + '%', width: (100 / anchorsPerCell) + '%' }"
                            @click="pointClicked(drifter, a.hourIndex)">
                            <i v-if="a.HCDT != null" class="fa fa-location-arrow current-arrow"
                              :style="{ transform: `translate(-50%,-50%) rotate(${a.HCDT - 45}deg)` }"></i>
                          </div>
                        </td>
                      </tr>
                      <tr class="drifter-row temp-row"
                        :class="{ 'row-selected': isDrifterSelected(drifter) }"
                        @mouseenter="hoveredDrifter = drifter.id" @mouseleave="hoveredDrifter = null">
                        <td v-for="(cell, cellIndex) in cells" :key="cellIndex" class="data-cell temp-cell">
                          <div v-for="(a, ai) in anchors(drifter, cellIndex)" :key="ai"
                            class="anchor-hit"
                            :class="{ 'point-selected': isPointSelected(drifter, a.hourIndex) }"
                            :style="{ left: (a.leftPct - 50 / anchorsPerCell) + '%', width: (100 / anchorsPerCell) + '%' }"
                            @click="pointClicked(drifter, a.hourIndex)">
                            <span v-if="a.TEMP != null" class="temp-text">{{ a.TEMP.toFixed(1) }}</span>
                          </div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Info section (end of the horizontal scroll) -->
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

const DRAG_THRESHOLD = 4; // px before a mousedown becomes a pan (vs a click)

export default {
  name: "DTAPDrifters",
  created() {
    // Virtual scroll offsets (not reactive — applied directly via transforms).
    this._sx = 0;
    this._sy = 0;
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
    window.addEventListener('resize', this.onResize);
    this.resetScroll();
    const id = this.$gui.selectedPlatform?.stationId;
    if (id && this.drifters.some(d => d.id === id)) {
      this._lastScrolledId = id;
      this.scrollToDrifter(id);
    }
  },
  beforeUnmount() {
    this.endPan();
    this.stopAutoScroll();
    window.removeEventListener('resize', this.onResize);
  },
  data() {
    return {
      drifters: [],
      totalHours: 0,
      hoveredDrifter: null,
      selectedPoint: null, // { id, hourIndex }
      intervalOptions: [
        { label: 'Daily',   minutes: 1440 },
        { label: '3 hours', minutes: 180  },
        { label: 'Hourly',  minutes: 60   },
      ],
    }
  },
  methods: {
    // ================= scroll engine =================
    applyScroll() {
      const ri = this.$refs.rightInner, di = this.$refs.dataInner, ni = this.$refs.namesInner;
      if (ri) ri.style.transform = `translateX(${-this._sx}px)`;
      if (di) di.style.transform = `translateY(${-this._sy}px)`;
      if (ni) ni.style.transform = `translateY(${-this._sy}px)`;
    },
    maxScrollX() {
      const rv = this.$refs.rightViewport, ri = this.$refs.rightInner;
      return rv && ri ? Math.max(0, ri.offsetWidth - rv.clientWidth) : 0;
    },
    maxScrollY() {
      const dv = this.$refs.dataViewport, di = this.$refs.dataInner;
      return dv && di ? Math.max(0, di.offsetHeight - dv.clientHeight) : 0;
    },
    clampScroll() {
      this._sx = Math.min(Math.max(this._sx, 0), this.maxScrollX());
      this._sy = Math.min(Math.max(this._sy, 0), this.maxScrollY());
    },
    scrollBy(dx, dy) {
      this._sx += dx;
      this._sy += dy;
      this.clampScroll();
      this.applyScroll();
    },
    onResize() {
      this.clampScroll();
      this.applyScroll();
    },

    // ================= wheel =================
    onWheel(e) {
      // Let the info panel handle its own vertical scroll natively.
      if (e.target.closest('.info-section')) return;
      const unit = e.deltaMode === 1 ? 16
        : e.deltaMode === 2 ? (this.$refs.dataViewport?.clientHeight || 200)
        : 1;
      let dx = e.deltaX * unit;
      let dy = e.deltaY * unit;
      if (e.shiftKey && dx === 0) { dx = dy; dy = 0; } // shift+wheel → horizontal
      this.scrollBy(dx, dy);
      e.preventDefault();
    },

    // ================= left-drag pan =================
    onMouseDown(e) {
      if (e.button === 1) { this.startAutoScroll(e); return; }
      if (e.button !== 0) return;
      if (e.target.closest('a, button, input')) return; // keep links/buttons clickable
      this._panStartX = e.pageX;
      this._panStartY = e.pageY;
      this._panFromX = this._sx;
      this._panFromY = this._sy;
      this._panMoved = false;
      window.addEventListener('mousemove', this.onPanMove);
      window.addEventListener('mouseup', this.onPanUp);
    },
    onPanMove(e) {
      const dx = e.pageX - this._panStartX;
      const dy = e.pageY - this._panStartY;
      if (!this._panMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      this._panMoved = true;
      this._sx = this._panFromX - dx;
      this._sy = this._panFromY - dy;
      this.clampScroll();
      this.applyScroll();
      if (e.cancelable) e.preventDefault();
    },
    onPanUp() {
      this.endPan();
      if (this._panMoved) this.suppressNextClick();
      this._panMoved = false;
    },
    endPan() {
      window.removeEventListener('mousemove', this.onPanMove);
      window.removeEventListener('mouseup', this.onPanUp);
    },
    // Cancel the click that a browser fires after a drag (so cells aren't selected).
    suppressNextClick() {
      const suppress = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        window.removeEventListener('click', suppress, true);
      };
      window.addEventListener('click', suppress, true);
      setTimeout(() => window.removeEventListener('click', suppress, true), 0);
    },

    // ================= middle-click autoscroll =================
    startAutoScroll(e) {
      e.preventDefault();
      this._autoAnchorX = e.clientX;
      this._autoAnchorY = e.clientY;
      this._autoCurX = e.clientX;
      this._autoCurY = e.clientY;
      this._autoActive = true;
      window.addEventListener('mousemove', this.onAutoMove);
      window.addEventListener('mouseup', this.stopAutoScroll);
      const loop = () => {
        if (!this._autoActive) return;
        const vx = (this._autoCurX - this._autoAnchorX) * 0.12;
        const vy = (this._autoCurY - this._autoAnchorY) * 0.12;
        if (vx || vy) this.scrollBy(vx, vy);
        this._autoRaf = requestAnimationFrame(loop);
      };
      this._autoRaf = requestAnimationFrame(loop);
    },
    onAutoMove(e) {
      this._autoCurX = e.clientX;
      this._autoCurY = e.clientY;
    },
    stopAutoScroll() {
      if (!this._autoActive) return;
      this._autoActive = false;
      if (this._autoRaf) cancelAnimationFrame(this._autoRaf);
      window.removeEventListener('mousemove', this.onAutoMove);
      window.removeEventListener('mouseup', this.stopAutoScroll);
    },

    // ================= touch pan =================
    onTouchStart(e) {
      const t = e.touches[0];
      this._panStartX = t.pageX;
      this._panStartY = t.pageY;
      this._panFromX = this._sx;
      this._panFromY = this._sy;
      this._panMoved = false;
      window.addEventListener('touchmove', this.onTouchMove, { passive: false });
      window.addEventListener('touchend', this.onTouchEnd);
    },
    onTouchMove(e) {
      const t = e.touches[0];
      const dx = t.pageX - this._panStartX;
      const dy = t.pageY - this._panStartY;
      if (!this._panMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      this._panMoved = true;
      this._sx = this._panFromX - dx;
      this._sy = this._panFromY - dy;
      this.clampScroll();
      this.applyScroll();
      if (e.cancelable) e.preventDefault();
    },
    onTouchEnd() {
      window.removeEventListener('touchmove', this.onTouchMove);
      window.removeEventListener('touchend', this.onTouchEnd);
      this._panMoved = false;
    },

    // ================= programmatic scroll =================
    // Show the most recent date at the right edge (info sits just beyond it).
    resetScroll() {
      this.$nextTick(() => {
        const dc = this.$refs.dataCol, rv = this.$refs.rightViewport;
        if (!dc || !rv) return;
        this._sx = Math.max(0, dc.offsetWidth - rv.clientWidth);
        this.clampScroll();
        this.applyScroll();
      });
    },
    scrollToDrifter(id) {
      this.$nextTick(() => {
        const di = this.$refs.dataInner, dv = this.$refs.dataViewport;
        const rowRef = this.$refs['row_' + id];
        const row = Array.isArray(rowRef) ? rowRef[0] : rowRef;
        if (!di || !dv || !row) return;
        const rowTop = row.getBoundingClientRect().top - di.getBoundingClientRect().top;
        this._sy = rowTop + 22 - dv.clientHeight / 2; // centre the 44px group
        this.clampScroll();
        this.applyScroll();
      });
    },

    // ================= data / colour =================
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
    segments(drifter, cellIndex) {
      const n = this.barsPerCell;
      const out = [];
      for (let s = 0; s < n; s++) {
        const i = cellIndex * n + s;
        out.push(this.colorForSpeed(i < this.totalHours ? drifter.HCSP[i] : null));
      }
      return out;
    },
    anchors(drifter, cellIndex) {
      const n = this.barsPerCell;
      const count = this.anchorsPerCell;
      const out = [];
      for (let k = 0; k < count; k++) {
        const frac = (k + 0.5) / count;
        const hourOffset = Math.floor(frac * n);
        const i = cellIndex * n + hourOffset;
        if (i >= this.totalHours) continue;
        out.push({ leftPct: frac * 100, HCDT: drifter.HCDT[i], TEMP: drifter.TEMP[i], HCSP: drifter.HCSP[i], hourIndex: i });
      }
      return out;
    },
    // ================= selection =================
    drifterNameClicked(drifter) {
      this.selectedPoint = null;
      this.$gui.selectedPlatform = { stationId: drifter.id };
      this.$gui.isPlatformDetailOpen = true;
    },
    pointClicked(drifter, hourIndex) {
      const i = hourIndex;
      const date = new Date(this.$gui.timelineStartDate.getTime() + i * 3600 * 1000);
      this.$gui.selectedPlatform = {
        stationId: drifter.id,
        date,
        lat: drifter.lat[i], lon: drifter.lon[i],
        HCSP: drifter.HCSP[i], HCDT: drifter.HCDT[i], TEMP: drifter.TEMP[i],
      };
      this.selectedPoint = { id: drifter.id, hourIndex: i };
      this.$gui.isPlatformDetailOpen = true;
    },
    isPointSelected(drifter, hourIndex) {
      return this.selectedPoint?.id === drifter.id && this.selectedPoint?.hourIndex === hourIndex;
    },
    isDrifterSelected(drifter) {
      return this.$gui.isPlatformDetailOpen && this.$gui.selectedPlatform?.stationId === drifter.id;
    },
    // ================= zoom =================
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
      if (!isOpen) this.selectedPoint = null;
    },
    '$gui.timelineEffectiveIntervalMinutes'() {
      this.selectedPoint = null;
      this.resetScroll(); // cell count changed → keep the latest data in view
    },
    isComponentVisible(isVisible) {
      if (isVisible) this.resetScroll();
    },
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
  width: 100vw;
  max-width: 100vw;
}

/* ---- Legend ---- */
.drifter-legend {
  height: 22px;
  gap: 6px;
  padding: 0 12px;
  font-size: 0.7rem;
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
  overflow: hidden;
  cursor: grab;
  user-select: none;
  touch-action: none;   /* we handle touch panning ourselves */
}
.drifter-main:active { cursor: grabbing; }

/* ---- Left names column ---- */
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
.zoom-group { height: 22px; justify-content: flex-end; align-items: center; padding-right: 8px; gap: 2px; }
.tz-row { height: 22px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; }
.tz-toggle { font-size: 0.7rem; color: white; text-decoration: underline; text-align: right; }
.zoom-btn {
  background: none; border: none; padding: 2px 3px; font-size: small;
  color: white; text-shadow: 0 0 4px black; line-height: 1; border-radius: 4px;
}
.zoom-btn:disabled { color: rgba(255, 255, 255, 0.8); text-shadow: none; cursor: default; }
.zoom-btn:not(:disabled):hover { background: rgba(0, 0, 0, 0.1); }

.names-viewport {
  height: 236px;   /* = data-viewport height */
  overflow: hidden;
}
.name-group { height: 44px; display: flex; flex-direction: row; align-items: stretch; }
.name-id {
  width: 42px; min-width: 42px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 0.7rem;
  border-top: 1px solid rgba(255, 255, 255, 0.4);
}
.name-id span { color: black; text-shadow: none; }
.name-id.id-hover span { text-decoration: underline; }
.name-id.id-selected span { font-weight: bold; }
.name-vars { flex: 1; display: flex; flex-direction: column; }
.name-var {
  height: 22px; display: flex; align-items: center; justify-content: flex-end;
  padding-right: 8px; text-align: right;
  font-size: x0.7rem; color: rgba(0, 0, 0, 0.7);
}
.temp-unit { cursor: pointer; color: inherit; text-shadow: none; }

/* ---- Right viewport (data table + info) ---- */
.drifter-right {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  position: relative;
}
.right-inner {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: max-content;
  will-change: transform;
}

.data-col {
  width: max-content;
  background: rgba(255, 255, 255, 0.9);
}
.data-viewport {
  height: 236px;
  overflow: hidden;
}
.data-inner { will-change: transform; }

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

/* Date header */
.hdr-row td { background: white; }
/* Weekday label is absolutely positioned so its text never widens the column —
   this keeps the header table's columns a strict 30px, aligned with the data
   table (critical in daily view where a day is a single cell). */
.weekDayCell {
  position: relative;
  border-left: 1px solid gray;
  border-bottom: 1px solid gray;
}
.weekDayCell span {
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
  white-space: nowrap;
  color: black;
  text-shadow: none;
}
.hourCell {
  font-size: 0.7rem;
  border-bottom: 1px solid #0000002e;
  position: relative;
  overflow: visible;
}
.hourCell span {
  color: black; text-shadow: none;
  position: absolute; left: 0; top: 50%;
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

.color-strip { position: absolute; inset: 0; display: flex; flex-direction: row; }
.color-seg { flex: 1; height: 100%; }

.anchor-hit { position: absolute; top: 0; height: 100%; cursor: pointer; }
.anchor-hit:hover { box-shadow: inset 0 0 0 9999px rgba(var(--darkBlueRGB), 0.15); }
.anchor-hit.point-selected { box-shadow: inset 0 0 0 9999px rgba(var(--redRGB), 0.4); }

.current-arrow {
  position: absolute; top: 50%; left: 50%;
  font-size: 11px; color: rgba(0, 0, 0, 0.75);
  pointer-events: none;
}
.temp-text {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.7rem; color: black; text-shadow: none;
  white-space: nowrap; pointer-events: none;
}

.drifter-row.row-selected .data-cell {
  box-shadow: inset 0 0 0 9999px rgba(var(--redRGB), 0.15);
}
</style>
