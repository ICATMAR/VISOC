<template>
  <Transition name="slideBottom-fade">
    <!-- Vertical container -->
    <div class="vertical datatimeline-pane-section" v-show="$gui.isDataTimelineOpen && !$gui.isMenuOpen">

      <!-- Cross and top-left icons -->
      <div><i class="clickable close-x close-x-position fa fa-xmark" v-on:click="() => { $gui.isDataTimelineOpen = false }"></i></div>

      <!-- Data, timeline and bottom options (per dashboard) -->
      <DTContent></DTContent>

      <!-- Platform detail -->
      <Transition name="fade">
        <section class="platform-pane-container" v-show="$gui.isPlatformDetailOpen">
          <PlatformDetail></PlatformDetail>
        </section>
      </Transition>

    </div>
  </Transition>
</template>


<script>
import PlatformDetail from './PlatformDetail.vue';
import DTContent from './DTContent.vue';

export default {
  name: "DataTimeline",
  components: {
    PlatformDetail,
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
  background: var(--gray);
  border-radius: 10px 10px 0px 0px;

  /* horizontal | vertical | blur | spread | color */
  box-shadow: 0px -10px 10px -5px rgba(0, 0, 0, 0.5), /* Top shadow */
              -10px 0px 10px -5px rgba(0, 0, 0, 0.5), /* Left shadow */
              10px 0px 10px -5px rgba(0, 0, 0, 0.5);  /* Right shadow */
}

.close-x-position {
  position: absolute;
  top: -15px;
  left: 25px;
}

</style>
