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
      <div class="info-col vertical">
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
      <div class="info-col vertical" style="padding-left: 12px;">
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
      radarIconURL: './Assets/Icons/radar.svg',
    }
  },
  computed: {
    stationPhotoURL() {
      return './Assets/Images/platforms/HFR/' + (this.hfrStation?.id ?? '') + '.jpg';
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
  },
}
</script>


<style scoped>
.info-section {
  min-width: 400px;
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
