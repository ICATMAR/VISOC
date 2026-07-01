<template>
  <DTLayout :variables="allVariables" :active-var="hoveredStation || (selectedBar && selectedBar.stationName)" @var-click="stationNameClicked">
    <template #grid>
      <DTTimelineGrid v-slot="{ cells }">
        <!-- TOTALS row at top, separated from station rows by border -->
        <tr @mouseenter="hoveredStation = 'TOTALS'" @mouseleave="hoveredStation = null">
          <td v-for="(cell, cellIndex) in cells" :key="cellIndex" class="bar-cell totals-bar-cell">
            <div class="bars-group">
              <div v-for="sub in barsPerCell" :key="sub"
                class="dt-col bar-totals clickable"
                :class="{ 'dt-col-selected': isBarSelected('TOTALS', cellIndex, sub - 1) }"
                :title="totalsTitle(cellIndex, sub - 1)"
                @click="totalsClicked(cellIndex, sub - 1, cell)">
                <div class="bar-inner" :style="{ height: (totalsValue(cellIndex, sub - 1) / (totals.maxValue || 1) * 100) + '%' }"></div>
                <div class="dt-col-overlay"></div>
              </div>
            </div>
          </td>
        </tr>
        <!-- Individual station availability bars -->
        <tr v-for="station in stations" :key="station.name"
          @mouseenter="hoveredStation = station.name"
          @mouseleave="hoveredStation = null">
          <td v-for="(cell, cellIndex) in cells" :key="cellIndex" class="bar-cell">
            <div class="bars-group">
              <div v-for="sub in barsPerCell" :key="sub"
                class="dt-col clickable"
                :class="{ 'dt-col-selected': isBarSelected(station.name, cellIndex, sub - 1) }"
                :title="getHourlyValue(station, cellIndex, sub - 1) + ' valid points'"
                @click="stationClicked(station, cellIndex, sub - 1, cell)">
                <div class="bar-inner" :style="{ height: (getHourlyValue(station, cellIndex, sub - 1) / station.maxValue * 100) + '%' }"></div>
                <div class="dt-col-overlay"></div>
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

