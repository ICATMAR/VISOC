<template>
  <DTLayout :variables="stations">
    <template #grid>
      <table>
        <tbody>
          <!-- Days of week -->
          <tr>
            <td v-for="day in days" :key="day.date" :colspan="day.span" class="weekDayCell">
              <span>{{ day.textLong }}</span>
            </td>
          </tr>
          <!-- Hours (hidden for daily interval) -->
          <tr v-if="$gui.timelineEffectiveIntervalMinutes < 1440">
            <td v-for="(cell, index) in cells" :key="index" class="hourCell">
              <span :style="{ opacity: ($gui.timelineHours(cell) < 6 || $gui.timelineHours(cell) >= 21) ? '0.4' : '1' }">{{ $gui.timelineHours(cell) }}</span>
            </td>
          </tr>
          <!-- Station availability bars — barsPerCell hourly sub-bars per grid cell -->
          <tr v-for="station in stations" :key="station.name">
            <td v-for="(cell, cellIndex) in cells" :key="cellIndex" class="bar-cell">
              <div class="bars-group">
                <div v-for="sub in barsPerCell" :key="sub"
                  class="bar clickable"
                  :style="{ height: (getHourlyValue(station, cellIndex, sub - 1) / station.maxValue * 100) + '%' }"
                  :title="getHourlyValue(station, cellIndex, sub - 1) + ' valid points'"
                  @click="stationClicked(station, cellIndex, sub - 1)">
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </DTLayout>
</template>


<script>
import DTLayout from '../Shared/DTLayout.vue';

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
    stationClicked(station, cellIndex, subIndex) {
      this.$gui.selectedPlatform = { stationId: station.name, value: this.getHourlyValue(station, cellIndex, subIndex) };
      this.$gui.isPlatformDetailOpen = true;
    },
    getHourlyValue(station, cellIndex, subIndex) {
      return station.hourlyData[cellIndex * this.barsPerCell + subIndex] || 0;
    }
  },
  computed: {
    barsPerCell() {
      return Math.round(this.$gui.timelineEffectiveIntervalMinutes / 60);
    },
    cells() {
      const startTime = this.$gui.timelineStartDate.getTime();
      const endTime = this.$gui.timelineEndDate.getTime();
      const stepMs = this.$gui.timelineEffectiveIntervalMinutes * 60 * 1000;
      let cells = [];
      for (let t = startTime; t < endTime; t += stepMs)
        cells.push(new Date(t));
      return cells;
    },
    days() {
      let days = [];
      for (const cell of this.cells) {
        const last = days[days.length - 1];
        if (last && this.$gui.timelineDate(last.date) === this.$gui.timelineDate(cell))
          last.span++;
        else
          days.push({
            date: cell,
            span: 1,
            textLong: this.$gui.timelineFormatDay(cell, this.$i18n.locale),
          });
      }
      return days;
    },
  },
  components: {
    DTLayout
  }
}

</script>


<style scoped>
table {
  border-collapse: collapse;
  border-spacing: 0;
  align-self: flex-start;
}

td {
  width: 30px;
  height: 22px;
  text-align: center;
}

td > * {
  color: black;
  text-shadow: none;
}

.weekDayCell {
  text-align: left;
  padding-left: 15px;
  border-left: 1px solid gray;
  border-bottom: 1px solid gray;
}

.hourCell {
  font-size: x-small;
  border-bottom: 1px solid #0000002e;
  position: relative;
  overflow: visible;
}

.hourCell > span {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translate(-50%, -50%);
  white-space: nowrap;
}

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

</style>
