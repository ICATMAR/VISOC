<template>
  <!-- The data point the HFR Point view is about: a totals grid point or a
       radial bin, where it is, and its values at the selected hour -->
  <div class="horizontal pd-container" v-if="point">
    <i class="fa fa-xmark close-x pd-close-btn clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <!-- Map (left): the point; for a radial bin, its station too -->
    <div class="map-container map-clickable" @click="centerMainMap" :title="$t('Click to center main map')">
      <div ref="pointMap" class="pd-map"></div>
    </div>

    <div class="pd-info">
      <div class="pd-header">
        <span>{{ $t(point.kind === 'radial' ? 'Radial bin' : 'HF radar grid point') }}</span>
        <span>·</span>
        <span class="pd-coords">{{ coordsLabel }}</span>
        <button class="pd-copy-btn clickable" @click="copyCoords" :title="$t('Copy coordinates')">
          <i class="fa fa-copy"></i>
        </button>
      </div>

      <span class="pd-station-name">{{ title }}<span class="pd-id" v-if="subtitle">{{ subtitle }}</span></span>

      <div class="pd-facts">
        <span class="pd-date">{{ formattedDate }}</span>
      </div>

      <!-- Every row of the Point view at the hour -->
      <div class="pd-values-wrapper">
        <div class="pd-values-scroll" v-scroll-fade v-drag-scroll>
          <div class="pd-value-item" v-for="item in values" :key="item.label" :title="item.title"
            :class="{ 'pd-value-missing': item.missing }"
            :style="item.speed != undefined ? { background: $gui.colorFor('HCSP', item.speed) } : {}">
            <span class="pd-value-label">{{ item.label }}</span>
            <span class="pd-value-number">{{ item.value }}
              <i v-if="item.direction != undefined" class="fa fa-location-arrow"
                :style="{ transform: `rotate(${item.direction - 45}deg)`, display: 'inline-block' }"></i>
            </span>
          </div>
        </div>
      </div>

      <PDSourceLine v-if="origin" :origins="[origin]"></PDSourceLine>
    </div>
  </div>
</template>


<script>
import PDSourceLine from '../Shared/PDSourceLine.vue';

export default {
  name: "DTHFRDataPointDetail",
  mixins: [window.pdFocusMixin],
  components: { PDSourceLine },
  mounted() {
    this.$nextTick(() => this.drawMap());
  },
  beforeUnmount() {
    this.map?.setTarget(undefined);
  },
  methods: {
    drawMap() {
      const target = this.$refs.pointMap;
      const p = this.point;
      if (!target || !p) return;
      const at = (lon, lat) => ol.proj.fromLonLat([lon, lat]);
      if (!this.map) {
        this.vector = new ol.source.Vector();
        this.map = new ol.Map({
          target, controls: [], interactions: [],
          layers: [...window.createDetailMapLayers(), new ol.layer.Vector({ source: this.vector })],
          view: new ol.View({ center: at(p.lon, p.lat), zoom: 11 }),
        });
      } else if (this.map.getTargetElement() !== target) {
        this.map.setTarget(target);
      }
      const here = at(p.lon, p.lat);
      const features = [];
      if (p.site) {
        const site = at(p.site.lon, p.site.lat);
        const line = new ol.Feature(new ol.geom.LineString([site, here]));
        line.setStyle(new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'white', width: 1.2, lineDash: [3, 3] }) }));
        const station = new ol.Feature(new ol.geom.Point(site));
        station.setStyle(new ol.style.Style({
          image: new ol.style.Circle({ radius: 5, fill: new ol.style.Fill({ color: '#ff6b6b' }), stroke: new ol.style.Stroke({ color: 'white', width: 1.5 }) }),
          text: new ol.style.Text({ text: p.station, font: '600 10px Poppins, sans-serif', offsetY: -11,
            fill: new ol.style.Fill({ color: 'white' }), stroke: new ol.style.Stroke({ color: '#222', width: 3 }) }),
        }));
        features.push(line, station);
      }
      const dot = new ol.Feature(new ol.geom.Point(here));
      dot.setStyle(new ol.style.Style({
        image: new ol.style.Circle({ radius: 5, fill: new ol.style.Fill({ color: 'white' }), stroke: new ol.style.Stroke({ color: '#222', width: 1.5 }) }),
      }));
      features.push(dot);
      this.vector.clear();
      this.vector.addFeatures(features);
      const extent = ol.extent.boundingExtent(p.site ? [here, at(p.site.lon, p.site.lat)] : [here]);
      this.map.getView().fit(ol.extent.buffer(extent, 1500), { padding: [24, 24, 16, 24], maxZoom: 12 });
    },
    copyCoords() {
      navigator.clipboard?.writeText(`${this.point.lat}, ${this.point.lon}`);
    },
    centerMainMap() {
      if (this.point) this.$gui.centerMainMapOn(this.point.lon, this.point.lat);
    },
  },
  computed: {
    point() { return this.$gui.hfrDataPoint; },
    values() { return this.$gui.hfrDataPointValues; },
    origin() { return this.$gui.hfrDataPointOrigin; },
    title() {
      const p = this.point;
      return p.kind === 'radial' ? `${p.station} · ${p.network}` : p.network;
    },
    // A radial bin by its range and bearing from the antenna
    subtitle() {
      const p = this.point;
      if (p.kind !== 'radial') return '';
      return p.axisNames?.[0] === 'RNGE' ? `${p.a.toFixed(1)} km · ${Math.round(p.b)}º` : '';
    },
    coordsLabel() {
      const { lat, lon } = this.point;
      return `${Math.abs(lat).toFixed(3)}° ${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(3)}° ${lon < 0 ? 'W' : 'E'}`;
    },
    formattedDate() {
      const options = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
      if (!this.$gui.timelineUseLocalTime) options.timeZone = 'UTC';
      return new Date(this.$gui.selectedTime).toLocaleString(this.$i18n.locale, options)
        + (this.$gui.timelineUseLocalTime ? '' : ' UTC');
    },
    // See pdFocusMixin
    mainMapFocusKey() { return this.point ? `${this.point.lon},${this.point.lat}` : null; },
  },
  watch: {
    point() { this.$nextTick(() => this.drawMap()); },
  },
}
</script>


<style scoped>
.pd-id {
  margin-left: 6px;
  font-weight: normal;
  opacity: 0.6;
  font-size: 0.8rem;
}
.pd-facts {
  display: flex;
  flex-direction: row;
  gap: 4px 14px;
  font-size: 0.7rem;
}
.pd-value-missing {
  opacity: 0.5;
}
</style>
