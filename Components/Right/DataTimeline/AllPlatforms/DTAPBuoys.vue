<template>
  <DTLayout :variables="buoys" :active-var="hoveredBuoy || (selectedBar && selectedBar.buoyName)">
    <template #grid>
      <DTTimelineGrid v-slot="{ cells }">
        <!-- Buoy rows: barsPerCell hourly sub-cells per grid cell -->
        <tr v-for="buoy in buoys" :key="buoy.name"
          @mouseenter="hoveredBuoy = buoy.name"
          @mouseleave="hoveredBuoy = null">
          <td v-for="(cell, cellIndex) in cells" :key="cellIndex" class="bar-cell">
            <div class="bars-group">
              <div v-for="sub in barsPerCell" :key="sub"
                class="sub-cell clickable"
                :class="{
                  'no-data': !hasData(buoy, cellIndex, sub - 1),
                  'sub-cell-selected': isBarSelected(buoy.name, cellIndex, sub - 1)
                }"
                @click="buoyClicked(buoy, cellIndex, sub - 1, cell)">
                <!-- Wave height: bar grows upward from center -->
                <div class="wave-half">
                  <div class="wave-bar" :style="{ height: waveBarHeight(buoy, cellIndex, sub - 1) }"></div>
                </div>
                <!-- Wind speed: bar grows downward from center -->
                <div class="wind-half">
                  <div class="wind-bar" :style="{ height: windBarHeight(buoy, cellIndex, sub - 1) }"></div>
                </div>
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

const WAVE_MAX_M = 2.5;
const WIND_MAX_KMH = 30 * 1.852; // 30 knots in km/h

export default {
  name: "DTAPBuoys",
  created() {
    // Always generate hourly data regardless of display interval
    const totalHours = Math.round(
      (this.$gui.timelineEndDate.getTime() - this.$gui.timelineStartDate.getTime()) / (1000 * 3600)
    );
    for (const b of this.$requests.buoyStations) {
      const buoy = { name: b.id, waveData: [], windData: [] };
      for (let i = 0; i < totalHours; i++) {
        if (Math.random() < 0.15) {
          buoy.waveData.push(null);
          buoy.windData.push(null);
        } else {
          buoy.waveData.push(Math.random() * 4);   // 0–4 m
          buoy.windData.push(Math.random() * 70);  // 0–70 km/h
        }
      }
      this.buoys.push(buoy);
    }
  },
  data() {
    return {
      hoveredBuoy: null,
      selectedBar: null, // { buoyName, cellIndex, subIndex }
      buoys: [],
    }
  },
  methods: {
    //onclick: function(e){},
    hasData(buoy, cellIndex, subIndex) {
      return buoy.waveData[cellIndex * this.barsPerCell + subIndex] != null;
    },
    waveBarHeight(buoy, cellIndex, subIndex) {
      const v = buoy.waveData[cellIndex * this.barsPerCell + subIndex];
      if (v == null) return '0%';
      return Math.min(v / WAVE_MAX_M, 1) * 100 + '%';
    },
    windBarHeight(buoy, cellIndex, subIndex) {
      const v = buoy.windData[cellIndex * this.barsPerCell + subIndex];
      if (v == null) return '0%';
      return Math.min(v / WIND_MAX_KMH, 1) * 100 + '%';
    },
    isBarSelected(buoyName, cellIndex, subIndex) {
      return this.selectedBar?.buoyName === buoyName
        && this.selectedBar?.cellIndex === cellIndex
        && this.selectedBar?.subIndex === subIndex;
    },
    buoyClicked(buoy, cellIndex, subIndex, cellDate) {
      const date = new Date(cellDate.getTime() + subIndex * 3600 * 1000);
      this.$gui.selectedPlatform = {
        stationId: buoy.name,
        wave: buoy.waveData[cellIndex * this.barsPerCell + subIndex],
        wind: buoy.windData[cellIndex * this.barsPerCell + subIndex],
        date,
      };
      this.selectedBar = { buoyName: buoy.name, cellIndex, subIndex };
      this.$gui.isPlatformDetailOpen = true;
    },
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
}

.bars-group {
  display: flex;
  flex-direction: row;
  height: 22px;
  width: 100%;
}

.sub-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: lightblue;
  min-width: 0.5px;
}

.sub-cell.no-data {
  background: lightgray;
}

.sub-cell-selected {
  box-shadow: inset 0 0 0 1px var(--red);
}

.wave-half {
  flex: 1;
  display: flex;
  align-items: flex-end;
}

.wind-half {
  flex: 1;
  display: flex;
  align-items: flex-start;
}

.wave-bar {
  width: 100%;
  background: var(--blue);
}

.wind-bar {
  width: 100%;
  background: yellow;
}
</style>
