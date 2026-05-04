<template>
  <div class="map-arrows-circle">
    <div class="map-arrows-center"></div>
    <div class="map-arrow" style="transform: rotate(0deg) translateX(40px)"></div>
  </div>
</template>


<style scoped>
.map-arrows-circle {
  position: absolute;
  z-index: 1;
  width: 80%;
  height: 80%;
  border-radius: 50%;
  border: 1px solid #ffffff6b;
  top: 10%;
  right: 10%;

  display: flex;
  align-items: center;
  justify-content: center;
}

.map-arrows-center {
  background: #ffffffda;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.map-arrow {
  width: 20px;
  height: 5px;
  background: #ffffffda;
  position: absolute;
  top: 50%;
  left: 50%;
}
</style>