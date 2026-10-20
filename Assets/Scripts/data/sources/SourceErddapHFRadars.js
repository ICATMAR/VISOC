import Source from './Source.js';
import SourceErddap from './SourceErddap.js';
import VectorField from '../VectorField.js';
import { readNetCDF3 } from '../parsers/netcdf3.js';

// One ERDDAP server's gridded HF radar totals, read as MAPS of surface
// currents hour by hour - what the particle animation needs - rather than as
// time series at a point (see SourceErddapGriddap for those).
//
// One source per provider: `datasets` lists them (ICATMAR's ERDDAP: its one
// totals dataset), or `datasetPattern` finds them in the server's dataset list
// (the EU HFR Node: one per network, its first capture group naming the
// network) - so a network added to the node shows up on its own. Where
// networks overlap, `preferNetwork` wins.
//
// Each component (eastward, northward) is fetched as a griddap transparentPng
// drawn with a black-to-white colour bar over a fixed range: gray pixels,
// transparent where there is no data, no frame or legend. About 9 KB per map,
// which is what makes stepping through hours cheap. Exact values (a clicked
// point) are read as numbers instead - this is for drawing.
//
// Why not ERDDAP's WMS: it only draws with the dataset's own colorBar
// attributes (u/v at +-0.5 m/s, so anything faster clips) and rejects any
// STYLES - tested against both ERDDAPs. griddap images take the colour bar as
// a parameter.
//
// Drawn at UPSCALE pixels per grid cell and read at each cell's centre.
// ERDDAP's default size is one pixel per cell, but it resamples while drawing
// and some pixels end up holding a neighbour's value - checked against the
// same map as CSV: up to 2 m/s off at one pixel per cell, half a gray level
// at four, with every no-data cell where it should be. The image spans the
// cell CENTRES edge to edge (its first and last pixels are the first and last
// cells).
//
// 8 bits per component: over RANGE a level is 4 / 256 = 1.6 cm/s wide, and a
// value decodes to the middle of its level (see VectorField.fromGrayImages).
// Values beyond RANGE clip to its ends.

const RANGE = [-2, 2]; // m/s, the colour bar's ends
const COLOR_BAR = `BlackWhite|C|Linear|${RANGE[0]}|${RANGE[1]}|`;
const UPSCALE = 4;

// The maps that belong to an hour: from half an hour before it up to (not
// including) half an hour after - 10:00 is 9:30 to 10:30. A map outside that
// window never stands in for the hour. Some networks publish every 10-20
// minutes; the one closest to the hour is used.
const HALF_HOUR_MS = 30 * 60 * 1000;
const inHour = (t, hour) => t.getTime() >= hour.getTime() - HALF_HOUR_MS && t.getTime() < hour.getTime() + HALF_HOUR_MS;

// After a failed load(), how long before it is tried again - not on every
// call, which would keep a rate-limited server (HTTP 429) limiting
const RETRY_AFTER_MS = 60 * 1000;

// Availability counts: every COUNT_STRIDE-th cell in each direction, which is
// plenty to tell a full map from a thin one at a quarter of the download.
const COUNT_STRIDE = 2;
const COUNT_TTL = 10;
// How many maps are kept in memory (per network and hour)
const CACHE_SIZE = 96;

const TIMES_TTL = 10;   // minutes a dataset's list of times is reused for
const IMAGE_TTL = 60;   // a published map doesn't change
const TIMEOUT = 60;     // seconds

// griddap wants whole seconds - '2026-09-03T00:00:00Z'
const stamp = date => date.toISOString().substring(0, 19) + 'Z';


class SourceErddapHFRadars extends Source {

