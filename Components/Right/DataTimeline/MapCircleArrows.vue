<template>
  <div class="map-arrows-circle">
    <div class="map-arrows-center"></div>

    <template v-for="(item, index) in items" :key="index">
      <!-- Spoke: a hairline from the centre out to the chip, turned to the
           same bearing. -->
      <div class="variableSpoke" :style="{ rotate: (item.angle - 90) + 'deg' }"></div>
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
      <div class="variableValue horizontal animatedLayer" :title="item.title" :style="{
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
    // All magnitudes in STANDARD units (see data/variables.js); `from` is the
    // contributing sensors, as DTAPBuoys records them on selectedPlatform.
    wind:    { type: Object, default: null }, // { speed, dir, gust, from }
    waves:   { type: Object, default: null }, // { height, dir, period, from }
    current: { type: Object, default: null }, // { speed, dir, from }
    // `raw` on each: standard code -> the name the source published it under.
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
    format(code, value) {
      const { unit, decimals, toDisplay } = this.$gui.unitFor(code);
      return `${toDisplay(value).toFixed(decimals)} ${unit}`;
    },
    // The number alone. The chips ring a 100px circle, so a unit on each one
    // costs more room than it earns - and the reading is repeated with its
    // unit in the panel beside this, and in full in the tooltip below.
    number(code, value) {
      const { decimals, toDisplay } = this.$gui.unitFor(code);
      return toDisplay(value).toFixed(decimals);
    },
    // Everything behind one arrow, which is where the detail went when the
    // units came off the chips: each reading with its code, its unit, the
    // direction as the SOURCE recorded it (not the bearing the chip is
    // rotated to), and the instrument and server it all came from.
    //
    // `rows` are { label, code, value, bearing } - a bearing is printed in
    // degrees rather than run through a unit. `raw` is what each code was
    // published as (Puertos' 'Hm0' for VHM0), named alongside the standard
    // code because which spelling a value arrived as is the first thing worth
    // knowing when a number looks wrong. `from` is the contributing sensors,
    // one entry each, since an averaged cell can mix them.
    title(rows, from, raw) {
      const named = code => {
        const published = raw?.[code];
        return published && published !== code ? `${code}; ${published}` : code;
      };
      const lines = rows
        .filter(row => row.value != null && isFinite(row.value))
        .map(row => `${this.$t(row.label)} (${named(row.code)}): `
          + (row.bearing ? `${row.value.toFixed(0)}º` : this.format(row.code, row.value)));
      (from ?? []).forEach(({ sensor, instrument, source }) => {
        lines.push(`${this.$t('Sensor')}: ${sensor}${instrument ? ` (${instrument})` : ''}`);
        lines.push(`${this.$t('Source')}: ${source}`);
      });
      return lines.join('\n');
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
        result.push({ name: 'Wind', value: this.number('WSPD', this.wind.speed), angle: this.wind.dir ?? 0,
          color: this.$gui.colorFor('WSPD', this.wind.speed),
          title: this.title([
            { label: 'Wind speed', code: 'WSPD', value: this.wind.speed },
            { label: 'Direction',  code: 'WDIR', value: this.wind.dir, bearing: true },
            { label: 'Wind gust',  code: 'GSPD', value: this.wind.gust },
          ], this.wind.from, this.wind.raw) });
      if (this.waves?.height != null)
        result.push({ name: 'Waves', value: this.number('VHM0', this.waves.height), angle: this.waves.dir ?? 0,
          color: this.$gui.colorFor('VHM0', this.waves.height),
          title: this.title([
            { label: 'Wave height', code: 'VHM0',  value: this.waves.height },
            { label: 'Direction',   code: 'VMDR',  value: this.waves.dir, bearing: true },
            { label: 'Wave period', code: 'VTM02', value: this.waves.period },
          ], this.waves.from, this.waves.raw) });
      if (this.current?.speed != null)
        result.push({ name: 'Currents', value: this.number('HCSP', this.current.speed), angle: (this.current.dir + 180) % 360 ?? 0,
          color: this.$gui.colorFor('HCSP', this.current.speed),
          title: this.title([
            { label: 'Current speed', code: 'HCSP', value: this.current.speed },
            { label: 'Direction',     code: 'HCDT', value: this.current.dir, bearing: true },
          ], this.current.from, this.current.raw) });
      return result;
    }
  },
}

</script>

<style scoped>
.map-arrows-circle {
  position: absolute;
  z-index: 1;
  /* Named so the spoke can be a fraction of it instead of another magic
     number to keep in step with the size below. */
  --radius: 50px;
  width: calc(var(--radius) * 2);
  height: calc(var(--radius) * 2);
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

/* Laid out like everything else in here: the element sits at the circle's
   centre, `rotate` turns it about that centre, and the translate then pushes
   it outward along the turned axis - individual transform properties apply
   before `transform`, which is what makes that order work. translateX(50%)
   puts its inner end at the centre, so it reaches out by its own width. */
.variableSpoke {
  position: absolute;
  width: calc(var(--radius) * 0.9);
  height: 1px;
  background: white;
  opacity: 0.7;
  transform: translateX(50%);
  pointer-events: none;
  /* Behind every chip, not just its own. DOM order alone wouldn't do it: the
     spokes are interleaved with the chips, so the second item's spoke would
     paint over the first item's chip whenever that chip's cycling z-index came
     back round to 0. The circle sets z-index on itself, so it is a stacking
     context and this stays inside it - and the circle's own background is
     transparent, so there is nothing here for the line to disappear behind.
     The border sits at the full radius, past this line's 0.9 reach. */
  z-index: -1;
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
  border-radius: 4px;
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
