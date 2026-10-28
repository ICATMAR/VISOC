import Source from './Source.js';
import { decompressBlosc } from '../parsers/blosc.js';

// One Copernicus Marine (CMEMS) product - MEDSEA_ANALYSISFORECAST_PHY_006_013,
// IBI_ANALYSISFORECAST_PHY_005_001, ... - read as TIME SERIES AT A POINT, from
// its ARCO Zarr stores on Copernicus Marine's S3. CMEMS has no WCS/WFS (and
// retired MOTU/OPeNDAP); its WMTS answers one time step per request. The
// "geoChunked" Zarr stores are what the official copernicusmarine toolbox
// reads for a point: each chunk holds months of one variable over a small box
// (MED currents: 3576 h x 16 x 16 cells, ~1-3 MB), so a whole forecast window
// at a buoy is one request, shared by every buoy in the same box.
//
// What a product holds is discovered, not declared. The catalogue says which
// product, which variables and the time steps preferred (`intervals`, ISO
// 8601: 'PT15M', 'PT1H', 'P1D', 'P1M'), and the product's STAC metadata says
// the rest:
//
//   https://stac.marine.copernicus.eu/metadata/<PRODUCT>/product.stac.json
//
// lists every dataset of the product, each in one or more versions
// (..._202511, ..._202611). A product spreads its variables over datasets that
// differ from one product to the next - MED splits them by group (phy-cur,
// phy-tem) and by time step, IBI groups them all (phy ... -2D_PT1H-m) - and a
// dataset's name can change from one version to the next. So the latest
// RELEASED version of every dataset is read (a new one is published "in
// preparation" weeks ahead), and each variable is served by whichever dataset
// has it at the time step asked for.
//
// Both S3 and the STAC metadata are CORS-enabled, so unlike the ERDDAP
// sources nothing goes through the ICATMAR proxy. Chunks are Blosc-compressed
// (see parsers/blosc.js) and hold floats (MED) or 16-bit integers packed with
// a scale_factor/add_offset (IBI), unpacked here. Values are otherwise raw, as
// the product names them (uo, vo) - standardizing is DataProduct's job.

const STAC_URL = 'https://stac.marine.copernicus.eu/metadata/';

const METADATA_TTL = 60; // minutes - a dataset's metadata changes with its daily update
const DATA_TTL = 30;     // minutes a chunk is reused for - the forecasts update once a day
const DATA_TIMEOUT = 60; // seconds

// Decoded chunks kept in memory (3.6 MB each for MED's hourly currents): the
// buoys of one view share a few, so a handful is plenty.
const MAX_CHUNKS = 24;

// How far (cells) around a point to look for a sea cell, tried in order. A
// 4.2 km cell is often land at a buoy near the coast (Barcelona's is).
const SEARCH_RINGS = [2, 4, 10];

// Fill values (1e20) that slip through as numbers instead of NaN
const MAX_VALID = 1e19;

// The order time steps are listed in, finest first
const INTERVAL_ORDER = ['PT15M', 'PT1H', 'P1D', 'P1M'];

// STAC writes some steps in seconds
const STEP_ALIASES = { PT900S: 'PT15M', PT3600S: 'PT1H', PT60M: 'PT1H', PT24H: 'P1D', P1DT0H: 'P1D' };

const DEPTH_DIMENSIONS = ['elevation', 'depth'];

// The Zarr data types a chunk can be read as. MED stores its variables as
// floats, IBI packs them into 16-bit integers (CF's scale_factor/add_offset).
const DTYPES = { '<f4': Float32Array, '<f8': Float64Array, '<i2': Int16Array, '<i4': Int32Array, '|u1': Uint8Array, '|i1': Int8Array };


// A dataset id without its version, and the version: 'cmems_mod_med_phy-cur_anfc_4.2km-2D_PT1H-m_202511'
const versionOf = id => /^(.+)_(\d{6})$/.exec(id);

// The time step a dataset is at, from the end of its id (..._PT1H-m,
// ..._P1M-m) or, failing that, from its STAC time step
function intervalOf(baseId, step) {
  const fromId = /_(PT\d+[HMS]|P\d+[DMY])-[a-z]+$/.exec(baseId)?.[1];
  const interval = fromId ?? step;
  return STEP_ALIASES[interval] ?? interval;
}

