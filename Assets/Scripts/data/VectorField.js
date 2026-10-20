// A velocity field on a regular longitude/latitude grid: eastward (u) and
// northward (v) components, in m/s, at one time.
//
// Cell centres run from lonMin (column 0) eastward and from latMax (row 0)
// southward - the order an image is read in, so a field decoded from a PNG
// needs no reshuffling. NaN marks a cell with no data (land, or a hole in the
// radar's coverage).
class VectorField {

  constructor({ lonMin, latMax, dLon, dLat, nx, ny, u, v, time, label }) {
    Object.assign(this, { lonMin, latMax, dLon, dLat, nx, ny, u, v, time, label });
  }

  get lonMax() { return this.lonMin + (this.nx - 1) * this.dLon; }
  get latMin() { return this.latMax - (this.ny - 1) * this.dLat; }
  // [minLon, minLat, maxLon, maxLat] of the cell centres
  get bbox() { return [this.lonMin, this.latMin, this.lonMax, this.latMax]; }

  // How many cells hold a value
  get validCount() {
    let count = 0;
    for (let i = 0; i < this.u.length; i++) if (!Number.isNaN(this.u[i])) count++;
    return count;
  }

  // The value of the cell nearest a point, or null outside the grid or on a
  // cell with no data. Nearest rather than interpolated: a radar cell is an
  // average over the cell, and interpolating across a coverage edge would
  // invent values from a single neighbour.
  sample(lon, lat) {
    const col = Math.round((lon - this.lonMin) / this.dLon);
    const row = Math.round((this.latMax - lat) / this.dLat);
    if (col < 0 || row < 0 || col >= this.nx || row >= this.ny) return null;
    const index = row * this.nx + col;
    const u = this.u[index];
    if (Number.isNaN(u)) return null;
    return { u, v: this.v[index] };
  }

  // Decodes two gray images - one per component, as ERDDAP's griddap draws
  // them with a black-to-white colour bar over `range` - into a field.
  // `axes` is the grid: its cell centres { lonMin, lonMax, latMin, latMax }
  // and its size { nx, ny }. The images may be larger than the grid (see
  // SourceErddapHFRadars) and span the cell centres edge to edge, north up;
  // each cell is read at its own centre. A transparent pixel is a cell with no
  // data.
  //
  // ERDDAP's continuous black-to-white bar is 256 levels wide, and level R
  // holds the values from (R - 127) to (R - 126) steps above the middle of
  // the range - fitted against the same map as CSV - so a level decodes to
  // the middle of its step: (R + 1.5) / 256 of the way along. That leaves
  // only the step itself, (range[1] - range[0]) / 256, as uncertainty: half of
  // it either way.
  static fromGrayImages(east, north, axes, range, time, label) {
    const nx = axes.nx || east.width;
    const ny = axes.ny || east.height;
    const span = range[1] - range[0];
    const u = new Float32Array(nx * ny);
    const v = new Float32Array(nx * ny);
    for (let row = 0; row < ny; row++) {
      const y = ny > 1 ? Math.floor(row / (ny - 1) * (east.height - 1)) : 0;
      for (let col = 0; col < nx; col++) {
        const x = nx > 1 ? Math.floor(col / (nx - 1) * (east.width - 1)) : 0;
        const p = (y * east.width + x) * 4;
        const i = row * nx + col;
        const valid = east.data[p + 3] > 0 && north.data[p + 3] > 0;
        u[i] = valid ? (east.data[p] + 1.5) / 256 * span + range[0] : NaN;
        v[i] = valid ? (north.data[p] + 1.5) / 256 * span + range[0] : NaN;
      }
    }
    return new VectorField({
      lonMin: axes.lonMin,
      latMax: axes.latMax,
      dLon: nx > 1 ? (axes.lonMax - axes.lonMin) / (nx - 1) : 0,
      dLat: ny > 1 ? (axes.latMax - axes.latMin) / (ny - 1) : 0,
      nx, ny, u, v, time, label,
    });
  }

