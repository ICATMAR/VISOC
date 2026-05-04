<template>
  <div class="horizontal platform-detail-container">
    <!-- Close button -->
    <i class="fa fa-xmark close-x close-x-position clickable" v-on:click="() => { $gui.isPlatformDetailOpen = false }"></i>

    <!-- Map -->
    <div class="map-container">
      <!-- Overlay info -->
      <div class="vertical map-info-overlay">
        <span>{{ $t('Last observation') }}</span>
        <div class="horizontal">
          <div class="icon-last-observation"></div>
          <span>Xh ago. 9:00</span>
        </div>
      </div>

      <!-- Map -->
      <div class="map-placeholder">
      </div>
    </div>

    <!-- Values -->
    <div class="vertical">
      <span>{{ platformType }}</span>
      <span>2º E, 42º N</span>
      <div class="horizontal values-container">
        <div class="vertical value-container">
          <span>{{ $t('Temperature') }}</span>
          <span>15º C</span>
        </div>
        <div class="vertical value-container">
          <span>{{ $t('Salinity') }}</span>
          <span>38 psu</span>
        </div>
      </div>
    </div>

    <!-- 3D DTO -->
    <div class="dto">
    </div>
  
  </div>


</template>


<script>


export default {
  name: "PlatformDetail",
  created() {
    
  },
  mounted() {
  },
  data (){
    return {
      platformType: "buoy",
    }
  },
  methods: {
    //onclick: function(e){},
  },
  computed: {
    
  },
  components: {
  }
}
</script>

<style scoped>

.platform-detail-container {
  justify-content: space-between;
  align-items: flex-start;
}

.map-container {
  position: relative;
}

.map-info-overlay {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: x-small;
  background: #80808052;
  padding: 3px;
  border-radius: 5px;
}

.map-placeholder {
  width: 150px;
  height: 150px;
  background: lightblue;
}

.values-container {
  gap: 5px;
}

.value-container {
  background: lightgreen;
  border-radius: 10px;
}

.dto {
  width: 150px;
  height: 150px;
  background: lightpink;
}


.close-x-position {
  position: absolute;
  z-index: 10;
  top: -9px;
  left: -9px;
}
</style>