<template>
  <!-- Disabled: greyed out and not clickable (a feature not available yet,
       .is-unavailable); the container keeps its tooltip -->
  <div class="onoff-button-with-text-container" :class="{ 'is-unavailable': disabled }" :title="disabled ? disabledTitle : undefined">
    <OnOffButton ref="onOffButton" :checked="checked" :inSize="inSize" @change="toggle($event)"></OnOffButton>
    <span @click="toggle">{{ text }}</span>
    <!-- Whatever the toggle turned on is still loading -->
    <span v-if="loading" class="spinner-border onoff-loading"></span>
  </div>
</template>


  <script>

  import OnOffButton from './OnOffButton.vue';

  export default {
    name: 'onOffButtonWithText', // Caps, no -
    props: {
      checked: Boolean,
      inSize: String,
      text: String,
      loading: Boolean,
      disabled: Boolean,
      disabledTitle: { type: String, default: 'Not available yet' },
    },
    created() {
    },
    mounted() {
    },
    
    data (){
      return {
        isOn: this.checked,
      }
    },
    methods: {
      toggle: function(e){
        // OnOff Button was clicked
        if (e.target.value != undefined){
          this.isOn = e.target.checked;
          this.$emit('toggle', this.isOn);
        }
        // Text was clicked
        else {
          this.isOn = !this.isOn;
          this.$refs.onOffButton.setChecked(this.isOn);
        }
      }
    },
    components: {
      OnOffButton
    }
  }
  
  </script>

<style scoped>
.onoff-button-with-text-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  cursor: pointer;
  pointer-events: auto;
  user-select: none;
  gap: 5px;
}

.onoff-loading {
  width: 9px;
  height: 9px;
  border-width: 2px;
}

.onoff-button-with-text-container:hover {
  transform: scale(1.05);
  transition: all 0.2s ease-in-out;
}

</style>