  // A field from a list of points that have data - { lon, lat, u, v }, as a
  // CODAR .tuv lists them - laid on a regular grid. The grid is recovered from
  // the points themselves: its spacing is the smallest step between distinct
  // longitudes / latitudes, its corner the westernmost and northernmost ones.
  static fromPoints(points, time, label) {
    if (points.length === 0) return null;
    const step = values => {
      const sorted = [...new Set(values.map(v => Math.round(v * 1e5) / 1e5))].sort((a, b) => a - b);
      let min = Infinity;
      for (let i = 1; i < sorted.length; i++) min = Math.min(min, sorted[i] - sorted[i - 1]);
      return { min: sorted[0], max: sorted[sorted.length - 1], step: Number.isFinite(min) ? min : 1 };
    };
    const lons = step(points.map(p => p.lon));
    const lats = step(points.map(p => p.lat));
    const nx = Math.round((lons.max - lons.min) / lons.step) + 1;
    const ny = Math.round((lats.max - lats.min) / lats.step) + 1;
    const u = new Float32Array(nx * ny).fill(NaN);
    const v = new Float32Array(nx * ny).fill(NaN);
    points.forEach(p => {
      const col = Math.round((p.lon - lons.min) / lons.step);
      const row = Math.round((lats.max - p.lat) / lats.step);
      u[row * nx + col] = p.u;
      v[row * nx + col] = p.v;
    });
    return new VectorField({ lonMin: lons.min, latMax: lats.max, dLon: lons.step, dLat: lats.step, nx, ny, u, v, time, label });
  }

  // Several fields (one per radar network) as one, on a grid covering all of
  // them at the finest resolution among them - what a single particle layer
  // can animate. Where networks overlap, the first field listed wins.
  // `maxCells` caps the grid (coarsening it) for networks spread far apart.
  static merge(fields, maxCells = 4e6) {
    if (fields.length === 0) return null;
    if (fields.length === 1) return fields[0];
    const lonMin = Math.min(...fields.map(f => f.lonMin));
    const lonMax = Math.max(...fields.map(f => f.lonMax));
    const latMin = Math.min(...fields.map(f => f.latMin));
    const latMax = Math.max(...fields.map(f => f.latMax));
    let dLon = Math.min(...fields.map(f => f.dLon));
    let dLat = Math.min(...fields.map(f => f.dLat));
    let nx = Math.floor((lonMax - lonMin) / dLon) + 1;
    let ny = Math.floor((latMax - latMin) / dLat) + 1;
    if (nx * ny > maxCells) {
      const factor = Math.sqrt(nx * ny / maxCells);
      dLon *= factor; dLat *= factor;
      nx = Math.floor((lonMax - lonMin) / dLon) + 1;
      ny = Math.floor((latMax - latMin) / dLat) + 1;
    }
    const u = new Float32Array(nx * ny).fill(NaN);
    const v = new Float32Array(nx * ny).fill(NaN);
    for (let row = 0; row < ny; row++) {
      const lat = latMax - row * dLat;
      for (let col = 0; col < nx; col++) {
        const lon = lonMin + col * dLon;
        for (const field of fields) {
          const value = field.sample(lon, lat);
          if (value == null) continue;
          u[row * nx + col] = value.u;
          v[row * nx + col] = value.v;
          break;
        }
      }
    }
    return new VectorField({
      lonMin, latMax, dLon, dLat, nx, ny, u, v,
      time: new Date(Math.max(...fields.map(f => f.time.getTime()))),
      label: fields.map(f => f.label).filter(Boolean).join(', '),
    });
  }

  // The field in the GRIB-as-JSON layout the particle layer (lib/ol-wind)
  // reads: one record per component, rows from the north, no data as null
  // (it treats NaN as a value). Its grid is described by cell EDGES, which is
  // why the bounds sit half a cell outside the centres.
  toWindData() {
    const header = {
      lo1: this.lonMin - this.dLon / 2,
      lo2: this.lonMax + this.dLon / 2,
      la1: this.latMax + this.dLat / 2,
      la2: this.latMin - this.dLat / 2,
      dx: this.dLon,
      dy: this.dLat,
      nx: this.nx,
      ny: this.ny,
      parameterCategory: 2,
    };
    const toList = values => Array.from(values, value => Number.isNaN(value) ? null : value);
    return [
      { header: { ...header, parameterNumber: 2 }, data: toList(this.u) },
      { header: { ...header, parameterNumber: 3 }, data: toList(this.v) },
    ];
  }
}

export default VectorField;
