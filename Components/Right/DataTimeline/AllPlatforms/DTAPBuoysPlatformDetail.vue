<template>
  <div class="horizontal platform-detail-container">
    <!-- Close button -->
    <i class="fa fa-xmark close-x close-x-position clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <!-- Info -->
    <div class="vertical info-container">
      <span class="platform-type">Buoy</span>
      <span class="station-name">Station mockup</span>
      <span class="coordinates">–° N, –° E</span>
    </div>
  </div>
</template>


<script>

export default {
  name: "DTAPBuoysPlatformDetail",
}

</script>


<style scoped>
.platform-detail-container {
  justify-content: flex-start;
  align-items: flex-start;
  gap: 15px;
}

.info-container {
  gap: 5px;
  padding: 10px 0;
}

.platform-type {
  font-size: x-small;
  opacity: 0.6;
}

.station-name {
  font-size: medium;
  font-weight: bold;
  color: black;
  text-shadow: none;
}

.coordinates {
  font-size: x-small;
  color: black;
  text-shadow: none;
}

.close-x-position {
  position: absolute;
  z-index: 10;
  top: -9px;
  left: -9px;
}
</style>
