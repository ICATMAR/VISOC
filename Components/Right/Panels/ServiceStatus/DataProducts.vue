<template>
  <div class="data-products-container">

    <div class="horizontal section-header">
      <span class="section-title">{{ $t('Data products') }}</span>
      <span class="spinner-border" v-show="isLoading"></span>
    </div>

    <template v-if="!isLoading">
      <div v-for="product in products" :key="product.name">
        <div class="dashboard-section-text">{{ $t(product.name) }}</div>

        <div class="source-item" v-for="source in product.sources" :key="source.label">
          <span class="source-label">{{ source.label }}</span>
          <span class="source-range" v-if="source.startDate || source.endDate">
            {{ formatDate(source.startDate) }} - {{ formatRelative(source.endDate) }}
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
            label: source.dataset || source.path || source.src || source.constructor.name,
            startDate: source.startDate,
            endDate: source.endDate,
          };
        }));
        return { name, sources };
      }));

      this.isLoading = false;
    },

    formatDate(date) {
      if (!date) return '';
      return date.toLocaleDateString();
    },

    // 'X days ago' if 1+ day old, 'X hours ago' from 24h down to 1h, otherwise 'X minutes ago'
    formatRelative(date) {
      if (!date) return '';
      const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
      if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
      const days = Math.floor(hours / 24);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
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
</style>