// An axis, as STAC describes it: { type: 'minMaxStep', min, step, len } or
// { type: 'explicit', values }
const axis = {
  length: c => (c.type === 'minMaxStep' ? c.len : c.values.length),
  value: (c, i) => (c.type === 'minMaxStep' ? c.min + i * c.step : c.values[i]),
  nearest(c, value) {
    if (c.type === 'minMaxStep') return Math.min(c.len - 1, Math.max(0, Math.round((value - c.min) / c.step)));
    let best = 0;
    c.values.forEach((v, i) => { if (Math.abs(v - value) < Math.abs(c.values[best] - value)) best = i; });
    return best;
  },
  // [first, last] index whose value is within [from, to]; first > last if none
  range(c, from, to) {
    if (c.type === 'minMaxStep') {
      const first = Math.max(0, Math.ceil((from - c.min) / c.step - 1e-9));
      const last = Math.min(c.len - 1, Math.floor((to - c.min) / c.step + 1e-9));
      return [first, last];
    }
    const inside = c.values.map((v, i) => (v >= from && v <= to ? i : -1)).filter(i => i >= 0);
    return inside.length ? [inside[0], inside[inside.length - 1]] : [1, 0];
  },
  // The level closest to the surface - elevation is negative downwards and
  // listed from the bottom up, so index 0 is the deepest
  surface: c => axis.nearest(c, 0),
};


class SourceCMEMS extends Source {

  // `product`: the CMEMS product id. `variables`: the product's own names of
  // the variables to read. `intervals`: the time steps to read them at, in
  // order of preference - a variable not served at the first is read at the
  // next. `model`, `label`, `resolution`: what this product is, as the
  // catalogue describes it - carried onto every series it returns.
  constructor({ fetchManager, src, product, variables, intervals, bbox, model, label, resolution }) {
    super({ fetchManager });
    this.src = src;
    this.product = product;
    this.requestedVariables = variables ?? [];
    this.intervals = intervals ?? ['PT1H'];
    this.bbox = bbox;
    this.model = model ?? product;
    this.label = label ?? product;
    this.resolution = resolution;

    // The product's datasets, latest released version of each (see load)
    this.datasets = undefined;

    this.chunks = new Map(); // chunk url -> { promise of its values, expiresAt }
    this.cells = new Map();  // dataset + point -> Promise of its nearest sea cell

    this.loadingPromise = this.load();
  }

  fetchJSON(url, ttl = METADATA_TTL) {
    return this.fetchManager.fetch(url, ttl, DATA_TIMEOUT).then(res => res.json());
  }

  // Every dataset of the product, in the latest version that is released:
  //
  //   { id, baseId, version, interval, statistic, hasDepth, variables, units,
  //     zarr, axes, startDate, endDate, metadata }
  async load() {
    const product = await this.fetchJSON(`${STAC_URL}${this.product}/product.stac.json`);
    const versions = {};
    (product.links ?? []).filter(link => link.rel === 'item').forEach(link => {
      const id = link.href.split('/')[0];
      const match = versionOf(id);
      if (!match || id.includes('static')) return;
      (versions[match[1]] ??= []).push({ id, version: match[2], href: link.href });
    });

    const released = await Promise.all(Object.entries(versions).map(([baseId, list]) => this.latestReleased(baseId, list)));
    this.datasets = released.filter(Boolean);
    if (!this.datasets.length) throw new Error(`No released dataset with a Zarr store found for CMEMS product '${this.product}'`);

    // What this source reads by default: its variables at their preferred time step
    const used = this.requestedVariables.map(name => this.preferred(name, this.intervals)?.dataset).filter(Boolean);
    this.variables = {};
    used.forEach(dataset => dataset.variables.forEach(name => {
      if (this.requestedVariables.includes(name)) this.variables[name] = { units: dataset.units[name] };
    }));
    if (used.length) {
      this.startDate = new Date(Math.min(...used.map(d => d.startDate.getTime())));
      this.endDate = new Date(Math.max(...used.map(d => d.endDate.getTime())));
    }
  }

