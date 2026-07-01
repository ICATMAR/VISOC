<template>
<table class="dt-table">
  <tbody>
    <!-- Days of week -->
    <tr>
      <td v-for="day in days" :key="day.date" :colspan="day.span" class="weekDayCell">
        <span>{{ day.textLong }}</span>
      </td>
    </tr>
    <!-- Hours: single label per cell (sub-daily) or 0/12 anchors per day (daily) -->
    <tr>
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
    <!-- Data rows provided by each DataTimeline -->
    <slot :cells="cells" :barsPerCell="barsPerCell"></slot>
  </tbody>
</table>
</template>


<script>

export default {
  name: "DTTimelineGrid",
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
  }
}

</script>


<!-- Non-scoped: applies to slot content rendered by child DT components -->
<style>
.dt-table {
  border-collapse: collapse;
  border-spacing: 0;
  align-self: flex-start;
}

.dt-table td {
  width: 30px;
  height: 22px;
  text-align: center;
}

.dt-table td > * {
  color: black;
  text-shadow: none;
  text-wrap: nowrap;
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

.hourCell-noon {
  left: 50% !important;
}
</style>
