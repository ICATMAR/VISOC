(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('ol/layer'), require('ol/proj'), require('ol/renderer/canvas/Layer'), require('ol/transform'), require('ol/extent')) :
  typeof define === 'function' && define.amd ? define(['exports', 'ol/layer', 'ol/proj', 'ol/renderer/canvas/Layer', 'ol/transform', 'ol/extent'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.OlWind = {}, global.ol.layer, global.ol.proj, global.ol.renderer.canvas.ImageLayer, global.ol.transform, global.ol.extent));
})(this, (function (exports, layer, proj, CanvasLayerRenderer, transform, extent) { 'use strict';

  const hasOwnProperty = Object.prototype.hasOwnProperty;
  const symToStringTag = typeof Symbol !== "undefined" ? Symbol.toStringTag : void 0;
  function baseGetTag(value) {
    if (value === null) {
      return value === void 0 ? "[object Undefined]" : "[object Null]";
    }
    if (!(symToStringTag && symToStringTag in Object(value))) {
      return toString.call(value);
    }
    const isOwn = hasOwnProperty.call(value, symToStringTag);
    const tag = value[symToStringTag];
    let unmasked = false;
    try {
      value[symToStringTag] = void 0;
      unmasked = true;
    } catch (e) {
    }
    const result = Object.prototype.toString.call(value);
    if (unmasked) {
      if (isOwn) {
        value[symToStringTag] = tag;
      } else {
        delete value[symToStringTag];
      }
    }
    return result;
  }
  function isFunction(value) {
    if (!isObject(value)) {
      return false;
    }
    const tag = baseGetTag(value);
    return tag === "[object Function]" || tag === "[object AsyncFunction]" || tag === "[object GeneratorFunction]" || tag === "[object Proxy]";
  }
  function isObject(value) {
    const type = typeof value;
    return value !== null && (type === "object" || type === "function");
  }
  function isString(value) {
    if (value == null) {
      return false;
    }
    return typeof value === "string" || value.constructor !== null && value.constructor === String;
  }
  function isNumber(value) {
    return Object.prototype.toString.call(value) === "[object Number]" && !isNaN(value);
  }
  function isArray(arr) {
    return Array.isArray(arr);
  }
  function assign(target, ...sources) {
    return Object.assign(target, ...sources);
  }
  function warnLog(msg, n) {
    console.warn(`${n || "wind-layer"}: ${msg}`);
  }
  const warnings = {};
  function warnOnce(namespaces, msg) {
    if (!warnings[msg]) {
      warnLog(msg, namespaces);
      warnings[msg] = true;
    }
  }
  function floorMod(a, n) {
    return a - n * Math.floor(a / n);
  }
  function isValide(val) {
    return val !== void 0 && val !== null && !isNaN(val);
  }
  function formatData(data, options = {}) {
    let uComp = void 0;
    let vComp = void 0;
    data.forEach(function(record) {
      switch (record.header.parameterCategory + "," + record.header.parameterNumber) {
        case "1,2":
        case "2,2":
          uComp = record;
          break;
        case "1,3":
        case "2,3":
          vComp = record;
          break;
      }
    });
    if (!vComp || !uComp) {
      return void 0;
    }
    const header = uComp.header;
    const vectorField = new Field({
      xmin: header.lo1,
      // 一般格点数据是按照矩形范围来切割，所以定义其经纬度范围
      ymin: header.la1,
      xmax: header.lo2,
      ymax: header.la2,
      deltaX: header.dx,
      // x（经度）增量
      deltaY: header.dy,
      // y（维度）增量
      cols: header.nx,
      // 列（可由 `(xmax - xmin) / deltaX` 得到）
      rows: header.ny,
      // 行
      us: uComp.data,
      // U分量
      vs: vComp.data,
      // V分量
      ...options
    });
    return vectorField;
  }
  class Vector {
    constructor(u, v) {
      this.u = u;
      this.v = v;
      this.m = this.magnitude();
    }
    /**
     * 向量值（这里指风速）
     * @returns {Number}
     */
    magnitude() {
      return Math.sqrt(this.u ** 2 + this.v ** 2);
    }
    /**
     * 流体方向 （这里指风向，范围为0-360º）
     * N is 0º and E is 90º
     * @returns {Number}
     */
    directionTo() {
      const verticalAngle = Math.atan2(this.u, this.v);
      let inDegrees = verticalAngle * (180 / Math.PI);
      if (inDegrees < 0) {
        inDegrees += 360;
      }
      return inDegrees;
    }
    /**
     * Angle in degrees (0 to 360º) From x-->
     * N is 0º and E is 90º
     * @returns {Number}
     */
    directionFrom() {
      const a = this.directionTo();
      return (a + 180) % 360;
    }
  }
  class Field {
    constructor(params) {
      this.grid = [];
      this.xmin = params.xmin;
      this.xmax = params.xmax;
      this.ymin = params.ymin;
      this.ymax = params.ymax;
      this.cols = params.cols;
      this.rows = params.rows;
      this.us = params.us;
      this.vs = params.vs;
      this.deltaX = params.deltaX;
      this.deltaY = params.deltaY;
      this.flipY = Boolean(params.flipY);
      this.ymin = Math.min(params.ymax, params.ymin);
      this.ymax = Math.max(params.ymax, params.ymin);
      if (!(this.deltaY < 0 && this.ymin < this.ymax)) {
        if (params.flipY === void 0) {
          this.flipY = true;
        }
        console.warn("[wind-core]: The data is flipY");
      }
      this.isFields = true;
      const cols = Math.ceil((this.xmax - this.xmin) / params.deltaX);
      const rows = Math.ceil((this.ymax - this.ymin) / params.deltaY);
      if (cols !== this.cols || rows !== this.rows) {
        console.warn("[wind-core]: The data grid not equal");
      }
      this.isContinuous = Math.floor(this.cols * params.deltaX) >= 360;
      this.translateX = "translateX" in params ? params.translateX : this.xmax > 180;
      if ("wrappedX" in params) {
        warnOnce("[wind-core]: ", "`wrappedX` namespace will deprecated please use `translateX` instead\uFF01");
      }
      this.wrapX = Boolean(params.wrapX);
      this.grid = this.buildGrid();
      this.range = this.calculateRange();
    }
    // from https://github.com/sakitam-fdd/wind-layer/blob/95368f9433/src/windy/windy.js#L110
    buildGrid() {
      const grid = [];
      let p = 0;
      const { rows, cols, us, vs } = this;
      for (let j = 0; j < rows; j++) {
        const row = [];
        for (let i = 0; i < cols; i++, p++) {
          const u = us[p];
          const v = vs[p];
          const valid = this.isValid(u) && this.isValid(v);
          row[i] = valid ? new Vector(u, v) : null;
        }
        if (this.isContinuous) {
          row.push(row[0]);
        }
        grid[j] = row;
      }
      return grid;
    }
    /**
     * release data
     */
    release() {
      this.grid = [];
    }
    /**
     * grib data extent
     * 格点数据范围
     */
    extent() {
      return [this.xmin, this.ymin, this.xmax, this.ymax];
    }
    /**
     * Bilinear interpolation for Vector
     * 针对向量进行双线性插值
     * https://en.wikipedia.org/wiki/Bilinear_interpolation
     * @param   {Number} x
     * @param   {Number} y
     * @param   {Number[]} g00
     * @param   {Number[]} g10
     * @param   {Number[]} g01
     * @param   {Number[]} g11
     * @returns {Vector}
     */
    bilinearInterpolateVector(x, y, g00, g10, g01, g11) {
      const rx = 1 - x;
      const ry = 1 - y;
      const a = rx * ry;
      const b = x * ry;
      const c = rx * y;
      const d = x * y;
      const u = g00.u * a + g10.u * b + g01.u * c + g11.u * d;
      const v = g00.v * a + g10.v * b + g01.v * c + g11.v * d;
      return new Vector(u, v);
    }
    /**
     * calculate vector value range
     */
    calculateRange() {
      if (!this.grid || !this.grid[0])
        return;
      const rows = this.grid.length;
      const cols = this.grid[0].length;
      let min;
      let max;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const vec = this.grid[j][i];
          if (vec !== null) {
            const val = vec.m || vec.magnitude();
            if (min === void 0) {
              min = val;
            } else if (max === void 0) {
              max = val;
              min = Math.min(min, max);
              max = Math.max(min, max);
            } else {
              min = Math.min(val, min);
              max = Math.max(val, max);
            }
          }
        }
      }
      return [min, max];
    }
    /**
     * 检查 uv是否合法
     * @param x
     * @private
     */
    isValid(x) {
      return x !== null && x !== void 0;
    }
    getWrappedLongitudes() {
      let xmin = this.xmin;
      let xmax = this.xmax;
      if (this.translateX) {
        if (this.isContinuous) {
          xmin = -180;
          xmax = 180;
        } else {
          xmax = this.xmax - 360;
          xmin = this.xmin - 360;
        }
      }
      return [xmin, xmax];
    }
    contains(lon, lat) {
      const [xmin, xmax] = this.getWrappedLongitudes();
      if (xmax > 180 && lon >= -180 && lon <= xmax - 360) {
        lon += 360;
      } else if (xmin < -180 && lon <= 180 && lon >= xmin + 360) {
        lon -= 360;
      }
      const longitudeIn = lon >= xmin && lon <= xmax;
      let latitudeIn;
      if (this.deltaY >= 0) {
        latitudeIn = lat >= this.ymin && lat <= this.ymax;
      } else {
        latitudeIn = lat >= this.ymax && lat <= this.ymin;
      }
      return longitudeIn && latitudeIn;
    }
    /**
     * 获取经纬度所在的位置索引
     * @param lon
     * @param lat
     */
    getDecimalIndexes(lon, lat) {
      const i = floorMod(lon - this.xmin, 360) / this.deltaX;
      if (this.flipY) {
        const j = (this.ymax - lat) / this.deltaY;
        return [i, j];
      } else {
        const j = (this.ymin + lat) / this.deltaY;
        return [i, j];
      }
    }
    /**
     * Nearest value at lon-lat coordinates
     * 线性插值
     * @param lon
     * @param lat
     */
    valueAt(lon, lat) {
      let flag = false;
      if (this.wrapX) {
        flag = true;
      } else if (this.contains(lon, lat)) {
        flag = true;
      }
      if (!flag)
        return null;
      const indexes = this.getDecimalIndexes(lon, lat);
      const ii = Math.floor(indexes[0]);
      const jj = Math.floor(indexes[1]);
      const ci = this.clampColumnIndex(ii);
      const cj = this.clampRowIndex(jj);
      return this.valueAtIndexes(ci, cj);
    }
    /**
     * Get interpolated grid value lon-lat coordinates
     * 双线性插值
     * @param lon
     * @param lat
     */
    interpolatedValueAt(lon, lat) {
      let flag = false;
      if (this.wrapX) {
        flag = true;
      } else if (this.contains(lon, lat)) {
        flag = true;
      }
      if (!flag)
        return null;
      const [i, j] = this.getDecimalIndexes(lon, lat);
      return this.interpolatePoint(i, j);
    }
    hasValueAt(lon, lat) {
      const value = this.valueAt(lon, lat);
      return value !== null;
    }
    /**
     * 基于向量的双线性插值
     * @param i
     * @param j
     */
    interpolatePoint(i, j) {
      const indexes = this.getFourSurroundingIndexes(i, j);
      const [fi, ci, fj, cj] = indexes;
      const values = this.getFourSurroundingValues(fi, ci, fj, cj);
      if (values) {
        const [g00, g10, g01, g11] = values;
        return this.bilinearInterpolateVector(i - fi, j - fj, g00, g10, g01, g11);
      }
      return null;
    }
    /**
     * Check the column index is inside the field,
     * adjusting to min or max when needed
     * @private
     * @param   {Number} ii - index
     * @returns {Number} i - inside the allowed indexes
     */
    clampColumnIndex(ii) {
      let i = ii;
      if (ii < 0) {
        i = 0;
      }
      const maxCol = this.cols - 1;
      if (ii > maxCol) {
        i = maxCol;
      }
      return i;
    }
    /**
     * Check the row index is inside the field,
     * adjusting to min or max when needed
     * @private
     * @param   {Number} jj index
     * @returns {Number} j - inside the allowed indexes
     */
    clampRowIndex(jj) {
      let j = jj;
      if (jj < 0) {
        j = 0;
      }
      const maxRow = this.rows - 1;
      if (jj > maxRow) {
        j = maxRow;
      }
      return j;
    }
    /**
     * 计算索引位置周围的数据
     * @private
     * @param   {Number} i - decimal index
     * @param   {Number} j - decimal index
     * @returns {Array} [fi, ci, fj, cj]
     */
    getFourSurroundingIndexes(i, j) {
      const fi = Math.floor(i);
      let ci = fi + 1;
      if (this.isContinuous && ci >= this.cols) {
        ci = 0;
      }
      ci = this.clampColumnIndex(ci);
      const fj = this.clampRowIndex(Math.floor(j));
      const cj = this.clampRowIndex(fj + 1);
      return [fi, ci, fj, cj];
    }
    /**
     * Get four surrounding values or null if not available,
     * from 4 integer indexes
     * @private
     * @param   {Number} fi
     * @param   {Number} ci
     * @param   {Number} fj
     * @param   {Number} cj
     * @returns {Array}
     */
    getFourSurroundingValues(fi, ci, fj, cj) {
      let row;
      if (row = this.grid[fj]) {
        const g00 = row[fi];
        const g10 = row[ci];
        if (this.isValid(g00) && this.isValid(g10) && (row = this.grid[cj])) {
          const g01 = row[fi];
          const g11 = row[ci];
          if (this.isValid(g01) && this.isValid(g11)) {
            return [g00, g10, g01, g11];
          }
        }
      }
      return null;
    }
    /**
     * Value for grid indexes
     * @param   {Number} i - column index (integer)
     * @param   {Number} j - row index (integer)
     * @returns {Vector|Number}
     */
    valueAtIndexes(i, j) {
      return this.grid[j][i];
    }
    /**
     * Lon-Lat for grid indexes
     * @param   {Number} i - column index (integer)
     * @param   {Number} j - row index (integer)
     * @returns {Number[]} [lon, lat]
     */
    lonLatAtIndexes(i, j) {
      const lon = this.longitudeAtX(i);
      const lat = this.latitudeAtY(j);
      return [lon, lat];
    }
    /**
     * Longitude for grid-index
     * @param   {Number} i - column index (integer)
     * @returns {Number} longitude at the center of the cell
     */
    longitudeAtX(i) {
      const halfXPixel = this.deltaX / 2;
      let lon = this.xmin + halfXPixel + i * this.deltaX;
      if (this.translateX) {
        lon = lon > 180 ? lon - 360 : lon;
      }
      return lon;
    }
    /**
     * Latitude for grid-index
     * @param   {Number} j - row index (integer)
     * @returns {Number} latitude at the center of the cell
     */
    latitudeAtY(j) {
      const halfYPixel = this.deltaY / 2;
      return this.ymax - halfYPixel - j * this.deltaY;
    }
    /**
     * 生成粒子位置
     * @param o
     * @param width
     * @param height
     * @param unproject
     * @return IPosition
     */
    randomize(o = {}, width, height, unproject) {
      const i = Math.random() * (width || this.cols) | 0;
      const j = Math.random() * (height || this.rows) | 0;
      const coords = unproject([i, j]);
      if (coords !== null) {
        o.x = coords[0];
        o.y = coords[1];
      } else {
        o.x = this.longitudeAtX(i);
        o.y = this.latitudeAtY(j);
      }
      return o;
    }
    /**
     * 判断是否是 `Field` 的实例
     * @return boolean
     */
    checkFields() {
      return this.isFields;
    }
  }
  const defaultOptions = {
    globalAlpha: 0.9,
    // 全局透明度
    lineWidth: 1,
    // 线条宽度
    colorScale: "#fff",
    velocityScale: 1 / 25,
    // particleAge: 90,
    maxAge: 90,
    // alias for particleAge
    // particleMultiplier: 1 / 300, // TODO: PATHS = Math.round(width * height * particleMultiplier);
    paths: 800,
    frameRate: 20,
    useCoordsDraw: true
  };
  function indexFor(m, min, max, colorScale) {
    return Math.max(0, Math.min(colorScale.length - 1, Math.round((m - min) / (max - min) * (colorScale.length - 1))));
  }
  class WindCore {
    constructor(ctx, options, field) {
      this.particles = [];
      this.generated = false;
      this.ctx = ctx;
      if (!this.ctx) {
        throw new Error("ctx error");
      }
      this.animate = this.animate.bind(this);
      this.framesSinceResidue = 0; // VISOC patch: see render()
      this.setOptions(options);
      if (field) {
        this.updateData(field);
      }
    }
    static {
      this.Field = Field;
    }
    /**
     * 设置配置项
     * @param options
     */
    setOptions(options) {
      this.options = { ...defaultOptions, ...options };
      const { width, height } = this.ctx.canvas;
      if ("particleAge" in options && !("maxAge" in options) && isNumber(this.options.particleAge)) {
        this.options.maxAge = this.options.particleAge;
      }
      if ("particleMultiplier" in options && !("paths" in options) && isNumber(this.options.particleMultiplier)) {
        this.options.paths = Math.round(width * height * this.options.particleMultiplier);
      }
      this.prerender();
    }
    /**
     * 获取配置项
     */
    getOptions() {
      return this.options;
    }
    /**
     * 更新数据
     * @param field
     */
    updateData(field) {
      this.field = field;
      if (!this.generated) {
        return;
      }
      this.particles = this.prepareParticlePaths();
    }
    // @ts-ignore
    project(...args) {
      throw new Error("project must be overriden");
    }
    // @ts-ignore
    unproject(...args) {
      throw new Error("unproject must be overriden");
    }
    /**
     * 判断位置是否在当前视窗内
     * @param coordinates
     */
    intersectsCoordinate(coordinates) {
      throw new Error("must be overriden");
    }
    /**
     * 清空当前画布
     */
    clearCanvas() {
      this.stop();
      this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
      this.forceStop = false;
    }
    isStop() {
      return !this.starting;
    }
    /**
     * 启动粒子动画
     */
    start() {
      this.starting = true;
      this.forceStop = false;
      this.then = Date.now();
      this.animate();
    }
    /**
     * 停止粒子动画
     */
    stop() {
      cancelAnimationFrame(this.animationLoop);
      this.starting = false;
      this.forceStop = true;
    }
    animate() {
      if (this.animationLoop) {
        cancelAnimationFrame(this.animationLoop);
      }
      this.animationLoop = requestAnimationFrame(this.animate);
      const now = Date.now();
      const delta = now - this.then;
      if (delta > this.options.frameRate) {
        this.then = now - delta % this.options.frameRate;
        this.render();
      }
    }
    /**
     * 渲染前处理
     */
    prerender() {
      this.generated = false;
      if (!this.field) {
        return;
      }
      this.particles = this.prepareParticlePaths();
      this.generated = true;
      if (!this.starting && !this.forceStop) {
        this.starting = true;
        this.then = Date.now();
        this.animate();
      }
    }
    /**
     * 开始渲染
     */
    render() {
      this.moveParticles();
      this.drawParticles();
      // VISOC patch: residue cleanup. The trails fade with a destination-in
      // fill each frame, but with 8-bit alpha a pixel below a few units
      // rounds back to itself and never reaches zero - a faint haze builds up
      // wherever particles have been. Every `residueEvery` frames, pixels
      // under `residueAlpha` are cleared outright. Off unless asked for.
      if (this.options.residueEvery > 0 && ++this.framesSinceResidue >= this.options.residueEvery) {
        this.framesSinceResidue = 0;
        this.clearResidue(this.options.residueAlpha ?? 8);
      }
      this.postrender();
    }
    // VISOC patch: see render(). Only over the part of the canvas the field
    // covers - particles never leave it - and a pixel at a time as one 32-bit
    // word rather than four bytes.
    clearResidue(threshold) {
      const { width, height } = this.ctx.canvas;
      if (!width || !height) return;
      let x0 = 0, y0 = 0, x1 = width, y1 = height;
      const bounds = this.field?.extent?.();
      if (bounds) {
        const corners = [[bounds[0], bounds[1]], [bounds[0], bounds[3]], [bounds[2], bounds[1]], [bounds[2], bounds[3]]]
          .map(corner => this.project(corner)).filter(Boolean);
        if (corners.length === 4) {
          x0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[0]))) - 2);
          y0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[1]))) - 2);
          x1 = Math.min(width, Math.ceil(Math.max(...corners.map(c => c[0]))) + 2);
          y1 = Math.min(height, Math.ceil(Math.max(...corners.map(c => c[1]))) + 2);
        }
      }
      if (x1 <= x0 || y1 <= y0) return;
      const image = this.ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
      // RGBA bytes read as little-endian words: alpha is the top byte
      const pixels = new Uint32Array(image.data.buffer);
      const limit = threshold << 24 >>> 0;
      let changed = false;
      for (let i = 0; i < pixels.length; i++) {
        const pixel = pixels[i];
        if (pixel !== 0 && (pixel & 0xFF000000) >>> 0 < limit) {
          pixels[i] = 0;
          changed = true;
        }
      }
      if (changed) this.ctx.putImageData(image, x0, y0);
    }
    /**
     * each frame render end
     */
    postrender() {
    }
    moveParticles() {
      const { width, height } = this.ctx.canvas;
      const particles = this.particles;
      const maxAge = this.options.maxAge;
      const velocityScale = isFunction(this.options.velocityScale) ? this.options.velocityScale() : this.options.velocityScale;
      let i = 0;
      const len = particles.length;
      for (; i < len; i++) {
        const particle = particles[i];
        if (particle.age > maxAge) {
          // VISOC patch: respawn where there is data (see spawn), with a
          // full life - only a particle's first life has a random age, and
          // one that never managed to start (born unset) is still due it
          particle.age = particle.born ? 0 : this.randomize();
          this.spawn(particle, width, height);
        }
        const x = particle.x;
        const y = particle.y;
        const vector = this.field.interpolatedValueAt(x, y);
        if (vector === null) {
          particle.age = maxAge;
        } else {
          const xt = x + vector.u * velocityScale;
          const yt = y + vector.v * velocityScale;
          if (this.field.hasValueAt(xt, yt)) {
            particle.xt = xt;
            particle.yt = yt;
            particle.m = vector.m;
          } else {
            particle.x = xt;
            particle.y = yt;
            particle.age = maxAge;
          }
        }
        particle.age++;
      }
    }
    fadeIn() {
      const prev = this.ctx.globalCompositeOperation;
      this.ctx.globalCompositeOperation = "destination-in";
      this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
      this.ctx.globalCompositeOperation = prev;
    }
    drawParticles() {
      const particles = this.particles;
      this.fadeIn();
      this.ctx.globalAlpha = this.options.globalAlpha;
      this.ctx.fillStyle = `rgba(0, 0, 0, ${this.options.globalAlpha})`;
      this.ctx.lineWidth = isNumber(this.options.lineWidth) ? this.options.lineWidth : 1;
      this.ctx.strokeStyle = isString(this.options.colorScale) ? this.options.colorScale : "#fff";
      let i = 0;
      const len = particles.length;
      if (this.field && len > 0) {
        let min;
        let max;
        if (isValide(this.options.minVelocity) && isValide(this.options.maxVelocity)) {
          min = this.options.minVelocity;
          max = this.options.maxVelocity;
        } else {
          [min, max] = this.field.range;
        }
        for (; i < len; i++) {
          this[this.options.useCoordsDraw ? "drawCoordsParticle" : "drawPixelParticle"](particles[i], min, max);
        }
      }
    }
    /**
     * 用于绘制像素粒子
     * @param particle
     * @param min
     * @param max
     */
    drawPixelParticle(particle, min, max) {
      const pointPrev = [particle.x, particle.y];
      const pointNext = [particle.xt, particle.yt];
      if (pointNext && pointPrev && isValide(pointNext[0]) && isValide(pointNext[1]) && isValide(pointPrev[0]) && isValide(pointPrev[1]) && particle.age <= this.options.maxAge) {
        this.ctx.beginPath();
        this.ctx.moveTo(pointPrev[0], pointPrev[1]);
        this.ctx.lineTo(pointNext[0], pointNext[1]);
        if (isFunction(this.options.colorScale)) {
          this.ctx.strokeStyle = this.options.colorScale(particle.m);
        } else if (Array.isArray(this.options.colorScale)) {
          const colorIdx = indexFor(particle.m, min, max, this.options.colorScale);
          this.ctx.strokeStyle = this.options.colorScale[colorIdx];
        }
        if (isFunction(this.options.lineWidth)) {
          this.ctx.lineWidth = this.options.lineWidth(particle.m);
        }
        particle.x = particle.xt;
        particle.y = particle.yt;
        this.ctx.stroke();
      }
    }
    /**
     * 用于绘制坐标粒子
     * @param particle
     * @param min
     * @param max
     */
    drawCoordsParticle(particle, min, max) {
      const source = [particle.x, particle.y];
      const target = [particle.xt, particle.yt];
      if (target && source && isValide(target[0]) && isValide(target[1]) && isValide(source[0]) && isValide(source[1]) && this.intersectsCoordinate(target) && particle.age <= this.options.maxAge) {
        const pointPrev = this.project(source);
        const pointNext = this.project(target);
        if (pointPrev && pointNext) {
          this.ctx.beginPath();
          this.ctx.moveTo(pointPrev[0], pointPrev[1]);
          this.ctx.lineTo(pointNext[0], pointNext[1]);
          particle.x = particle.xt;
          particle.y = particle.yt;
          if (isFunction(this.options.colorScale)) {
            this.ctx.strokeStyle = this.options.colorScale(particle.m);
          } else if (Array.isArray(this.options.colorScale)) {
            const colorIdx = indexFor(particle.m, min, max, this.options.colorScale);
            this.ctx.strokeStyle = this.options.colorScale[colorIdx];
          }
          if (isFunction(this.options.lineWidth)) {
            this.ctx.lineWidth = this.options.lineWidth(particle.m);
          }
          this.ctx.stroke();
        }
      }
    }
    prepareParticlePaths() {
      const { width, height } = this.ctx.canvas;
      const particleCount = typeof this.options.paths === "function" ? this.options.paths(this) : this.options.paths;
      const particles = [];
      if (!this.field) {
        return [];
      }
      let i = 0;
      for (; i < particleCount; i++) {
        // VISOC patch: placed where there is data (see spawn). The random
        // age is kept for this first life only, so the particles don't all
        // reach the end of it together.
        const particle = { age: this.randomize() };
        this.spawn(particle, width, height);
        particles.push(particle);
      }
      return particles;
    }
    // VISOC patch: a random position on screen WHERE THE FIELD HAS DATA,
    // trying up to SPAWN_ATTEMPTS times (as the old AnimationEngine's
    // generatePoint did). Placed anywhere, most particles landed outside a
    // small field (an HF radar's coverage) and died on their first frame - all
    // in the same frame, so they came back as one cohort that kept dying and
    // respawning together. A particle that still misses just dies on its next
    // move and tries again the frame after - and, never having started, keeps
    // its claim to a random first-life age (see moveParticles). Its previous
    // target is dropped so no segment is drawn from where it was.
    spawn(particle, width, height) {
      const SPAWN_ATTEMPTS = 20;
      particle.xt = particle.yt = undefined;
      for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
        this.field.randomize(particle, width, height, this.unproject);
        // The same test moveParticles kills by: an interpolated value needs
        // all four surrounding cells, so the nearest one having data
        // (hasValueAt) isn't enough at a coverage edge or hole
        if (this.field.interpolatedValueAt(particle.x, particle.y) !== null) {
          particle.born = true;
          return true;
        }
      }
      return false;
    }
    randomize() {
      return Math.floor(Math.random() * this.options.maxAge);
    }
  }

  const ViewHint = {
    ANIMATING: 0,
    INTERACTING: 1
  };
  class WindLayerRender extends CanvasLayerRenderer {
    constructor(layer) {
      super(layer);
      this.pixelTransform = transform.create();
      this.inversePixelTransform = transform.create();
    }
    // useContainer(target: HTMLElement, transform: string, backgroundColor: number) 这里在 v6.3.0 后有 break change
    useContainer(target, transform, backgroundColor) {
      super.useContainer(null, transform, backgroundColor);
    }
    getBackground(frameState) {
      if (super.getBackground) {
        return super.getBackground(frameState);
      }
      return "";
    }
    prepareFrame(frameState) {
      const layerState = frameState.layerStatesArray[frameState.layerIndex];
      const viewState = frameState.viewState;
      const hints = frameState.viewHints;
      let renderedExtent = frameState.extent;
      if (layerState.extent !== void 0) {
        renderedExtent = extent.getIntersection(
          renderedExtent,
          proj.fromUserExtent(layerState.extent, viewState.projection)
        );
      }
      if (!hints[ViewHint.ANIMATING] && !frameState.animate && !hints[ViewHint.INTERACTING] && !extent.isEmpty(renderedExtent)) {
        // VISOC patch: a view that changed with no interaction or animation
        // (a programmatic setCenter / fit / resize) is still a new view - the
        // canvas holds the old one's trails. renderFrame resets on viewDirty.
        const key = [
          viewState.center[0], viewState.center[1], viewState.resolution, viewState.rotation,
          frameState.size[0], frameState.size[1], frameState.pixelRatio,
        ].join("|");
        if (key !== this.lastViewKey) {
          this.lastViewKey = key;
          this.viewDirty = true;
        }
        if (this.wind?.isStop?.()) {
          this.wind.start();
        }
        return true;
      } else {
        // VISOC patch: while the map moves the layer isn't drawn, but the
        // animation loop kept painting with the OLD view, and that stale canvas
        // flashed up when the move ended. Stop and clear instead, as the map
        // starts moving; renderFrame starts afresh when it stops.
        if (this.wind && !this.wind.isStop()) this.wind.clearCanvas();
        this.viewDirty = true;
        const layer = this.getLayer();
        return layer.get("forceRender");
      }
    }
    prepareContainer(frameState, target) {
      const size = frameState.size;
      const rotation = frameState.viewState.rotation;
      const pixelRatio = frameState.pixelRatio;
      const width = Math.round(size[0] * pixelRatio);
      const height = Math.round(size[1] * pixelRatio);
      transform.compose(
        this.pixelTransform,
        frameState.size[0] / 2,
        frameState.size[1] / 2,
        1 / pixelRatio,
        1 / pixelRatio,
        rotation,
        -width / 2,
        -height / 2
      );
      transform.makeInverse(this.inversePixelTransform, this.pixelTransform);
      const canvasTransform = transform.toString(this.pixelTransform);
      this.useContainer(target, canvasTransform, this.getBackground(frameState));
      if (!this.containerReused) {
        const canvas = this.context.canvas;
        if (canvas.width != width || canvas.height != height) {
          canvas.width = width;
          canvas.height = height;
        }
        if (canvasTransform !== canvas.style.transform) {
          canvas.style.transform = canvasTransform;
        }
      }
    }
    getRenderContext(frameState) {
      return this.context;
    }
    renderFrame(frameState, target) {
      const layerState = frameState.layerStatesArray[frameState.layerIndex];
      const viewState = frameState.viewState;
      this.prepareContainer(frameState, target);
      const context = this.getRenderContext(frameState);
      context.imageSmoothingEnabled = false;
      this.preRender(context, frameState);
      let clipped = false;
      let render = true;
      if (layerState.extent) {
        const layerExtent = proj.fromUserExtent(layerState.extent, viewState.projection);
        render = extent.intersects(layerExtent, frameState.extent);
        clipped = render && !extent.containsExtent(layerExtent, frameState.extent);
        if (clipped) {
          this.clipUnrotated(context, frameState, layerExtent);
        }
      }
      const layer = this.getLayer();
      const opt = layer.getWindOptions();
      const data = layer.getData();
      // VISOC patch: a new view (see prepareFrame) starts from a clean canvas
      // with every particle re-seeded inside it - otherwise the first segment
      // of each would be drawn from where it was before the move, and the old
      // trails (and their faint residue) would stay painted in the old view's
      // shape. Seeding unprojects through this.frameState, so set it first.
      if (this.viewDirty && this.wind) {
        this.frameState = frameState;
        this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
        this.wind.particles = this.wind.prepareParticlePaths();
      }
      this.viewDirty = false;
      this.execute(this.context, frameState, opt, data);
      this.postRender(this.context, frameState);
      if (clipped) {
        context.restore();
      }
      context.imageSmoothingEnabled = true;
      return this.container;
    }
    setOptions(options) {
      if (this.wind) {
        this.wind.setOptions(options);
      }
    }
    setData(field) {
      if (this.wind) {
        // VISOC patch: new data (another hour, another source) starts from a
        // clean canvas, as a new view does (see renderFrame) - otherwise the
        // previous data's trails, and their faint residue, stay painted under
        // the new ones. updateData re-seeds the particles.
        this.wind.ctx.clearRect(0, 0, this.wind.ctx.canvas.width, this.wind.ctx.canvas.height);
        this.wind.updateData(field);
      }
    }
    execute(context, frameState, opt, data) {
      if (!this.wind) {
        this.wind = new WindCore(context, opt, data);
        this.wind.project = this.getPixelFromCoordinateInternal.bind(this);
        this.wind.unproject = this.getCoordinateFromPixel.bind(this);
        this.wind.intersectsCoordinate = this.intersectsCoordinate.bind(this);
        this.wind.postrender = () => {
        };
        this.wind.prerender();
      }
    }
    getPixelFromCoordinateInternal(coordinate) {
      const frameState = this.frameState;
      if (!frameState) {
        return null;
      } else {
        const viewState = frameState.viewState;
        const pixelRatio = frameState.pixelRatio;
        const point = proj.transform(coordinate, "EPSG:4326", viewState.projection);
        const viewCoordinate = proj.fromUserCoordinate(point, viewState.projection);
        const pixel = transform.apply(frameState.coordinateToPixelTransform, viewCoordinate.slice(0, 2));
        return [pixel[0] * pixelRatio, pixel[1] * pixelRatio];
      }
    }
    getCoordinateFromPixel(pixel) {
      const frameState = this.frameState;
      if (!frameState) {
        return null;
      } else {
        const viewState = frameState.viewState;
        const viewCoordinate = transform.apply(frameState.pixelToCoordinateTransform, pixel.slice(0, 2));
        const coordinate = proj.toUserCoordinate(viewCoordinate, viewState.projection);
        const point = proj.transform(coordinate, viewState.projection, "EPSG:4326");
        return [point[0], point[1]];
      }
    }
    intersectsCoordinate(coordinate) {
      const frameState = this.frameState;
      if (frameState) {
        const viewState = frameState.viewState;
        const point = proj.transform(coordinate, "EPSG:4326", viewState.projection);
        const viewCoordinate = proj.fromUserCoordinate(point, viewState.projection);
        return extent.containsCoordinate(frameState.extent, viewCoordinate.slice(0, 2));
      }
      return true;
    }
  }

  const _options = {
    forceRender: true,
    windOptions: {}
  };
  class WindLayer extends layer.Layer {
    constructor(data, options) {
      const opt = assign({}, _options, options);
      super(opt);
      this.options = opt;
      this.className_ = options.className !== void 0 ? options.className : "wind-layer";
      this.pickWindOptions();
      if (data) {
        this.setData(data, options.fieldOptions);
      }
    }
    /**
     * 兼容旧版调用方式，现在可以使用以下方式添加图层：
     * ```ts
     * 1. 常规方式
     * map.addLayer(windLayer);
     *
     * 2. setMap 会脱离 ol 地图的图层管理
     *
     * layer.setMap(map);
     *
     * 3. 调用 appendTo
     *
     * layer.appendTo(map);
     * ```
     * @param map
     */
    appendTo(map) {
      map.addLayer(this);
    }
    onAdd() {
      const renderer = this.getRenderer();
      if (renderer) {
        renderer.wind?.start();
      }
    }
    onRemove() {
      const renderer = this.getRenderer();
      if (renderer) {
        renderer.wind.stop();
      }
    }
    createRenderer() {
      return new WindLayerRender(this);
    }
    getRenderer() {
      return super.getRenderer();
    }
    pickWindOptions() {
      Object.keys(defaultOptions).forEach((key) => {
        if (key in this.options) {
          if (this.options.windOptions === void 0) {
            this.options.windOptions = {};
          }
          this.options.windOptions[key] = this.options[key];
        }
      });
    }
    /**
     * 获取图层现有数据
     * get wind layer data
     */
    // @ts-ignore overwrite base layer
    getData() {
      return this.field;
    }
    /**
     * 设置图层数据
     * set layer data
     * @param data
     * @param options
     * @returns {WindLayer}
     */
    setData(data, options = {}) {
      if (data && data.checkFields && data.checkFields()) {
        this.field = data;
      } else if (isArray(data)) {
        this.field = formatData(data, options);
      } else {
        console.error("Illegal data");
      }
      const renderer = this.getRenderer();
      if (renderer && this.field) {
        renderer.setData(this.field);
      }
      this.changed();
      return this;
    }
    /**
     * 设置风场图层的配置项
     * @param options
     */
    setWindOptions(options) {
      const beforeOptions = this.options.windOptions || {};
      this.options = assign(this.options, {
        windOptions: assign(beforeOptions, options || {})
      });
      const renderer = this.getRenderer();
      if (renderer) {
        const windOptions = this.options.windOptions;
        renderer.setOptions(windOptions);
      }
      this.changed();
    }
    /**
     * 获取风场图层渲染的配置项
     */
    getWindOptions() {
      return this.options.windOptions || {};
    }
    render(frameState, target) {
      const layerRenderer = this.getRenderer();
      if (layerRenderer && layerRenderer.prepareFrame(frameState)) {
        this.rendered = true;
        return layerRenderer.renderFrame(frameState, target);
      }
      return null;
    }
    // since v6
    setMapInternal(map) {
      super.setMapInternal(map);
      if (!map) {
        this.onRemove();
      } else {
        this.onAdd();
      }
    }
    /**
     * 支持以 setMap 方式添加图层
     * @param map
     */
    setMap(map) {
      super.setMap(map);
      if (!map) {
        this.onRemove();
      } else {
        this.onAdd();
      }
    }
  }

  exports.Field = Field;
  exports.WindLayer = WindLayer;

}));
//# sourceMappingURL=ol-wind.js.map
