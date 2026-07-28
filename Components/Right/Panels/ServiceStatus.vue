<template>
  <div class="service-status-container">

    <!-- Left-side arrow button to go back -->
    <i class="fa fa-arrow-left back-arrow clickable" v-on:click="$emit('close')"></i>

    <div class="horizontal" style="gap: 10px">
      <span class="service-status-title">{{ $t('Data services status') }}</span>
      <!-- Loading circle -->
      <span class="spinner-border" v-show="isLoading"></span>
    </div>

    <template v-if="!isLoading">
      <!-- Internet off -> only this message, nothing else (all services would be off too) -->
      <div class="status-row" v-if="!status.hasInternet">
        <span class="status-dot status-off"></span>
        <span>{{ $t('No internet connection') }}</span>
      </div>

      <template v-else>
        <!-- Proxy off -> services below are shown as unknown (gray), we cannot reach them -->
        <div class="status-row" v-if="!status.isProxyOn">
          <span class="status-dot status-off"></span>
          <span>{{ $t('Proxy server unavailable') }}</span>
        </div>

        <!-- Services grouped by institution -->
        <div class="institution-group" v-for="group in groups" :key="group.name">
          <div class="institution-header">
            <img class="institution-logo" :src="group.logoSrc" :alt="group.name">
            <span class="institution-name">{{ group.name }}</span>
          </div>

          <div class="service-item" v-for="service in group.services" :key="service.label">
            <div class="service-row">
              <span class="status-dot" :class="'status-' + service.state"></span>
              <a class="service-link" :href="service.url" target="_blank" rel="noopener noreferrer">{{ service.label }}</a>
            </div>
            <p class="service-description">{{ $t(service.description) }}</p>
          </div>
        </div>
      </template>
    </template>

    <button class="clickable refresh-button" v-on:click="refresh(0)"><span>{{ $t('Refresh') }}</span></button>

  </div>
</template>


<script>

export default {
  name: "ServiceStatus",
  emits: ['close'],
  created() {
    this.refresh();
  },
  data() {
    return {
      isLoading: true,
      status: null,
      institutions: [
        {
          name: 'ICATMAR',
          logoSrc: './Assets/Images/logos/logo-icatmar-icon.svg',
          services: [
            { key: 'icatmarErddap', label: 'ERDDAP', description: 'Data provider for HFR network (currents), drifters, buoys and forecast models.' },
            { key: 'msm', label: 'MSM API', description: 'Data service for buoys.' },
            { key: 'ais', label: 'AIS API', description: 'Data service for AIS (vessel locations) around the buoys for the 3D digital twins.' },
          ],
        },
        {
          name: 'Ifremer',
          logoSrc: './Assets/Images/logos/logo-ifremer-icon.svg',
          services: [
            { key: 'ifremerErddap', label: 'ERDDAP', description: 'Data provider for Argo floats (ICATMAR and external).' },
          ],
        },
        {
          name: 'NOAA-AOML',
          logoSrc: './Assets/Images/logos/logo-NOAA.svg',
          services: [
            { key: 'noaaErddap', label: 'ERDDAP', description: 'Data provider for drifters from different sources.' },
          ],
        },
        {
          name: 'EU HFR Node',
          logoSrc: './Assets/Images/logos/logo-EUHFR.png',
          services: [
            { key: 'eunodeErddap', 'label': 'ERDDAP', description: 'Data provider for HFR networks (currents).' },
          ],
        }
      ],
    }
  },
  methods: {
    refresh(ttl) {
      this.isLoading = true;
      this.$serviceStatus.requestAllStatus(ttl).then(status => {
        this.status = status;
        this.isLoading = false;
      });
    }
  },
  computed: {
    // Institutions with each service's live state (on/off/unknown) and URL merged in
    groups() {
      return this.institutions.map(inst => ({
        name: inst.name,
        logoSrc: inst.logoSrc,
        services: inst.services.map(s => ({
          label: s.label,
          description: s.description,
          url: this.$serviceStatus.services[s.key],
          state: !this.status.isProxyOn ? 'unknown' : (this.status[s.key] ? 'on' : 'off'),
        })),
      }));
    }
  }
}

</script>


<style scoped>
.service-status-container {
  position: relative;
  padding: 50px 20px 20px;
}

.back-arrow {
  position: absolute;
  top: 15px;
  left: 15px;
  width: 30px;
  height: 30px;
  background: var(--blue);
  color: white;
  box-shadow: 0 0 4px black;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.service-status-title {
  display: block;
  font-weight: bold;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-on      { background: #4caf50; box-shadow: 0 0 4px #4caf5088; }
.status-off     { background: var(--red); box-shadow: 0 0 4px rgba(var(--redRGB), 0.5); }
.status-unknown { background: #757575; }

.institution-group {
  margin-top: 18px;
}

.institution-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.institution-logo {
  width: 24px;
  height: 24px;
  object-fit: contain;
  box-shadow: 0 0 4px black;
  border-radius: 50%;
}

.institution-name {
  font-weight: bold;
}

.service-item {
  margin: 8px 0 8px 32px;
}

.service-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.service-link {
  color: white;
  text-decoration: underline;
}
.service-link:hover {
  color: var(--lightBlue);
}

.service-description {
  font-size: x-small;
  color: rgba(255, 255, 255, 0.6);
  text-shadow: none;
  margin: 2px 0 0;
}

.refresh-button {
  margin-top: 15px;
  background: var(--blue);
  border: none;
  border-radius: 10px;
  padding: 5px 15px;
}
</style>