  // The newest version of a dataset that is published and not retired, or
  // undefined if none is
  async latestReleased(baseId, list) {
    const now = Date.now();
    for (const { id, version, href } of [...list].sort((a, b) => b.version.localeCompare(a.version))) {
      const stac = await this.fetchJSON(`${STAC_URL}${this.product}/${href}`).catch(error => {
        console.log(`SourceCMEMS: could not read the metadata of '${id}': ${error.message}`);
        return undefined;
      });
      const properties = stac?.properties ?? {};
      const geo = stac?.assets?.geoChunked;
      if (!geo || properties.admp_in_preparation) continue;
      if (properties.admp_retired_date && new Date(properties.admp_retired_date).getTime() < now) continue;

      const axes = {};
      Object.entries(geo.viewDims ?? {}).forEach(([dimension, description]) => { axes[dimension] = description.coords; });
      const variables = properties['cube:variables'] ?? {};
      const time = geo.viewDims?.time ?? {};
      return {
        id, baseId, version,
        interval: intervalOf(baseId, properties['cube:dimensions']?.time?.step),
        statistic: /-i$/.test(baseId) ? 'instantaneous' : 'mean',
        hasDepth: DEPTH_DIMENSIONS.some(dimension => axes[dimension]),
        variables: Object.keys(variables),
        units: Object.fromEntries(Object.entries(variables).map(([name, v]) => [name, v.unit])),
        zarr: geo.href,
        axes,
        startDate: new Date(time.validStartDate ?? properties.admp_valid_start_date ?? properties.start_datetime),
        endDate: new Date(properties.end_datetime),
        metadata: properties,
        // Where its description is, and the update the views were given
        // (see checkRun)
        href,
        runToken: properties.admp_updated_data ?? properties.admp_updated,
      };
    }
    return undefined;
  }

  // The time steps all of `variables` are served at, finest first
  availableIntervals(variables = this.requestedVariables) {
    const intervals = new Set((this.datasets ?? []).map(d => d.interval));
    return [...intervals]
      .filter(interval => variables.every(name => this.resolve(name, interval)))
      .sort((a, b) => (INTERVAL_ORDER.indexOf(a) + 1 || 99) - (INTERVAL_ORDER.indexOf(b) + 1 || 99));
  }

  // The dataset serving `variable` at `interval`: the surface-only (2D) one
  // over the one with depth - smaller chunks, and the surface is what is read
  // anyway - and the mean over the instantaneous
  resolve(variable, interval) {
    const candidates = (this.datasets ?? []).filter(d => d.interval === interval && d.variables.includes(variable));
    candidates.sort((a, b) => (a.hasDepth - b.hasDepth) || ((a.statistic !== 'mean') - (b.statistic !== 'mean')));
    return candidates[0];
  }

  // The first of `intervals` `variable` is served at: { interval, dataset }
  preferred(variable, intervals) {
    for (const interval of intervals) {
      const dataset = this.resolve(variable, interval);
      if (dataset) return { interval, dataset };
    }
    return undefined;
  }

  // A dataset's Zarr layout, per variable: { shape, chunks, dimensions,
  // separator, type, fill, scale, offset } - read once from its consolidated
  // metadata. A variable this source can't read (another compressor, an
  // unknown type) is only refused when it is read, so it doesn't stop the
  // dataset's other variables.
  zarrMetadata(dataset) {
    dataset.zarrPromise ??= this.fetchJSON(`${dataset.zarr}/.zmetadata`).then(json => {
      const metadata = json.metadata ?? {};
      const arrays = {};
      dataset.variables.forEach(name => {
        const array = metadata[`${name}/.zarray`];
        if (!array) return;
        const attributes = metadata[`${name}/.zattrs`] ?? {};
        let unsupported;
        if (array.compressor?.id !== 'blosc' || (array.filters && array.filters.length))
          unsupported = `is not plain Blosc (${JSON.stringify(array.compressor)})`;
        else if (!DTYPES[array.dtype])
          unsupported = `is ${array.dtype}, which is not read`;
        arrays[name] = {
          shape: array.shape,
          chunks: array.chunks,
          dimensions: attributes._ARRAY_DIMENSIONS ?? [],
          separator: array.dimension_separator ?? '.',
          type: DTYPES[array.dtype],
          unsupported,
          // Raw values meaning "no data", before unpacking
          fill: [array.fill_value, attributes._FillValue, attributes.missing_value].filter(v => v != undefined),
          // Packed values: value = raw * scale + offset (CF conventions)
          scale: attributes.scale_factor ?? 1,
          offset: attributes.add_offset ?? 0,
        };
      });
      return arrays;
    }).catch(error => {
      dataset.zarrPromise = undefined; // the next call should retry
      throw error;
    });
    return dataset.zarrPromise;
  }

