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
          <span class="source-label">{{ source.label }}</span>
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
        const dataProduct = this.$dataService.catalogue.find(p => p.name === name); // source config (institution, mapping...)

        const sources = await Promise.all(product.sources.map(async (source, i) => {
          await source.loadingPromise.catch(() => {}); // one failed source shouldn't hide the rest
          return {
            label: this.sourceTitle(source),
            institution: dataProduct.sources[i]?.institution,
            startDate: source.startDate,
            endDate: source.endDate,
            recentWindowDays: source.recentWindowDays,
          };
        }));
        return { name, sources };
      }));

      this.isLoading = false;
    },

    // Composite sources (multiple datasets/stations in one Source) aren't
    // titled specifically yet - revisit once we build out their UI.
    sourceTitle(source) {
      if (source.dataset) return `ERDDAP - ${source.dataset}`;
      if (source.path || source.paths) return 'Static files';
      return source.constructor.name;
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
  font-size: x-small;
  margin: 30px 0px 5px 10px;
  color: var(--lightBlue);
}

.source-item {
  display: flex;
  flex-direction: column;
  margin: 8px 0 8px 32px;
}

.source-label {
  font-size: small;
}

.source-range {
  font-size: x-small;
  color: rgba(255, 255, 255, 0.6);
}

.source-institution {
  color: var(--lightBlue);
}
</style>