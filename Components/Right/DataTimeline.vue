<template>
  <Transition name="slideBottom-fade">
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


</style>