<template>
  <div id="app">
    <!-- MAP -->
    <section class="map-container">

    </section>

    <!-- RIGHT SECTION -->
    <div class="right-section">
      <!-- Menu and list of dashboards -->
      <span class="top-right-section">
        <div class="top-right-container">
          <div> Hello world </div>
          <button>Press me</button>
        </div>
      </span>
      
      <!-- Providers -->
      <div class="providers-container">
        <span>ICATMAR</span>
      </div>

      <!-- Bottom right -->
      <span class="bottom-right-section">
        <div class="bottom-right-container">
          <div>Bottom right</div>
          <button>Press me</button>
        </div>
      </span>

      <!-- Bottom pane -->
      <span class="bottom-pane-section" v-if="false">
        <!-- Bottom panel with data -->
        <div class="bottom-pane-container">
          <div>Data and timeline</div>
        </div>
      </span>
    </div>

    <!-- MENU -->
    <span>
      <div class="menu-container">
        <button>Menu</button>
      </div>
    </span>


    <!-- BOTTOM -->
    <span class="bottom-section">
      <!-- Timeline -->
      <div class="timeline-container">
        <div>Timeline</div>
        <button>Press me</button>
      </div>
    </span>
  </div>
</template>



<style scoped>
#app {
  width: 100vw;
  height: 100dvh; /* Use 100dvh for better mobile viewport handling */
  height: 100vh;
  position: fixed;
  background: blue;
}

.map-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: green;
}

.right-section {
  position: fixed;
  top: 0px;
  bottom: 0px;
  right: 0px;
  left: 0px;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  transition: right .5s ease-out, opacity .7s;
}

.top-right-section {
  flex-grow: 1;
}

.top-right-container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  position: relative;
  pointer-events: none;
  margin-top: 10px;
  margin-bottom: 20px;
  margin-right: 10px;
  height: calc(100% - 30px);
  background-color: purple;

}

.providers-container {
  height: 40px;
  width: 220px;
  margin-right: 110px;
}

.bottom-right-section {
}

.bottom-right-container {
  display: flex;
  flex-direction: column;
  width: 320px;
  margin: 0 8px 8px auto;
  position: relative;
  white-space: nowrap;
  pointer-events: auto;
  background:wheat;
}

.bottom-pane-section {
  align-self: flex-start;
  background: brown;
}

.bottom-pane-container {
  margin: 0;
  padding: 0;
  left: 0;
  right: 0;
  width: 100vw;
  min-height: 100px;
  position: relative;
  pointer-events: auto;
  overflow: unset;
  -webkit-transition: margin-bottom .3s ease-in-out;
  transition: margin-bottom .3s ease-in-out;
}



.menu-container {
  position: fixed;
  width: 400px;
  right: 0;
  top: 0;
  bottom: 0;
  margin: 0;
  padding: 0;
  background:aqua
}





.bottom-section {
  position: fixed;
  bottom: 0px;
  left: 0px;
  right: 0px;
  margin-right: 330px;
  background-color: yellow;
}

.timeline-container {
  max-width: 700px;
  margin: 0 auto;
  padding: 0;
}
</style>