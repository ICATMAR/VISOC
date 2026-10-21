<template>
  <!-- Selected view -->
  <!-- Network: the availability of a network's stations, as All platforms
       draws ICATMAR's -->
  <DTAPHFR v-if="$gui.hfrTab === 'Network'" :network="euNetwork"></DTAPHFR>
  <DTHFRCompare v-else-if="$gui.hfrTab === 'Compare' && $gui.hfrPoint"></DTHFRCompare>
  <div v-else class="horizontal hfr-placeholder">
    <span>{{ $t(placeholder) }}</span>
  </div>

  <!-- Bottom options: the station views, then the views about a point -->
  <div class="horizontal wrap button-group bottom-bar">
    <template v-for="(group, groupIndex) in tabGroups" :key="groupIndex">
      <span v-if="groupIndex > 0" class="tab-group-gap"></span>
      <button v-for="tab in group" :key="tab" class="clickable" :class="{ 'selectedOption': $gui.hfrTab == tab }"
        @click="$gui.hfrTab = tab"><span>{{ $t(tab) }}</span></button>
    </template>
  </div>
</template>


<script>
import DTAPHFR from '../AllPlatforms/DTAPHFR.vue';
import DTHFRCompare from './DTHFRCompare.vue';

// The HFR dashboard's bottom section. About the stations: the availability
// of a network's stations (Network) and one station's measures (Station).
// About a place (GUIManager.hfrPoint): what the radars measured there (Point)
// and how the radars, the platforms and the models compare (Compare).
export default {
  name: "DTHFR",
  created() {
    this.loadNetworks();
  },
  data() {
    return {
      tabGroups: [['Network', 'Station'], ['Point', 'Compare']],
      networks: [], // getAllNetworks()' groups, once loaded
    }
  },
  methods: {
    async loadNetworks() {
      try {
        this.networks = await this.$dataService.hfrnetwork.getAllNetworks(this.$dataService.hfrstations);
      } catch (error) {
        console.error('Error loading the HF radar networks:', error);
      }
    },
  },
  computed: {
    // With the EU HFR Node: the network of the station picked, as the node
    // publishes it - HFR-ICATMAR until one is. With ICATMAR: null, ICATMAR's
    // own network (DTAPHFR's default).
    euNetwork() {
      if (this.$gui.hfrSource !== 'EU') return null;
      const code = this.$gui.selectedPlatform?.network || 'HFR-ICATMAR';
      return this.networks.find(network => this.$dataService.hfrnetwork.networkCode(network) === code) ?? null;
    },
    placeholder() {
      if (this.$gui.hfrTab === 'Station') return 'Coming soon: the selected station\'s measures, hour by hour';
      if (this.$gui.hfrTab === 'Compare') return 'Click a buoy or a drifter on the map to compare it with the HF radars and the models';
      return 'Coming soon: click a point on the map to see the currents there';
    },
  },
  watch: {
    // A buoy or drifter picked on the map belongs to Compare: in any other
    // view it is no longer selected - no detail, nothing in the info panel
    '$gui.hfrTab'(tab) {
      if (tab === 'Compare' || !this.$gui.selectedPlatform?.kind) return;
      this.$gui.selectedPlatform = null;
      this.$gui.isPlatformDetailOpen = false;
    },
  },
  components: {
    DTAPHFR,
    DTHFRCompare,
  }
}

</script>


<style scoped>
.bottom-bar {
  border-top: 1px white solid;
  background: var(--blue);
}
.bottom-bar > * {
  padding-left: 10px;
  font-size: small;
}

/* Sets the station views apart from the views about a point */
.tab-group-gap {
  width: 1px;
  align-self: stretch;
  margin: 4px 6px 4px 10px;
  padding: 0;
  background: rgba(255, 255, 255, 0.5);
}

.hfr-placeholder {
  width: 100vw;
  height: 90px;
  align-items: center;
  justify-content: center;
  background: var(--lightBlue);
  font-size: small;
}
</style>
