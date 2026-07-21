<template>
  <div class="service-status-container">

    <!-- Left-side arrow button to go back -->
    <i class="fa fa-arrow-left back-arrow clickable" v-on:click="$emit('close')"></i>

    <div class="horizontal" style="gap: 10px">
      <span class="service-status-title">  {{ $t('Data services status') }}</span>
      <!-- Loading circle-->
      <span class="spinner-border" v-show="isLoading"></span>
    </div>
    
      
      
      


    <!-- If no internet / no proxy / proxy on -> services: rows built in `rows` -->
    <div class="status-row" v-if="!isLoading" v-for="row in rows" :key="row.label">
      <span class="status-dot" :class="row.ok ? 'status-on' : 'status-off'"></span>
      <span>{{ $t(row.label) }}</span>
    </div>

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
    rows() {
      if (!this.status) return [];
      if (!this.status.hasInternet)
        return [{ label: 'No internet connection', ok: false }];

      const rows = [
        { label: 'Internet connection', ok: true },
        { label: 'Proxy server', ok: this.status.isProxyOn },
      ];
      if (!this.status.isProxyOn) return rows;

      rows.push({ label: 'ICATMAR ERDDAP', ok: this.status.icatmarErddap });
      rows.push({ label: 'ICATMAR MSM', ok: this.status.msm });
      rows.push({ label: 'ICATMAR AIS', ok: this.status.ais });
      rows.push({ label: 'Ifremer ERDDAP', ok: this.status.ifremerErddap });
      rows.push({ label: 'NOAA-AOML ERDDAP', ok: this.status.noaaErddap });
      return rows;
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
.status-on  { background: #4caf50; box-shadow: 0 0 4px #4caf5088; }
.status-off { background: var(--red); box-shadow: 0 0 4px rgba(var(--redRGB), 0.5); }

.refresh-button {
  margin-top: 15px;
  background: var(--blue);
  border: none;
  border-radius: 10px;
  padding: 5px 15px;
}
</style>
