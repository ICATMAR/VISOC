<template>


<!-- Timetable -->
 <table>
    <tbody>
      <!-- Data points -->
      <tr v-for="station in stations" :key="station.name">
        <template v-for="(dataPoint, index) in station.data" :key="index">
          <!-- Create the same cells as hourlyInterval and fill with more detail -->
          <td v-if="index % hourlyInterval == 0">
            <div class="cell-container">
              <div class="hourly-cell" v-for="n in hourlyInterval" :key="n" :style="{height: (station.data[index + n - 1]/station.maxValue * 100) + '%'}" :title="station.data[index + n - 1] + ' ' + $t('valid points')"></div>
            </div>
          </td>
        </template>
      </tr>
    </tbody>
  </table>


</template>


<script>

export default {
  name: "DataTimelineRadarAvailability",
  props: {
    startTmst: String,
    endTmst: String,
    hourlyInterval: Number,
  },
  created() {

    let numHours = this.getNumHours(this.startTmst, this.endTmst, this.hourlyInterval);

    this.cellWidth = (30 + 2) / this.hourlyInterval + 'px';
    
    for (let i = 0; i < this.stations.length; i++){
      let station = this.stations[i];
      // Fill data
      for (let j = 0; j < numHours; j++){
        station.data[j] = 500 + Math.round(Math.random()*500);
        if (station.data[j] > station.maxValue)
          station.maxValue = station.data[j];
      }
    }
    
  },
  mounted() {

    

  },
  data() {
    return {
      stations: [
        {
          name: 'CNET',
          data: [],
          maxValue: 0,
        },
        {
          name: 'CREU',
          data: [],
          maxValue: 0,
        },
        {
          name: 'BEGU',
          data: [],
          maxValue: 0,
        },
        {
          name: 'TOSS',
          data: [],
          maxValue: 0,
        },
        {
          name: 'AREN',
          data: [],
          maxValue: 0,
        },
        {
          name: 'PBCN',
          data: [],
          maxValue: 0,
        },
        {
          name: 'GNST',
          data: [],
          maxValue: 0,
        },
        {
          name: 'SVLR',
          data: [],
          maxValue: 0,
        }
      ],
    }
  },
  methods: {
    //onclick: function(e){},
    getNumHours: function(startTmst, endTmst, hourlyInterval){
      let startDate = new Date(startTmst);
      let endDate = new Date(endTmst);

      let totalHours = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600));
      // Correct the total number of hours so it fills the last hourlyInterval cell
      totalHours = Math.ceil(totalHours / hourlyInterval) * hourlyInterval;
      console.log("There are " + totalHours + " subcells");
      return totalHours;
    },
  }
}

</script>


<style scoped>
td {
  padding: 0px;
}

.cell-container {
  height: 22px;
  display: flex;
  flex-direction: row;
  align-items: flex-end;
}

.hourly-cell {
  width: calc(v-bind(cellWidth));
  background: var(--blue);
}

</style>