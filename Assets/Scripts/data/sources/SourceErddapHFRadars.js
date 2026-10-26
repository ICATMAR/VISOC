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
// The hour a time belongs to (see inHour)
const hourOf = time => new Date(Math.floor((time.getTime() + HALF_HOUR_MS) / 3600000) * 3600000);

// After a failed load(), how long before it is tried again - not on every
// call, which would keep a rate-limited server (HTTP 429) limiting
const RETRY_AFTER_MS = 60 * 1000;
// When the server's dataset list doesn't have the source's datasets (see
// loadDatasets), how long before it is read again
const MISSING_RECHECK_MS = 10 * 60 * 1000;

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

// The 4 grid cells around a point, on a regular grid given by its cell
// centres' extent and counts (see grid()): their coordinates, where the
// point falls between them (fx, fy, 0-1) and each one's bilinear weight -
// null outside the grid. Corners are keyed '<lat side><lon side>', 0 = low.
function cellsAround(axes, lon, lat) {
  const { lonMin, lonMax, latMin, latMax, nx, ny } = axes;
  const dLon = nx > 1 ? (lonMax - lonMin) / (nx - 1) : 0;
  const dLat = ny > 1 ? (latMax - latMin) / (ny - 1) : 0;
  if (!dLon || !dLat) return null;
  const x = (lon - lonMin) / dLon, y = (lat - latMin) / dLat;
  if (!(x >= 0 && y >= 0 && x <= nx - 1 && y <= ny - 1)) return null;
  const i0 = Math.min(Math.floor(x), nx - 2), j0 = Math.min(Math.floor(y), ny - 2);
  const fx = x - i0, fy = y - j0;
  const lon0 = lonMin + i0 * dLon, lon1 = lon0 + dLon, lat0 = latMin + j0 * dLat, lat1 = lat0 + dLat;
  const weights = { '00': (1 - fx) * (1 - fy), '01': fx * (1 - fy), '10': (1 - fx) * fy, '11': fx * fy };
  const cells = Object.entries(weights).map(([key, weight]) => ({
    latitude: key[0] === '1' ? lat1 : lat0, longitude: key[1] === '1' ? lon1 : lon0, weight,
  }));
  const nearest = cells.reduce((a, b) => (b.weight > a.weight ? b : a));
  return {
    lon0, lon1, lat0, lat1, weights, cells,
    nearest: { latitude: nearest.latitude, longitude: nearest.longitude },
    lonMid: (lon0 + lon1) / 2, latMid: (lat0 + lat1) / 2,
  };
}

// Bilinear between 4 corners - null unless all 4 have a value
function interpolateCorners(corners, { weights }) {
  let u = 0, v = 0;
  for (const key of ['00', '01', '10', '11']) {
    const corner = corners[key];
    if (!corner) return null;
    u += corner.u * weights[key];
    v += corner.v * weights[key];
  }
  return { u, v };
}


class SourceErddapHFRadars extends Source {

  // `provider`: which of the HFR dashboard's choices this source is
  // (GUIManager.hfrSource). `eastward`/`northward`: the datasets' names for
  // the two components (u/v on ICATMAR's ERDDAP, EWCT/NSCT on the EU HFR
  // Node). `useProxy`: ICATMAR's ERDDAP only answers the browser through the
  // ICATMAR proxy; the EU HFR Node allows cross-origin requests itself.
  // `network`: the name of a single-dataset source's network.
  // `countVariable`: a variable that is filled wherever a map has data and
  // empty elsewhere - a one-byte QC flag, so counting it per hour is cheap.
  constructor({ fetchManager, src, datasets, datasetPattern, eastward = 'EWCT', northward = 'NSCT', countVariable = 'QCflag', useProxy = true, provider, network, preferNetwork, label, reprocessed = false }) {
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
    this.staleCounts = new Set();  // '<dataset>|<stride>': counts to ask afresh once (see refresh)
    // Whether the server re-processes hours it has published (ICATMAR's does;
    // the EU HFR Node doesn't) - see getVersions
    this.reprocessed = reprocessed;
    this.staleHours = new Map();   // '<dataset>' -> Map(hour ms -> when it went stale, ms)
    this.updatedAt = new Map();    // '<ISO hour>' -> its file's last modification, ms

    this.loadingPromise = this.load();
  }

