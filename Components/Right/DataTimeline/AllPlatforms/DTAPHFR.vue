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
          <!-- Hours -->
          <tr>
            <td v-for="(cell, index) in cells" :key="index" class="hourCell">
              <span :style="{ opacity: (cell.getHours() < 6 || cell.getHours() >= 21) ? '0.4' : '1' }">{{ cell.getHours() }}</span>
            </td>
          </tr>
          <!-- Station availability bars -->
          <tr v-for="station in stations" :key="station.name">
            <td v-for="(value, index) in station.data" :key="index" class="bar-cell">
              <div class="bar" :style="{ height: (value / station.maxValue * 100) + '%' }" :title="value + ' valid points'"></div>
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
    for (const station of this.stations) {
      for (let i = 0; i < this.cells.length; i++) {
        station.data[i] = 500 + Math.round(Math.random() * 500);
        if (station.data[i] > station.maxValue)
          station.maxValue = station.data[i];
      }
    }
  },
  data() {
    return {
      stations: [
        { name: 'CNET', data: [], maxValue: 0 },
        { name: 'CREU', data: [], maxValue: 0 },
        { name: 'BEGU', data: [], maxValue: 0 },
        { name: 'TOSS', data: [], maxValue: 0 },
        { name: 'AREN', data: [], maxValue: 0 },
        { name: 'PBCN', data: [], maxValue: 0 },
        { name: 'GNST', data: [], maxValue: 0 },
        { name: 'SVLR', data: [], maxValue: 0 },
      ],
    }
  },
  computed: {
    cells() {
      const startTime = this.$gui.timelineStartDate.getTime();
      const endTime = this.$gui.timelineEndDate.getTime();
      const stepMs = 60 * 60 * 1000; // 1h interval
      let cells = [];
      for (let t = startTime; t < endTime; t += stepMs)
        cells.push(new Date(t));
      return cells;
    },
    days() {
      let days = [];
      for (const cell of this.cells) {
        const last = days[days.length - 1];
        if (last && last.date.getDate() === cell.getDate())
          last.span++;
        else
          days.push({
            date: cell,
            span: 1,
            textLong: cell.toLocaleString(this.$i18n.locale, { weekday: 'long', day: 'numeric' }),
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
}

.bar-cell {
  padding: 0;
  vertical-align: bottom;
}

.bar {
  background: var(--blue);
}

</style>
