<template>

<!-- Timetable -->
<table>
  <tbody>
    <!-- Days of week -->
    <tr>
      <td v-for="day in days" :key="day.date" :colspan="day.span" class="weekDayCell">
        <span>{{ day.textLong }}</span>
      </td>
    </tr>
    <!-- Time of day -->
    <tr>
      <td v-for="(cell, index) in cells" :key="index" class="hourCell">
        <span v-if="cell.getMinutes() === 0"
          :style="{ opacity: (cell.getHours() < 6 || cell.getHours() >= 21) ? '0.4' : '1' }">{{ cell.getHours() }}</span>
      </td>
    </tr>
    <!-- Data points -->
    <tr v-for="(varDataPoints, varIndex) in data" :key="varIndex">
      <td v-for="(dataPoint, index) in varDataPoints" :key="index"
        :style="getGradientStyle(index, varDataPoints)" style="font-size: small">
        <span>{{ dataPoint }}º</span>
      </td>
    </tr>
  </tbody>
</table>

</template>


<script>

export default {
  name: "DTTimelineGrid",
  props: {
    variables: Array,
    intervalMinutes: { type: Number, default: 180 }, // 180 (3h), 60 (1h) or 15 (15min)
  },
  methods: {
    //onclick: function(e){},
    // LEGEND COLORS
    // Helper to map value to a color (example logic)
    getColorFromValue(value) {
      if (value < 3) return 'white';
      if (value < 6) return 'yellow';
      if (value < 9) return 'orange';
      return 'red';
    },
    getGradientStyle(index, dataArray) {
      const currentVal = dataArray[index];
      // Use the current value as fallback if neighbor doesn't exist
      const prevVal = index > 0 ? dataArray[index - 1] : currentVal;
      const nextVal = index < dataArray.length - 1 ? dataArray[index + 1] : currentVal;

      const prevColor = this.getColorFromValue((prevVal + currentVal) / 2);
      const currColor = this.getColorFromValue(currentVal);
      const nextColor = this.getColorFromValue((nextVal + currentVal) / 2);

      return {
        background: `linear-gradient(to right, ${prevColor}, ${currColor}, ${nextColor})`
      };
    },
  },
  computed: {
    cells() {
      const startTime = this.$gui.timelineStartDate.getTime();
      const endTime = this.$gui.timelineEndDate.getTime();
      const stepMs = this.intervalMinutes * 60 * 1000;
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
    data() {
      let variablesDataPoints = [];
      for (let vI = 0; vI < this.variables.length; vI++) {
        variablesDataPoints[vI] = [];
        for (let i = 0; i < this.cells.length; i++) {
          // Generate random data points for now
          variablesDataPoints[vI][i] = Math.floor(Math.random() * 10);
        }
      }
      return variablesDataPoints;
    },
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

</style>
