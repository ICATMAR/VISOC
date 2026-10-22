<template>
  <!-- Where the selected value came from - for traceability: sources process
       the same data each their own way. Hover: every source this data
       product draws on for the platform. -->
  <component :is="url ? 'a' : 'span'" class="pd-source" v-if="origins.length"
    :href="url" :target="url && '_blank'" :rel="url && 'noopener'" :title="title">
    {{ $t('Source') }}: {{ origins.map(o => o.label).join(', ') }}
  </component>
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
    // A link to the first origin, where it has an address
    url() { return this.origins[0]?.url; },
    title() {
      const lines = this.origins.map(o => `${this.$t('This value')}: ${o.label}${o.dataset ? ` · ${o.dataset}` : ''}`);
      if (this.sources.length) lines.push(`${this.$t('Sources')}: ${this.sources.join(', ')}`);
      if (this.note) lines.push(this.note);
      return lines.join('\n');
    },
  },
}
</script>
