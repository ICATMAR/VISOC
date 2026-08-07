<template>
  <div class="data-products-container">

    <div class="horizontal section-header">
      <span class="section-title">{{ $t('Data products') }}</span>
      <span class="spinner-border" v-show="isLoading"></span>
    </div>

    <template v-if="!isLoading">
      <div v-for="product in products" :key="product.name">
        <div class="dashboard-section-text">{{ $t(product.name) }}</div>
        <div class="dashboard-section-text-description">{{ $t(product.description) }}</div>

        <div class="source-item" v-for="(source, i) in product.sources" :key="i">
          <div class="source-title-row">
            <div class="pd-status-dot" :class="source.status"></div>
            <a v-if="source.url" class="source-label" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.label }}</a>
            <span v-else class="source-label">{{ source.label }}</span>
          </div>
          <span class="source-range">
            <template v-if="source.startDate && source.endDate">{{ formatDate(source.startDate) }} - {{ formatRelative(source.endDate) }}</template>
            <template v-else-if="source.endDate">{{ formatRelative(source.endDate) }}</template>
            <template v-else-if="source.rateLimited">{{ $t('API limit reached, resets in 1 hour') }}</template>
            <template v-else>{{ noDataText(source) }}</template>
            <span v-if="source.institution" class="source-institution"> · {{ source.institution }}</span>
          </span>
        </div>
      </div>
    </template>

  </div>
</template>


<script>

export default {
  name: "DataProducts",
  created() {
    this.load();
  },
  data() {
    return {
      isLoading: true,
      products: [],
    }
  },
  methods: {
    async load() {
      const entries = this.$dataService.dataProducts; // [{ name, product }, ...]

      this.products = await Promise.all(entries.map(async ({ name, product }) => {
        const sources = await Promise.all(product.sources.map(async source => {
          if (source.loadingPromise != undefined){
            await source.loadingPromise.catch(() => {}); // one failed source shouldn't hide the rest
          }
          return {
            label: this.sourceTitle(source),
            url: this.sourceUrl(source),
            status: this.sourceStatus(source, product.type),
            institution: source.institution,
            startDate: source.startDate,
            endDate: source.endDate,
            recentWindowDays: source.recentWindowDays,
            rateLimited: source.isRateLimited,
          };
        }));
        return { name, sources, description: product.description };
      }));

      this.isLoading = false;
    },

    // SourceErddapEUHFRStations/SourceErddapBuoys (multiple datasets, one per
    // station/sensor) aren't broken down per-dataset in the UI yet, just
    // shown as one ERDDAP entry - revisit once we build out that view.
    sourceTitle(source) {
      if (source.dataset) return `ERDDAP - ${source.dataset}`;
      if (source.datasetCommonKey) return `ERDDAP - ${this.erddapServerLabel(source.baseUrl)}`;
      if (source.datasets) return `ERDDAP - ${source.institution}`;
      if (source.repo) return `Github - ${source.repo}`;
      if (source.path || source.paths) return 'Static files';
      return source.constructor.name;
    },

    // e.g. 'https://erddap.icatmar.cat/erddap' -> 'ICATMAR', 'https://hebe.icm.csic.es/erddap' -> 'HEBE'
    erddapServerLabel(baseUrl) {
      const host = new URL(baseUrl).hostname;
      if (host.includes('icatmar')) return 'ICATMAR';
      if (host.includes('hebe')) return 'HEBE';
      return host;
    },

    // ERDDAP datasets link to their info page; the EU HFR Node, buoys and
    // Github sources link to the server/repository itself, since none of
    // them is one single dataset.
    sourceUrl(source) {
      if (source.dataset) return `${source.baseUrl}/info/${source.dataset}/index.html`;
      if (source.datasetCommonKey || source.datasets) return source.src;
      if (source.repo) return source.src;
      return undefined;
    },

    // Static files aren't 'live', so always gray. Otherwise based on how
    // stale endDate is: <=1 day green, <=15 days yellow, older (or no data) gray.
    sourceStatus(source, dpType) {
      if (source.path || source.paths) return 'static';
      if (!source.endDate) return 'inactive';
      // Not forecast
      if (!(dpType == 'forecast')) {
        const ageDays = (Date.now() - source.endDate.getTime()) / 86400000;
        if (ageDays <= 1) return 'active';
        if (ageDays <= 15) return 'delayed';
        return 'inactive';
      } 
      // Forecast
      else {
        // If forecast end date is in the past for less than a 1 day, it's delayed. More than a day, it's inactive. If it's in the future, it's active.
        const ageDays = (source.endDate.getTime() - Date.now()) / 86400000;
        if (ageDays > 0) return 'active';
        if (ageDays > -1) return 'delayed';
        return 'inactive';
      }
      
    },

    noDataText(source) {
      return source.recentWindowDays != null
        ? `No data in the last ${source.recentWindowDays} days`
        : 'No data';
    },

    formatDate(date) {
      if (!date) return '';
      return date.toLocaleDateString();
    },

    // Up to 7 days away: 'X minutes/hours/days ago' (past) or '...ahead'
    // (future, e.g. a forecast's end date). Beyond that: just the date.
    formatRelative(date) {
      if (!date) return '';
      const diffMs = date.getTime() - Date.now();
      const suffix = diffMs > 0 ? 'ahead' : 'ago';
      const minutes = Math.floor(Math.abs(diffMs) / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      if (days > 7) return this.formatDate(date);
      if (days >= 1) return `${days} ${days === 1 ? 'day' : 'days'} ${suffix}`;
      if (hours >= 1) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${suffix}`;
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ${suffix}`;
    }
  }
}

</script>


<style scoped>
.section-header {
  align-items: center;
  gap: 10px;
}

.section-title {
  font-weight: bold;
}

.dashboard-section-text {
  font-size: small;
  margin: 10px 0px 0px 10px;
  color: var(--lightBlue);
}

.dashboard-section-text-description {
  font-size: 0.7rem;
  font-style: italic;
  color: var(--lightBlue);
}


.source-item {
  display: flex;
  flex-direction: column;
  margin: 8px 0 8px 32px;
}

.source-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.source-label {
  font-size: 0.7rem;
  color: white;
}

a.source-label {
  text-decoration: underline;
}
a.source-label:hover {
  color: var(--lightBlue);
}

.source-range {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.6);
}

.source-institution {
  color: var(--lightBlue);
}
</style>