  // `provider`: which of the HFR dashboard's choices this source is
  // (GUIManager.hfrSource). `eastward`/`northward`: the datasets' names for
  // the two components (u/v on ICATMAR's ERDDAP, EWCT/NSCT on the EU HFR
  // Node). `useProxy`: ICATMAR's ERDDAP only answers the browser through the
  // ICATMAR proxy; the EU HFR Node allows cross-origin requests itself.
  // `network`: the name of a single-dataset source's network.
  // `countVariable`: a variable that is filled wherever a map has data and
  // empty elsewhere - a one-byte QC flag, so counting it per hour is cheap.
  constructor({ fetchManager, src, datasets, datasetPattern, eastward = 'EWCT', northward = 'NSCT', countVariable = 'QCflag', useProxy = true, provider, network, preferNetwork, label }) {
    super({ fetchManager });
    this.src = src;
    this.baseUrl = src.replace(/\/index\.html$/, '');
    this.datasetPattern = datasetPattern ? new RegExp(datasetPattern) : undefined;
    this.datasets = datasets;      // filled in by load() when found by pattern
    this.dataset = datasets?.length === 1 ? datasets[0] : undefined;
    this.eastward = eastward;
    this.northward = northward;
    this.countVariable = countVariable;
    this.useProxy = useProxy;
    this.provider = provider;
    this.label = label ?? src;
    this.network = network;
    this.preferNetwork = preferNetwork;

    this.networks = [];            // { dataset, network, bbox, startDate, endDate }
    this.grids = new Map();        // dataset -> Promise of { dimensions, axes }
    this.times = new Map();        // '<dataset>|<day>' -> Promise<[Date]>
    this.maps = new Map();         // '<dataset>|<ISO>' -> Promise<VectorField>

    this.loadingPromise = this.load();
  }

  // load(), again if it failed - but no sooner than RETRY_AFTER_MS after the
  // failure (a server down for a moment shouldn't leave the source empty for
  // the rest of the session, nor be asked again on every call)
  ready() {
    if (this.failedAt && Date.now() - this.failedAt > RETRY_AFTER_MS) {
      this.failedAt = undefined;
      this.loadingPromise = this.load();
    }
    return this.loadingPromise;
  }

  // The datasets, their networks, where and when they have data - all from
  // the server's dataset list (cached by FetchManager, shared with the other
  // ERDDAP sources on the same server)
  load() {
    return this.loadDatasets().catch(error => { this.failedAt = Date.now(); throw error; });
  }

  async loadDatasets() {
    // Straight from a server that allows cross-origin requests, through the
    // proxy otherwise (SourceErddap.fetchAllDatasets always proxies)
    const allDatasets = this.useProxy
      ? await SourceErddap.fetchAllDatasets(this.fetchManager, this.baseUrl)
      : await this.fetchManager.fetch(`${this.baseUrl}/tabledap/allDatasets.jsonlKVP`, 1)
        .then(res => res.text())
        .then(text => text.trim().split('\n').filter(line => line).map(line => JSON.parse(line)));
    const found = allDatasets.filter(d => this.datasetPattern
      ? this.datasetPattern.test(d['datasetID'])
      : this.datasets.includes(d['datasetID']));
    if (found.length === 0) throw new Error(`No HF radar totals found on ${this.src}`);

    this.networks = found.map(d => ({
      dataset: d['datasetID'],
      network: this.datasetPattern?.exec(d['datasetID'])?.[1] ?? this.network ?? d['datasetID'],
      bbox: [d['minLongitude'], d['minLatitude'], d['maxLongitude'], d['maxLatitude']].map(Number),
      startDate: d['minTime'] ? new Date(d['minTime']) : undefined,
      endDate: d['maxTime'] ? new Date(d['maxTime']) : undefined,
    }));
    this.datasets = this.networks.map(n => n.dataset);
    const starts = this.networks.map(n => n.startDate).filter(Boolean);
    const ends = this.networks.map(n => n.endDate).filter(Boolean);
    this.startDate = starts.length ? new Date(Math.min(...starts)) : undefined;
    this.endDate = ends.length ? new Date(Math.max(...ends)) : undefined;
  }

  // The networks in `bbox` ([minLon, minLat, maxLon, maxLat], what is in
  // view) with data since `since`, the preferred one first
  async networksIn(bbox, since) {
    await this.ready();
    return this.networks
      .filter(n => !bbox || !n.bbox.every(Number.isFinite) || intersects(n.bbox, bbox))
      .filter(n => !since || !n.endDate || n.endDate >= since)
      .sort((a, b) => (b.network === this.preferNetwork) - (a.network === this.preferNetwork));
  }

  // The time of the newest map of any network in `bbox`
  async getLatestTime(bbox) {
    const ends = (await this.networksIn(bbox)).map(n => n.endDate).filter(Boolean);
    return ends.length ? new Date(Math.max(...ends)) : undefined;
  }

  // The map for the hour `time`, or null if no network has one. Every network
  // in `bbox` with a map in that hour (see inHour) is merged into one field; a
  // network without one is left out, never shown at another time.
  async getField(time, bbox) {
    const networks = await this.networksIn(bbox, new Date(time.getTime() - HALF_HOUR_MS));

    const fields = await Promise.all(networks.map(n => this.mapAt(n, time).catch(error => {
      console.error(`HF radar currents from ${n.dataset}:`, error);
      return null;
    })));
    const found = fields.filter(Boolean);
    const merged = VectorField.merge(found);
    // The networks it was made from, each on its own grid - where the data
    // points really are (the merged grid is only for the animation)
    if (merged) merged.parts = found;
    return merged;
  }

