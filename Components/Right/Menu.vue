<template>
  <span>
    <Transition name="slide-fade">
      <div class="menu-container" v-show="$gui.isMenuOpen">

        <!-- Language selector -->
        <div class="horizontal" style="justify-content: space-around">
          <button v-for="(language, code) in $gui.languages" :key="code" v-on:click="() => { $gui.selectedLanguage = code }" :class="$gui.selectedLanguage === code ? 'selected':''">
            {{ language.name }}
          </button>
        </div>

        <!-- Divider -->
        <div class="divider"></div>

        <!-- Dashboards by platform -->
        <div class="vertical">
          <!-- Title -->
          <span>{{ $t('Platforms and devices') }}</span>
          <!-- List of platforms -->
          <div class="horizontal wrap">
            <button v-for="dashboard in $gui.dashboards" :key="dashboard.id"
              v-on:click="() => { $gui.selectedDashboard = dashboard.id }"
              :class="$gui.selectedDashboard === dashboard.id ? 'selected' : ''">
              <div class="vertical">
                <img :src="dashboard.icon" alt="Dashboard icon" class="dashboard-icon">
                <span>{{ $t(dashboard.name) }}</span>
              </div>
              
            </button>
          </div>


        </div>

        

        <!-- Dashboards by variable -->


        <!-- Divider -->
        <div class="divider"></div>

        <!-- Panels -->
        <div class="horizontal wrap">
          <button>{{ $t('About') }}</button>
          <button>{{ $t('Cookie consent') }}</button>
          <button>{{$t('Source code')}}</button>
          <button>{{ $t('Download data') }}</button>
        </div>

        <!-- Divider -->
        <div class="divider"></div>

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
  </span>
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
  background: lightblue;
  font-weight: bold;
  text-decoration: underline;
}

.dashboard-icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: 8px;
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