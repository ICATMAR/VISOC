<template>
  <div class="map-arrows-circle">
    <div class="map-arrows-center"></div>

    <!-- Variable name -->
    <template v-for="(item, index) in data" :key="index">
      <div class="variableName animatedLayer" :style="{
        rotate: (item.angle - 90) + 'deg',
        '--maxZIndex': data.length,
        '--duration': (data.length * loopInterval) + 's',
        '--delay': (-index * loopInterval) + 's'
        }">
        <span :style="{rotate: textRotation(item.angle), display: 'block'}">{{ $t(item.name) }}</span>
      </div>
      <!-- Variable value -->
      <div class="variableValue horizontal animatedLayer" :style="{
        rotate: (item.angle - 90) + 'deg',
        '--maxZIndex': data.length,
        '--duration': (data.length * loopInterval) + 's',
        '--delay': (-index * loopInterval) + 's'
        }">
        <div class="variableArrow"></div>
        <span :style="{rotate: textRotation(item.angle), display: 'block'}">{{ item.value }}</span>
      </div>
    </template>


  </div>
</template>

<script>

export default {
  name: "MapCircleArrows",
  created() {
    
  },
  mounted() {
  },
  data (){
    return {
      loopInterval: 2,
      data: [
        {
          name: 'Wind',
          value: '15kn',
          angle: 185,
        },
        {
          name: 'Waves',
          value: '1.5m, 4s',
          angle: 190,
        },
        {
          name: 'Currents',
          value: '0.5m/s',
          angle: 180,
        }
      ],
    }
  },
  methods: {
    //onclick: function(e){},
    textRotation(angle) {
      return angle > 180 ? '180deg' : '0deg';
    }
  },
  computed: {
    
  },
  components: {
    
  }
}

</script>

<style scoped>
.map-arrows-circle {
  position: absolute;
  z-index: 1;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 1px solid #ffffff6b;
  top: 25%;
  right: 25%;

  display: flex;
  align-items: center;
  justify-content: center;
}

.map-arrows-center {
  background: #ffffffda;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.variableName {
  position: absolute;
  transform: translateX(calc(50% + 52px));
  background: var(--darkBlue);
  font-size: x-small;
  padding-right: 6px;
  padding-left: 2px;
  border-radius: 0 5px 5px 0;
}

.variableValue {
  position: absolute;
  transform: translateX(calc(-50% + 49px));
  background: var(--blue);
  font-size: x-small;
  padding-right: 2px;
  padding-left: 4px;
  border-radius: 0 4px 4px 0;
}
.variableValue > span {
  z-index: 1;
  /* Reverse the rotation so text stays horizontal */
  transform: rotate(calc(-1 * var(--direction)));
}

.variableArrow {
  position: absolute;
  transform: translate(-80%) rotate(45deg);
  background: var(--blue);
  height: 10px;
  width: 10px;
  z-index: 0;
}


/* Register the custom property so it works inside @keyframes */
@property --maxZIndex {
  syntax: '<integer>';
  inherits: true;
  initial-value: 1;
}

@keyframes depthLoop {
  0% {
    z-index: 0;
  }
  100% {
    z-index: var(--maxZIndex);
  }
}

.animatedLayer {
  /* position: absolute; */
  animation: depthLoop var(--duration) infinite linear;
  animation-delay: var(--delay);
}

</style>