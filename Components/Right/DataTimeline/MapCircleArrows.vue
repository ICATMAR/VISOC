<template>
  <div class="map-arrows-circle">
    <div class="map-arrows-center"></div>

    <template v-for="(item, index) in items" :key="index">
      <!-- Variable name label -->
      <div class="variableName animatedLayer" :style="{
        rotate: (item.angle - 90) + 'deg',
        '--maxZIndex': items.length,
        '--duration': (items.length * loopInterval) + 's',
        '--delay': (-index * loopInterval) + 's'
        }">
        <span :style="{rotate: textRotation(item.angle), display: 'block'}">{{ $t(item.name) }}</span>
      </div>
      <!-- Variable value + arrow -->
      <div class="variableValue horizontal animatedLayer" :style="{
        rotate: (item.angle - 90) + 'deg',
        '--maxZIndex': items.length,
        '--duration': (items.length * loopInterval) + 's',
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
  props: {
    wind:    { type: Object, default: null }, // { speed: km/h, dir: degrees }
    waves:   { type: Object, default: null }, // { height: m,   dir: degrees }
    current: { type: Object, default: null }, // { speed: m/s,  dir: degrees }
  },
  data() {
    return {
      loopInterval: 2,
    }
  },
  methods: {
    textRotation(angle) {
      return angle > 180 ? '180deg' : '0deg';
    }
  },
  computed: {
    items() {
      const result = [];
      if (this.wind?.speed != null)
        result.push({ name: 'Wind', value: `${this.wind.speed.toFixed(0)} km/h`, angle: this.wind.dir ?? 0 });
      if (this.waves?.height != null)
        result.push({ name: 'Waves', value: `${this.waves.height.toFixed(1)} m`, angle: this.waves.dir ?? 0 });
      if (this.current?.speed != null)
        result.push({ name: 'Currents', value: `${this.current.speed.toFixed(2)} m/s`, angle: this.current.dir ?? 0 });
      return result;
    }
  },
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
}

.variableArrow {
  position: absolute;
  transform: translate(-80%) rotate(45deg);
  background: var(--blue);
  height: 10px;
  width: 10px;
  z-index: 0;
}

@property --maxZIndex {
  syntax: '<integer>';
  inherits: true;
  initial-value: 1;
}

@keyframes depthLoop {
  0%   { z-index: 0; }
  100% { z-index: var(--maxZIndex); }
}

.animatedLayer {
  animation: depthLoop var(--duration) infinite linear;
  animation-delay: var(--delay);
}
</style>
