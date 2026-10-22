<template>
  <DTLayout :variables="allVariables" :active-var="hoveredStation || (selectedBar && selectedBar.stationName)" :selected-var="$gui.isPlatformDetailOpen ? $gui.selectedPlatform?.stationId : null" @var-click="stationNameClicked">
    <template #grid>
      <DTTimelineGrid v-slot="{ cells }">
        <!-- TOTALS row at top, separated from station rows by border -->
        <!-- Still waiting on the network Total's own promise to resolve -->
        <tr v-if="totals.loading">
          <!-- <td :colspan="cells.length" class="message-cell totals-bar-cell"><span class="spinner-border"></span></td> -->
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
            <!-- <td :colspan="cells.length" class="message-cell"><span class="spinner-border"></span></td> -->
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

// ICATMAR's network, as ICATMAR processes it
const ICATMAR_STATIONS = ['CNET', 'CREU', 'BEGU', 'TOSS', 'AREN', 'PBCN', 'GNST', 'SCAL',
  // Puertos del Estado's (GitHub, or their HFR-DeltaEbro copies on the EU HFR Node)
  'SALO', 'ALFA', 'VINA'];

// hourlyOrigin: where each bar's count came from ({ label, dataset, url })
const emptyRow = name => ({ name, hourlyData: [], hourlyOrigin: [], maxValue: 0 });

