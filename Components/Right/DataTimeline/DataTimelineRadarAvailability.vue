<template>


<!-- Timetable -->
 <table>
    <tbody>
      <!-- Data points -->
      <tr v-for="station in stations" :key="station.name">
        <td v-for="(dataPoint, index) in station.data" :key="index"
          style="font-size: small">
          <span>{{ dataPoint }}</span>
        </td>
      </tr>
    </tbody>
  </table>


</template>


<script>

export default {
  name: "DataTimelineRadarAvailability",
  created() {
    
  },
  mounted() {
    // HFR Node URL
    // TODO: all this fetch activities, move them somewhere else. The fetch
    // should only return the array ready? or the data to be parsed and fitted
    // to this component?
    let startTmst = '2026-06-14T15:00:00Z';
    let endTmst = '2026-06-15T05:00:00Z';
    
    for (let i = 0; i < this.stations.length; i++) {
      let station = this.stations[i];
      let url = this.baseURL.replace('{{stationName}}', station.name);
      url = url.replace('{{startTmst}}', startTmst);
      url = url.replace('{{endTmst}}', endTmst);
      console.log(url.replace('csv', 'htmlTable'));
      const encodedUrl = encodeURIComponent(url);
      const proxyFullURL = this.proxyURL + '?url=' + encodedUrl;
      //fetch(proxyFullURL).then(r => r.jsonlKVP()).then(res => console.log(res));
      this.parseMessage(this.returnMessage, station);

    }

  },
  data() {
    return {
      proxyURL: 'https://api.icatmar.cat/proxy/',
      baseURL: `https://erddap.hfrnode.eu/erddap/tabledap/EUHFR_NRTcurrent_HFR-ICATMAR-{{stationName}}_v3_table.csv?time,RDVA
&time>={{startTmst}}
&time<={{endTmst}}
&RDVA!=NaN
&orderByCount("time")`,
      stations: [
        {
          name: 'CREU',
          data: [],
        }
      ],
      returnMessage: `time,RDVA
UTC,count
2026-06-14T15:00:00Z,1182
2026-06-14T16:00:00Z,1220
2026-06-14T17:00:00Z,1640
2026-06-14T18:00:00Z,861
2026-06-14T19:00:00Z,809
2026-06-14T20:00:00Z,1448
2026-06-14T21:00:00Z,1528
2026-06-14T22:00:00Z,1088
2026-06-14T23:00:00Z,1123
2026-06-15T00:00:00Z,1606
2026-06-15T01:00:00Z,1724
2026-06-15T02:00:00Z,1367
2026-06-15T03:00:00Z,1275
2026-06-15T04:00:00Z,954
2026-06-15T05:00:00Z,1106`
      ,
    }
  },
  methods: {
    //onclick: function(e){},
    parseMessage: function (msg, stationObj) {
      const text = msg.trim();
      const lines = text.split(/\r?\n/);
      // Skip the two header lines
      const data = lines.slice(2).map(line => {
        const [time, rdva] = line.split(',');

        return {
          time: new Date(time),
          RDVA: Number(rdva)
        };
      });

      // Assign values to station
      for (let i = 0; i < data.length; i++){
        stationObj.data.push(data[i].RDVA);
      }
    }
  }
}

</script>


<style scoped>

</style>