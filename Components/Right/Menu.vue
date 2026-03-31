<template>
  <div>
    <Transition name="slide-fade">
      <div class="menu-container" v-show="$gui.isMenuOpen">

        <!-- Language selector -->
        <div class="horizontal button-group" style="justify-content: flex-end">
          <button class="clickable" v-for="language in $gui.languages" :key="language.id" v-on:click="() => { $gui.selectedLanguage = language.id }" :class="$gui.selectedLanguage === language.id ? 'selected':''">
            <span>{{ language.name }}</span>
          </button>
        </div>

        <!-- Panels -->
        <div class="horizontal wrap info-links" style="justify-content: flex-end">
          <button class="clickable"><span>{{ $t('About') }}</span></button>
          <button class="clickable"><span>{{ $t('Cookie consent') }}</span></button>
          <button class="clickable"><span>{{$t('Source code')}}</span></button>
        </div>

        <!-- Divider -->
        <div class="divider-small"></div>

        <!-- All platforms -->
        <div class="dashboard-container clickable" v-on:click="() => { $gui.selectedDashboard = allPlatformsDashboard.id }" :class="$gui.selectedDashboard === allPlatformsDashboard.id ? 'dashboard-box-selected' : ''">
          <div class="dashboard-img-container">
            <img class="dashboard-img" :src="allPlatformsDashboard.icon" alt="All platforms icon" >
          </div>
          <span class="dashboard-bottom-text">{{ $t(allPlatformsDashboard.name) }}</span>
        </div>

        <!-- Dashboards by platform -->
        <div class="dashboard-section-text">
          {{ $t('By platform') }}
        </div>
        <!-- List of platforms -->
        <div class="horizontal wrap">
          <div class="dashboard-container clickable"v-for="dashboard in platformDashboards" :key="dashboard.id"
            v-on:click="() => { $gui.selectedDashboard = dashboard.id }"
            :class="$gui.selectedDashboard === dashboard.id ? 'dashboard-box-selected' : ''">
            <div class="dashboard-img-container">
              <img class="dashboard-img" :src="dashboard.image" alt="Dashboard image">
              <img class="dashboard-icon" :src="dashboard.icon" alt="Dashboard icon">
            </div>
            
            <span class="dashboard-bottom-text">{{ $t(dashboard.name) }}</span>
          </div>
        </div>




        

        <!-- Dashboards by variable -->

        <div class="divider-small"></div>

        <button>{{ $t('Download data') }}</button>

        <!-- Divider -->
        <div class="divider-small"></div>

        <!-- Providers and funding -->
        <div class="vertical" style="align-items: center;">
          <img src="../../Assets/Images/logos/logo-icatmar-negatiu.svg" alt="ICATMAR logo" class="icatmar-logo">
        </div>
        <div class="horizontal" style="justify-content: space-around;">
          <img src="../../Assets/Images/logos/generalitat.webp" alt="Generalitat logo" class="funding-logo">
          <img src="../../Assets/Images/logos/logo-ICM.svg" alt="ICM logo" class="funding-logo">
        </div>
        <div class="horizontal" style="justify-content: space-around;">
          <img src="../../Assets/Images/logos/logo-CSIC.png" alt="CSIC logo" class="funding-logo">
          <img src="../../Assets/Images/logos/logo-EU.svg" alt="EU logo" class="funding-logo">
        </div>

        <!-- About -->

      </div>
    </Transition>
  </div>
</template>

<script>
export default {
  name: "Menu",
  created() {
    
  },
  mounted() {
  },
  data (){
    return {
      nativeWindow: window
    }
  },
  methods: {
    //onclick: function(e){},
  },
  computed: {
    platformDashboards() {
      return this.$gui.dashboards.filter(d => d.type === 'platform');
    },
    allPlatformsDashboard() {
      return this.$gui.dashboards.find(d => d.id === 'platforms');
    }
  },
  components: {
  }
}
</script>

<style scoped>
.menu-container {
  position: fixed;
  width: 400px;
  right: 0;
  top: 0;
  bottom: 0;
  margin: 0;
  padding: 0;
  z-index: 1;
  background:var(--darkBlue);
}


.selected {
  background: var(--red);
  font-weight: bold;
  box-shadow: 0 0 4px black;
}

.info-links > button{
  background: none;
  border: none;
  text-decoration: underline;
  color: white;
  font-size: x-small;
}


.dashboard-container {
  width: 70px;
  display: flex;
  flex-direction: column;
  margin: 4px 15px;
}

.dashboard-img-container {
  position: relative;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dashboard-img {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  filter: brightness(0.8);
}

.dashboard-icon {
  width: 40%;
  z-index: 2;
  background: rgb(171 219 237 / 71%);
  border-radius: 50%;
}

.dashboard-section-text {
  font-size: x-small;
  margin: 30px 0px 5px 10px;
  color: var(--lightBlue);
}

.dashboard-bottom-text {
  font-size: x-small;
  text-align: center;
  padding-top: 2px;
}

.dashboard-box-selected > div > .dashboard-img {
  border: 2px solid var(--red);
  box-shadow: 0 0 4px var(--red);
  filter: brightness(1.2);
}

.dashboard-box-selected > .dashboard-bottom-text {
  background: var(--red);
  border-radius: 2px 2px 10px 10px;
  font-weight: bold;
  padding-left: 3px;
  padding-right: 3px;
  padding-bottom: 3px;
}


.icatmar-logo {
  width: 180px;
  height: auto;
  object-fit: contain;
  margin: 5px;
}

.funding-logo {
  width: 120px;
  height: auto;
  margin: 5px;
  object-fit: contain;
}






/* 1. The entering/leaving timing (The "Middle" State) */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: transform 0.5s ease-out, opacity 0.3s ease;
}

/* 2. The "From" state (Start of enter / End of leave) */
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(100%); /* Slide it off to the right */
  opacity: 0;
}

/* 3. The "To" state (End of enter / Start of leave) */
/* Optional: defaults to original CSS if not defined, 
   but good for clarity */
.slide-fade-enter-to,
.slide-fade-leave-from {
  transform: translateX(0);
  opacity: 1;
}
</style>