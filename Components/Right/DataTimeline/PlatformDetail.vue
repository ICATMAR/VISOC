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

      <!-- Overlay arrows (wind, waves, currents?) -->
      <MapCircleArrows></MapCircleArrows>


      <!-- Map -->
      <div id="platformMap" ref="platformMap" class="map-placeholder">
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
    <div class="dto-container">
      <img class="dto-gif" :src="mockupGifSource">
      </img>
      <i class="fa-solid fa-arrow-up-right-from-square icon-open-link clickable"></i>
    </div>
    
  
  </div>


</template>


<script>
import MapCircleArrows from './MapCircleArrows.vue';



export default {
  name: "PlatformDetail",
  created() {
    this.map = undefined;
  },
  mounted() {
    this.map = new ol.Map({
      target: this.$refs.platformMap,
      controls: [],
      interactions: [],
      layers: [
        new ol.layer.Tile({
          source: new ol.source.XYZ({ // https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/0
            url: 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png',
            attributions: '© Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
            cacheSize: 500,
            crossOrigin: 'anonymous',
          }),
        })
      ],
      view: new ol.View({
        center: ol.proj.fromLonLat([2.5, 41.5]),
        zoom: 10
      })
    });
  },
  data (){
    return {
      platformType: "buoy",
      mockupGifSource: "./Assets/Images/mockup/buoydto.gif",
    }
  },
  methods: {
    //onclick: function(e){},
  },
  computed: {
    
  },
  components: {
    MapCircleArrows
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
  z-index: 1;
  top: 4px;
  right: 4px;
  font-size: x-small;
  background: #80808052;
  padding: 3px;
  border-radius: 5px;
}

.map-placeholder {
  width: 180px;
  height: 180px;
  background: lightblue;
}

.values-container {
  gap: 5px;
}

.value-container {
  background: lightgreen;
  border-radius: 10px;
  padding: 10px;
}

.value-container span:first-child {
  font-size: x-small;
}

.dto-container {
  position: relative;
}

.dto-gif {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  margin: 10px;
  box-shadow: 0 0 4px black;
}

.icon-open-link {
  position: absolute;
  top: 9px;
  right: 9px;

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


.close-x-position {
  position: absolute;
  z-index: 10;
  top: -9px;
  left: -9px;
}
</style>