export default {
  name: "DTAPHFR",
  created() {
    const totalHours = Math.round(
      (this.$gui.timelineEndDate.getTime() - this.$gui.timelineStartDate.getTime()) / (1000 * 3600)
    );
    for (const station of this.stations) {
      for (let i = 0; i < totalHours; i++) {
        station.hourlyData[i] = 500 + Math.round(Math.random() * 500);
        if (station.hourlyData[i] > station.maxValue)
          station.maxValue = station.hourlyData[i];
      }
    }
    // Independent mockup data for the TOTALS network product
    for (let i = 0; i < totalHours; i++) {
      const ok = Math.random() > 0.08;
      const validPts = ok ? 300 + Math.round(Math.random() * 500) : 0;
      const activeStations = ok ? 4 + Math.round(Math.random() * 4) : Math.round(Math.random() * 2);
      this.totals.hourlyData.push(validPts);
      this.totals.activeStations.push(activeStations);
      if (validPts > this.totals.maxValue) this.totals.maxValue = validPts;
    }
  },
  data() {
    return {
      hoveredStation: null,
      selectedBar: null,
      totals: { name: 'TOTALS', hourlyData: [], activeStations: [], maxValue: 0 },
      stations: [
        { name: 'CNET', hourlyData: [], maxValue: 0 },
        { name: 'CREU', hourlyData: [], maxValue: 0 },
        { name: 'BEGU', hourlyData: [], maxValue: 0 },
        { name: 'TOSS', hourlyData: [], maxValue: 0 },
        { name: 'AREN', hourlyData: [], maxValue: 0 },
        { name: 'PBCN', hourlyData: [], maxValue: 0 },
        { name: 'GNST', hourlyData: [], maxValue: 0 },
        { name: 'SCAL', hourlyData: [], maxValue: 0 },
      ],
    }
  },
  methods: {
    totalsValue(cellIndex, subIndex) {
      return this.totals.hourlyData[cellIndex * this.barsPerCell + subIndex] || 0;
    },
    totalsActiveStations(cellIndex, subIndex) {
      return this.totals.activeStations[cellIndex * this.barsPerCell + subIndex] ?? 0;
    },
    totalsTitle(cellIndex, subIndex) {
      const pts = this.totalsValue(cellIndex, subIndex);
      const active = this.totalsActiveStations(cellIndex, subIndex);
      if (!pts) return this.$t('No data available');
      return `${pts} valid points · ${active} active stations`;
    },
    totalsClicked(cellIndex, subIndex, cellDate) {
      const date = new Date(cellDate.getTime() + subIndex * 3600 * 1000);
      this.$gui.selectedPlatform = {
        stationId: 'TOTALS',
        value: this.totalsValue(cellIndex, subIndex),
        activeStations: this.totalsActiveStations(cellIndex, subIndex),
        date,
      };
      this.selectedBar = { stationName: 'TOTALS', cellIndex, subIndex };
      this.$gui.isPlatformDetailOpen = true;
    },
    stationClicked(station, cellIndex, subIndex, cellDate) {
      const date = new Date(cellDate.getTime() + subIndex * 3600 * 1000);
      this.$gui.selectedPlatform = {
        stationId: station.name,
        value: this.getHourlyValue(station, cellIndex, subIndex),
        date,
      };
      this.selectedBar = { stationName: station.name, cellIndex, subIndex };
      this.$gui.isPlatformDetailOpen = true;
    },
    isBarSelected(stationName, cellIndex, subIndex) {
      return this.selectedBar?.stationName === stationName
        && this.selectedBar?.cellIndex === cellIndex
        && this.selectedBar?.subIndex === subIndex;
    },
    getHourlyValue(station, cellIndex, subIndex) {
      return station.hourlyData[cellIndex * this.barsPerCell + subIndex] || 0;
    },
    stationNameClicked(v) {
      this.$gui.selectedPlatform = { stationId: v.name };
      this.$gui.isPlatformDetailOpen = true;
    },
  },
  computed: {
    barsPerCell() {
      return Math.round(this.$gui.timelineEffectiveIntervalMinutes / 60);
    },
    allVariables() {
      return [this.totals, ...this.stations];
    },
  },
  watch: {
    '$gui.isPlatformDetailOpen'(isOpen) {
      if (!isOpen) this.selectedBar = null;
    },
    '$gui.timelineEffectiveIntervalMinutes'() {
      this.selectedBar = null;
    },
    '$gui.selectedPlatform'(newP, oldP) {
      if (!this.selectedBar) return;
      if (newP?.date) return;
      const newId = newP?.stationId;
      const oldId = oldP?.stationId;
      // Never cross-sync when TOTALS is involved
      if (newId === 'TOTALS' || oldId === 'TOTALS') return;
      // Double-click fix: same station, map click cleared the date → restore from selectedBar
      if (newId && newId === oldId && !newP.date && oldP?.date) {
        const s = this.stations.find(st => st.name === newId);
        if (s) {
          const value = this.getHourlyValue(s, this.selectedBar.cellIndex, this.selectedBar.subIndex);
          this.$gui.selectedPlatform = { stationId: newId, value, date: oldP.date };
        }
        return;
      }
      if (!newId || !oldId || newId === oldId) return;
      const newStation = this.stations.find(s => s.name === newId);
      if (!newStation) return;
      const oldDate = oldP?.date;
      if (!oldDate) return;
      const elapsedHours = (oldDate.getTime() - this.$gui.timelineStartDate.getTime()) / (1000 * 3600);
      const absHour = Math.floor(elapsedHours);
      const subIndex = absHour % this.barsPerCell;
      const cellIndex = Math.floor(absHour / this.barsPerCell);
      const value = this.getHourlyValue(newStation, cellIndex, subIndex);
      this.$gui.selectedPlatform = { stationId: newId, value, date: oldDate };
      this.selectedBar = { stationName: newId, cellIndex, subIndex };
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
  vertical-align: bottom;
}

.bars-group {
  display: flex;
  flex-direction: row;
  height: 100%;
  width: 100%;
}

/* dt-col fills the full cell height; bar-inner grows from the bottom */
.dt-col {
  flex: 1;
  min-width: 0.5px;
  height: 100%;
  position: relative;
  display: flex;
  align-items: flex-end;
}

.bar-inner {
  width: 100%;
  background: var(--blue);
}

.bar-totals .bar-inner {
  background: var(--darkBlue);
}

.totals-bar-cell {
  border-bottom: 2px solid var(--blue);
}
</style>
