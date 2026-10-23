<template>
  <!-- Animation and data points - of the currents or of the radials -->
 <div class="horizontal wrap options-container">
    <OnOffButtonWithText :checked="$gui.hfrShowParticles" :text="$t('particle animation')" :inSize="'8px'"
      @toggle="$gui.hfrShowParticles = $event"></OnOffButtonWithText>
    <OnOffButtonWithText :checked="$gui.hfrShowGridPoints" :text="$t('data points')" :inSize="'8px'"
      @toggle="$gui.hfrShowGridPoints = $event"></OnOffButtonWithText>

  </div>


  <div class="filled-container">
    <!-- Currents or radials -->
    <div class="horizontal wrap button-group">
      <button class="clickable" :class="{ 'selectedOption': $gui.hfrProduct == 'currents' }"
        @click="$gui.hfrProduct = 'currents'"><span>{{ $t('Currents') }}</span></button>
      <button class="clickable" :class="{ 'selectedOption': $gui.hfrProduct == 'radials' }"
        @click="$gui.hfrProduct = 'radials'"><span>{{ $t('Radials') }}</span></button>
    </div>

    <!-- Radials: each station on/off (those the map can draw now), and
         all points or only those no QC test flagged -->
    <Transition name="slideBottom-fade">
      <div class="vertical" v-if="$gui.hfrProduct == 'radials'">
        <!-- Under each network's code; past RADIALS_BY_NETWORK stations in
             view, one toggle per network instead of one per station -->
        <div class="horizontal wrap options-container" v-if="radialsByNetwork">
          <OnOffButtonWithText v-for="group in radialGroups" :key="group.network"
            :checked="!isNetworkHidden(group.network)" :text="`${shortNetwork(group.network)} (${group.stations.length})`" :inSize="'8px'"
            :title="`${group.network}: ${group.stations.map(s => s.id).join(', ')}`"
            @toggle="toggleNetwork(group.network, $event)"></OnOffButtonWithText>
        </div>
        <div class="vertical radial-groups" v-else>
          <div class="radial-group" v-for="group in radialGroups" :key="group.network">
            <span class="radial-network">{{ group.network }}</span>
            <div class="horizontal wrap options-container">
              <OnOffButtonWithText v-for="station in group.stations" :key="station.key"
                :checked="!isStationHidden(station)" :text="station.id" :inSize="'8px'"
                :title="station.key" @toggle="toggleShowRadial(station, $event)"></OnOffButtonWithText>
            </div>
          </div>
        </div>
        <div class="horizontal wrap options-container">
          <OnOffButtonWithText :checked="$gui.hfrRadialsValidOnly" :text="$t('Non-flagged QC points')" :inSize="'8px'"
            :title="$t('On: only the points no QC test flagged. Off: all points.')"
            @toggle="$gui.hfrRadialsValidOnly = $event"></OnOffButtonWithText>
        </div>
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
    <div class="field-status" v-if="$gui.hfrProduct === 'radials'">
      <template v-if="$gui.hfrRadialStatus.state === 'loading'">
        <span class="spinner-border field-spinner"></span>{{ $t('Loading') }}
      </template>
      <template v-else-if="$gui.hfrRadialStatus.state === 'ok'">
        {{ $t('Radials') }} · {{ $gui.hfrRadialStatus.count }} {{ $t('stations') }} · {{ formatTime($gui.hfrRadialStatus.time) }}
      </template>
      <template v-else>{{ $t('No radials at') }} {{ formatTime($gui.hfrRadialStatus.time) }}</template>
    </div>
    <div class="field-status" v-else>
      <template v-if="$gui.hfrFieldStatus.state === 'loading'">
        <span class="spinner-border field-spinner"></span>{{ $t('Loading') }}
      </template>
      <!-- Where the map is from, linking to it (the ERDDAP dataset's page,
           the GitHub or static file) -->
      <template v-else-if="$gui.hfrFieldStatus.state === 'ok'">
        <a v-if="$gui.hfrFieldStatus.url" class="field-status-link" :href="$gui.hfrFieldStatus.url"
          target="_blank" rel="noopener" :title="$gui.hfrFieldStatus.url">
          {{ $gui.hfrFieldStatus.label }} · {{ formatTime($gui.hfrFieldStatus.time) }}
        </a>
        <template v-else>{{ $gui.hfrFieldStatus.label }} · {{ formatTime($gui.hfrFieldStatus.time) }}</template>
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

// Past this many stations in view, the radials are switched on and off by
// network rather than station by station
const RADIALS_BY_NETWORK = 15;

export default {
  props: {
  },
  created() {
  },
  mounted() {

  },

  data() {
    return {
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
    // Radials switched off: station keys, and 'net:<network>' for a whole
    // network (see GUIManager.hfrRadialHidden)
    isNetworkHidden(network) {
      return this.$gui.hfrRadialHidden.includes(`net:${network}`);
    },
    isStationHidden(station) {
      return this.isNetworkHidden(station.network) || this.$gui.hfrRadialHidden.includes(station.key);
    },
    toggleShowRadial(station, isOn) {
      let hidden = this.$gui.hfrRadialHidden.filter(k => k !== station.key);
      // Back on in a network that was off as a whole: only this one comes back
      if (isOn && this.isNetworkHidden(station.network)) {
        const others = this.$gui.hfrRadialStations.filter(s => s.network === station.network && s.key !== station.key).map(s => s.key);
        hidden = [...hidden.filter(k => k !== `net:${station.network}`), ...others];
      }
      this.$gui.hfrRadialHidden = isOn ? hidden : [...hidden, station.key];
    },
    toggleNetwork(network, isOn) {
      const hidden = this.$gui.hfrRadialHidden.filter(k => k !== `net:${network}` && !k.startsWith(`${network}:`));
      this.$gui.hfrRadialHidden = isOn ? hidden : [...hidden, `net:${network}`];
    },
    shortNetwork(network) {
      return network.replace(/^HFR-/, '');
    },
  },
  computed: {
    // The stations in view, by network, in the order they come (north to south)
    radialGroups() {
      const groups = new Map();
      this.$gui.hfrRadialStations.forEach(station => {
        if (!groups.has(station.network)) groups.set(station.network, { network: station.network, stations: [] });
        groups.get(station.network).stations.push(station);
      });
      return [...groups.values()];
    },
    radialsByNetwork() {
      return this.$gui.hfrRadialStations.length > RADIALS_BY_NETWORK;
    },
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

/* Radial toggles under each network's code */
.radial-groups {
  gap: 2px;
  padding-top: 4px;
}
.radial-network {
  padding: 0 5px;
  font-size: 0.6rem !important;
  opacity: 0.7;
  letter-spacing: 0.03em;
}
.radial-group .options-container {
  padding-top: 2px;
}

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
  text-wrap: wrap;
}

.field-status-link {
  color: inherit;
  text-decoration: none;
}
.field-status-link:hover {
  text-decoration: underline;
}

.field-spinner {
  width: 10px;
  height: 10px;
  border-width: 2px;
}

</style>