  // REFRESH (see DPForecast.refresh). Whether the datasets read so far were
  // updated - a new run: their STAC description read again (one small JSON
  // each), its update date the token. An updated dataset's axes, dates and
  // description follow, and its chunks are dropped and asked again.
  // undefined while nothing has been read.
  async checkRun() {
    await this.loadingPromise?.catch(() => {});
    const opened = (this.datasets ?? []).filter(dataset => dataset.zarrPromise);
    if (opened.length === 0) return undefined;
    const tokens = await Promise.all(opened.map(async dataset => {
      const stac = await this.fetchJSON(`${STAC_URL}${this.product}/${dataset.href}`, 0).catch(() => undefined);
      const properties = stac?.properties;
      if (!properties) return dataset.runToken;
      const token = properties.admp_updated_data ?? properties.admp_updated;
      if (token !== dataset.runToken) {
        const geo = stac.assets?.geoChunked;
        Object.entries(geo?.viewDims ?? {}).forEach(([dimension, description]) => { dataset.axes[dimension] = description.coords; });
        const time = geo?.viewDims?.time ?? {};
        dataset.startDate = new Date(time.validStartDate ?? properties.admp_valid_start_date ?? properties.start_datetime);
        dataset.endDate = new Date(properties.end_datetime);
        dataset.metadata = properties;
        dataset.zarrPromise = undefined;
        [...this.chunks.keys()].forEach(url => { if (url.startsWith(dataset.zarr)) this.chunks.delete(url); });
        dataset.runToken = token;
        this.runChangedAt = Date.now();
      }
      return token;
    }));
    return tokens.join('|');
  }

  // One chunk's raw values, decoded into a `Type` typed array - null for a
  // chunk the store doesn't have (Zarr leaves out the ones that are all fill
  // value, and S3 answers 403 for a key that doesn't exist where listing
  // isn't allowed)
  loadChunk(url, Type) {
    const cached = this.chunks.get(url);
    if (cached && Date.now() < cached.expiresAt) return cached.promise;

    // Asked again when the dataset was updated after this chunk was kept (see checkRun)
    const fetchedAt = this.fetchManager.fetchedAt?.(url);
    const ttl = this.runChangedAt && fetchedAt != undefined && fetchedAt < this.runChangedAt ? 0 : DATA_TTL;
    const promise = this.fetchManager.fetch(url, ttl, DATA_TIMEOUT)
      .then(res => res.arrayBuffer())
      .then(buffer => {
        const bytes = decompressBlosc(buffer);
        return new Type(bytes.buffer, bytes.byteOffset, bytes.byteLength / Type.BYTES_PER_ELEMENT);
      })
      .catch(error => {
        if (error.name === 'HTTPError' && (error.status === 403 || error.status === 404)) return null;
        this.chunks.delete(url);
        throw error;
      });
    this.chunks.delete(url); // re-inserted last, so the oldest are the first evicted
    this.chunks.set(url, { promise, expiresAt: Date.now() + DATA_TTL * 60000 });
    while (this.chunks.size > MAX_CHUNKS) this.chunks.delete(this.chunks.keys().next().value);
    return promise;
  }

