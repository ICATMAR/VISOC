<template>
  <DTLayout :variables="allVariables" :active-var="hoveredStation || (selectedBar && selectedBar.stationName)" :selected-var="$gui.isPlatformDetailOpen ? $gui.selectedPlatform?.stationId : null" @var-click="stationNameClicked">
    <template #grid>
      <DTTimelineGrid v-slot="{ cells }">
        <!-- TOTALS row at top, separated from station rows by border -->
        <!-- Still waiting on the network Total's own promise to resolve -->
        <tr v-if="totals.loading">
          <td :colspan="cells.length" class="message-cell totals-bar-cell"><span class="spinner-border"></span></td>
        </tr>
        <!-- No data at all for the network Total - show a placeholder message instead of bars -->
        <tr v-else-if="totals.noData">
          <td :colspan="cells.length" class="message-cell totals-bar-cell">{{ $t('No data for TOTALS') }}</td>
        </tr>
        <tr v-else :class="{ 'row-selected': isRowSelected('TOTALS') }"
          @mouseenter="hoveredStation = 'TOTALS'" @mouseleave="hoveredStation = null">
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
        <template v-for="station in stations" :key="station.name">
          <!-- Still waiting on this station's own promise to resolve -->
          <tr v-if="station.loading">
            <td :colspan="cells.length" class="message-cell"><span class="spinner-border"></span></td>
          </tr>
          <!-- No EU HFR Node dataset for this station (e.g. SCAL) - show a placeholder message instead of bars -->
          <tr v-else-if="station.noData">
            <td :colspan="cells.length" class="message-cell">{{ $t('No data for ') + station.name }}</td>
          </tr>
          <tr v-else
            :class="{ 'row-selected': isRowSelected(station.name) }"
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
        </template>
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
    this.loadStations();
  },
  data() {
    return {
      hoveredStation: null,
      selectedBar: null,
      totals: { name: 'TOTALS', hourlyData: [], maxValue: 0 },
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
    // getNumberOfValidPointsPerNetwork() resolves to an array of per-entity
    // promises (one per station, plus one for TOTALS), not a single
    // Promise<object> - each row's bars are filled in as soon as ITS own
    // promise resolves, instead of everything waiting on the slowest one.
    async loadStations() {
      this.stations.forEach(s => { s.loading = true; });
      this.totals.loading = true;

      const promises = await this.$dataService.hfrnetwork.getNumberOfValidPointsPerNetwork(
        this.$dataService.hfrstations, this.$dataService.hfrtotals,
        this.$gui.timelineStartDate, this.$gui.timelineEndDate
      );

      const startMs = this.$gui.timelineStartDate.getTime();
      promises.forEach(promise => promise.then(({ id, points }) => {
        const entry = id === 'TOTALS' ? this.totals : this.stations.find(s => s.name === id);
        if (!entry) return;
        entry.loading = false;
        if (points == null) { entry.noData = true; return; } // e.g. SCAL - no EU HFR Node dataset

        Object.entries(points).forEach(([timeStr, count]) => {
          const hourIndex = Math.round((new Date(timeStr).getTime() - startMs) / (1000 * 3600));
          if (hourIndex < 0) return;
          entry.hourlyData[hourIndex] = count;
          if (count > entry.maxValue) entry.maxValue = count;
        });
      }));
    },
    totalsValue(cellIndex, subIndex) {
      return this.totals.hourlyData[cellIndex * this.barsPerCell + subIndex] || 0;
    },
    totalsTitle(cellIndex, subIndex) {
      const pts = this.totalsValue(cellIndex, subIndex);
      if (!pts) return this.$t('No data available');
      return `${pts} valid points`;
    },
    totalsClicked(cellIndex, subIndex, cellDate) {
      const date = new Date(cellDate.getTime() + subIndex * 3600 * 1000);
      this.$gui.selectedPlatform = {
        stationId: 'TOTALS',
        value: this.totalsValue(cellIndex, subIndex),
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
    isRowSelected(stationName) {
      return this.$gui.isPlatformDetailOpen
        && this.$gui.selectedPlatform?.stationId === stationName;
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
      // Double-click fix: same entity, map click cleared the date → restore from selectedBar
      if (newId && newId === oldId && !newP.date && oldP?.date) {
        const entry = newId === 'TOTALS' ? this.totals : this.stations.find(st => st.name === newId);
        if (entry) {
          const value = this.getHourlyValue(entry, this.selectedBar.cellIndex, this.selectedBar.subIndex);
          this.$gui.selectedPlatform = { stationId: newId, value, date: oldP.date };
        }
        return;
      }
      if (!newId || !oldId || newId === oldId) return;
      const newEntry = newId === 'TOTALS' ? this.totals : this.stations.find(s => s.name === newId);
      if (!newEntry) return;
      const oldDate = oldP?.date;
      if (!oldDate) return;
      const elapsedHours = (oldDate.getTime() - this.$gui.timelineStartDate.getTime()) / (1000 * 3600);
      const absHour = Math.floor(elapsedHours);
      const subIndex = absHour % this.barsPerCell;
      const cellIndex = Math.floor(absHour / this.barsPerCell);
      const value = this.getHourlyValue(newEntry, cellIndex, subIndex);
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
  height: 22px;
  /* Style B: thin separator between station rows */
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.bars-group {
  display: flex;
  flex-direction: row;
  height: 100%;
  width: 100%;
}

.dt-col {
  flex: 1;
  min-width: 0.5px;
  height: 100%;
  position: relative;
  display: flex;
  align-items: flex-end;
}

/* Style B (stations): minimal — bars on transparent background */
.bar-inner {
  width: 90%;
  margin-left: 5%;
  background: var(--blue);
  border-radius: 2px 2px 0 0;
  transition: height 0.3s ease-out;
}

/* Style A (TOTALS): faint background reveals the empty space → progress-bar feel */
.bar-totals {
  background: rgba(var(--lightBlueRGB), 0.2);
}

.bar-totals .bar-inner {
  background: var(--lightBlue);
}

.totals-bar-cell {
  border-bottom: 2px solid var(--blue);
}

.message-cell {
  padding: 0;
  height: 22px;
  text-align: center;
  font-size: x-small;
  color: rgba(0, 0, 0, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
</style>
