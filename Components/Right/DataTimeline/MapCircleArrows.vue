<template>
  <div class="map-arrows-circle">
    <div class="map-arrows-center"></div>

    <!-- Variable name -->
    <div class="variableName" :style="{ rotate: direction }"><span>{{ $t('Wind') }}</span></div>
    <!-- Variable value -->
    <div class="variableValue horizontal" :style="{ rotate: direction }">
      <div class="variableArrow"></div>
      <span>15 kn</span>
    </div>
  </div>
</template>

<script>

export default {
  name: "MapCircleArrows",
  created() {
    
  },
  mounted() {
  },
  data (){
    return {
      direction: '180deg'
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
.map-arrows-circle {
  position: absolute;
  z-index: 1;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 1px solid #ffffff6b;
  top: 25%;
  right: 25%;

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

.variableName {
  position: absolute;
  transform: translateX(calc(50% + 52px));
  background: var(--darkBlue);
  font-size: x-small;
  padding-right: 6px;
  padding-left: 2px;
  border-radius: 0 5px 5px 0;
}

.variableValue {
  position: absolute;
  transform: translateX(calc(-50% + 49px));
  background: var(--blue);
  font-size: x-small;
  padding-right: 2px;
  padding-left: 4px;
  border-radius: 0 4px 4px 0;
}
.variableValue > span {
  z-index: 1;
  /* Reverse the rotation so text stays horizontal */
  transform: rotate(calc(-1 * var(--direction)));
}

.variableArrow {
  position: absolute;
  transform: translate(-80%) rotate(45deg);
  background: var(--blue);
  height: 10px;
  width: 10px;
  z-index: 0;
}

</style>