  // Values of `variable` at the grid indices `at` ({ time, latitude,
  // longitude }, depth at the surface), for each time index in `times`:
  // [value or undefined], in the same order
  async readValues(dataset, variable, at, times) {
    const array = (await this.zarrMetadata(dataset))[variable];
    if (!array) return times.map(() => undefined);
    if (array.unsupported) throw new Error(`SourceCMEMS: '${dataset.id}/${variable}' ${array.unsupported}`);

    const index = dimension => (DEPTH_DIMENSIONS.includes(dimension) ? axis.surface(dataset.axes[dimension]) : at[dimension]);
    // Strides inside a chunk (C order) - Zarr v2 stores edge chunks full size
    const strides = array.chunks.map((_, d) => array.chunks.slice(d + 1).reduce((a, b) => a * b, 1));

    const byChunk = new Map(); // chunk key -> [{ position, offset }]
    times.forEach((time, position) => {
      const indices = array.dimensions.map(dimension => (dimension === 'time' ? time : index(dimension)));
      const key = indices.map((i, d) => Math.floor(i / array.chunks[d])).join(array.separator);
      const offset = indices.reduce((sum, i, d) => sum + (i % array.chunks[d]) * strides[d], 0);
      if (!byChunk.has(key)) byChunk.set(key, []);
      byChunk.get(key).push({ position, offset });
    });

    const values = times.map(() => undefined);
    await Promise.all([...byChunk].map(async ([key, entries]) => {
      const chunk = await this.loadChunk(`${dataset.zarr}/${variable}/${key}`, array.type);
      if (!chunk) return;
      entries.forEach(({ position, offset }) => {
        const raw = chunk[offset];
        if (!isFinite(raw) || array.fill.includes(raw)) return;
        const value = raw * array.scale + array.offset;
        if (Math.abs(value) < MAX_VALID) values[position] = value;
      });
    }));
    return values;
  }

  // The nearest sea cell of a dataset's grid to a point, searched once per
  // point and remembered: { latitude, longitude, distanceKm, indices }, or
  // undefined if there is none nearby
  nearestValidCell(dataset, variable, latitude, longitude) {
    const key = `${dataset.id}|${latitude},${longitude}`;
    if (!this.cells.has(key)) {
      const promise = this.searchValidCell(dataset, variable, latitude, longitude).catch(error => {
        this.cells.delete(key); // don't keep a failed search - the next call should retry
        throw error;
      });
      this.cells.set(key, promise);
    }
    return this.cells.get(key);
  }

  async searchValidCell(dataset, variable, latitude, longitude) {
    const { latitude: lat, longitude: lon, time } = dataset.axes;
    if (!lat || !lon || !time) return undefined;
    // Outside the grid altogether
    const outside = (c, value) => {
      const first = axis.value(c, 0), last = axis.value(c, axis.length(c) - 1);
      const margin = Math.abs(axis.length(c) > 1 ? axis.value(c, 1) - first : 0);
      return value < Math.min(first, last) - margin || value > Math.max(first, last) + margin;
    };
    if (outside(lat, latitude) || outside(lon, longitude)) return undefined;

    // A land cell is land at every time step, so one is enough: the last
    const t = axis.nearest(time, dataset.endDate.getTime());
    const y0 = axis.nearest(lat, latitude);
    const x0 = axis.nearest(lon, longitude);

    for (const ring of SEARCH_RINGS) {
      const cells = [];
      for (let y = Math.max(0, y0 - ring); y <= Math.min(axis.length(lat) - 1, y0 + ring); y++)
        for (let x = Math.max(0, x0 - ring); x <= Math.min(axis.length(lon) - 1, x0 + ring); x++)
          cells.push({ y, x });

      // One time index per cell - readValues groups them by chunk
      const array = (await this.zarrMetadata(dataset))[variable];
      if (!array) return undefined;
      const values = await Promise.all(cells.map(({ y, x }) =>
        this.readValues(dataset, variable, { latitude: y, longitude: x }, [t]).then(v => v[0])));

      let best;
      cells.forEach(({ y, x }, i) => {
        if (values[i] == undefined) return;
        const cellLat = axis.value(lat, y), cellLon = axis.value(lon, x);
        // Equirectangular distance - plenty at a few km
        const dLat = cellLat - latitude;
        const dLon = (cellLon - longitude) * Math.cos(latitude * Math.PI / 180);
        const distance = dLat * dLat + dLon * dLon;
        if (best == undefined || distance < best.distance)
          best = { latitude: cellLat, longitude: cellLon, distance, indices: { latitude: y, longitude: x } };
      });
      if (best) return { latitude: best.latitude, longitude: best.longitude, distanceKm: Math.sqrt(best.distance) * 111.2, indices: best.indices };
    }

    console.log(`SourceCMEMS: no sea cell of ${dataset.id} near ${latitude}, ${longitude}`);
    return undefined;
  }

