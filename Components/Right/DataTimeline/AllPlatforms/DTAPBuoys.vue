<template>
  <DTLayout :variables="buoys" :active-var="hoveredBuoy || (selectedBar && selectedBar.buoyName)" @var-click="buoyNameClicked">
    <template #grid>
      <DTTimelineGrid v-slot="{ cells }">
        <tr v-for="buoy in buoys" :key="buoy.name"
          @mouseenter="hoveredBuoy = buoy.name"
          @mouseleave="hoveredBuoy = null">
          <td v-for="(cell, cellIndex) in cells" :key="cellIndex" class="bar-cell">
            <div class="bars-group">
              <div v-for="sub in barsPerCell" :key="sub"
                class="sub-cell clickable"
                :class="{
                  'no-data': !hasData(buoy, cellIndex, sub - 1),
                  'sub-cell-selected': isBarSelected(buoy.name, cellIndex, sub - 1)
                }"
                :title="cellTitle(buoy, cellIndex, sub - 1)"
                @click="buoyClicked(buoy, cellIndex, sub - 1, cell)">
                <!-- Wave height: bar grows upward from center -->
                <div class="wave-half">
                  <div class="wave-bar" :style="{ height: waveBarHeight(buoy, cellIndex, sub - 1) }"></div>
                </div>
                <!-- Wind speed: bar grows downward from center -->
                <div class="wind-half">
                  <div class="wind-bar" :style="{ height: windBarHeight(buoy, cellIndex, sub - 1) }"></div>
                </div>
                <!-- Hover / selected overlay -->
                <div class="sub-cell-overlay"></div>
              </div>
            </div>
          </td>
        </tr>
      </DTTimelineGrid>
    </template>
  </DTLayout>
</template>


<script>
import DTLayout from '../Shared/DTLayout.vue';
import DTTimelineGrid from '../Shared/DTTimelineGrid.vue';

const WAVE_MAX_M   = 2.5;
const WIND_MAX_KMH = 30 * 1.852; // 30 knots → km/h

