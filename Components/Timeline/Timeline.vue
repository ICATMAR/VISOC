<template>
  <span class="bottom-section">
    <!-- Timeline -->
    <div class="timeline-container">
      
      <div class="timeline-content">
        <!-- Play button -->
        <button class="play-button"><span class="fa fa-play"></span></button>
        <!-- Timeline -->
        <div class="timeline">
        timeline
        </div>
      </div>

    </div>
  </span>
</template>




<style scoped>
.bottom-section {
  position: fixed;
  bottom: 0px;
  left: 0px;
  right: 0px;
  margin-right: 330px;
  background-color: yellow;
}

.timeline-container {
  position: relative;
  margin: 0 30px;
  padding: 0;
}

.timeline-content {
  max-width: 1800px;
  position: relative;
  width: 100%;
  padding: 0;
  margin: 0 auto;
  display: flex;
  flex-direction: row;
  align-items: flex-end;
}

.play-button {
  margin-right: 15px;
  margin-bottom: 8px;
}

.timeline {
  width: calc(100%);
  background: var(--lightBlue);
}
</style>