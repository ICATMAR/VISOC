<template>
  <div class="right-section">
    <!-- Menu and list of dashboards -->
    <span class="top-right-section">
      <div class="top-right-container">
        <!-- Menu button -->
        <button v-on:click="()=>{$gui.toggleMenu()}">
          <span v-if="!$gui.isMenuOpen">Menu <span class='fa fa-bars'></span></span>
          <span v-else class='fa fa-xmark'></span>
        </button>
        <!-- List of dashboards -->
        <button v-for="dashboard in dashboards" :key="dashboard.id" v-on:click="()=>{$gui.selectedDashboard = dashboard.id}" :class="$gui.selectedDashboard === dashboard.id ? 'selected':''">
          {{ $t(dashboard.name) }}
        </button>
      </div>
    </span>

    <!-- Providers -->
    <div class="providers-container" v-show="!$gui.isDataTimelineOpen">
      <span>ICATMAR</span>
    </div>

    <!-- Bottom right -->
    <span class="bottom-right-section" v-show="!$gui.isDataTimelineOpen">
      <div class="bottom-right-container">
        <div>Bottom right</div>
        <button>Press me</button>
      </div>
    </span>

    <!-- Bottom pane -->
    <DataTimeline></DataTimeline>
  </div>
</template>


<script>
import DataTimeline from './DataTimeline.vue';


export default {
  name: "RightPanel",
  created() {
    
  },
  mounted() {
  },
  data (){
    return {
      dashboards: [
        {name: 'All platforms', id: 'platforms'},
        {name: 'HFR currents', id: 'hfr'},
        {name: 'HFR radials', id: 'hfr-radials'},
        {name: 'Buoys', id: 'buoys'},
        {name: 'Satellites', id: 'satellites'},
        {name: 'Drifters', id: 'drifters'},
        {name: 'Argos', id: 'argos'},
      ]
    }
  },
  methods: {
    //onclick: function(e){},
  },
  components: {
    DataTimeline
  }
}
</script>


<style scoped>
.right-section {
  position: fixed;
  top: 0px;
  bottom: 0px;
  right: 0px;
  left: 0px;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  pointer-events: none;
  transition: right .5s ease-out, opacity .7s;
}

.top-right-section {
  flex-grow: 1;
}

.top-right-container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  position: relative;
  pointer-events: none;
  margin-top: 10px;
  margin-bottom: 20px;
  margin-right: 10px;
  height: calc(100% - 30px);
  background-color: purple;

}

.providers-container {
  height: 40px;
  width: 220px;
  margin-right: 110px;
}

.bottom-right-section {
}

.bottom-right-container {
  display: flex;
  flex-direction: column;
  width: 320px;
  margin: 0 8px 8px auto;
  position: relative;
  white-space: nowrap;
  pointer-events: auto;
  background:wheat;
}

.selected {
  font-weight: bold;
  text-decoration: underline;
}

</style>