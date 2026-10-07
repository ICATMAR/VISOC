<template>
  <div class="info-section horizontal">

    <!-- HFR individual station -->
    <template v-if="hfrStation">
      <div class="photo-col">
        <div class="photo-fallback"><img :src="radarIconURL" class="fallback-icon" alt=""></div>
        <div class="station-photo" :style="{ backgroundImage: 'url(\'' + stationPhotoURL + '\')' }"></div>
      </div>
      <div class="info-col vertical" :style="institutionBgStyle">
        <div class="info-header">
          <span class="info-abbr">{{ hfrStation.id }}</span>
          <span class="info-sep">·</span>
          <span class="info-name">{{ hfrStation.name }}</span>
        </div>
        <div class="info-rows">
          <div class="info-row">
            <span class="info-label">Platform type</span>
            <span class="info-value">High-frequency radar station</span>
          </div>
          <div class="info-row">
            <span class="info-label">Institution</span>
            <a :href="hfrOwner.url" target="_blank" rel="noopener" class="info-link">{{ hfrOwner.name }}</a>
          </div>
          <div class="info-row">
            <span class="info-label">Manufacturer</span>
            <span class="info-value">{{ network.manufacturer }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Frequency</span>
            <span class="info-value">{{ network.frequency }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Installed</span>
            <span class="info-value">{{ formatInstallDate(hfrStation.installed) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Last calibration</span>
            <span class="info-value">{{ formatInstallDate(hfrStation.lastCalibration) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">License</span>
            <a :href="network.licenseUrl" target="_blank" rel="noopener" class="info-link">{{ network.licenseLabel }}</a>
          </div>
        </div>
      </div>
    </template>

    <!-- HFR totals / network (no specific station selected) -->
    <template v-else-if="isHFRContext">
      <div class="info-col vertical" :style="[{ paddingLeft: '12px' }, institutionBgStyle]">
        <div class="info-header">
          <span class="info-abbr">TOTALS</span>
          <span class="info-sep">·</span>
          <span class="info-name">HF Radar Network</span>
        </div>
        <div class="info-rows">
          <div class="info-row">
            <span class="info-label">Platform type</span>
            <span class="info-value">High-frequency radar network</span>
          </div>
          <div class="info-row">
            <span class="info-label">Institution</span>
            <a href="https://icatmar.cat" target="_blank" rel="noopener" class="info-link">ICATMAR</a>
          </div>
          <div class="info-row">
            <span class="info-label">Manufacturer</span>
            <span class="info-value">{{ network.manufacturer }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Frequency</span>
            <span class="info-value">{{ network.frequency }}</span>
          </div>
          <div class="info-row" v-if="activeStations != null">
            <span class="info-label">Active stations</span>
            <span class="info-value">{{ activeStations }} / {{ totalStations }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">License</span>
            <a :href="network.licenseUrl" target="_blank" rel="noopener" class="info-link">{{ network.licenseLabel }}</a>
          </div>
        </div>
      </div>
    </template>

    <!-- Buoy individual station -->
    <template v-else-if="buoyStation">
      <div class="photo-col">
        <div class="photo-fallback"><img :src="buoyIconURL" class="fallback-icon" alt=""></div>
        <div class="station-photo" :style="{ backgroundImage: 'url(\'' + buoyStationPhotoURL + '\')' }"></div>
      </div>
      <div class="info-col vertical" :style="institutionBgStyle">
        <div class="info-header">
          <span class="info-abbr">{{ buoyStation.id }}</span>
          <span class="info-sep">·</span>
          <span class="info-name">{{ buoyStation.name }}</span>
        </div>
        <div class="info-rows">
          <div class="info-row">
            <span class="info-label">Platform type</span>
            <span class="info-value">Meteo-oceanographic moored buoy</span>
          </div>
          <!-- One entry per institution: a buoy can be run by more than one
               (SOMO is 'ICATMAR / ICM-CSIC'), each linked where we know the
               address. -->
          <div class="info-row" v-if="buoyInstitutions.length">
            <span class="info-label">Institution</span>
            <span class="info-value">
              <template v-for="(inst, index) in buoyInstitutions" :key="inst.name">
                <span v-if="index"> / </span>
                <a v-if="inst.url" :href="inst.url" target="_blank" rel="noopener" class="info-link">{{ inst.name }}</a>
                <span v-else>{{ inst.name }}</span>
              </template>
            </span>
          </div>
          <!-- Whole metres: the unit group's one decimal is right for a sensor
               depth and noise on a water column. -->
          <!-- Same wording and same copy button as the platform detail's
               header, so a position reads and copies identically in both. -->
          <div class="info-row" v-if="buoyCoords">
            <span class="info-label">Position</span>
            <span class="info-value info-coords">{{ buoyCoords }}
              <button class="pd-copy-btn clickable" @click="copyBuoyCoords" :title="$t('Copy coordinates')">
                <i class="fa fa-copy"></i>
              </button>
            </span>
          </div>
          <div class="info-row" v-if="buoyStation.depth != undefined">
            <span class="info-label">Depth</span>
            <span class="info-value">{{ amount('DEPTH', buoyStation.depth, 0) }}
              <span class="info-unit" :class="{ clickable: $gui.isUnitSwitchable('DEPTH') }"
                :title="$gui.isUnitSwitchable('DEPTH') ? $t('Change units') : ''"
                @click="cycleUnit('DEPTH')">{{ unitOf('DEPTH') }}</span></span>
          </div>
          <div class="info-row" v-if="buoyStation.distanceToCoast != undefined">
            <span class="info-label">Distance to coast</span>
            <span class="info-value">{{ amount('DISTCOAST', buoyStation.distanceToCoast) }}
              <span class="info-unit" :class="{ clickable: $gui.isUnitSwitchable('DISTCOAST') }"
                :title="$gui.isUnitSwitchable('DISTCOAST') ? $t('Change units') : ''"
                @click="cycleUnit('DISTCOAST')">{{ unitOf('DISTCOAST') }}</span></span>
          </div>
          <div class="info-row" v-if="buoyStation.installed">
            <span class="info-label">Installed</span>
            <span class="info-value">{{ formatInstallDate(buoyStation.installed) }}</span>
          </div>
          <div class="info-row" v-if="buoyStation.license">
            <span class="info-label">License</span>
            <a v-if="buoyLicenseUrl" :href="buoyLicenseUrl" target="_blank" rel="noopener" class="info-link">{{ buoyStation.license }}</a>
            <span v-else class="info-value">{{ buoyStation.license }}</span>
          </div>
          <!-- Who to credit, and how to cite. Several sentences long where
               every other value is a word or two, so this one is capped and
               wraps (see .info-ack). -->
          <div class="info-row" v-if="buoyAcknowledgement">
            <span class="info-label">Acknowledgement</span>
            <span class="info-value info-ack">{{ buoyAcknowledgement }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Drifter -->
    <template v-else-if="drifterStation">
      <div class="photo-col">
        <div class="photo-fallback"><img :src="drifterIconURL" class="fallback-icon" alt=""></div>
        <div class="station-photo" :style="{ backgroundImage: 'url(\'' + drifterStationPhotoURL + '\')' }"></div>
      </div>
      <div class="info-col vertical" :style="institutionBgStyle">
        <div class="info-header">
          <span class="info-abbr">{{ drifterStation.id }}</span>
          <span class="info-sep">·</span>
          <span class="info-name">{{ drifterStation.exercise }}</span>
        </div>
        <div class="info-rows">
          <div class="info-row">
            <span class="info-label">Platform type</span>
            <span class="info-value">Lagrangian drifter</span>
          </div>
          <div class="info-row">
            <span class="info-label">Type</span>
            <span class="info-value">{{ drifterStation.type }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Deployment ID</span>
            <span class="info-value">{{ drifterStation.deploymentId }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Drifter ID</span>
            <span class="info-value">{{ drifterStation.id }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Project</span>
            <span class="info-value">{{ drifterStation.project }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Exercise</span>
            <span class="info-value">{{ drifterStation.exercise }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Institution</span>
            <a href="https://icatmar.cat" target="_blank" rel="noopener" class="info-link">ICATMAR</a>
          </div>
          <div class="info-row">
            <span class="info-label">Depth</span>
            <span class="info-value">{{ drifterStation.depth > 0 ? drifterStation.depth + ' m' : 'Surface' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date deployment</span>
            <span class="info-value">{{ formatInstallDate(drifterStation.deployDate) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Fallback -->
    <template v-else>
      <span class="info-placeholder">Select a platform for details</span>
    </template>

  </div>
</template>


<script>
// Everything the view needs about an institution: where to link its name, the
// logo washed into the panel background, and the filter that turns that logo
// white. Here rather than in the catalogue - it is a display concern, and
// `institution` there is free text several buoys share.
//
// The PNGs are dark artwork on transparency, so inverting them is enough.
// logo-PdE.svg is full colour, which an invert alone would turn into a
// different colour rather than white - saturate(0%) strips the colour first.
const DEFAULT_LOGO_FILTER = 'invert(1)';
const INSTITUTIONS = {
  'ICATMAR':  { url: 'https://icatmar.cat',          logo: './Assets/Images/institutions/ICATMAR.png' },
  'ICM-CSIC': { url: 'https://www.icm.csic.es',      logo: './Assets/Images/institutions/ICM-CSIC.png' },
  'CEFREM':   { url: 'https://cefrem.univ-perp.fr/', logo: './Assets/Images/institutions/CEFREM.png' },
  'Puertos del Estado': {
    url: 'https://www.puertos.es',
    logo: './Assets/Images/logos/logo-PdE.svg',
    filter: 'saturate(0%) hue-rotate(78deg) brightness(200%) contrast(102%)',
  },
};

// 'ICATMAR / ICM-CSIC' -> ['ICATMAR', 'ICM-CSIC']. The catalogue writes joint
// ownership with a slash, and each half is its own organisation.
const institutionsOf = value =>
  String(value ?? '').split('/').map(name => name.trim()).filter(Boolean);

const LICENSE_URLS = {
  'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
};

export default {
  name: "DTInfoSection",
  // The buoy catalogue, static first (synchronous, so a buoy already selected
  // resolves immediately) then refined once the live sources merge in - the
  // same two-step every other buoy view uses.
  created() {
    this.buoys = this.$dataService.buoys.getBuoys();
    this.$dataService.buoys.loadBuoys()
      .then(buoys => { this.buoys = buoys; })
      .catch(error => console.error('Error loading buoys for the info section:', error));
  },
  data() {
    return {
      radarIconURL: './Assets/Icons/radar.svg',
      buoyIconURL: './Assets/Icons/buoy.svg',
      driftIconURL: './Assets/Icons/drifter.svg',
      codeIconURL: './Assets/Icons/code.svg',
      svpIconURL: './Assets/Icons/svp.svg',
      buoys: [],
    }
  },
  computed: {
    stationPhotoURL() {
      return './Assets/Images/platforms/HFR/' + (this.hfrStation?.id ?? '') + '.jpg';
    },
    buoyStationPhotoURL() {
      return './Assets/Images/platforms/Buoys/' + (this.buoyStation?.id ?? '') + '.jpg';
    },
    drifterStationPhotoURL() {
      return './Assets/Images/platforms/Drifters/' + (this.drifterStation?.type ?? '') + '.jpg';
    },
    isHFRContext() {
      return this.$gui.selectedDashboard === 'hfr'
        || (this.$gui.selectedDashboard === 'platforms' && this.$gui.timelineDashboardId === 'hfr');
    },
    hfrStation() {
      if (!this.isHFRContext) return null;
      const id = this.$gui.selectedPlatform?.stationId;
      if (!id || id === 'TOTALS') return null;
      return this.$requests.getHFRStation(id);
    },
    hfrOwner() {
      const key = this.hfrStation?.owner ?? 'ICATMAR';
      return this.$requests.hfrOwners[key] ?? { name: key, url: '#' };
    },
    network() {
      return this.$requests.hfrNetwork;
    },
    activeStations() {
      return this.$gui.selectedPlatform?.activeStations ?? null;
    },
    totalStations() {
      return this.$requests.hfrStations.length;
    },
    isBuoyContext() {
      return this.$gui.selectedDashboard === 'buoys'
        || (this.$gui.selectedDashboard === 'platforms' && this.$gui.timelineDashboardId === 'buoys');
    },
    // The real catalogue (DPBuoys), not RequestsManager's mock list - that one
    // holds five invented buoys whose ids only coincidentally match three of
    // the thirteen real ones, so ten buoys showed no metadata at all.
    buoyStation() {
      if (!this.isBuoyContext) return null;
      const id = this.$gui.selectedPlatform?.stationId;
      if (!id) return null;
      return this.buoys.find(buoy => buoy.id === id) ?? null;
    },
    // 'ICATMAR / ICM-CSIC' -> two entries. The catalogue writes joint
    // ownership with a slash, and each half is its own organisation.
    buoyInstitutions() {
      return institutionsOf(this.buoyStation?.institution)
        .map(name => ({ name, url: INSTITUTIONS[name]?.url }));
    },
    buoyCoords() {
      const buoy = this.buoyStation;
      if (buoy?.latitude == undefined || buoy?.longitude == undefined) return '';
      return `${buoy.latitude.toFixed(2)}° N, ${buoy.longitude.toFixed(2)}° E`;
    },
    buoyLicenseUrl() {
      return LICENSE_URLS[this.buoyStation?.license];
    },
    // Whitespace collapsed to single spaces: the catalogue writes these across
    // several indented lines and ERDDAP serves them with the indentation still
    // in, which HTML would fold anyway - but not for a copy, a title, or
    // anything else that reads the string rather than renders it.
    buoyAcknowledgement() {
      const text = this.buoyStation?.acknowledgement;
      return text ? String(text).replace(/\s+/g, ' ').trim() : '';
    },
    isDrifterContext() {
      return this.$gui.selectedDashboard === 'drifters'
        || (this.$gui.selectedDashboard === 'platforms' && this.$gui.timelineDashboardId === 'drifters');
    },
    drifterStation() {
      if (!this.isDrifterContext) return null;
      const id = this.$gui.selectedPlatform?.stationId;
      if (!id) return null;
      return this.$requests.getDrifterStation(id);
    },
    drifterIconURL() {
      if (this.drifterStation?.type === 'CODE') return this.codeIconURL;
      if (this.drifterStation?.type === 'SVP')  return this.svpIconURL;
      return this.driftIconURL;
    },
    // One background layer per institution, so a jointly run platform shows
    // both marks rather than neither - the old single derived path turned
    // 'ICATMAR / ICM-CSIC' into a filename that does not exist.
    //
    // The filter is one value for the whole element, so mixed artwork cannot
    // be washed two different ways; the first institution that asks for a
    // filter sets it. That holds as the catalogue stands (Puertos del Estado
    // never shares a platform) and would need two elements if it ever changes.
    institutionBgStyle() {
      let value = null;
      if (this.hfrStation)          value = this.hfrStation.owner;
      else if (this.isHFRContext)   value = 'ICATMAR';
      else if (this.buoyStation)    value = this.buoyStation.institution;
      else if (this.drifterStation) value = this.drifterStation.institution;

      const names = institutionsOf(value);
      if (!names.length) return {};

      // An institution with no entry falls back to the name-derived path, so
      // adding one is still just a matter of dropping a PNG in. No separator
      // to strip: institutionsOf has already split on it.
      const entries = names.map(name => INSTITUTIONS[name]
        ?? { logo: './Assets/Images/institutions/' + name + '.png' });

      const share = 100 / entries.length;
      return {
        '--inst-logo': entries.map(entry => `url('${entry.logo}')`).join(', '),
        '--inst-logo-size': entries.length === 1
          ? 'contain'
          : entries.map(() => `${(share * 0.9).toFixed(0)}% auto`).join(', '),
        '--inst-logo-position': entries.length === 1
          ? 'center'
          : entries.map((entry, index) => `${(share * (index + 0.5)).toFixed(0)}% center`).join(', '),
        '--inst-filter': entries.find(entry => entry.filter)?.filter ?? DEFAULT_LOGO_FILTER,
      };
    },
  },
  methods: {
    // A measurement in whatever unit the user has picked for its quantity.
    //
    // Precision comes from the MAGNITUDE, not from the unit group. The groups
    // are tuned for readings on a chart - coastDistance carries 0 decimals,
    // which suits an offshore distance and rounds a buoy 1.24 km out to "1 km"
    // - whereas these are fixed facts about a mooring, spanning 0.24 km to
    // 1200 m in one panel. `decimals` forces a value where a field knows
    // better (a water column wants whole metres however deep it is).
    //
    // Trailing zeros are dropped, so 0.5 doesn't become 0.50.
    //
    // The NUMBER only - the unit is rendered separately, since it is the part
    // that is styled apart and the part you click.
    amount(code, value, decimals) {
      const unit = this.$gui.unitFor(code);
      const shown = unit.toDisplay(value);
      const magnitude = Math.abs(shown);
      const places = decimals ?? (magnitude >= 10 ? 0 : magnitude >= 1 ? 1 : 2);
      return Number(shown.toFixed(places));
    },
    unitOf(code) {
      return this.$gui.unitFor(code).unit;
    },
    // Steps that quantity to its next unit, app-wide - the same
    // GUIManager.cycleUnit the timeline's variable bar and the value chips
    // use, so putting depth into feet here puts it into feet everywhere.
    // Plain decimal degrees, not the displayed string - what gets pasted into
    // a chart plotter or a search box, the same as the detail panel copies.
    copyBuoyCoords() {
      const buoy = this.buoyStation;
      if (buoy?.latitude == undefined || buoy?.longitude == undefined) return;
      navigator.clipboard?.writeText(`${buoy.latitude.toFixed(2)}, ${buoy.longitude.toFixed(2)}`);
    },
    cycleUnit(code) {
      if (this.$gui.isUnitSwitchable(code)) this.$gui.cycleUnit(code);
    },
    formatInstallDate(iso) {
      if (!iso || iso === 'unknown') return '—';
      const d = new Date(iso);
      if (isNaN(d)) return '—';
      return d.toLocaleDateString(this.$i18n.locale, { year: 'numeric', month: 'long', timeZone: 'UTC' });
    },
  },
}
</script>


<style scoped>
/* The unit sits quieter than the number it belongs to, and carries the
   click. Underlined only where there is another unit to go to - the signal the
   variable bar and the detail panel's readings already use for this gesture. */
.info-unit {
  font-style: italic;
  opacity: 0.8;
}

.info-unit.clickable {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.info-section {
  min-width: 620px;
  background: var(--lightBlue);
  height: 100%;
  overflow: hidden;
  align-items: stretch;
}

/* Photo column.
   Fixed width; height follows the panel (align-self: stretch). Both the photo
   and the fallback are absolutely positioned so neither contributes any
   intrinsic size — the info rows alone determine the panel height, and the
   photo can never make the container taller than the datatimeline. */
.photo-col {
  position: relative;
  width: 200px;
  min-width: 120px;
  overflow: hidden;
  flex-shrink: 0;
  align-self: stretch;
}

/* Photo shown as a cover background (no intrinsic size). If the image is
   missing the div is transparent and the fallback below shows through. */
.station-photo {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.photo-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--blue);
}

.fallback-icon {
  width: 48px;
  opacity: 0.3;
  filter: invert(1);
}

/* Info column */
.info-col {
  flex: 1;
  padding: 8px 10px 6px;
  overflow-y: auto;
  gap: 4px;
  align-items: flex-start;
  min-width: 0;
  position: relative;
}

.info-col::before {
  content: '';
  position: absolute;
  inset: 10%;
  background-image: var(--inst-logo, none);
  background-size: var(--inst-logo-size, contain);
  background-position: var(--inst-logo-position, center);
  background-repeat: no-repeat;
  opacity: 0.07;
  /* Per institution: dark PNGs only need inverting, full-colour SVGs have to
     lose their colour first (see INSTITUTIONS). */
  filter: var(--inst-filter, invert(1));
  pointer-events: none;
}

.info-header {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 5px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.info-abbr {
  font-weight: bold;
  font-size: medium;
  color: white;
  text-shadow: 0 0 4px black;
}

.info-sep {
  color: white;
  text-shadow: none;
  font-size: medium;
}

.info-name {
  font-size: medium;
  color: white;
  text-shadow: 0 0 4px black;
}

/* Metadata rows */
.info-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.info-row {
  display: flex;
  flex-direction: row;
  gap: 12px;
  align-items: baseline;
  font-size: small;
}

.info-label {
  color: white;
  text-shadow: none;
  flex-shrink: 0;
  min-width: 120px;
  text-align: right;
}

.info-value {
  color: white;
  text-shadow: 0 0 3px black;
  /* A flex item defaults to min-width:auto, which is its longest word - fine
     for text, but it has to be able to shrink before it can wrap at all. */
  min-width: 0;
  user-select: text;
}

/* Keeps the copy button on the same baseline as the coordinates rather than
   letting it sit as a block of its own. */
.info-coords {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
}

/* The one value long enough to need more than a line. Capped rather than left
   to the panel's width so it breaks at a comfortable measure instead of
   stretching the row; the URL at the end is one long token, so it is allowed
   to break mid-word rather than push the line out. */
.info-ack {
  max-width: 420px;
  overflow-wrap: anywhere;
}

.info-link {
  color: white;
  text-decoration: underline;
  text-shadow: 0 0 3px black;
  font-size: small;
}
.info-link:hover {
  color: var(--darkBlue);
}



/* Fallback */
.info-placeholder {
  font-size: small;
  color: rgba(255,255,255,0.4);
  text-shadow: none;
  padding: 12px;
  align-self: center;
}
</style>
