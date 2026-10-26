<template>
  <!-- Selected view -->
  <!-- The HFR view gets the selected station's network (see viewProps) -->
  <component :is="currentView" v-if="currentView" v-bind="viewProps"></component>

  <!-- Bottom options. Wraps, which is what lets the variable picker open a
       second row underneath without a container of its own. -->
  <div class="horizontal wrap button-group bottom-bar">
    <button v-for="view in views" :key="view.label" class="clickable"
      :class="{ 'selectedOption': selectedView === view }"
      @click="selectView(view)"><span>{{ $t(view.label) }}</span></button>

    <!-- Buoys-only: which variable the rows are drawn from, and its unit.
         Sits on this row; opening it adds a row of variables below. Doesn't
         apply to HFR currents or Drifters. -->
    <DTAPBuoysVariableBar v-if="selectedView.dashboardId === 'buoys'" />
  </div>
</template>


<script>
import DTAPHFR from './DTAPHFR.vue';
import DTAPBuoys from './DTAPBuoys.vue';
import DTAPDrifters from './DTAPDrifters.vue';
import DTAPArgos from './DTAPArgos.vue';
import DTAPBuoysVariableBar from './DTAPBuoysVariableBar.vue';

export default {
  name: "DTAllPlatforms",
  created() {
    // If timelineDashboardId was pre-set (e.g. from a map icon click), jump to that view
    if (this.$gui.timelineDashboardId) {
      const preSelected = this.views.find(v => v.dashboardId === this.$gui.timelineDashboardId);
      if (preSelected) this.selectedView = preSelected;
    }
    this.$gui.timelineDashboardId = this.selectedView.dashboardId;
    this.$gui.timelineIntervalMinutes = this.selectedView.defaultInterval;
    this.loadNetworks();
  },
  beforeUnmount() {
    this.$gui.timelineDashboardId = null;
  },
  data() {
    const views = [
      { label: 'HFR currents',  component: 'DTAPHFR',      defaultInterval: 180,   dashboardId: 'hfr'           },
      { label: 'Buoys',      component: 'DTAPBuoys',     defaultInterval: 180,  dashboardId: 'buoys'         },
      { label: 'Drifters',   component: 'DTAPDrifters',  defaultInterval: 180,  dashboardId: 'drifters'      },
      // { label: 'Argos',      component: 'DTAPArgos',     defaultInterval: 1440, dashboardId: 'argos'         },
      // { label: 'Satellite',  component: null,             defaultInterval: 1440, dashboardId: 'remoteSensing' },
    ];
    return {
      views,
      selectedView: views[0],
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
    selectView(view) {
      this.selectedView = view;
      this.$gui.timelineDashboardId = view.dashboardId;
      this.$gui.timelineIntervalMinutes = view.defaultInterval;
    }
  },
  computed: {
    currentView() {
      return this.selectedView.component || null;
    },
    // The HF radar station picked from another network than ICATMAR's (with
    // External platforms on): that network, as the EU HFR Node publishes it -
    // its stations are the rows. Otherwise null: ICATMAR's own network, as
    // ICATMAR processes it (DTAPHFR's default).
    hfrNetwork() {
      const code = this.$gui.selectedPlatform?.network;
      if (!code || code === 'HFR-ICATMAR') return null;
      return this.$dataService.hfrnetwork.networkOf(this.networks, code);
    },
    viewProps() {
      return this.currentView === 'DTAPHFR' ? { network: this.hfrNetwork } : {};
    },
  },
  watch: {
    // External platforms off: another network's station picked is no longer
    // on the map - let go of it, the timeline goes back to ICATMAR's network
    '$gui.platformsShowExternal'(shown) {
      const code = this.$gui.selectedPlatform?.network;
      if (shown || !code || code === 'HFR-ICATMAR') return;
      this.$gui.selectedPlatform = null;
      this.$gui.isPlatformDetailOpen = false;
    },
    '$gui.timelineDashboardId'(newId) {
      if (!newId) return;
      const view = this.views.find(v => v.dashboardId === newId);
      if (view && view !== this.selectedView) {
        this.selectedView = view;
        this.$gui.timelineIntervalMinutes = view.defaultInterval;
      }
    }
  },
  components: {
    DTAPHFR,
    DTAPBuoys,
    DTAPDrifters,
    DTAPArgos,
    DTAPBuoysVariableBar,
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

</style>