  // Series at one point ({ latitude, longitude }) within [startDate, endDate]:
  //
  //   [{ model, label, institution, resolution, interval, statistic, dataset,
  //      datasets, run, cell, rows: { '<ISO>': { <variable>: value } } }]
  //
  // Same shape as SourceErddapGriddap's, so a forecast product ranks it the
  // same way. One series per time step - every variable at the first of the
  // preferred `intervals` it is served at (or at `options.interval` only, if
  // given); variables that end up at different steps make separate series.
  // Empty where the product has no sea cell near the point or doesn't reach
  // the window.
  async getPointSeries(point, startDate, endDate, options = {}) {
    await this.loadingPromise;

    if (this.bbox) {
      const { minLat, minLon, maxLat, maxLon } = this.bbox;
      if (point.latitude < minLat || point.latitude > maxLat || point.longitude < minLon || point.longitude > maxLon) return [];
    }

    const intervals = options.interval ? [options.interval] : this.intervals;
    const groups = new Map(); // interval -> [{ variable, dataset }]
    this.requestedVariables.forEach(variable => {
      const found = this.preferred(variable, intervals);
      if (!found) return;
      if (!groups.has(found.interval)) groups.set(found.interval, []);
      groups.get(found.interval).push({ variable, dataset: found.dataset });
    });

    const series = await Promise.all([...groups].map(([interval, entries]) =>
      this.readSeries(point, startDate, endDate, interval, entries)));
    return series.filter(Boolean);
  }

  async readSeries(point, startDate, endDate, interval, entries) {
    const rows = {};
    const used = [];
    let cell;

    await Promise.all(entries.map(async ({ variable, dataset }) => {
      // Only the part of the window the dataset holds
      const from = Math.max(startDate.getTime(), dataset.startDate.getTime());
      const to = Math.min(endDate.getTime(), dataset.endDate.getTime());
      if (from > to) return;

      const found = await this.nearestValidCell(dataset, variable, point.latitude, point.longitude);
      if (!found) return;
      cell ??= found;

      const [first, last] = axis.range(dataset.axes.time, from, to);
      if (first > last) return;
      const times = [];
      for (let t = first; t <= last; t++) times.push(t);
      const values = await this.readValues(dataset, variable, found.indices, times);

      times.forEach((t, i) => {
        if (values[i] == undefined) return;
        const stamp = new Date(axis.value(dataset.axes.time, t)).toISOString();
        (rows[stamp] ??= {})[variable] = values[i];
      });
      if (!used.includes(dataset)) used.push(dataset);
    }));

    if (!Object.keys(rows).length) return undefined;
    return {
      model: this.model,
      label: this.label,
      institution: this.institution,
      resolution: this.resolution,
      interval,
      statistic: used[0]?.statistic,
      dataset: used.map(d => d.id).join(', '),
      datasets: used.map(d => d.id),
      run: this.runInfo(used[0]),
      cell,
      rows,
    };
  }

  // When the dataset was last updated - CMEMS doesn't publish a run's
  // reference time in its metadata - and the system that produced it ('MedFS
  // EAS10'). Same shape as SourceErddapGriddap.runInfo().
  runInfo(dataset) {
    const metadata = dataset?.metadata ?? {};
    const updated = metadata.admp_updated_data ?? metadata.admp_updated;
    const publishedAt = updated ? new Date(updated) : undefined;
    return {
      referenceTime: undefined,
      publishedAt: publishedAt && !isNaN(publishedAt) ? publishedAt : undefined,
      note: metadata.source,
    };
  }

}

export default SourceCMEMS;
