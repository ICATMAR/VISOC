<template>
  <!-- Selected view -->
  <component :is="currentView" v-if="currentView"></component>

  <!-- Bottom options -->
  <div class="horizontal wrap button-group bottom-bar">
    <button v-for="view in views" :key="view.label" class="clickable"
      :class="{ 'selectedOption': selectedView === view }"
      @click="selectView(view)"><span>{{ $t(view.label) }}</span></button>
  </div>
</template>


<script>
import DTAPHFR from './DTAPHFR.vue';
import DTAPBuoys from './DTAPBuoys.vue';
import DTAPDrifters from './DTAPDrifters.vue';
import DTAPArgos from './DTAPArgos.vue';

export default {
  name: "DTAllPlatforms",
  created() {
    this.$gui.timelineDashboardId = this.selectedView.dashboardId;
    this.$gui.timelineIntervalMinutes = this.selectedView.defaultInterval;
  },
  beforeUnmount() {
    this.$gui.timelineDashboardId = null;
  },
  data() {
    const views = [
      { label: 'HF radars',  component: 'DTAPHFR',      defaultInterval: 60,   dashboardId: 'hfr'           },
      { label: 'Buoys',      component: 'DTAPBuoys',     defaultInterval: 180,  dashboardId: 'buoys'         },
      { label: 'Drifters',   component: 'DTAPDrifters',  defaultInterval: 180,  dashboardId: 'drifters'      },
      { label: 'Argos',      component: 'DTAPArgos',     defaultInterval: 1440, dashboardId: 'argos'         },
      { label: 'Satellite',  component: null,             defaultInterval: 1440, dashboardId: 'remoteSensing' },
    ];
    return {
      views,
      selectedView: views[0],
    }
  },
  methods: {
    //onclick: function(e){},
    selectView(view) {
      this.selectedView = view;
      this.$gui.timelineDashboardId = view.dashboardId;
      this.$gui.timelineIntervalMinutes = view.defaultInterval;
    }
  },
  computed: {
    currentView() {
      return this.selectedView.component || null;
    }
  },
  components: {
    DTAPHFR,
    DTAPBuoys,
    DTAPDrifters,
    DTAPArgos
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
  font-size: x-small;
}

</style>
