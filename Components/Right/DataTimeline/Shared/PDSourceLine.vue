<template>
  <!-- Where the selected value came from - for traceability: sources process
       the same data each their own way. Hover: every source this data
       product draws on for the platform. -->
  <div class="pd-source" v-if="grouped.length" :title="title">
    <span>{{ $t(grouped.length > 1 ? 'Sources' : 'Source') }}: </span>
    <span class="pd-source-item" v-for="(origin, index) in grouped" :key="index">
      <a v-if="origin.url" class="pd-source-link" :href="origin.url" target="_blank" rel="noopener"
        :title="origin.datasets.join('\n') || origin.url">{{ origin.label }}</a>
      <span v-else :title="origin.datasets.join('\n')">{{ origin.label }}</span>
    </span>
  </div>
</template>


<script>
// The "Source:" line at the bottom of a platform detail (see
// styles/platformDetails.css .pd-source)
export default {
  name: "PDSourceLine",
  props: {
    // The selected value's origin(s): [{ label, url, dataset }]
    origins: { type: Array, default: () => [] },
    // Every source the data product draws on for this platform (labels)
    sources: { type: Array, default: () => [] },
    // Said after the list of sources, e.g. how they are combined
    note: { type: String, default: '' },
  },
  computed: {
    // One entry per source (server), however many of its datasets or files
    // are behind the values: { label, url (the first's), datasets }
    grouped() {
      const groups = [];
      this.origins.filter(Boolean).forEach(origin => {
        let group = groups.find(g => g.label === origin.label);
        if (!group) groups.push(group = { label: origin.label, url: origin.url, datasets: [] });
        if (origin.dataset && !group.datasets.includes(origin.dataset)) group.datasets.push(origin.dataset);
      });
      return groups;
    },
    title() {
      const lines = this.origins.filter(Boolean).map(o => `${this.$t('This value')}: ${o.label}${o.dataset ? ` · ${o.dataset}` : ''}`);
      if (this.sources.length) lines.push(`${this.$t('Sources')}: ${this.sources.join(', ')}`);
      if (this.note) lines.push(this.note);
      return lines.join('\n');
    },
  },
}
</script>
