<template>
  <div class="right-section">
    <!-- Menu and list of dashboards -->
    <span class="top-right-section">
      <div class="top-right-container">
        <!-- Menu button -->
        <div class="menu-button-container menu-menu-button clickable" v-on:click="()=>{$gui.toggleMenu()}">
          <Transition name="scale-fade" mode="out-in">
            <div class="horizontal" v-if="!$gui.isMenuOpen">
              <span class="menu-text">{{ $t('Menu') }}</span>
              <i class="menu-icon-big fa fa-bars"></i>
            </div>
            <template v-else>
              <i class="menu-icon-big menu-icon-xmark fa fa-xmark"></i>
            </template>
          </Transition>
        </div>

        <!-- List of dashboards -->
        <div class="menu-button-container menu-element clickable" v-for="dashboard in availableDashboards" :key="dashboard.id" v-on:click="()=>{$gui.selectedDashboard = dashboard.id}" :class="$gui.selectedDashboard === dashboard.id ? 'selected':''">
          <span class="menu-text">{{ $t(dashboard.name) }}</span>
          <img v-if="dashboard.icon" class="menu-icon-small" :src="dashboard.icon" alt="Dashboard Icon">
          <img v-else-if="dashboard.image" class="menu-icon-small" :src="dashboard.image" alt="Dashboard Image">
        </div>
      </div>
    </span>

    <!-- Providers -->
    <div class="providers-container" v-show="!$gui.isDataTimelineOpen">
      <span>ICATMAR</span>
    </div>

    <!-- Bottom right -->
    <span class="bottom-right-section" v-show="!$gui.isDataTimelineOpen">
        <BottomRight></BottomRight>
    </span>

    <!-- Bottom pane -->
    <DataTimeline></DataTimeline>
  </div>
</template>


<script>
import DataTimeline from './DataTimeline/DataTimeline.vue';
import BottomRight from './BottomRight/BottomRight.vue';


export default {
  name: "RightPanel",
  created() {
    
  },
  mounted() {
  },
  data (){
    return {
      
    }
  },
  methods: {
    //onclick: function(e){},
  },
  computed: {
    availableDashboards() {
      return this.$gui.dashboards.filter(dashboard => dashboard.isAvailable);
    },
  },
  components: {
    DataTimeline,
    BottomRight
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
  margin-right: 0px;
  height: calc(100% - 30px);
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
}






.menu-button-container {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 4px;
  background: #00000040;
  border-radius: 20px 0px 0px 20px;
}

.menu-menu-button {
  margin-bottom: 20px;
  height: 50px;
  border-radius: 30px 0 0 30px;
}

.menu-element {
  margin-bottom: 5px;
  font-size: small;
}

.menu-text {
  display: inline-block;
  padding: 0px 20px;
  text-align: center;
  color: white;
  text-shadow: 0px 0px 4px black;
}

.menu-icon-big {
  width: 40px;
  height: 40px;
  color: white;
  text-shadow: 0px 0px 4px black;
  font-weight: bold;
  background: var(--lightBlue);
  border-radius: 50%;
  box-shadow: 0px 0px 5px black;
  margin-left: 3px;
  margin-right: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
  cursor: pointer;
}


.menu-icon-xmark {
  background: var(--red);
}

.menu-icon-small {
  width: 25px;
  height: 25px;
  color: white;
  text-shadow: 0px 0px 4px black;
  font-weight: bold;
  background: var(--lightBlue);
  border-radius: 50%;
  box-shadow: 0px 0px 5px black;
  margin-left: 3px;
  margin-right: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
  cursor: pointer;
}




.menu-vertical-button {
  background: #ffffff29;
  border: none;
  box-shadow: 0 0 4px black;
  margin: 2px 0;
  border-radius: 10px;
}

.selected {
  font-weight: bold;
  background:var(--red);
  box-shadow: 0 0 4px black;
}

</style>