<template>
  <Transition name="slide-fade">
    <span class="datatimeline-pane-section" v-show="$gui.isDataTimelineOpen && !$gui.isMenuOpen">

      

      <!-- Data and timeline panel with data -->
      <div class="datatimeline-pane-container">
        <div>Data and timeline</div>
        <button v-on:click="() => { $gui.isDataTimelineOpen = false }">Close data timeline</button>
        <button v-on:click="() => { $gui.isPlatformDetailOpen = true }">Open platform detail</button>
      </div>


      <!-- Platform detail -->
      <section class="platform-pane-container" v-show="$gui.isPlatformDetailOpen">
        <div>Map</div>
        <div>Platform name</div>
        <button v-on:click="() => { $gui.isPlatformDetailOpen = false }">Close platform detail</button>
      </section>


    </span>
  </Transition>
</template>

<style scoped>
.datatimeline-pane-section {
  align-self: flex-start;
  background: brown;
  position: relative;
}

.datatimeline-pane-container {
  margin: 0;
  padding: 0;
  left: 0;
  right: 0;
  width: 100vw;
  min-height: 100px;
  position: relative;
  pointer-events: auto;
  overflow: unset;
  -webkit-transition: margin-bottom .3s ease-in-out;
  transition: margin-bottom .3s ease-in-out;
}

.platform-pane-container {
  position: absolute;
  top: initial;
  height: initial;
  bottom: 100%;
  width: 750px;
  padding: 0;
  margin-left: 0;
  left: calc((100vw - 750px) / 2);
  background: orange;
}


/* 1. The entering/leaving timing (The "Middle" State) */
.slide-fade-enter-active {
  transition: transform 0.5s ease-out, opacity 0.3s ease;
}
.slide-fade-leave-active {
  transition: none;
}

/* 2. The "From" state (Start of enter / End of leave) */
.slide-fade-enter-from {
  transform: translateY(100%); /* Slide it off to the right */
  opacity: 0;
}

/* 3. The "To" state (End of enter / Start of leave) */
/* Optional: defaults to original CSS if not defined, 
   but good for clarity */
.slide-fade-enter-to{
  transform: translateY(0);
  opacity: 1;
}

</style>