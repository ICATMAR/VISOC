<template>
  <DTLayout :variables="variables">
    <template #grid>
      <DTTimelineGrid v-slot="{ cells, barsPerCell }">
        <tr v-for="(variable, vIndex) in variables" :key="variable.name">
          <td v-for="(cell, cellIndex) in cells" :key="cellIndex"
            :style="getGradientStyle(vIndex, cellIndex, barsPerCell)">
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
  name: "DTHFRModels",
  created() {
    const totalHours = Math.round(
      (this.$gui.timelineEndDate.getTime() - this.$gui.timelineStartDate.getTime()) / (1000 * 3600)
    );
    this.variablesData = this.variables.map(() =>
      Array.from({ length: totalHours }, () => Math.floor(Math.random() * 10))
    );
  },
  data() {
    return {
      variablesData: [],
      // Sea water velocity from radar compared to other models / networks
      variables: [
        { name: 'HF Radar',  unit: 'm/s' },
        { name: 'ICATMAR',   unit: 'm/s' },
        { name: 'CMEMS',     unit: 'm/s' },
      ],
    }
  },
  methods: {
    //onclick: function(e){},
    getColorFromValue(value) {
      if (value < 3) return 'white';
      if (value < 6) return 'yellow';
      if (value < 9) return 'orange';
      return 'red';
    },
    getGradientStyle(vIndex, cellIndex, barsPerCell) {
      const data = this.variablesData[vIndex];
      if (!data) return {};
      const i = cellIndex * barsPerCell;
      const curr = data[i] ?? 0;
      const prev = i > 0 ? data[i - barsPerCell] : curr;
      const next = i + barsPerCell < data.length ? data[i + barsPerCell] : curr;
      return {
        background: `linear-gradient(to right,
          ${this.getColorFromValue((prev + curr) / 2)},
          ${this.getColorFromValue(curr)},
          ${this.getColorFromValue((curr + next) / 2)})`
      };
    },
  },
  components: {
    DTLayout,
    DTTimelineGrid,
  }
}

</script>
