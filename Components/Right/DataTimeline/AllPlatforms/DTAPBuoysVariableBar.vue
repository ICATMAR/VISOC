<template>
  <!-- Three siblings rather than one wrapper, so they become flex items of
       DTAllPlatforms' .bottom-bar directly: the trigger and the unit sit on
       the same row as the HFR currents/Buoys/Drifters tabs, while the options
       take a full row's width and so wrap onto their own line below (the bar
       is a wrapping flex container). -->
  <button class="clickable variable-trigger" @click="isOpen = !isOpen"
    :title="$t('Choose variable')">
    <span>{{ $t(selected.label) }}</span>
    <i class="fa-solid" :class="isOpen ? 'fa-angle-up' : 'fa-angle-down'"></i>
  </button>

  <!-- Units, in the app's usual "click me to change" styling. Switching is by
       QUANTITY, not by variable, so putting wind into knots here puts every
       wind reading in the app into knots - and nothing refetches, since only
       the drawing changes (see GUIManager.unitFor). -->
  <span class="variable-unit" :class="{ clickable: switchable }"
    :title="switchable ? $t('Change units') : ''"
    @click="switchable && $gui.cycleUnit(selected.code)">{{ unit.unit }}</span>

  <div v-if="isOpen" class="horizontal wrap variable-options">
    <button v-for="item in $gui.buoyVariables" :key="item.code" class="clickable"
      :class="{ 'selectedOption': item.code === $gui.selectedBuoyVariableCode }"
      @click="choose(item)"><span>{{ $t(item.label) }}</span></button>
  </div>
</template>


<script>

export default {
  name: "DTAPBuoysVariableBar",
  data() {
    return {
      isOpen: false,
    }
  },
  methods: {
    choose(item) {
      this.$gui.selectedBuoyVariableCode = item.code;
      this.isOpen = false;
    },
  },
  computed: {
    selected() {
      return this.$gui.selectedBuoyVariable;
    },
    // { unit, decimals, toDisplay } for whatever the user has picked
    unit() {
      return this.$gui.unitFor(this.selected.code);
    },
    switchable() {
      return this.$gui.isUnitSwitchable(this.selected.code);
    },
  },
}

</script>


<style scoped>
.variable-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.15);
  border: none;
  border-radius: 10px;
  padding: 0px 8px;
  margin-left: 10px;
  margin-right: 5px;
}

.variable-trigger:hover {
  background: rgba(0, 0, 0, 0.3);
}

.variable-trigger > i {
  font-size: 0.65rem;
}

.variable-unit {
  font-style: italic;
  align-self: center;
}

.variable-unit.clickable {
  text-decoration: underline;
  font-size: 0.7rem;
}

/* A full row of its own: .bottom-bar wraps, so a 100% basis pushes this
   below the tabs instead of squeezing in beside them. */
.variable-options {
  flex-basis: 100%;
  padding: 4px 0 0;
  gap: 4px;
}

.variable-options > button {
  border-radius: 10px;
  padding: 0px 12px;
  border: none;
  background: rgb(0 0 0 / 0%);
  font-size: small;
}

.variable-options > button:hover {
  background: rgba(0, 0, 0, 0.2);
}

.variable-options > button.selectedOption {
  background: var(--red);
  box-shadow: 0 0 4px black;
}
</style>
