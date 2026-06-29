<template>
  <!-- Info section -->
  <div class="horizontal info-section">
    <img :src="imgSrc">
    <span>{{ text }}</span>
  </div>
</template>


<script>

export default {
  name: "DTInfoSection",
  props: {
    imgSrc: { type: String, default: './Assets/Images/platforms/HFRCREU.png' },
    text: { type: String, default: 'This is the info section where information about the platform is provided. Location, update rate...' },
  },
}

</script>


<style scoped>
.info-section {
  width: 400px;
  min-width: 400px;
  background: var(--lightBlue);
  padding-left: 10px;
  height: 100%;
}

.info-section > img {
  max-height: 160px;
  padding: 10px;
}

</style>
