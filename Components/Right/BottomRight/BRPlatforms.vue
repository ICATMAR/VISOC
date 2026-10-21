<template>
  <!-- Other institutions' platforms: off, All platforms shows ICATMAR's -->
  <div class="filled-container">
    <div class="horizontal wrap options-container">
      <OnOffButtonWithText :checked="$gui.platformsShowExternal" :text="$t('External platforms')" :inSize="'8px'"
        @toggle="$gui.platformsShowExternal = $event"></OnOffButtonWithText>
    </div>
  </div>
</template>


<script>
import OnOffButtonWithText from '../../Utils/OnOffButtonWithText.vue';

export default {
  name: 'BRPlatforms',
  components: {
    OnOffButtonWithText,
  },
}
</script>
