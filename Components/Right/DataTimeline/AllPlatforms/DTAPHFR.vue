<template>
  <DTLayout :variables="stations" :active-var="hoveredStation || (selectedBar && selectedBar.stationName)">
    <template #grid>
      <DTTimelineGrid v-slot="{ cells }">
        <!-- Station availability bars — barsPerCell hourly sub-bars per grid cell -->
        <tr v-for="station in stations" :key="station.name"
          @mouseenter="hoveredStation = station.name"
          @mouseleave="hoveredStation = null">
          <td v-for="(cell, cellIndex) in cells" :key="cellIndex" class="bar-cell">
            <div class="bars-group">
              <div v-for="sub in barsPerCell" :key="sub"
                class="bar clickable"
                :class="{ 'bar-selected': isBarSelected(station.name, cellIndex, sub - 1) }"
                :style="{ height: (getHourlyValue(station, cellIndex, sub - 1) / station.maxValue * 100) + '%' }"
                :title="getHourlyValue(station, cellIndex, sub - 1) + ' valid points'"
                @click="stationClicked(station, cellIndex, sub - 1, cell)">
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
    // Always generate hourly data regardless of display interval
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
  },
  data() {
    return {
      hoveredStation: null,
      selectedBar: null, // { stationName, cellIndex, subIndex }
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
    //onclick: function(e){},
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
    }
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
    // Bug fix: map icon click while a cell is selected — keep same timestamp on new station
    '$gui.selectedPlatform'(newP, oldP) {
      if (!this.selectedBar) return;
      const newId = newP?.stationId;
      const oldId = oldP?.stationId;
      // Double-click fix: same station, but map click cleared the date → restore from selectedBar
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
      if (!newStation) return; // different platform type
      const oldDate = oldP?.date;
      if (!oldDate) return; // map click sets no date; recover from previous selectedPlatform
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
  align-items: flex-end;
  height: 100%;
  width: 100%;
}

.bar {
  flex: 1;
  background: var(--blue);
  min-width: 0.5px;
}

.bar:hover {
  background: var(--darkBlue);
}

.bar-selected {
  background: var(--red) !important;
}
</style>
