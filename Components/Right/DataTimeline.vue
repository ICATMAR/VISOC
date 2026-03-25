<template>
  <Transition name="slide-fade">
    <span class="bottom-pane-section" v-show="$gui.isDataTimelineOpen && !$gui.isMenuOpen">
      <!-- Bottom panel with data -->
      <div class="bottom-pane-container">
        <div>Data and timeline</div>
        <button v-on:click="() => { $gui.isDataTimelineOpen = false }">Close data timeline</button>
      </div>
    </span>
  </Transition>
</template>

<style scoped>
.bottom-pane-section {
  align-self: flex-start;
  background: brown;
}

.bottom-pane-container {
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