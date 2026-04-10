<template>
  <span class="bottom-section">
    <!-- Timeline -->
    <div class="timeline-container">

      <div class="timeline-content">

        <div class="vertical">
          <!-- Swith to full timeline -->
          <Transition name="scale-fade" mode="out-in">
            <button class="full-timeline-switch" key="fulltime" v-if="!isFullTimeline" @click="isFullTimeline = !isFullTimeline">2018 - now</button>
            <button class="full-timeline-switch" key="lastweek" v-else @click="isFullTimeline = !isFullTimeline">Lastest week</button>
          </Transition>
          <!-- Play button -->
          <button class="play-button"><span class="fa fa-play"></span></button>
        </div>

        

        <!-- Short timeline -->
        <ShortTimeline v-if="!isFullTimeline"></ShortTimeline>

        <!-- Full timeline -->
        <FullTimeline v-else></FullTimeline>

      </div>

    </div>
  </span>
</template>


<script>
import ShortTimeline from './ShortTimeline.vue';
import FullTimeline from './FullTimeline.vue';


export default {
  name: "Timeline",
  created() {
    
  },
  mounted() {
  },
  data (){
    return {
      isFullTimeline: false,
    }
  },
  methods: {
    //onclick: function(e){},
  },
  computed: {
    
  },
  components: {
    ShortTimeline,
    FullTimeline
  }
}
</script>




<style scoped>
.bottom-section {
  position: fixed;
  bottom: 0px;
  left: 0px;
  right: 0px;
  margin-right: 330px;
  background-color: yellow;
}

.timeline-container {
  position: relative;
  margin: 0 30px;
  padding: 0;
}

.timeline-content {
  max-width: 1800px;
  position: relative;
  width: 100%;
  padding: 0;
  margin: 0 auto;
  display: flex;
  flex-direction: row;
  align-items: flex-end;
}

.full-timeline-switch {
  margin-left: -16px;
  margin-bottom: 8px;

  width: 50px;
  height: 50px;
  font-size: x-small;
  border-radius: 50%;

  display: flex;
  align-items: center;
  justify-content: center;
}
.play-button {
  margin-right: 8px;
  margin-bottom: 8px;

  width: 30px;
  height: 30px;
  border-radius: 50%;

  display: flex;
  align-items: center;
  justify-content: center;
}


.timeline {
  width: calc(100%);
  background: var(--lightBlue);
  display: flex;
  flex-direction: column;
  position: relative;
  box-shadow: 0 0 4px black;
}


:deep(.timeline-slider) {
  position: absolute;
  width: 100%;
  height: 40px;
  opacity: 0; /* Make it invisible */
  cursor: pointer;
  z-index: 5;
}


:deep(.timeline-days-container) {
  display: flex;
  width: 100%;
}

:deep(.timeline-day) {
  display: flex;
  justify-content: center;
  border-right: solid 1px var(--blue);
  border-left: solid 1px var(--blue);
  font-size: small;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>