export default {
  name: "DTAPBuoys",
  created() {
    const totalHours = Math.round(
      (this.$gui.timelineEndDate.getTime() - this.$gui.timelineStartDate.getTime()) / (1000 * 3600)
    );
    for (const b of this.$requests.buoyStations) {
      const d = this.$requests.generateBuoyHourlyData(b.id, totalHours);
      this.buoys.push({
        name: b.id,
        VHM0: d.VHM0, VMDR: d.VMDR,
        WSPD: d.WSPD, WDIR: d.WDIR,
        HCSP: d.HCSP, HCDT: d.HCDT,
        TEMP: d.TEMP, PSAL: d.PSAL,
      });
    }
  },
  data() {
    return {
      hoveredBuoy: null,
      selectedBar: null,
      buoys: [],
    }
  },
  methods: {
    hasData(buoy, cellIndex, subIndex) {
      const i = cellIndex * this.barsPerCell + subIndex;
      return buoy.VHM0[i] != null || buoy.WSPD[i] != null;
    },
    waveBarHeight(buoy, cellIndex, subIndex) {
      const v = buoy.VHM0[cellIndex * this.barsPerCell + subIndex];
      if (v == null) return '0%';
      return Math.min(v / WAVE_MAX_M, 1) * 100 + '%';
    },
    windBarHeight(buoy, cellIndex, subIndex) {
      const v = buoy.WSPD[cellIndex * this.barsPerCell + subIndex];
      if (v == null) return '0%';
      return Math.min(v / WIND_MAX_KMH, 1) * 100 + '%';
    },
    isBarSelected(buoyName, cellIndex, subIndex) {
      return this.selectedBar?.buoyName === buoyName
        && this.selectedBar?.cellIndex === cellIndex
        && this.selectedBar?.subIndex === subIndex;
    },
    cellTitle(buoy, cellIndex, subIndex) {
      const i = cellIndex * this.barsPerCell + subIndex;
      const vhm0 = buoy.VHM0[i];
      const wspd = buoy.WSPD[i];
      if (vhm0 == null && wspd == null) return this.$t('No data available');
      const parts = [];
      if (vhm0 != null) parts.push(`${this.$t('Wave height')} ${vhm0.toFixed(1)} m`);
      if (wspd != null) parts.push(`${this.$t('Wind speed')} ${wspd.toFixed(0)} km/h`);
      return parts.join(' · ');
    },
    buoyNameClicked(buoy) {
      this.$gui.selectedPlatform = { stationId: buoy.name };
      this.$gui.isPlatformDetailOpen = true;
    },
    buoyClicked(buoy, cellIndex, subIndex, cellDate) {
      const i = cellIndex * this.barsPerCell + subIndex;
      const date = new Date(cellDate.getTime() + subIndex * 3600 * 1000);
      this.$gui.selectedPlatform = {
        stationId: buoy.name,
        VHM0: buoy.VHM0[i], VMDR: buoy.VMDR[i],
        WSPD: buoy.WSPD[i], WDIR: buoy.WDIR[i],
        HCSP: buoy.HCSP[i], HCDT: buoy.HCDT[i],
        TEMP: buoy.TEMP[i], PSAL: buoy.PSAL[i],
        date,
      };
      this.selectedBar = { buoyName: buoy.name, cellIndex, subIndex };
      this.$gui.isPlatformDetailOpen = true;
    },
  },
  computed: {
    barsPerCell() {
      return Math.round(this.$gui.timelineEffectiveIntervalMinutes / 60);
    },
  },
  watch: {
    '$gui.isPlatformDetailOpen'(isOpen) {
      if (!isOpen) this.selectedBar = null;
    },
    '$gui.timelineEffectiveIntervalMinutes'() {
      this.selectedBar = null;
    },
    // Bug fix: map icon click while a cell is selected — keep same timestamp on new buoy
    '$gui.selectedPlatform'(newP, oldP) {
      if (!this.selectedBar) return;
      // Direct cell click (has date) — no cross-station sync needed
      if (newP?.date) return;
      const newId = newP?.stationId;
      const oldId = oldP?.stationId;
      // Double-click fix: same buoy, but map click cleared the date → restore from selectedBar
      if (newId && newId === oldId && !newP.date && oldP?.date) {
        const b = this.buoys.find(buoy => buoy.name === newId);
        if (b) {
          const { cellIndex, subIndex } = this.selectedBar;
          const i = cellIndex * this.barsPerCell + subIndex;
          this.$gui.selectedPlatform = {
            stationId: newId,
            VHM0: b.VHM0[i], VMDR: b.VMDR[i],
            WSPD: b.WSPD[i], WDIR: b.WDIR[i],
            HCSP: b.HCSP[i], HCDT: b.HCDT[i],
            TEMP: b.TEMP[i], PSAL: b.PSAL[i],
            date: oldP.date,
          };
        }
        return;
      }
      if (!newId || !oldId || newId === oldId) return;
      const newBuoy = this.buoys.find(b => b.name === newId);
      if (!newBuoy) return; // different platform type
      const oldDate = oldP?.date;
      if (!oldDate) return;
      const elapsedHours = (oldDate.getTime() - this.$gui.timelineStartDate.getTime()) / (1000 * 3600);
      const absHour = Math.floor(elapsedHours);
      const subIndex = absHour % this.barsPerCell;
      const cellIndex = Math.floor(absHour / this.barsPerCell);
      const i = cellIndex * this.barsPerCell + subIndex;
      this.$gui.selectedPlatform = {
        stationId: newId,
        VHM0: newBuoy.VHM0[i], VMDR: newBuoy.VMDR[i],
        WSPD: newBuoy.WSPD[i], WDIR: newBuoy.WDIR[i],
        HCSP: newBuoy.HCSP[i], HCDT: newBuoy.HCDT[i],
        TEMP: newBuoy.TEMP[i], PSAL: newBuoy.PSAL[i],
        date: oldDate,
      };
      this.selectedBar = { buoyName: newId, cellIndex, subIndex };
    },
  },
  components: {
    DTLayout,
    DTTimelineGrid,
  }
}

</script>


<style scoped>
.bar-cell {
  padding: 0;
}

.bars-group {
  display: flex;
  flex-direction: row;
  height: 22px;
  width: 100%;
}

.sub-cell {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  background: lightblue;
  min-width: 0.5px;
}

.sub-cell.no-data {
  background: lightgray;
}

.sub-cell-overlay {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}
.sub-cell:hover .sub-cell-overlay {
  background: var(--darkBlue);
  opacity: 0.6;
}
.sub-cell-selected .sub-cell-overlay {
  background: var(--red);
  opacity: 0.6;
}

.wave-half {
  flex: 1;
  display: flex;
  align-items: flex-end;
}

.wind-half {
  flex: 1;
  display: flex;
  align-items: flex-start;
}

.wave-bar {
  width: 100%;
  background: var(--blue);
}

.wind-bar {
  width: 100%;
  background: yellow;
}
</style>
