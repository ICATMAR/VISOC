<template>
  <div class="info-section horizontal">

    <!-- HFR individual station -->
    <template v-if="hfrStation">
      <div class="photo-col">
        <img v-if="!imgError"
          :src="stationPhotoURL"
          class="station-photo"
          :alt="hfrStation.name"
          @error="imgError = true">
        <div v-else class="photo-fallback">
          <img :src="radarIconURL" class="fallback-icon" alt="">
        </div>
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
        <img v-if="!buoyImgError"
          :src="buoyStationPhotoURL"
          class="station-photo"
          :alt="buoyStation.name"
          @error="buoyImgError = true">
        <div v-else class="photo-fallback">
          <img :src="buoyIconURL" class="fallback-icon" alt="">
        </div>
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
          <div class="info-row">
            <span class="info-label">Institution</span>
            <a href="https://icatmar.cat" target="_blank" rel="noopener" class="info-link">ICATMAR</a>
          </div>
          <div class="info-row">
            <span class="info-label">Manufacturer</span>
            <span class="info-value">{{ buoyStation.manufacturer }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Depth</span>
            <span class="info-value">{{ buoyStation.depth }} m</span>
          </div>
          <div class="info-row">
            <span class="info-label">Distance to coast</span>
            <span class="info-value">{{ buoyStation.distanceCoast }} mn</span>
          </div>
          <div class="info-row">
            <span class="info-label">Installed</span>
            <span class="info-value">{{ formatInstallDate(buoyStation.installed) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">License</span>
            <a :href="network.licenseUrl" target="_blank" rel="noopener" class="info-link">{{ network.licenseLabel }}</a>
          </div>
        </div>
      </div>
    </template>

    <!-- Drifter -->
    <template v-else-if="drifterStation">
      <div class="photo-col">
        <div class="photo-fallback">
          <img :src="drifterIconURL" class="fallback-icon" alt="">
        </div>
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
export default {
  name: "DTInfoSection",
  data() {
    return {
      imgError: false,
      buoyImgError: false,
      radarIconURL: './Assets/Icons/radar.svg',
      buoyIconURL: './Assets/Icons/buoy.svg',
      driftIconURL: './Assets/Icons/drifter.svg',
      codeIconURL: './Assets/Icons/code.svg',
      svpIconURL: './Assets/Icons/svp.svg',
    }
  },
  computed: {
    stationPhotoURL() {
      return './Assets/Images/platforms/HFR/' + (this.hfrStation?.id ?? '') + '.jpg';
    },
    buoyStationPhotoURL() {
      return './Assets/Images/platforms/Buoys/' + (this.buoyStation?.id ?? '') + '.jpg';
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
    buoyStation() {
      if (!this.isBuoyContext) return null;
      const id = this.$gui.selectedPlatform?.stationId;
      if (!id) return null;
      return this.$requests.getBuoyStation(id);
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
    institutionBgStyle() {
      let name = null;
      if (this.hfrStation)          name = this.hfrStation.owner;
      else if (this.isHFRContext)   name = 'ICATMAR';
      else if (this.buoyStation)    name = this.buoyStation.institution;
      else if (this.drifterStation) name = this.drifterStation.institution;
      if (!name) return {};
      const url = './Assets/Images/institutions/' + name.replace(/[\/\\]/g, '-') + '.png';
      return { '--inst-logo': 'url(\'' + url + '\')' };
    },
  },
  methods: {
    formatInstallDate(iso) {
      if (!iso || iso === 'unknown') return '—';
      const d = new Date(iso);
      if (isNaN(d)) return '—';
      return d.toLocaleDateString(this.$i18n.locale, { year: 'numeric', month: 'long', timeZone: 'UTC' });
    },
  },
  watch: {
    hfrStation() {
      this.imgError = false;
    },
    buoyStation() {
      this.buoyImgError = false;
    },
  },
}
</script>


<style scoped>
.info-section {
  min-width: 520px;
  background: var(--lightBlue);
  height: 100%;
  overflow: hidden;
  align-items: stretch;
}

/* Photo column */
.photo-col {
  width: 120px;
  min-width: 120px;
  overflow: hidden;
  flex-shrink: 0;
}

.station-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-fallback {
  width: 100%;
  height: 100%;
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
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 0.07;
  filter: invert(1);
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
  gap: 1px;
  width: 100%;
}

.info-row {
  display: flex;
  flex-direction: row;
  gap: 6px;
  align-items: baseline;
  font-size: small;
}

.info-label {
  color: white;
  text-shadow: none;
  flex-shrink: 0;
  min-width: 120px;
}

.info-value {
  color: white;
  text-shadow: 0 0 3px black;
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
