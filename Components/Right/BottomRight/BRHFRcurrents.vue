<template>
  <!-- Animation -->
 <div class="horizontal wrap options-container">
    <OnOffButtonWithText :checked="$gui.hfrShowParticles" :text="$t('particle animation')" :inSize="'8px'"
      @toggle="$gui.hfrShowParticles = $event"></OnOffButtonWithText>
    <OnOffButtonWithText :checked="$gui.hfrShowGridPoints" :text="$t('data points')" :inSize="'8px'"
      @toggle="$gui.hfrShowGridPoints = $event"></OnOffButtonWithText>

  </div>


  <div class="filled-container">
    <!-- Currents or radials -->
    <div class="horizontal wrap button-group">
      <button class="clickable" :class="{ 'selectedOption': selectedHFRProduct == 'currents' }"
        @click="selectedHFRProduct = 'currents'"><span>{{ $t('Currents') }}</span></button>
      <button class="clickable" :class="{ 'selectedOption': selectedHFRProduct == 'radials' }"
        @click="selectedHFRProduct = 'radials'"><span>{{ $t('Radials') }}</span></button>
    </div>

    <!-- Radial antennas on/off -->
    <Transition name="slideBottom-fade">
      <div class="horizontal wrap options-container" v-if="selectedHFRProduct == 'radials'">
        <OnOffButtonWithText v-for="radial in radials" :key="radial" :checked="true" :text="$t(radial)" :inSize="'8px'"
          @change="toggleShowRadial($event, radial)"></OnOffButtonWithText>
      </div>
    </Transition>


  </div>

  <div class="filled-container">
    <!-- On/Off options -->
    <div class="horizontal wrap options-container">
      <OnOffButtonWithText ref="toggleShowBuoys" :checked="$gui.hfrShowBuoys" :text="$t('buoys')" :inSize="'8px'"
        :loading="$gui.hfrShowBuoys && $gui.hfrBuoysLoading"
        @toggle="$gui.hfrShowBuoys = $event"></OnOffButtonWithText>
      <OnOffButtonWithText ref="toggleShowDrifters" :checked="$gui.hfrShowDrifters" :text="$t('drifters')" :inSize="'8px'"
        @toggle="$gui.hfrShowDrifters = $event"></OnOffButtonWithText>
    </div>
  </div>

  <!-- Data source -->
  <div class="filled-container">
    <div class="horizontal wrap button-group">
      <button class="clickable" :class="{ 'selectedOption': $gui.hfrSource == 'ICATMAR' }"
        @click="$gui.hfrSource = 'ICATMAR'"><span>{{ $t('ICATMAR') }}</span></button>
      <button class="clickable" :class="{ 'selectedOption': $gui.hfrSource == 'EU' }"
        @click="$gui.hfrSource = 'EU'"><span>{{ $t('EU HFR Node') }}</span></button>
      <!-- <OnOffButtonWithText ref="toggleExternalSources" :checked="false" :text="$t('EU HFR Node data')" :inSize="'8px'"
      @change="toggleExternalSources($event)"></OnOffButtonWithText> -->
    </div>
  </div>


  <!-- Colour bar: the same current-speed scale as the timelines and chips,
       so a particle's colour reads the same as a cell's. The unit beside it
       switches app-wide, like every unit. -->
  <div class="filled-container legend-container">
    <div class="horizontal legend-row">
      <span class="legend-holder"><DTColorLegend code="HCSP" :range="$gui.rangeFor('HCSP')"></DTColorLegend></span>
      <span class="legend-unit" :class="{ clickable: $gui.isUnitSwitchable('HCSP') }"
        :title="$t('Click to change units')" @click="$gui.cycleUnit('HCSP')">{{ $gui.unitFor('HCSP').unit }}</span>
    </div>
    <!-- Which map is on the screen -->
    <div class="field-status">
      <template v-if="$gui.hfrFieldStatus.state === 'loading'">
        <span class="spinner-border field-spinner"></span>{{ $t('Loading') }}
      </template>
      <template v-else-if="$gui.hfrFieldStatus.state === 'ok'">
        {{ $gui.hfrFieldStatus.label }} · {{ formatTime($gui.hfrFieldStatus.time) }}
      </template>
      <template v-else>{{ $t('No HF radar data at') }} {{ formatTime($gui.hfrFieldStatus.time) }}</template>
    </div>
  </div>

</template>

<script>
// Import components
import OnOffButton from '../../Utils/OnOffButton.vue';
import OnOffButtonWithText from '../../Utils/OnOffButtonWithText.vue';
import DTColorLegend from '../DataTimeline/Shared/DTColorLegend.vue';

export default {
  props: {
  },
  created() {
  },
  mounted() {

  },

  data() {
    return {
      selectedHFRProduct: 'currents',
      radials: ['CNET', 'CREU', 'BEGU', 'TOSS', 'AREN', 'PBCN', 'GNST', 'SCAL'],
    }
  },
  methods: {
    //onclick: function(e){},
    // The map's hour, in the timeline's time zone
    formatTime(time) {
      if (!time) return '';
      const options = { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      if (!this.$gui.timelineUseLocalTime) options.timeZone = 'UTC';
      return new Date(time).toLocaleString(this.$i18n.locale, options) + (this.$gui.timelineUseLocalTime ? '' : ' UTC');
    },
    toggleExternalSources(e) {
      this.$emit('toggleExternalSources');
    },
    toggleShowRadial(e, radial) {
      this.$emit('toggleShowRadial', radial);
    }
  },
  components: {
    OnOffButton,
    OnOffButtonWithText,
    DTColorLegend,
  }
}
</script>

<style scoped>

.legend-row {
  align-items: center;
  gap: 8px;
  margin: 5px 12px 0;
}

/* Not a class of DTColorLegend's own (it has a .legend-scale inside) */
.legend-holder {
  display: flex;
  flex: 1;
  min-width: 0;
}

/* Like every unit in the app: quieter than its value, underlined where a
   click switches it */
.legend-unit {
  font-size: 0.7rem;
  font-style: italic;
  opacity: 0.8;
}
.legend-unit.clickable {
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.field-status {
  font-size: 0.7rem;
  opacity: 0.8;
  margin: 4px 12px 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-spinner {
  width: 10px;
  height: 10px;
  border-width: 2px;
}

.colorbar {
  height: 15px;
  margin: 5px 20px;
  background: linear-gradient(to right, blue, cyan, green, yellow, red);
  border-radius: 10px;
  box-shadow: 0 0 2px black;
}

.legend-numbers {
  display: flex;
  flex-wrap: nowrap;
  flex-direction: row;
  justify-content: space-between;
  margin: 0px 20px;
}

</style>