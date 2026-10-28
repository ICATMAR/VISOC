<template>
  <Transition name="slideBottom-fade">
    <!-- Vertical container -->
    <!-- The ids are what GUIManager.bottomCoveredPx measures -->
    <div id="dataTimelinePane" class="vertical datatimeline-pane-section" v-show="$gui.isDataTimelineOpen && !$gui.isMenuOpen">

      <!-- Cross and top-left icons -->
      <div><i class="clickable close-x close-x-position fa fa-xmark" v-on:click="() => { $gui.isDataTimelineOpen = false; $gui.isPlatformDetailOpen = false; $gui.selectedPlatform = null; }"></i></div>

      <!-- Data, timeline and bottom options (per dashboard) -->
      <DTContent></DTContent>

      <!-- Platform detail: a card floating above the timeline, or on short
           screens a slim full-width strip (pd-compact, see platformDetails.css) -->
      <Transition name="fade">
        <section id="platformDetailPane" class="platform-pane-container" :class="{ 'pd-compact': $gui.isShortScreen }" v-show="$gui.isPlatformDetailOpen">
          <DTPlatformDetail></DTPlatformDetail>
        </section>
      </Transition>

    </div>
  </Transition>
</template>


<script>
import DTPlatformDetail from './DTPlatformDetail.vue';
import DTContent from './DTContent.vue';

export default {
  name: "DataTimeline",
  components: {
    DTPlatformDetail,
    DTContent
  }
}

</script>


<style scoped>
.datatimeline-pane-section {
  align-self: flex-start;
  position: relative;
  pointer-events: auto;

  font-size: small;
}

.platform-pane-container {
  position: absolute;
  top: initial;
  height: initial;
  bottom: 100%;
  width: 600px;
  padding: 0;
  margin-left: 0;
  left: calc((100vw - 600px) / 2);
  /* Above the timeline content (drifter sticky cells use z-index up to 6) so
     overflowing MapCircleArrows labels are not covered by the timeline. */
  z-index: 10;
  background: var(--gray);
  border-radius: 10px 10px 0px 0px;

  /* horizontal | vertical | blur | spread | color */
  box-shadow: 0px -10px 10px -5px rgba(0, 0, 0, 0.5), /* Top shadow */
              -10px 0px 10px -5px rgba(0, 0, 0, 0.5), /* Left shadow */
              10px 0px 10px -5px rgba(0, 0, 0, 0.5);  /* Right shadow */
}

/* The strip spans the whole timeline. Square-cornered and shadowed only
   upward, since it sits flush on the timeline below. */
.platform-pane-container.pd-compact {
  left: 0;
  width: 100%;
  border-radius: 0;
  box-shadow: 0px -6px 8px -4px rgba(0, 0, 0, 0.5);
}

.close-x-position {
  position: absolute;
  top: -15px;
  left: 25px;
  /* Above the timeline content (drifter sticky cells use z-index up to 6). */
  z-index: 12;
}

</style>