export default {
  name: "DTAPHFR",
  props: {
    // A network as the EU HFR Node publishes it (one of getAllNetworks()'
    // groups); ICATMAR's own network when not given
    network: { type: Object, default: null },
  },
  created() {
    this.loadStations();
    this.selectBarAtSelectedTime(); // a platform picked before this opened
  },
  data() {
    return {
      hoveredStation: null,
      selectedBar: null,
      totals: emptyRow('TOTALS'),
      stations: this.stationRows(),
    }
  },
  methods: {
    stationRows() {
      const ids = this.network
        ? [...this.network.stations].filter(s => !s.notOnEUNode).sort((a, b) => b.latitude - a.latitude).map(s => s.id)
        : ICATMAR_STATIONS;
      return ids.map(emptyRow);
    },
    // What a click on a row selects, besides the station: its network, when
    // it is another network's - codes repeat across networks
    selectionDetails() {
      return this.network ? { network: this.networkCode } : {};
    },
    // getNumberOfValidPointsPerNetwork() resolves to an array of per-entity
    // promises (one per station, plus one for TOTALS), not a single
    // Promise<object> - each row's bars are filled in as soon as ITS own
    // promise resolves, instead of everything waiting on the slowest one.
    async loadStations() {
      const request = (this.request ?? 0) + 1; // a newer network's rows supersede these
      this.request = request;
      this.stations.forEach(s => { s.loading = true; });
      this.totals.loading = true;

      const promises = this.network
        ? this.$dataService.hfrnetwork.getNumberOfValidPointsForEUNetwork(
          this.$dataService.hfrstations, this.network,
          this.$gui.timelineStartDate, this.$gui.timelineEndDate)
        : await this.$dataService.hfrnetwork.getNumberOfValidPointsPerNetwork(
          this.$dataService.hfrstations, this.$dataService.hfrtotals,
          this.$gui.timelineStartDate, this.$gui.timelineEndDate);

      const startMs = this.$gui.timelineStartDate.getTime();
      promises.forEach(promise => promise.then(({ id, points, origins, source }) => {
        if (request !== this.request) return;
        const entry = id === 'TOTALS' ? this.totals : this.stations.find(s => s.name === id);
        if (!entry) return;
        entry.loading = false;
        if (points == null) { entry.noData = true; return; } // e.g. SCAL - no EU HFR Node dataset

        Object.entries(points).forEach(([timeStr, count]) => {
          // A bar is the hour ENDING at its time: 13:00's count is drawn
          // between 12:00 and 13:00
          const hourIndex = Math.ceil((new Date(timeStr).getTime() - startMs) / (1000 * 3600)) - 1;
          if (hourIndex < 0) return;
          entry.hourlyData[hourIndex] = count;
          // Per hour where sources mix (a station's GitHub-filled hours), or
          // one for the whole row
          entry.hourlyOrigin[hourIndex] = origins?.[timeStr] ?? source;
          if (count > entry.maxValue) entry.maxValue = count;
        });
        // The selected bar's count has arrived
        if (this.$gui.selectedPlatform?.stationId === id) this.selectBarAtSelectedTime();
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
      const date = new Date(cellDate.getTime() + (subIndex + 1) * 3600 * 1000); // the bar's end
      this.$gui.selectedTime = date;
      this.$gui.selectedPlatform = {
        stationId: 'TOTALS',
        value: this.totalsValue(cellIndex, subIndex),
        origin: this.totals.hourlyOrigin[cellIndex * this.barsPerCell + subIndex],
        origins: undefined,
        date,
        ...this.selectionDetails(),
      };
      this.selectedBar = { stationName: 'TOTALS', cellIndex, subIndex };
      this.$gui.isPlatformDetailOpen = true;
    },
    stationClicked(station, cellIndex, subIndex, cellDate) {
      const date = new Date(cellDate.getTime() + (subIndex + 1) * 3600 * 1000); // the bar's end
      this.$gui.selectedTime = date;
      this.$gui.selectedPlatform = {
        stationId: station.name,
        value: this.getHourlyValue(station, cellIndex, subIndex),
        origin: station.hourlyOrigin[cellIndex * this.barsPerCell + subIndex],
        origins: undefined,
        date,
        ...this.selectionDetails(),
      };
      this.selectedBar = { stationName: station.name, cellIndex, subIndex };
      this.$gui.isPlatformDetailOpen = true;
    },
    // The bar of the hour `time` belongs to, as the map rounds it (9:30 up
    // to 10:30 is 10:00): the bar ending at that hour. { cellIndex, subIndex,
    // date } - null outside the timeline.
    barAt(time) {
      const hour = Math.floor((new Date(time).getTime() + 1800000) / 3600000) * 3600000;
      const start = this.$gui.timelineStartDate.getTime();
      if (hour <= start || hour > this.$gui.timelineEndDate.getTime()) return null;
      const absHour = Math.round((hour - start) / 3600000) - 1;
      return { cellIndex: Math.floor(absHour / this.barsPerCell), subIndex: absHour % this.barsPerCell, date: new Date(hour) };
    },
    // The selected platform's bar at the selected time, its count and hour
    // written into the selection for the platform detail
    selectBarAtSelectedTime() {
      const selection = this.$gui.selectedPlatform;
      const id = selection?.stationId;
      const entry = id === 'TOTALS' ? this.totals : this.stations.find(s => s.name === id);
      if (!entry || !this.$gui.isPlatformDetailOpen) { this.selectedBar = null; return; }
      const bar = this.barAt(this.$gui.selectedTime);
      if (!bar) { this.selectedBar = null; return; }
      this.selectedBar = { stationName: id, cellIndex: bar.cellIndex, subIndex: bar.subIndex };
      const value = this.getHourlyValue(entry, bar.cellIndex, bar.subIndex);
      const origin = entry.hourlyOrigin[bar.cellIndex * this.barsPerCell + bar.subIndex];
      if (selection.date?.getTime() !== bar.date.getTime() || selection.value !== value || selection.origin !== origin || selection.origins)
        this.$gui.selectedPlatform = { ...selection, value, origin, origins: undefined, date: bar.date };
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
      this.$gui.selectedPlatform = { stationId: v.name, ...this.selectionDetails() };
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
    networkCode() {
      return this.$dataService.hfrnetwork.networkCode(this.network);
    },
  },
  watch: {
    // Another network: its own rows, from scratch
    networkCode() {
      this.selectedBar = null;
      this.totals = emptyRow('TOTALS');
      this.stations = this.stationRows();
      this.loadStations();
    },
    '$gui.isPlatformDetailOpen'(isOpen) {
      if (isOpen) this.selectBarAtSelectedTime();
      else this.selectedBar = null;
    },
    // The bars are grouped differently after a zoom
    '$gui.timelineEffectiveIntervalMinutes'() { this.selectBarAtSelectedTime(); },
    // The selected bar is always the selected time's: a bar click sets that
    // time, a platform picked elsewhere (map, menu, its name) opens on it,
    // and the time handle moves it
    '$gui.selectedPlatform'() { this.selectBarAtSelectedTime(); },
    '$gui.selectedTime'() { this.selectBarAtSelectedTime(); },
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
