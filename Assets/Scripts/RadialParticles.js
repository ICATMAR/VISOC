// HF radar radials, animated on an OpenLayers map: one particle per radial
// bin, sliding back and forth along the radial direction - out from the
// antenna where the current runs away from it, in where it runs towards it -
// coloured by the speed on the sea water velocity scale.
//
// Ported from HFRadar's radial particles (Assets/Scripts/AnimationEngine/
// ParticleSystems.js, ParticleSystemHF / ParticleHF): a looping path through
// each bin rather than advection, a bell-shaped alpha along it, and trails
// that fade with a destination-in fill. Changed on the way:
// - one canvas for every station, not one per station;
// - strokes batched by colour and alpha (a few dozen per frame instead of one
//   per particle, which HFRadar flagged as slow);
// - the sea water velocity colours (|velocity|) instead of red-white-blue;
// - frames timed with requestAnimationFrame, the step scaled to the time
//   elapsed, so the speed doesn't depend on the frame rate;
// - pixels the fade can never bring to 0 cleaned up now and then (the same
//   residue the ol-wind layer had - see lib/ol-wind/source.txt).
//
// The fields are SourceErddapEUHFR.getRadialField()'s: { lat, lon, velocity,
// direction, qc } arrays, velocity in m/s positive away from the antenna,
// direction the bearing away from it.

const EARTH_RADIUS_KM = 6378;
// Each bin's path: from BEHIND_KM behind it to AHEAD_KM ahead, in the
// direction it moves (HFRadar's 0.5 and 1 km) - never shorter on screen than
// MIN_PATH_PX, or a zoomed-out map shows dots
const BEHIND_KM = 0.5;
const AHEAD_KM = 1;
const MIN_PATH_PX = 10;
// Per HFRadar frame (40 ms): a fixed step plus one per cm/s
const STEP_PER_FRAME = 0.02;
const STEP_PER_CM_S = 0.001;
const HFRADAR_FRAME_MS = 40;
// Trails: what's left of the previous frame (HFRadar's 0.95)
const FADE_ALPHA = 0.95;
// Every RESIDUE_EVERY frames, pixels fainter than RESIDUE_ALPHA are cleared:
// at FADE_ALPHA 0.95 anything below 0.5/(1 - 0.95) = 10 never fades further
const RESIDUE_EVERY = 60;
const RESIDUE_ALPHA = 11;
// Colours and alphas are quantised so strokes can be batched
const COLOR_STEPS = 20;
const ALPHA_STEPS = 4;
const QC_GOOD = 1;

export default class RadialParticles {

