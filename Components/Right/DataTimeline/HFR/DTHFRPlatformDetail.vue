<template>
  <!-- The place the HFR Compare view is about - a map point, a buoy or a
       drifter - and where each compared product's data comes from: the mini
       map marks the point and each product's grid point nearest it, with the
       distance between them, since none of them sits exactly on the point. -->
  <div class="horizontal pd-container hfr-pd" v-if="point">
    <i class="fa fa-xmark close-x pd-close-btn clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <!-- Comparison map (left) -->
    <div class="map-container map-clickable" @click="centerMainMap" :title="$t('Click to center main map')">
      <div ref="compareMap" class="pd-map"></div>
    </div>

    <div class="pd-info">
      <!-- Line 1: what it is · lat/lon [copy] -->
      <div class="pd-header">
        <span>{{ $t(kindLabel) }}</span>
        <span>·</span>
        <span class="pd-coords">{{ coordsLabel }}</span>
        <button class="pd-copy-btn clickable" @click="copyCoords" :title="$t('Copy coordinates')">
          <i class="fa fa-copy"></i>
        </button>
      </div>

      <!-- Line 2: name and id -->
      <span class="pd-station-name">{{ point.kind === 'point' ? $t('Map point') : point.name }}<span class="pd-id" v-if="point.kind !== 'point' && point.name !== point.id">{{ point.id }}</span></span>

      <!-- Line 3: the selected hour -->
      <div class="pd-facts">
        <span class="pd-date">{{ formattedDate }}</span>
      </div>

      <!-- Line 4: each compared product - its distance from the point and its
           value at the hour, edged in its colour on the map -->
      <div class="pd-values-wrapper">
        <div class="pd-values-scroll" v-scroll-fade v-drag-scroll>
          <div class="pd-value-item compare-item" v-for="item in products" :key="item.key"
            :style="{ background: item.speed != undefined ? $gui.colorFor('HCSP', item.speed) : 'rgba(255,255,255,0.15)', borderLeftColor: item.color }"
            :title="itemTitle(item)">
            <span class="pd-value-label">{{ $t(item.name) }} · {{ formatDistance(item.distanceKm) }}</span>
            <span class="pd-value-number">
              <template v-if="item.speed != undefined">
                <span :class="{ clickable: $gui.isUnitSwitchable('HCSP') }" class="pd-reading" @click.stop="$gui.cycleUnit('HCSP')">{{ format(item.speed) }}</span>
                <i v-if="item.direction != undefined" class="fa fa-location-arrow"
                  :style="{ transform: `rotate(${item.direction - 45}deg)`, display: 'inline-block' }"></i>
              </template>
              <span v-else class="pd-no-data">{{ $t('No data') }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Where the values at this hour came from -->
      <PDSourceLine :origins="origins" :sources="sources" :note="sourceNote"></PDSourceLine>

      <!-- Switch to the platform's own dashboard, on the same day -->
      <button class="pd-switch-btn clickable" v-if="point.kind === 'buoy'" @click="switchToDashboard">
        <div class="pd-switch-btn-circle">
          <img :src="buoysDashboard.icon" class="pd-switch-btn-icon" alt="">
        </div>
        <span class="pd-switch-btn-label">{{ $t('Switch to dashboard') }}</span>
      </button>
    </div>
  </div>
</template>


<script>
import PDSourceLine from '../Shared/PDSourceLine.vue';

// The map never zooms in further than this (a click right on a grid point
// would otherwise fill the map with one cell)
const MAX_ZOOM = 13;

export default {
  name: "DTHFRPlatformDetail",
  mixins: [window.pdFocusMixin],
  components: { PDSourceLine },
  mounted() {
    this.$nextTick(() => this.drawMap());
  },
  beforeUnmount() {
    this.map?.setTarget(undefined);
  },
  methods: {
    // The mini map: the point (a cross), and per product its nearest grid
    // point (a dot in its colour) joined to the point by a dashed line, with
    // the distance written by it. (An interpolated series' 4 cells, when a
    // product gives them, show faintly.)
    drawMap() {
      const target = this.$refs.compareMap;
      if (!target || !this.point) return;
      if (!this.map) {
        this.vector = new ol.source.Vector();
        this.map = new ol.Map({
          target,
          controls: [],
          interactions: [],
          layers: [...window.createDetailMapLayers(), new ol.layer.Vector({ source: this.vector })],
          view: new ol.View({ center: ol.proj.fromLonLat([this.point.lon, this.point.lat]), zoom: 11 }),
        });
      } else if (this.map.getTargetElement() !== target) {
        this.map.setTarget(target);
      }
      const at = (lon, lat) => ol.proj.fromLonLat([lon, lat]);
      const here = at(this.point.lon, this.point.lat);
      const features = [];
      // Products sharing a grid point (ICATMAR's network on both providers)
      // would hide each other: each one drawn on the same spot gets smaller,
      // so the first shows as a ring around the next
      const drawnAt = new Map();
      this.products.filter(item => item.key !== 'platform').forEach(item => {
        (item.cells ?? []).forEach(cell => {
          const feature = new ol.Feature(new ol.geom.Point(at(cell.lon, cell.lat)));
          feature.setStyle(new ol.style.Style({
            image: new ol.style.Circle({ radius: 2.5, fill: new ol.style.Fill({ color: item.color + '66' }) }),
          }));
          features.push(feature);
        });
        const there = at(item.lon, item.lat);
        const spot = `${item.lon.toFixed(5)},${item.lat.toFixed(5)}`;
        const before = drawnAt.get(spot) ?? 0;
        drawnAt.set(spot, before + 1);
        const line = new ol.Feature(new ol.geom.LineString([here, there]));
        line.setStyle(new ol.style.Style({ stroke: new ol.style.Stroke({ color: item.color, width: 1.2, lineDash: [3, 3] }) }));
        const dot = new ol.Feature(new ol.geom.Point(there));
        dot.setStyle(new ol.style.Style({
          image: new ol.style.Circle({ radius: 6 - before * 2.5, fill: new ol.style.Fill({ color: item.color }), stroke: new ol.style.Stroke({ color: '#222', width: 1 }) }),
          // One distance label per spot
          text: before > 0 ? undefined : new ol.style.Text({
            text: this.formatDistance(item.distanceKm), font: '600 10px Poppins, sans-serif', offsetY: -10,
            fill: new ol.style.Fill({ color: item.color }), stroke: new ol.style.Stroke({ color: '#222', width: 3 }),
          }),
        }));
        features.push(line, dot);
      });
      // The point itself, on top
      const cross = new ol.Feature(new ol.geom.Point(here));
      cross.setStyle(new ol.style.Style({
        image: new ol.style.RegularShape({ points: 4, radius: 7, radius2: 0, angle: Math.PI / 4,
          stroke: new ol.style.Stroke({ color: 'white', width: 2 }) }),
      }));
      features.push(cross);
      this.vector.clear();
      this.vector.addFeatures(features);

      // Fitted to the point and every product's point, once per new set
      const key = `${this.point.lon},${this.point.lat}|` + this.products.map(p => `${p.key}:${p.lon},${p.lat}`).join(';');
      if (key === this.fittedKey) return;
      this.fittedKey = key;
      const extent = ol.extent.boundingExtent([here,
        ...this.products.flatMap(p => [at(p.lon, p.lat), ...(p.cells ?? []).map(c => at(c.lon, c.lat))])]);
      this.map.getView().fit(ol.extent.buffer(extent, 300), { padding: [24, 24, 16, 24], maxZoom: MAX_ZOOM });
    },
    format(speed) {
      const { unit, decimals, toDisplay } = this.$gui.unitFor('HCSP');
      return `${toDisplay(speed).toFixed(decimals)} ${unit}`;
    },
    formatDistance(km) {
      if (km == undefined) return '';
      return km < 0.05 ? '0 km' : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
    },
    // A product's chip, in full: where its point is, how far, the value, and
    // for the buoy the instrument and depth behind its reading
    itemTitle(item) {
      const lines = [`${this.$t(item.name)}: ${item.lat.toFixed(4)}º N, ${item.lon.toFixed(4)}º E`,
        `${this.$t('Distance to the point')}: ${this.formatDistance(item.distanceKm)}`];
      if (item.speed != undefined) lines.push(`${this.format(item.speed)}` + (item.direction != undefined ? ` · ${Math.round(item.direction)}º` : ''));
      if (item.cells?.length) lines.push(this.$t('Interpolated between the 4 grid cells around the point'));
      if (item.key === 'platform' && this.reading) {
        if (this.sensorText !== '–') lines.push(`${this.$t('Sensor')}: ${this.sensorText}`);
        if (this.depthText !== '–') lines.push(`${this.$t('Depth')}: ${this.depthText}`);
      }
      if (item.origin) lines.push(`${this.$t('Source')}: ${item.origin}`);
      return lines.join('\n');
    },
    copyCoords() {
      navigator.clipboard?.writeText(`${this.point.lat}, ${this.point.lon}`);
    },
    centerMainMap() {
      if (this.point) this.$gui.centerMainMapOn(this.point.lon, this.point.lat);
    },
    // Over to the Buoys dashboard on this buoy and this hour, asking its
    // timeline to open on the currents (GUIManager.buoysView - honoured by the
    // buoys timeline once it has that view)
    switchToDashboard() {
      const { id } = this.point;
      const time = new Date(this.$gui.selectedTime);
      this.$gui.buoysView = { mode: 'variable', group: 'currents' };
      this.$gui.selectedDashboard = 'buoys';
      this.$gui.selectedTime = time;
      this.$gui.selectedPlatform = { stationId: id, date: time };
      this.$gui.isDataTimelineOpen = true;
      this.$gui.isPlatformDetailOpen = true;
    },
  },
  computed: {
    point() { return this.$gui.hfrPoint; },
    reading() { return this.$gui.hfrPointReading; },
    products() { return this.$gui.hfrComparePoints; },
    kindLabel() {
      return { buoy: 'Buoy', drifter: 'Drifter', point: 'Comparison' }[this.point?.kind] ?? 'Point';
    },
    coordsLabel() {
      const { lat, lon } = this.point;
      return `${Math.abs(lat).toFixed(3)}° ${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(3)}° ${lon < 0 ? 'W' : 'E'}`;
    },
    // Every product's source at this hour; the buoy's own, or the drifters'
    // (still simulated)
    // Every product's source at this hour, each its own link (the drifters
    // are still simulated)
    origins() {
      const list = [];
      if (this.point?.kind === 'drifter') list.push({ label: this.$t('Simulated data') });
      this.products.forEach(item => {
        if (item.speed == undefined) return;
        (item.origins ?? []).forEach(origin => {
          if (!list.some(o => o.label === origin.label && o.dataset === origin.dataset)) list.push(origin);
        });
      });
      return list;
    },
    sources() {
      return this.point?.kind === 'buoy' ? this.$dataService.buoys.sourcesOf(this.point.id) : [];
    },
    sourceNote() {
      return this.$t('Each product is read at its own grid point nearest the point, as the map shows with their distances. Sources can process the same data differently.');
    },
    // See pdFocusMixin
    mainMapFocusKey() { return this.point ? `${this.point.lon},${this.point.lat}` : null; },
    // The selected cell: the hour ending at the selected time
    formattedDate() {
      const options = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
      if (!this.$gui.timelineUseLocalTime) options.timeZone = 'UTC';
      return new Date(this.$gui.selectedTime).toLocaleString(this.$i18n.locale, options)
        + (this.$gui.timelineUseLocalTime ? '' : ' UTC');
    },
    sensorText() {
      const r = this.reading;
      if (!r?.sensor) return '–';
      return r.instrument && r.instrument !== r.sensor ? `${r.sensor} (${r.instrument})` : r.sensor;
    },
    // Metres below the surface; published negative downward
    depthText() {
      const depth = this.reading?.depth;
      return depth == undefined || !isFinite(depth) ? '–' : `${Math.abs(depth).toFixed(1)} m`;
    },
    buoysDashboard() {
      return this.$gui.dashboards.find(d => d.id === 'buoys') ?? { icon: '' };
    },
  },
  watch: {
    products() { this.$nextTick(() => this.drawMap()); },
    point() { this.fittedKey = null; this.$nextTick(() => this.drawMap()); },
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
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 14px;
  font-size: 0.7rem;
}

/* Edged in the product's colour on the map */
.compare-item {
  border-left: 4px solid transparent;
}

.pd-reading.clickable {
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
