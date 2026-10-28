<template>
  <!-- The data point the HFR Point view is about: a totals grid point or a
       radial bin, where it is, and its values at the selected hour -->
  <div class="horizontal pd-container" v-if="point">
    <i class="fa fa-xmark close-x pd-close-btn clickable" @click="$gui.isPlatformDetailOpen = false"></i>

    <!-- Map (left): the point; for a radial bin, its station too -->
    <div class="map-container map-clickable" @click="centerMainMap" :title="$t('Click to center main map')">
      <div ref="pointMap" class="pd-map"></div>
      <!-- The unit the radial bin's distance is written in, clicked to switch
           it - for every horizontal distance in the app -->
      <button v-if="radial" class="pd-map-unit" :class="{ clickable: $gui.isUnitSwitchable('HDIST') }"
        :title="$gui.isUnitSwitchable('HDIST') ? $t('Change units') : ''"
        @click.stop="$gui.cycleUnit('HDIST')">
        <i class="fa-solid fa-ruler-horizontal"></i>{{ distanceUnit }}
      </button>
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

      <!-- A radial bin by its range (unit clicked to switch it) and bearing
           from the antenna -->
      <span class="pd-station-name">{{ title }}<span class="pd-id" v-if="radial"
        :title="radial.computed ? $t('Worked out from the station position') : ''">{{ formatDistance(radial.range, false) }}
        <span :class="{ 'clickable pd-unit': $gui.isUnitSwitchable('HDIST') }" :title="$t('Change units')"
          @click="$gui.cycleUnit('HDIST')">{{ distanceUnit }}</span> · {{ Math.round(radial.bearing) }}º<template
          v-if="radial.rangeCell != undefined"> · <span :title="$t('Range cell')">R{{ radial.rangeCell }}</span></template></span></span>

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

// The map never zooms in further than this (as the Compare detail's)
const MAX_ZOOM = 13;
// The cell an hour was read at, in the colour Compare gives its provider's row
const CELL_COLORS = { ICATMAR: '#ff9f43', EU: '#54a0ff' };


