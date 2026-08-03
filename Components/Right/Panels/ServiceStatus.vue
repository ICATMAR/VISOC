<template>
  <div class="service-status-container">

    <!-- Left-side arrow button to go back -->
    <i class="fa fa-arrow-left back-arrow clickable" v-on:click="$emit('close')"></i>

    <ServersAPIsStatus />

    <div class="divider-small"></div>

    <DataProducts />

  </div>
</template>


<script>
import ServersAPIsStatus from './ServiceStatus/ServersAPIsStatus.vue';
import DataProducts from './ServiceStatus/DataProducts.vue';

export default {
  name: "ServiceStatus",
  emits: ['close'],
  components: {
    ServersAPIsStatus,
    DataProducts,
  }
}

</script>


<style scoped>
.service-status-container {
  position: relative;
  padding: 50px 20px 20px;
}

.back-arrow {
  position: absolute;
  top: 15px;
  left: 15px;
  width: 30px;
  height: 30px;
  background: var(--blue);
  color: white;
  box-shadow: 0 0 4px black;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>