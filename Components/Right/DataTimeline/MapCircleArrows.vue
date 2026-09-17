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
      <!-- Variable value + arrow. Painted with the variable's own colour
           legend (GUIManager.colorFor), the same scale the buoys timeline and
           the panel's value chips use, so one reading reads the same colour
           everywhere. The pointer takes the same colour as the chip, or they
           come apart. The legend's colours are pale, so the text goes black
           over them; a variable with no legend keeps the stylesheet's blue and
           its white text. -->
      <div class="variableValue horizontal animatedLayer" :style="{
        rotate: (item.angle - 90) + 'deg',
        '--maxZIndex': items.length,
        '--duration': (items.length * loopInterval) + 's',
        '--delay': (-index * loopInterval) + 's',
        background: item.color,
        color: item.color ? 'black' : undefined,
        textShadow: item.color ? 'none' : undefined
        }">
        <div class="variableArrow" :style="{ background: item.color }"></div>
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
    },
    // The magnitudes arrive STANDARD (see data/variables.js), so the unit they
    // are WRITTEN in is the user's choice, not this component's - switching
    // wind to knots anywhere switches these chips with it (GUIManager.unitFor).
    // They used to be hardcoded, which had the wind labelled km/h while
    // carrying m/s.
    format(code, value) {
      const { unit, decimals, toDisplay } = this.$gui.unitFor(code);
      return `${toDisplay(value).toFixed(decimals)} ${unit}`;
    },
  },
  computed: {
    // `color` is undefined for anything the legends don't cover, which leaves
    // the chip its stylesheet background rather than painting a guess over it.
    // The ranges in colorLegends.js are standard too, so the magnitudes go to
    // colorFor untouched - only format() converts.
    items() {
      const result = [];
      if (this.wind?.speed != null)
        result.push({ name: 'Wind', value: this.format('WSPD', this.wind.speed), angle: this.wind.dir ?? 0,
          color: this.$gui.colorFor('WSPD', this.wind.speed) });
      if (this.waves?.height != null)
        result.push({ name: 'Waves', value: this.format('VHM0', this.waves.height), angle: this.waves.dir ?? 0,
          color: this.$gui.colorFor('VHM0', this.waves.height) });
      if (this.current?.speed != null)
        result.push({ name: 'Currents', value: this.format('HCSP', this.current.speed), angle: (this.current.dir + 180) % 360 ?? 0,
          color: this.$gui.colorFor('HCSP', this.current.speed) });
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
  /* Center the circle on the map center (where the marker dot sits) */
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

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
  font-size: 0.7rem;
  padding-right: 6px;
  padding-left: 2px;
  border-radius: 0 5px 5px 0;
}

.variableValue {
  position: absolute;
  font-size: 0.7rem;
  transform: translateX(calc(-50% + 49px));
  background: var(--blue);
  padding-right: 2px;
  padding-left: 4px;
  border-radius: 0 4px 4px 0;
}
.variableValue > span {
  z-index: 1;
  color: black;
  text-shadow: none;
  font-weight: bold;
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