  // `colorOf(speed)` gives a speed's CSS colour, `maxSpeed` the end of its
  // scale (m/s, both from GUIManager's HCSP legend)
  constructor(map, { colorOf, maxSpeed, lineWidth = 2 }) {
    this.map = map;
    this.colorOf = colorOf;
    this.maxSpeed = maxSpeed;
    this.lineWidth = lineWidth;
    this.fields = [];
    this.showFlagged = false;
    this.running = false;
    this.frames = 0;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'radial-particles';
    Object.assign(this.canvas.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    // Over the map's layers, under its overlays (markers stay on top)
    const viewport = map.getViewport();
    const layers = viewport.querySelector('.ol-layers');
    viewport.insertBefore(this.canvas, layers ? layers.nextSibling : viewport.firstChild);
    this.ctx = this.canvas.getContext('2d');

    // A moving map: clear and pause, then rebuild the paths where it stopped
    this.onMoveStart = () => { this.moving = true; this.clear(); };
    this.onMoveEnd = () => { this.moving = false; this.layout(); };
    map.on('movestart', this.onMoveStart);
    map.on('moveend', this.onMoveEnd);
    map.on('change:size', this.onMoveEnd);

    this.colors = Array.from({ length: COLOR_STEPS }, (_, i) => this.colorOf((i + 0.5) / COLOR_STEPS * this.maxSpeed));
    this.frame = this.frame.bind(this);
  }

  // The radials to draw, replacing any before
  setFields(fields, { showFlagged = this.showFlagged } = {}) {
    this.fields = fields.filter(Boolean);
    this.showFlagged = showFlagged;
    this.clear();
    this.layout();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = undefined;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stop();
    this.map.un('movestart', this.onMoveStart);
    this.map.un('moveend', this.onMoveEnd);
    this.map.un('change:size', this.onMoveEnd);
    this.canvas.remove();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Every particle's path in pixels for the map as it is now: start and end
  // point, its colour, a random place along it (so they don't pulse together)
  // and its step per HFRadar frame
  layout() {
    const size = this.map.getSize();
    if (!size) return;
    const ratio = window.devicePixelRatio || 1;
    this.ratio = ratio;
    this.canvas.width = Math.round(size[0] * ratio);
    this.canvas.height = Math.round(size[1] * ratio);

    const count = this.fields.reduce((n, f) => n + f.lat.length, 0);
    const path = new Float32Array(count * 4);
    const color = new Uint8Array(count);
    const life = new Float32Array(count);
    const step = new Float32Array(count);
    let n = 0;
    for (const field of this.fields) {
      for (let i = 0; i < field.lat.length; i++) {
        if (!this.showFlagged && field.qc[i] !== QC_GOOD) continue;
        const v = field.velocity[i];
        // Away from the antenna, or towards it
        const heading = (v >= 0 ? field.direction[i] : field.direction[i] + 180) * Math.PI / 180;
        const [x0, y0] = this.pixelAt(field.lat[i], field.lon[i], heading, -BEHIND_KM);
        let [x1, y1] = this.pixelAt(field.lat[i], field.lon[i], heading, AHEAD_KM);
        const length = Math.hypot(x1 - x0, y1 - y0);
        if (length < MIN_PATH_PX) {
          const k = length > 0 ? MIN_PATH_PX / length : 0;
          x1 = x0 + (x1 - x0) * k; y1 = y0 + (y1 - y0) * k;
          if (k === 0) { x1 = x0 + MIN_PATH_PX * Math.sin(heading); y1 = y0 - MIN_PATH_PX * Math.cos(heading); }
        }
        path.set([x0 * ratio, y0 * ratio, x1 * ratio, y1 * ratio], n * 4);
        color[n] = Math.min(COLOR_STEPS - 1, Math.floor(Math.abs(v) / this.maxSpeed * COLOR_STEPS));
        life[n] = Math.random();
        step[n] = STEP_PER_FRAME + Math.abs(v) * 100 * STEP_PER_CM_S;
        n++;
      }
    }
    this.particles = { count: n, path, color, life, step };
  }

  // The pixel `km` from a point along `heading` (radians from north)
  pixelAt(lat, lon, heading, km) {
    const dLat = km * Math.cos(heading) / EARTH_RADIUS_KM * 180 / Math.PI;
    const dLon = km * Math.sin(heading) / EARTH_RADIUS_KM * 180 / Math.PI / Math.cos(lat * Math.PI / 180);
    return this.map.getPixelFromCoordinate(ol.proj.fromLonLat([lon + dLon, lat + dLat])) ?? [NaN, NaN];
  }

  frame(time) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const elapsed = this.lastTime == undefined ? HFRADAR_FRAME_MS : Math.min(time - this.lastTime, 100);
    this.lastTime = time;
    if (this.moving || !this.particles?.count) return;
    this.draw(elapsed / HFRADAR_FRAME_MS);
  }

  // One frame: fade what's there, then each particle's next stretch of path
  draw(frameFraction) {
    const { ctx, canvas } = this;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.pow(FADE_ALPHA, frameFraction)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = this.lineWidth * this.ratio;
    ctx.lineCap = 'round';

    // Segments grouped by colour and alpha, one stroke per group
    const { count, path, color, life, step } = this.particles;
    const groups = new Map();
    for (let i = 0; i < count; i++) {
      // Along its path, back to the start past the end; this frame's stretch
      // runs from there one step on
      const inc = step[i] * frameFraction;
      let from = life[i] + inc;
      if (from > 1) from = 0;
      life[i] = from;
      const to = Math.min(from + inc, 1);
      // Bell-shaped: invisible at both ends, full in the middle (HFRadar's)
      const alpha = 16 * Math.pow((1 - from) * from, 2);
      const a = Math.min(ALPHA_STEPS, Math.round(alpha * ALPHA_STEPS));
      if (a === 0) continue;
      const key = color[i] * (ALPHA_STEPS + 1) + a;
      let list = groups.get(key);
      if (!list) groups.set(key, list = []);
      list.push(i, from, to);
    }
    groups.forEach((list, key) => {
      const c = Math.floor(key / (ALPHA_STEPS + 1)), a = key % (ALPHA_STEPS + 1);
      ctx.strokeStyle = this.colors[c];
      ctx.globalAlpha = a / ALPHA_STEPS;
      ctx.beginPath();
      for (let k = 0; k < list.length; k += 3) {
        const p = list[k] * 4, from = list[k + 1], to = list[k + 2];
        const x0 = path[p], y0 = path[p + 1], dx = path[p + 2] - x0, dy = path[p + 3] - y0;
        ctx.moveTo(x0 + dx * from, y0 + dy * from);
        ctx.lineTo(x0 + dx * to, y0 + dy * to);
      }
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    if (++this.frames % RESIDUE_EVERY === 0) this.clearResidue();
  }

  clearResidue() {
    const { ctx, canvas } = this;
    if (!canvas.width || !canvas.height) return;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    for (let i = 3; i < data.length; i += 4) if (data[i] < RESIDUE_ALPHA) data[i] = 0;
    ctx.putImageData(image, 0, 0);
  }
}