export default {
  name: "DTHFRDataPointDetail",
  mixins: [window.pdFocusMixin],
  components: { PDSourceLine },
  mounted() {
    this.$nextTick(() => this.drawMap());
    this.loadGrid();
  },
  beforeUnmount() {
    this.map?.setTarget(undefined);
  },
  methods: {
    // The grid the selected hour was read from, faintly: the totals' grid
    // points with data (as the source of that hour grids them - see
    // DPHFRTotals.getGridPoints), or the station's radial bins with data
    async loadGrid() {
      const p = this.point;
      if (!p) return;
      const hour = new Date(Math.round(new Date(this.$gui.selectedTime).getTime() / 3600000) * 3600000);
      const source = this.origin?.source;
      const key = `${p.kind}|${p.network}|${p.station}|${p.lon},${p.lat}|${hour.toISOString()}|${source}`;
      if (key === this.gridKey) return;
      this.gridKey = key;
      let cells = [];
      try {
        if (p.kind === 'radial') {
          const field = await this.$dataService.hfrstations.getRadials(p.network, p.station, hour);
          if (field) cells = Array.from(field.lat, (lat, i) => ({ lon: field.lon[i], lat }));
        } else {
          cells = await this.$dataService.hfrtotals.getGridPoints(hour, p.provider, p.network, p.lon, p.lat, source);
        }
      } catch (error) {
        console.error('Point detail grid:', error);
      }
      if (key !== this.gridKey) return;
      this.gridCells = cells;
      this.drawMap();
    },
    // The mini map, in the Compare detail's style: the grid faintly, the data
    // point (a cross), and the cell the selected hour was read at - sources
    // grid the radars differently, so it can be next to the point - joined to
    // it by a dashed line with the distance written by it; for a radial bin,
    // its station too
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
      const gridStyle = new ol.style.Style({
        image: new ol.style.Circle({ radius: 2, fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.35)' }) }),
      });
      (this.gridCells ?? []).forEach(cell => {
        const feature = new ol.Feature(new ol.geom.Point(at(cell.lon, cell.lat)));
        feature.setStyle(gridStyle);
        features.push(feature);
      });
      if (p.site) {
        const site = at(p.site.lon, p.site.lat);
        const line = new ol.Feature(new ol.geom.LineString([site, here]));
        // Labelled half-way with the bin's distance from the antenna
        line.setStyle(new ol.style.Style({
          stroke: new ol.style.Stroke({ color: 'white', width: 1.2, lineDash: [3, 3] }),
          text: this.radial ? new ol.style.Text({
            text: this.formatDistance(this.radial.range), font: '600 10px Poppins, sans-serif', placement: 'point',
            fill: new ol.style.Fill({ color: 'white' }), stroke: new ol.style.Stroke({ color: '#222', width: 3 }),
          }) : undefined,
        }));
        const station = new ol.Feature(new ol.geom.Point(site));
        station.setStyle(new ol.style.Style({
          image: new ol.style.Circle({ radius: 5, fill: new ol.style.Fill({ color: '#ff6b6b' }), stroke: new ol.style.Stroke({ color: 'white', width: 1.5 }) }),
          text: new ol.style.Text({ text: p.station, font: '600 10px Poppins, sans-serif', offsetY: -11,
            fill: new ol.style.Fill({ color: 'white' }), stroke: new ol.style.Stroke({ color: '#222', width: 3 }) }),
        }));
        features.push(line, station);
      }
      const used = this.usedCell;
      if (used) {
        const there = at(used.lon, used.lat);
        const line = new ol.Feature(new ol.geom.LineString([here, there]));
        line.setStyle(new ol.style.Style({ stroke: new ol.style.Stroke({ color: used.color, width: 1.2, lineDash: [3, 3] }) }));
        const dot = new ol.Feature(new ol.geom.Point(there));
        dot.setStyle(new ol.style.Style({
          // No distance written by it: the point is snapped to the grid
          image: new ol.style.Circle({ radius: 6, fill: new ol.style.Fill({ color: used.color }), stroke: new ol.style.Stroke({ color: '#222', width: 1 }) }),
        }));
        features.push(line, dot);
      }
      // The data point itself, on top
      const cross = new ol.Feature(new ol.geom.Point(here));
      cross.setStyle(new ol.style.Style({
        image: new ol.style.RegularShape({ points: 4, radius: 7, radius2: 0, angle: Math.PI / 4,
          stroke: new ol.style.Stroke({ color: 'white', width: 2 }) }),
      }));
      features.push(cross);
      this.vector.clear();
      this.vector.addFeatures(features);

      // Fitted to the point, its cell and station, once per new set - wide
      // enough to show a couple of grid points around it (ICATMAR's are ~3 km apart)
      const spots = [here, ...(used ? [at(used.lon, used.lat)] : []), ...(p.site ? [at(p.site.lon, p.site.lat)] : [])];
      const key = spots.map(c => c.map(v => v.toFixed(0)).join(',')).join(';');
      if (key === this.fittedKey) return;
      this.fittedKey = key;
      this.map.getView().fit(ol.extent.buffer(ol.extent.boundingExtent(spots), 7000), { padding: [24, 24, 16, 24], maxZoom: MAX_ZOOM });
    },
    // A radial bin's distance (km) in the unit picked for horizontal
    // distances, with one decimal at any range - the bins are ~1.7 km apart -
    // and with its unit, unless `withUnit` is false
    formatDistance(km, withUnit = true) {
      if (km == undefined) return '';
      const { unit, toDisplay } = this.$gui.unitFor('HDIST');
      const number = toDisplay(km).toFixed(1);
      return withUnit ? `${number} ${unit}` : number;
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
    // Where the selected hour was read (the Point view's origin for it), how
    // far from the data point, in its provider's Compare colour - null for an
    // hour with no value, or a radial bin (its own grid point)
    usedCell() {
      const cell = this.origin?.cell, p = this.point;
      if (!cell || !p || p.kind === 'radial') return null;
      const lat = Number(cell.latitude), lon = Number(cell.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return { lat, lon, color: CELL_COLORS[p.provider] ?? CELL_COLORS.ICATMAR };
    },
    title() {
      const p = this.point;
      return p.kind === 'radial' ? `${p.station} · ${p.network}` : p.network;
    },
    // A radial bin's range and bearing from its antenna (see
    // geo.radialRangeBearing) - null for a totals grid point
    radial() {
      return this.point?.kind === 'radial' ? window.radialRangeBearing(this.point) ?? null : null;
    },
    distanceUnit() { return this.$gui.unitFor('HDIST').unit; },
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
    point() { this.fittedKey = null; this.gridCells = []; this.$nextTick(() => this.drawMap()); this.loadGrid(); },
    usedCell() { this.$nextTick(() => this.drawMap()); },
    // The distance on the map is drawn into it, so a new unit redraws it
    distanceUnit() { this.drawMap(); },
    origin() { this.loadGrid(); },
    '$gui.selectedTime'() { this.loadGrid(); },
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

.pd-unit.clickable {
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* The distance's unit, over the map's bottom right corner (as Compare's) */
.pd-container > .map-container {
  position: relative;
}
.pd-map-unit {
  position: absolute;
  right: 4px;
  bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border: none;
  border-radius: 8px;
  background: rgba(34, 34, 34, 0.75);
  color: white;
  font: 600 10px Poppins, sans-serif;
}
.pd-map-unit.clickable:hover {
  background: rgba(34, 34, 34, 0.95);
  text-decoration: underline;
}
</style>
