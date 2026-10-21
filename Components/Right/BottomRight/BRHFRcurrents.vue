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
       so a particle's colour reads the same as a cell's. The unit is written
       inside the bar and switches app-wide, like every unit. -->
  <div class="filled-container legend-container">
    <div class="legend-row">
      <DTColorLegend code="HCSP" :range="$gui.rangeFor('HCSP')" :showUnit="true" :fullWidth="true"></DTColorLegend>
    </div>
    <!-- Which map is on the screen, and what is under the cursor -->
    <div class="field-status">
      <template v-if="$gui.hfrFieldStatus.state === 'loading'">
        <span class="spinner-border field-spinner"></span>{{ $t('Loading') }}
      </template>
      <template v-else-if="$gui.hfrFieldStatus.state === 'ok'">
        {{ $gui.hfrFieldStatus.label }} · {{ formatTime($gui.hfrFieldStatus.time) }}
      </template>
      <template v-else>{{ $t('No HF radar data at') }} {{ formatTime($gui.hfrFieldStatus.time) }}</template>
    </div>
    <div class="field-status cursor-status" v-if="$gui.hfrCursor">
      <span>{{ formatPosition($gui.hfrCursor) }}</span>
      <!-- The value as the map draws a platform's: a chip on the legend's
           colour, with the arrow - the unit is on the legend above -->
      <CurrentChip v-if="$gui.hfrCursor.speed != null" :speed="$gui.hfrCursor.speed"
        :direction="$gui.hfrCursor.direction" :label="$gui.hfrCursor.network"></CurrentChip>
      <span v-else class="cursor-no-data">· {{ $t('no data') }}</span>
    </div>
  </div>

</template>

<script>
// Import components
import OnOffButton from '../../Utils/OnOffButton.vue';
import OnOffButtonWithText from '../../Utils/OnOffButtonWithText.vue';
import DTColorLegend from '../DataTimeline/Shared/DTColorLegend.vue';
import CurrentChip from '../../Map/CurrentChip.vue';

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
      radials: ['CNET', 'CREU', 'BEGU', 'TOSS', 'AREN', 'PBCN', 'GNST', 'SCAL', 'SALO', 'ALFA', 'VINA'],
    }
  },
  methods: {
    //onclick: function(e){},
    // 41.38ºN 2.17ºE
    formatPosition({ lon, lat }) {
      return `${Math.abs(lat).toFixed(2)}º${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}º${lon >= 0 ? 'E' : 'W'}`;
    },
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
    CurrentChip,
  }
}
</script>

<style scoped>

.legend-row {
  margin: 5px 12px 0;
}

.cursor-status {
  margin-top: 0;
}
.cursor-status .current-chip {
  box-shadow: none;
}
.cursor-no-data {
  opacity: 0.6;
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

</style>