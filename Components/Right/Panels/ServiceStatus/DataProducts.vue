<template>
  <div class="data-products-container">

    <div class="horizontal section-header">
      <span class="section-title">{{ $t('Data products') }}</span>
      <span class="spinner-border" v-show="isLoading"></span>
    </div>

    <template v-if="!isLoading">
      <div v-for="product in products" :key="product.name">
        <div class="dashboard-section-text">{{ $t(product.name) }}</div>

        <div class="source-item" v-for="(source, i) in product.sources" :key="i">
          <div class="source-title-row">
            <div class="pd-status-dot" :class="source.status"></div>
            <a v-if="source.url" class="source-label" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.label }}</a>
            <span v-else class="source-label">{{ source.label }}</span>
          </div>
          <span class="source-range">
            <template v-if="source.startDate || source.endDate">{{ formatDate(source.startDate) }} - {{ formatRelative(source.endDate) }}</template>
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
          await source.loadingPromise.catch(() => {}); // one failed source shouldn't hide the rest
          return {
            label: this.sourceTitle(source),
            url: this.sourceUrl(source),
            status: this.sourceStatus(source),
            institution: source.institution,
            startDate: source.startDate,
            endDate: source.endDate,
            recentWindowDays: source.recentWindowDays,
          };
        }));
        return { name, sources };
      }));

      this.isLoading = false;
    },

    // SourceErddapEUHFRStations (multiple datasets, one per station) isn't
    // broken down per-station in the UI yet, just shown as one ERDDAP entry -
    // revisit once we build out that view.
    sourceTitle(source) {
      if (source.dataset) return `ERDDAP - ${source.dataset}`;
      if (source.datasets) return `ERDDAP - ${source.institution}`;
      if (source.path || source.paths) return 'Static files';
      return source.constructor.name;
    },

    // ERDDAP datasets link to their info page; the EU HFR Node source links
    // to the server itself, since it isn't one single dataset.
    sourceUrl(source) {
      if (source.dataset) return `${source.baseUrl}/info/${source.dataset}/index.html`;
      if (source.datasets) return source.src;
      return undefined;
    },

    // Static files aren't 'live', so always gray. Otherwise based on how
    // stale endDate is: <=1 day green, <=15 days yellow, older (or no data) gray.
    sourceStatus(source) {
      if (source.path || source.paths) return 'inactive';
      if (!source.endDate) return 'inactive';
      const ageDays = (Date.now() - source.endDate.getTime()) / 86400000;
      if (ageDays <= 1) return 'active';
      if (ageDays <= 15) return 'delayed';
      return 'inactive';
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

    // Up to 7 days old: 'X minutes/hours/days ago'. Older than that: just the date.
    formatRelative(date) {
      if (!date) return '';
      const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      if (days > 7) return this.formatDate(date);
      if (days >= 1) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
      if (hours >= 1) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
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
  margin: 0px 0px 5px 10px;
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