  // A network's map for the hour `time` - the one closest to it within the
  // hour's window (see inHour) - or null
  async mapAt(network, time) {
    const times = (await this.timesAround(network, time)).filter(t => inHour(t, time));
    if (times.length === 0) return null;
    const best = times.reduce((a, b) => Math.abs(b - time) < Math.abs(a - time) ? b : a);

    const key = `${network.dataset}|${best.toISOString()}`;
    if (!this.maps.has(key)) {
      this.maps.set(key, this.fetchMap(network, best).catch(error => { this.maps.delete(key); throw error; }));
      // Oldest out first - a Map iterates in insertion order
      while (this.maps.size > CACHE_SIZE) this.maps.delete(this.maps.keys().next().value);
    }
    return this.maps.get(key);
  }

  // A network's times on the UTC day of `time` (plus an hour either side),
  // asked once per day rather than per hour so the request repeats
  timesAround(network, time) {
    const day = new Date(time);
    day.setUTCHours(0, 0, 0, 0);
    const key = `${network.dataset}|${day.toISOString()}`;
    if (!this.times.has(key)) {
      const start = new Date(day.getTime() - 3600 * 1000);
      const end = new Date(day.getTime() + 25 * 3600 * 1000);
      this.times.set(key, this.getTimes(network, start, end).catch(error => { this.times.delete(key); throw error; }));
    }
    return this.times.get(key);
  }

  // Every time a network has a map for within [startDate, endDate], as Dates.
  // Empty if none - ERDDAP answers a range outside the dataset with an error.
  async getTimes(network, startDate, endDate) {
    const from = network.startDate && startDate < network.startDate ? network.startDate : startDate;
    const to = network.endDate && endDate > network.endDate ? network.endDate : endDate;
    if (from > to) return [];
    const url = `${this.baseUrl}/griddap/${network.dataset}.csv?time${encodeURIComponent(`[(${stamp(from)}):1:(${stamp(to)})]`)}`;
    try {
      const text = await this.fetchManager.fetch(this.url(url), TIMES_TTL, TIMEOUT).then(res => res.text());
      return text.trim().split('\n').slice(2).filter(line => line).map(line => new Date(line.split(',')[0]));
    } catch (error) {
      if (error.name === 'HTTPError') return [];
      throw error;
    }
  }

  // A network's map at one of its own times, as a VectorField
  async fetchMap(network, time) {
    const { dimensions, axes } = await this.grid(network.dataset);
    const [east, north] = await Promise.all([
      this.fetchImageData(this.imageUrl(network.dataset, this.eastward, time, dimensions, axes)),
      this.fetchImageData(this.imageUrl(network.dataset, this.northward, time, dimensions, axes)),
    ]);
    return VectorField.fromGrayImages(east, north, axes, RANGE, time, network.network);
  }

  url(url) {
    return this.useProxy ? SourceErddap.proxied(url) : url;
  }

  // How much data each network in `bbox` has, hour by hour, from `startDate`
  // to its latest map: [{ network, hours: { '<ISO hour>': count } }], the
  // preferred network first. A count is the number of cells with data in
  // every COUNT_STRIDE-th row and column - only meaningful against the same
  // network's other hours. One .nc request per network.
  async getAvailability(bbox, startDate) {
    const networks = await this.networksIn(bbox, startDate);
    const rows = await Promise.all(networks.map(async network => ({
      network: network.network,
      hours: await this.countsOf(network, startDate).catch(error => {
        console.error(`HF radar availability from ${network.dataset}:`, error);
        return {};
      }),
    })));
    // One row per network, even where it spans several datasets (versions)
    const byNetwork = new Map();
    rows.forEach(row => {
      const hours = byNetwork.get(row.network)?.hours ?? {};
      Object.entries(row.hours).forEach(([hour, count]) => { hours[hour] = Math.max(hours[hour] ?? 0, count); });
      byNetwork.set(row.network, { network: row.network, hours });
    });
    return [...byNetwork.values()];
  }