  // load(), again if it failed - but no sooner than RETRY_AFTER_MS after the
  // failure (a server down for a moment shouldn't leave the source empty for
  // the rest of the session, nor be asked again on every call) - or if the
  // server's dataset list didn't have this source's datasets, MISSING_RECHECK_MS
  // after reading it
  ready() {
    const retry = this.failedAt && Date.now() - this.failedAt > RETRY_AFTER_MS;
    const recheck = this.missingAt && Date.now() - this.missingAt > MISSING_RECHECK_MS;
    if (retry || recheck) {
      this.failedAt = undefined;
      this.missingAt = undefined;
      this.loadingPromise = this.load();
    }
    return this.loadingPromise;
  }

  // REPROCESSING. A server that re-processes published hours lists each
  // hour's file with its last modification (ERDDAP's files service: one
  // file per hour, all the same size - the time is the version). The
  // versions in [startDate, endDate]: Map('<ISO hour>' -> ms) - from the
  // dataset that serves the hour (networksIn's order). One small listing per
  // dataset and month. Empty for a server that doesn't re-process.
  async getVersions(startDate, endDate) {
    const versions = new Map();
    if (!this.reprocessed) return versions;
    const networks = (await this.networksIn(undefined, startDate)).filter(n => !n.startDate || n.startDate <= endDate);
    const months = [];
    for (let m = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1)); m <= endDate; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)))
      months.push(`${m.getUTCFullYear()}/${String(m.getUTCMonth() + 1).padStart(2, '0')}`);
    const from = startDate.getTime(), to = endDate.getTime();
    for (const network of networks) {
      const listings = await Promise.all(months.map(month =>
        this.fetchManager.fetch(this.url(`${this.baseUrl}/files/${network.dataset}/${month}/.csv`), 1, TIMEOUT)
          .then(res => res.text())
          .catch(() => ''))); // no such month there
      listings.join('\n').split('\n').forEach(line => {
        const [name, modified] = line.split(',');
        const match = name?.match(/_(\d{4})_(\d{2})_(\d{2})_(\d{2})(\d{2})\.nc$/);
        if (!match || !Number.isFinite(Number(modified))) return;
        const hour = hourOf(new Date(Date.UTC(match[1], match[2] - 1, match[3], match[4], match[5])));
        const t = hour.getTime();
        if (t < from || t > to || versions.has(hour.toISOString())) return;
        versions.set(hour.toISOString(), Number(modified));
        this.updatedAt.set(hour.toISOString(), Number(modified));
      });
    }
    return versions;
  }

  // When the hour's file was last modified (ms), as far as getVersions has seen
  getUpdatedAt(hour) {
    return this.updatedAt.get(new Date(hour).toISOString());
  }

  // Hours whose files changed: their maps are dropped, and any request
  // about them - the map, a series or the counts reaching them - is asked
  // again once (see freshTtl)
  invalidateHours(hours) {
    const now = Date.now();
    this.networks.forEach(network => {
      const stale = this.staleHours.get(network.dataset) ?? new Map();
      hours.forEach(hour => {
        stale.set(new Date(hour).getTime(), now);
        [...this.maps.keys()].forEach(key => {
          const [dataset, time] = key.split('|');
          if (dataset === network.dataset && hourOf(new Date(time)).toISOString() === hour) this.maps.delete(key);
        });
      });
      this.staleHours.set(network.dataset, stale);
    });
  }

  // The TTL for a request about `dataset` covering [from, to] (Dates; `to`
  // undefined: up to its last map): 0 - asked again - when an hour in it
  // went stale after the response kept for `url` was fetched, else `ttl`
  freshTtl(dataset, url, from, to, ttl) {
    const stale = this.staleHours.get(dataset);
    if (!stale?.size) return ttl;
    const fetchedAt = this.fetchManager.fetchedAt?.(url);
    if (fetchedAt == undefined) return ttl;
    const a = from.getTime() - HALF_HOUR_MS, b = to ? to.getTime() + HALF_HOUR_MS : Infinity;
    for (const [hour, at] of stale) if (hour >= a && hour <= b && at > fetchedAt) return 0;
    return ttl;
  }

  // The dataset list read again now (see the data products' refresh): a
  // dataset's last time moves on as maps are published. Whether any did -
  // then its lists of times from its old last day on are asked again, and
  // so are its availability counts (which end at 'last', the same URL).
  async refresh() {
    await this.loadingPromise?.catch(() => {});
    const before = new Map(this.networks.map(n => [n.dataset, n.endDate?.getTime()]));
    try {
      await this.loadDatasets();
    } catch (error) {
      console.error(`HF radar totals on ${this.src}, refresh:`, error);
      return false;
    }
    let changed = false;
    this.networks.forEach(n => {
      const old = before.get(n.dataset);
      if (n.endDate?.getTime() === old) return;
      changed = true;
      const fromDay = old == undefined ? 0 : new Date(old).setUTCHours(0, 0, 0, 0);
      [...this.times.keys()].forEach(key => {
        const [dataset, day] = key.split('|');
        if (dataset === n.dataset && new Date(day).getTime() >= fromDay) this.times.delete(key);
      });
      [1, COUNT_STRIDE].forEach(stride => this.staleCounts.add(`${n.dataset}|${stride}`));
    });
    return changed;
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
    if (found.length === 0) {
      // Not on the server for now - ERDDAP unloads a dataset while it can't
      // load it (ICATMAR's recent one does, at times). Not an error: the
      // source has no data, so every call answers "nothing" without asking
      // anything, and the list is read again in MISSING_RECHECK_MS
      if (!this.isMissing) console.warn(`HF radar totals ${this.datasets ?? this.datasetPattern} not on ${this.src} for now`);
      this.isMissing = true;
      this.missingAt = Date.now();
      this.networks = [];
      this.startDate = this.endDate = undefined;
      return;
    }
    if (this.isMissing) console.info(`HF radar totals back on ${this.src}`);
    this.isMissing = false;

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
  // view) with data since `since`, the preferred one first - and where a
  // network has several datasets (ICATMAR's processing versions), its newest
  // first: the one an hour is read from where versions overlap
  async networksIn(bbox, since) {
    await this.ready();
    const end = n => n.endDate?.getTime() ?? Infinity;
    return this.networks
      .filter(n => !bbox || !n.bbox.every(Number.isFinite) || intersects(n.bbox, bbox))
      .filter(n => !since || !n.endDate || n.endDate >= since)
      .sort((a, b) => ((b.network === this.preferNetwork) - (a.network === this.preferNetwork))
        || (end(b) === end(a) ? 0 : end(b) > end(a) ? 1 : -1));
  }

  // networksIn's entries grouped by network, each group in networksIn's
  // order: [[dataset entries of one network], ...]
  static byNetwork(networks) {
    const groups = new Map();
    networks.forEach(n => groups.set(n.network, [...(groups.get(n.network) ?? []), n]));
    return [...groups.values()];
  }

  // Where a value read from one of this source's datasets came from
  originOf(dataset) {
    return { label: this.label, source: this.label, dataset, url: `${this.baseUrl}/info/${dataset}/index.html` };
  }

  // The time of the newest map of any network in `bbox`
  async getLatestTime(bbox) {
    const ends = (await this.networksIn(bbox)).map(n => n.endDate).filter(Boolean);
    return ends.length ? new Date(Math.max(...ends)) : undefined;
  }

  // The map for the hour `time`, or null if no network has one. Every network
  // in `bbox` with a map in that hour (see inHour) is merged into one field; a
  // network without one is left out, never shown at another time. A network
  // with several datasets (versions) gives the first of them with a map for
  // the hour - two versions are never merged.
  async getField(time, bbox) {
    const networks = await this.networksIn(bbox, new Date(time.getTime() - HALF_HOUR_MS));

    const fields = await Promise.all(SourceErddapHFRadars.byNetwork(networks).map(async versions => {
      for (const n of versions) {
        try {
          const field = await this.mapAt(n, time);
          if (field) return field;
        } catch (error) {
          console.error(`HF radar currents from ${n.dataset}:`, error);
        }
      }
      return null;
    }));
    const found = fields.filter(Boolean);
    const merged = VectorField.merge(found);
    // The networks it was made from, each on its own grid - where the data
    // points really are (the merged grid is only for the animation)
    if (merged) merged.parts = found;
    // A map of several networks (datasets) links to the server itself
    if (merged && found.length > 1) merged.url = this.src;
    return merged;
  }

  // The grid point with data nearest (lon, lat) on the hour's map, no further
  // than one grid spacing in either direction (VectorField.nearestCell's
  // rule) - asked of ERDDAP for just the cells around the point, one small
  // .csv per network (a dataset of each, as getField picks it), rather than
  // read from whole maps:
  //   { lon, lat, network, distance (in km, see VectorField.distanceKm) }
  // null when the hour has a map but no data near the point, undefined when
  // no network has a map for the hour (so another source's is asked).
  async nearestGridPoint(time, lon, lat) {
    const bbox = [lon - 0.1, lat - 0.1, lon + 0.1, lat + 0.1];
    const networks = await this.networksIn(bbox, new Date(time.getTime() - HALF_HOUR_MS));
    let hasMap = false;
    let best = null;
    await Promise.all(SourceErddapHFRadars.byNetwork(networks).map(async versions => {
      for (const n of versions) {
        let cells;
        try {
          cells = await this.cellsAround(n, time, lon, lat);
        } catch (error) {
          console.error(`HF radar grid points from ${n.dataset}:`, error);
          continue;
        }
        if (cells === undefined) continue; // no map for the hour in this version
        hasMap = true;
        cells.forEach(cell => { if (!best || cell.distance < best.distance) best = cell; });
        return;
      }
    }));
    return best ?? (hasMap ? null : undefined);
  }

  // A network's cells with data within one grid spacing of (lon, lat) on its
  // map of the hour `time` (see mapAt): [{ lon, lat, network, distance }] -
  // undefined when it has no map for the hour
  async cellsAround(network, time, lon, lat) {
    const times = (await this.timesAround(network, time)).filter(t => inHour(t, time));
    if (times.length === 0) return undefined;
    const best = times.reduce((a, b) => Math.abs(b - time) < Math.abs(a - time) ? b : a);
    const { dimensions, axes } = await this.grid(network.dataset);
    const dLon = (axes.lonMax - axes.lonMin) / (axes.nx - 1);
    const dLat = (axes.latMax - axes.latMin) / (axes.ny - 1);
    // One spacing either way, within the grid - asking outside it is an error
    const lon0 = Math.max(lon - dLon, axes.lonMin), lon1 = Math.min(lon + dLon, axes.lonMax);
    const lat0 = Math.max(lat - dLat, axes.latMin), lat1 = Math.min(lat + dLat, axes.latMax);
    if (lon0 > lon1 || lat0 > lat1) return [];
    const selectors = encodeURIComponent((dimensions[this.eastward] ?? ['time', 'depth', 'latitude', 'longitude']).map(dimension => {
      if (dimension === 'time') return `[(${stamp(best)})]`;
      if (dimension === 'latitude') return `[(${lat0}):1:(${lat1})]`;
      if (dimension === 'longitude') return `[(${lon0}):1:(${lon1})]`;
      return '[0]';
    }).join(''));
    const url = `${this.baseUrl}/griddap/${network.dataset}.csv?${this.eastward}${selectors}`;
    let text;
    try {
      // A published map doesn't change - unless re-processed (see freshTtl)
      text = await this.fetchManager.fetch(this.url(url), this.freshTtl(network.dataset, this.url(url), best, best, IMAGE_TTL), TIMEOUT).then(res => res.text());
    } catch (error) {
      if (error.name === 'HTTPError') return [];
      throw error;
    }
    const lines = text.trim().split(/\r?\n/);
    const header = lines[0].split(',');
    const at = name => header.indexOf(name);
    const cells = [];
    lines.slice(2).forEach(line => {
      const row = line.split(',');
      const value = Number(row[at(this.eastward)]);
      if (row[at(this.eastward)] === 'NaN' || !Number.isFinite(value)) return;
      const cellLon = Number(row[at('longitude')]), cellLat = Number(row[at('latitude')]);
      if (Math.abs(cellLon - lon) > dLon || Math.abs(cellLat - lat) > dLat) return;
      cells.push({ lon: cellLon, lat: cellLat, network: network.network, distance: VectorField.distanceKm(lon, lat, cellLon, cellLat) });
    });
    return cells;
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
      this.fetchImageData(this.imageUrl(network.dataset, this.eastward, time, dimensions, axes), network.dataset, time),
      this.fetchImageData(this.imageUrl(network.dataset, this.northward, time, dimensions, axes), network.dataset, time),
    ]);
    const field = VectorField.fromGrayImages(east, north, axes, RANGE, time, network.network);
    // Which dataset it is from (one network's - a merge of several has none),
    // and its page
    if (field) {
      field.dataset = network.dataset;
      field.url = this.originOf(network.dataset).url;
    }
    return field;
  }

  url(url) {
    return this.useProxy ? SourceErddap.proxied(url) : url;
  }

  // A dataset's description, as its ERDDAP publishes it (NC_GLOBAL), plus
  // where to read about it
  async getDatasetMetadata(dataset) {
    const { metadata } = await this.grid(dataset);
    return { ...metadata, infoUrl: `${this.baseUrl}/info/${dataset}/index.html` };
  }

  // The current at one point, hour by hour over [startDate, endDate], as
  // numbers - exact, unlike the maps (which are for drawing). One griddap
  // request per dataset for the whole window. By default the grid cell
  // nearest the point (ERDDAP snaps to it and says which): a measured value,
  // at a known grid point. With `interpolate`, bilinear between the 4 cells
  // around it, only where all 4 have data (VectorField.interpolate,
  // ol-wind's rule) - for an interpolated view of the surface currents.
  // Every network covering the point is asked, the preferred one first, and
  // an hour already filled is kept:
  //   { cell: { latitude, longitude } (the cell read, or the nearest of the 4),
  //     network, dataset,
  //     cells: [{ latitude, longitude, weight }] (interpolate only: the 4),
  //     data: { '<ISO hour>': { u, v, speed, direction, time } } }
  // `direction` is where the water goes, clockwise from north.
  async getPointSeries(lon, lat, startDate, endDate, { interpolate = false } = {}) {
    const networks = (await this.networksIn([lon, lat, lon, lat], startDate))
      .filter(n => !n.startDate || n.startDate <= endDate);
    const result = { cell: undefined, cells: undefined, network: undefined, dataset: undefined, data: {} };
    for (const network of networks) {
      const from = network.startDate && startDate < network.startDate ? network.startDate : startDate;
      // Up to the dataset's last time - asking past it is an error
      const to = network.endDate && endDate >= network.endDate ? 'last' : `(${stamp(endDate)})`;
      const { dimensions, axes } = await this.grid(network.dataset);
      const around = interpolate ? cellsAround(axes, lon, lat) : null;
      if (interpolate && !around) continue;
      const selectors = (dimensions[this.eastward] ?? ['time', 'depth', 'latitude', 'longitude']).map(dimension => {
        if (dimension === 'time') return `[(${stamp(from)}):1:${to}]`;
        if (dimension === 'latitude') return around ? `[(${around.lat0}):1:(${around.lat1})]` : `[(${lat})]`;
        if (dimension === 'longitude') return around ? `[(${around.lon0}):1:(${around.lon1})]` : `[(${lon})]`;
        return '[0]';
      }).join('');
      const url = `${this.baseUrl}/griddap/${network.dataset}.csv?`
        + `${this.eastward}${encodeURIComponent(selectors)},${this.northward}${encodeURIComponent(selectors)}`;
      let text;
      try {
        const ttl = this.freshTtl(network.dataset, this.url(url), from, to === 'last' ? undefined : endDate, TIMES_TTL);
        text = await this.fetchManager.fetch(this.url(url), ttl, TIMEOUT).then(res => res.text());
      } catch (error) {
        if (error.name === 'HTTPError') continue; // nothing there in the window
        throw error;
      }
      const lines = text.trim().split(/\r?\n/);
      const header = lines[0].split(',');
      const at = name => header.indexOf(name);
      if (!around) {
        // The nearest cell: one row per map
        lines.slice(2).forEach(line => {
          const cells = line.split(',');
          const u = Number(cells[at(this.eastward)]);
          const v = Number(cells[at(this.northward)]);
          if (cells[at(this.eastward)] === 'NaN' || !isFinite(u) || !isFinite(v)) return;
          const time = new Date(cells[at('time')]);
          const key = hourOf(time).toISOString();
          if (result.data[key]) return;
          result.data[key] = { u, v, speed: Math.hypot(u, v), direction: (Math.atan2(u, v) * 180 / Math.PI + 360) % 360, time };
          result.cell ??= { latitude: Number(cells[at('latitude')]), longitude: Number(cells[at('longitude')]) };
          result.network ??= network.network;
          result.dataset ??= network.dataset;
        });
        continue;
      }
      // Each map's 4 corners, told apart by being on the low or high side
      const maps = new Map(); // time string -> { corners: { '00': {u, v}, ... } }
      lines.slice(2).forEach(line => {
        const cells = line.split(',');
        const timeText = cells[at('time')];
        const corner = `${Number(cells[at('latitude')]) > around.latMid ? 1 : 0}${Number(cells[at('longitude')]) > around.lonMid ? 1 : 0}`;
        const u = Number(cells[at(this.eastward)]);
        const v = Number(cells[at(this.northward)]);
        if (!maps.has(timeText)) maps.set(timeText, {});
        maps.get(timeText)[corner] = cells[at(this.eastward)] === 'NaN' || !isFinite(u) || !isFinite(v) ? null : { u, v };
      });
      let used = false;
      maps.forEach((corners, timeText) => {
        const value = interpolateCorners(corners, around);
        if (!value) return;
        const time = new Date(timeText);
        const key = hourOf(time).toISOString();
        if (result.data[key]) return;
        const { u, v } = value;
        result.data[key] = { u, v, speed: Math.hypot(u, v), direction: (Math.atan2(u, v) * 180 / Math.PI + 360) % 360, time };
        used = true;
      });
      if (used && !result.dataset) {
        result.cell = around.nearest;
        result.cells = around.cells;
        result.network = network.network;
        result.dataset = network.dataset;
      }
    }
    return result;
  }

  // Everything one grid cell of a network's totals holds, hour by hour over
  // [startDate, endDate] - the velocity and every other gridded variable
  // (errors, GDOP, coverage, QC flags...) - for the HFR dashboard's Point
  // view. The cell nearest (lon, lat), in the dataset of `network` (or the
  // first covering the point). One griddap request per dataset of the network
  // in the window - its versions, the newest first, an hour coming from the
  // first that has it (see networksIn).
  //   { network, dataset, cell: { latitude, longitude }, eastward, northward,
  //     variables: [{ name, attributes }], data: { <name>: { '<ISO hour>': value } },
  //     origins: { '<ISO hour>': { label, source, dataset, url, cell } } }
  // `dataset` and `cell` are the first dataset's; `origins` says each hour's.
  // null when no dataset covers the point.
  async getCellSeries(network, lon, lat, startDate, endDate) {
    const networks = (await this.networksIn([lon, lat, lon, lat], startDate))
      .filter(n => !n.startDate || n.startDate <= endDate);
    const name = networks.some(n => n.network === network) ? network : networks[0]?.network;
    let result = null;
    for (const chosen of networks.filter(n => n.network === name)) {
      const { dimensions, attributes } = await this.grid(chosen.dataset);
      const shape = (dimensions[this.eastward] ?? []).join(',');
      const names = Object.keys(dimensions).filter(name => dimensions[name].length > 1 && dimensions[name].join(',') === shape);
      const from = chosen.startDate && startDate < chosen.startDate ? chosen.startDate : startDate;
      const to = chosen.endDate && endDate >= chosen.endDate ? 'last' : `(${stamp(endDate)})`;
      const selectors = encodeURIComponent(dimensions[this.eastward].map(dimension => {
        if (dimension === 'time') return `[(${stamp(from)}):1:${to}]`;
        if (dimension === 'latitude') return `[(${lat})]`;
        if (dimension === 'longitude') return `[(${lon})]`;
        return '[0]';
      }).join(''));
      const url = `${this.baseUrl}/griddap/${chosen.dataset}.csv?${names.map(name => name + selectors).join(',')}`;
      let text;
      try {
        const ttl = this.freshTtl(chosen.dataset, this.url(url), from, to === 'last' ? undefined : endDate, TIMES_TTL);
        text = await this.fetchManager.fetch(this.url(url), ttl, TIMEOUT).then(res => res.text());
      } catch (error) {
        if (error.name === 'HTTPError') continue; // nothing there in the window
        throw error;
      }
      const lines = text.trim().split(/\r?\n/);
      const header = lines[0].split(',');
      const at = name => header.indexOf(name);
      result ??= {
        network: chosen.network, dataset: chosen.dataset, cell: undefined,
        eastward: this.eastward, northward: this.northward,
        variables: [], data: {}, origins: {},
      };
      names.forEach(name => {
        if (result.data[name]) return;
        result.variables.push({ name, attributes: attributes[name] ?? {} });
        result.data[name] = {};
      });
      // The hours an earlier (newer) version already has stay its own
      const taken = new Set(Object.keys(result.origins));
      let cell;
      lines.slice(2).forEach(line => {
        const cells = line.split(',');
        const key = hourOf(new Date(cells[at('time')])).toISOString();
        if (taken.has(key)) return;
        cell ??= { latitude: Number(cells[at('latitude')]), longitude: Number(cells[at('longitude')]) };
        let found = false;
        names.forEach(name => {
          const raw = cells[at(name)];
          const value = Number(raw);
          if (raw !== 'NaN' && raw !== '' && Number.isFinite(value) && result.data[name][key] == undefined) {
            result.data[name][key] = value;
            found = true;
          }
        });
        if (found) result.origins[key] ??= { ...this.originOf(chosen.dataset), cell };
      });
      result.cell ??= cell;
    }
    return result;
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
    // One row per network, even where it spans several datasets (versions):
    // an hour from the first version that has it, as the map takes it
    const byNetwork = new Map();
    rows.forEach(row => {
      const hours = byNetwork.get(row.network)?.hours ?? {};
      Object.entries(row.hours).forEach(([hour, count]) => { hours[hour] ??= count; });
      byNetwork.set(row.network, { network: row.network, hours });
    });
    return [...byNetwork.values()];
  }

  // How many grid points the network has, hour by hour in [startDate,
  // endDate] - every cell, unlike getAvailability's sample, so the counts
  // compare with the EU HFR Node's and GitHub's for the network timeline:
  //   { points: { 'YYYY-MM-DDTHH:00:00Z': count }, origins: { <same keys>: origin } }
  // An hour from the first dataset (version) that has it. One .nc request
  // per dataset, ~20 KB an hour for ICATMAR's grid.
  async getValidPointsCount(startDate, endDate = new Date()) {
    const networks = (await this.networksIn(undefined, startDate))
      .filter(n => !n.startDate || n.startDate <= endDate);
    const counts = await Promise.all(networks.map(network => this.countsOf(network, startDate, endDate, 1).catch(error => {
      console.error(`HF radar point counts from ${network.dataset}:`, error);
      return {};
    })));
    const points = {}, origins = {};
    counts.forEach((hours, k) => Object.entries(hours).forEach(([hour, count]) => {
      // Keyed as the EU HFR Node's and GitHub's counts are
      const key = hour.replace('.000Z', 'Z');
      if (count === 0 || points[key] != undefined) return;
      points[key] = count;
      origins[key] = this.originOf(networks[k].dataset);
    }));
    return { points, origins };
  }

  // A network's count of cells with data, per hour, from `startDate` to
  // `endDate` (to its latest map without one): every `stride`-th row and
  // column of countVariable - { '<ISO hour>': count }
  async countsOf(network, startDate, endDate, stride = COUNT_STRIDE) {
    const { dimensions } = await this.grid(network.dataset);
    const variable = this.countVariable;
    // Within the dataset's own time range - asking outside it is an error
    const from = network.startDate && startDate < network.startDate ? network.startDate : startDate;
    const to = !endDate || (network.endDate && endDate >= network.endDate) ? 'last' : `(${stamp(endDate)})`;
    if (endDate && from > endDate) return {};
    const selectors = (dimensions[variable] ?? ['time', 'depth', 'latitude', 'longitude']).map(dimension => {
      if (dimension === 'time') return `[(${stamp(from)}):1:${to}]`;
      if (dimension === 'latitude' || dimension === 'longitude') return `[0:${stride}:last]`;
      return '[0]';
    }).join('');
    const url = `${this.baseUrl}/griddap/${network.dataset}.nc?${variable}${encodeURIComponent(selectors)}`;
    let buffer;
    try {
      // Once afresh after a refresh found new maps: the URL ends at 'last'
      const ttl = this.staleCounts.delete(`${network.dataset}|${stride}`) ? 0
        : this.freshTtl(network.dataset, this.url(url), from, endDate, COUNT_TTL);
      buffer = await this.fetchManager.fetch(this.url(url), ttl, TIMEOUT).then(res => res.arrayBuffer());
    } catch (error) {
      if (error.name === 'HTTPError') return {}; // nothing in the range
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
      const hour = hourOf(new Date(seconds * 1000)).toISOString();
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
        const metadata = {}; // the dataset's NC_GLOBAL attributes (title, institution, license...)
        const attributes = {}; // each variable's own (long_name, units, flag_meanings...)
        text.trim().split('\n').filter(line => line).forEach(line => {
          const row = JSON.parse(line);
          const name = row['Variable Name'];
          if (row['Row Type'] === 'variable')
            dimensions[name] = String(row['Value'] ?? '').split(',').map(d => d.trim()).filter(Boolean);
          if (row['Row Type'] === 'attribute' && name !== 'NC_GLOBAL' && row['Attribute Name'])
            (attributes[name] ??= {})[row['Attribute Name']] = row['Value'];
          if (row['Row Type'] === 'dimension')
            counts[name] = Number(/nValues=(\d+)/.exec(String(row['Value']))?.[1]);
          if (name === 'NC_GLOBAL' && row['Attribute Name']) metadata[row['Attribute Name']] = row['Value'];
          if (row['Attribute Name'] === 'actual_range' && (name === 'latitude' || name === 'longitude'))
            ranges[name] = String(row['Value']).split(',').map(Number);
        });
        if (!ranges.latitude || !ranges.longitude)
          throw new Error(`No latitude/longitude range in the info of ${dataset}`);
        return {
          dimensions,
          metadata,
          attributes,
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

  async fetchImageData(url, dataset, time) {
    // A published map doesn't change - unless re-processed (see freshTtl)
    const ttl = dataset ? this.freshTtl(dataset, this.url(url), time, time, IMAGE_TTL) : IMAGE_TTL;
    const blob = await this.fetchManager.fetch(this.url(url), ttl, TIMEOUT).then(res => res.blob());
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
