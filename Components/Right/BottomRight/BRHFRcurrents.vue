<template>
  
  <!-- On/Off options -->
  <div class="horizontal wrap options-container">

    <OnOffButtonWithText ref="toggleShowBuoys" :checked="false" :text="$t('buoys')" :inSize="'10px'" @change="toggleShowBuoys($event)"></OnOffButtonWithText>
    <OnOffButtonWithText ref="toggleShowDrifters" :checked="false" :text="$t('drifters')" :inSize="'10px'" @change="toggleShowDrifters($event)"></OnOffButtonWithText>
    <OnOffButtonWithText ref="toggleShowDataPoints" :checked="false" :text="$t('data points')" :inSize="'10px'" @change="toggleShowDataPoints($event)"></OnOffButtonWithText>
    
  </div>

  <!-- Color bar -->
  <div class="colorbar"></div>

</template>

<script>
// Import components
import OnOffButton from '../../Utils/OnOffButton.vue';
import OnOffButtonWithText from '../../Utils/OnOffButtonWithText.vue';

export default {
  props: {
  },
  created() {
  },
  mounted() {

  },

  data() {
    return {
    }
  },
  methods: {
    //onclick: function(e){},
    toggleShowBuoys(e) {
      console.log('toggleShowBuoys', e);
      this.$emit('toggleShowBuoys');
    },
    toggleShowDrifters(e) {
      this.$emit('toggleShowDrifters');
    },
    toggleShowDataPoints(e) {
      this.$emit('toggleShowDataPoints');
    }
  },
  components: {
    OnOffButton,
    OnOffButtonWithText
  }
}
</script>

<style scoped>
.colorbar {
  width: 100%;
  height: 10px;
  background: linear-gradient(to right, blue, cyan, green, yellow, red);
}
</style>