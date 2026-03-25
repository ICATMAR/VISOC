<template>
  <span>
    <Transition name="slide-fade">
      <div class="menu-container" v-show="$gui.isMenuOpen">
        <button>Menu</button>
      </div>
    </Transition>
  </span>
</template>

<script>
export default {
  name: "Menu",
  created() {
    
  },
  mounted() {
  },
  data (){
    return {
      nativeWindow: window
    }
  },
  methods: {
    //onclick: function(e){},
  },
  components: {
  }
}
</script>

<style scoped>
.menu-container {
  position: fixed;
  width: 400px;
  right: 0;
  top: 0;
  bottom: 0;
  margin: 0;
  padding: 0;
  z-index: 1;
  background:aqua
}



/* 1. The entering/leaving timing (The "Middle" State) */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: transform 0.5s ease-out, opacity 0.3s ease;
}

/* 2. The "From" state (Start of enter / End of leave) */
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(100%); /* Slide it off to the right */
  opacity: 0;
}

/* 3. The "To" state (End of enter / Start of leave) */
/* Optional: defaults to original CSS if not defined, 
   but good for clarity */
.slide-fade-enter-to,
.slide-fade-leave-from {
  transform: translateX(0);
  opacity: 1;
}
</style>