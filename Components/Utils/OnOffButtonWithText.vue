<template>
<div class="onoff-button-with-text-container">
  <OnOffButton ref="onOffButton" :checked="checked" :inSize="inSize" @change="toggle($event)"></OnOffButton>
  <span @click="toggle">{{ text }}</span>

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
    },
    created() {
    },
    mounted() {
      this.isOn = this.checked;
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
          this.$emit('change', this.isOn);
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
  cursor: pointer;
  pointer-events: auto;
  user-select: none;
  gap: 5px;
}

.onoff-button-with-text-container:hover {
  transform: scale(1.05);
  transition: all 0.2s ease-in-out;
}

</style>