  async countsOf(network, startDate) {
    const { dimensions } = await this.grid(network.dataset);
    const variable = this.countVariable;
    const selectors = (dimensions[variable] ?? ['time', 'depth', 'latitude', 'longitude']).map(dimension => {
      // From startDate to whatever the dataset's last time is - asking past it is an error
      if (dimension === 'time') return `[(${stamp(startDate)}):1:last]`;
      if (dimension === 'latitude' || dimension === 'longitude') return `[0:${COUNT_STRIDE}:last]`;
      return '[0]';
    }).join('');
    const url = `${this.baseUrl}/griddap/${network.dataset}.nc?${variable}${encodeURIComponent(selectors)}`;
    let buffer;
    try {
      buffer = await this.fetchManager.fetch(this.url(url), COUNT_TTL, TIMEOUT).then(res => res.arrayBuffer());
    } catch (error) {
      if (error.name === 'HTTPError') return {}; // nothing since startDate
      throw error;
    }
    const file = readNetCDF3(buffer);
    const values = file.variables[variable].read();
    const fill = file.variables[variable].attributes['_FillValue'];
    const times = file.variables.time.read(); // seconds since 1970
    const perTime = values.length / times.length;
    const hours = {};
    times.forEach((seconds, k) => {
      let count = 0;
      for (let i = k * perTime; i < (k + 1) * perTime; i++) if (values[i] !== fill && !Number.isNaN(values[i])) count++;
      // The hour this map belongs to (see inHour); the fullest map if several do
      const hour = new Date(Math.floor((seconds * 1000 + HALF_HOUR_MS) / 3600000) * 3600000).toISOString();
      hours[hour] = Math.max(hours[hour] ?? 0, count);
    });
    return hours;
  }

  // A dataset's info: each variable's dimensions in order, and the grid
  // (cell centres and size) - { lonMin, lonMax, latMin, latMax, nx, ny }.
  // Read once per dataset.
  grid(dataset) {
    if (!this.grids.has(dataset)) {
      this.grids.set(dataset, (async () => {
        const infoUrl = `${this.baseUrl}/info/${dataset}/index.jsonlKVP`;
        // Not through the proxy when the server doesn't need it, so one being
        // down or rate-limited doesn't take the other with it
        const text = await this.fetchManager.fetch(this.url(infoUrl)).then(res => res.text());
        const dimensions = {};
        const ranges = {};
        const counts = {};
        text.trim().split('\n').filter(line => line).forEach(line => {
          const row = JSON.parse(line);
          const name = row['Variable Name'];
          if (row['Row Type'] === 'variable')
            dimensions[name] = String(row['Value'] ?? '').split(',').map(d => d.trim()).filter(Boolean);
          if (row['Row Type'] === 'dimension')
            counts[name] = Number(/nValues=(\d+)/.exec(String(row['Value']))?.[1]);
          if (row['Attribute Name'] === 'actual_range' && (name === 'latitude' || name === 'longitude'))
            ranges[name] = String(row['Value']).split(',').map(Number);
        });
        if (!ranges.latitude || !ranges.longitude)
          throw new Error(`No latitude/longitude range in the info of ${dataset}`);
        return {
          dimensions,
          axes: {
            lonMin: Math.min(...ranges.longitude), lonMax: Math.max(...ranges.longitude),
            latMin: Math.min(...ranges.latitude), latMax: Math.max(...ranges.latitude),
            nx: counts.longitude, ny: counts.latitude,
          },
        };
      })().catch(error => { this.grids.delete(dataset); throw error; }));
    }
    return this.grids.get(dataset);
  }

  // The griddap image of one component at one of the dataset's own times
  imageUrl(dataset, variable, time, dimensions, axes) {
    const selectors = (dimensions[variable] ?? ['time', 'depth', 'latitude', 'longitude']).map(dimension => {
      if (dimension === 'time') return `[(${stamp(time)})]`;
      if (dimension === 'latitude' || dimension === 'longitude') return '[]';
      return '[0]'; // depth: the surface, the only level a radar measures
    }).join('');
    return `${this.baseUrl}/griddap/${dataset}.transparentPng?${variable}${encodeURIComponent(selectors)}`
      + `&.colorBar=${encodeURIComponent(COLOR_BAR)}&.draw=surface&.land=off`
      + `&.size=${encodeURIComponent(`${axes.nx * UPSCALE}|${axes.ny * UPSCALE}`)}`;
  }

  async fetchImageData(url) {
    const blob = await this.fetchManager.fetch(this.url(url), IMAGE_TTL, TIMEOUT).then(res => res.blob());
    const bitmap = await createImageBitmap(blob);
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }
}

function intersects(a, b) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

export default SourceErddapHFRadars;
