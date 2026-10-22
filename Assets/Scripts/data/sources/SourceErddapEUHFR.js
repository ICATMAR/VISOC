import Source from './Source.js';
import SourceErddap from './SourceErddap.js';
import { readNetCDF3 } from '../parsers/netcdf3.js';
import { destination, bearingAwayFrom } from '../geo.js';


// Kept from the network's (the 'Total' dataset's) NC_GLOBAL attributes - shared
// across every station, so kept once instead of repeated on each of them.
const NETWORK_METADATA_KEYS = ['acknowledgement', 'institution', 'site_code','citation', 'comment', 'distribution_statement', 'license', 'summary'];
// Kept from each station's NC_GLOBAL attributes. manufacturer and
// last_calibration_date are here because the app shows both, and the EU HFR
// Node is the only place either is published - the static catalogue never
// carried them, and the hardcoded calibration dates they were read off years
// ago have since drifted (AREN/PBCN/GNST were recalibrated in May 2026).
const STATION_METADATA_KEYS = ['doa_estimation_method', 'institution', 'network', 'title', 'sensor_model', 'manufacturer', 'summary', 'wmo_platform_code', 'last_calibration_date', 'time_coverage_start', 'time_coverage_end'];

// The node serves some text double-encoded - 'DirecciÃ³' where 'Direcció'
// belongs. Undone where that pattern shows; left alone otherwise.
const repairEncoding = text => {
  if (typeof text !== 'string' || !/[\u00c0-\u00ff][\u0080-\u00bf]/.test(text)) return text;
  try { return decodeURIComponent(escape(text)); } catch { return text; }
};

// What griddapEntry() reads off a dataset's info
const GRIDDAP_ENTRY_KEYS = ['time_coverage_start', 'time_coverage_end', 'site_lat', 'site_lon',
  'geospatial_lat_min', 'geospatial_lat_max', 'geospatial_lon_min', 'geospatial_lon_max'];

// Radial maps: how many (station, hour) to keep, and for how long the
// requests themselves are cached
const RADIAL_CACHE_SIZE = 300;
const RADIAL_TTL_MINUTES = 10;
const HALF_HOUR_MS = 30 * 60 * 1000;

function pick(metadata, keys) {
  const picked = {};
  keys.forEach(key => { if (metadata[key] !== undefined) picked[key] = repairEncoding(metadata[key]); });
  return picked;
}

// Where a station's data actually lands, from ERDDAP's geospatial_* bounds -
// the box its radials cover, which reaches tens of kilometres offshore and is
// nothing like the site itself. Written in the same { minLat, minLon, maxLat,
// maxLon } shape the catalogue writes its bboxes in. undefined unless all four
// bounds are present and numeric: a half-known box can't be fitted to.
function coverageFrom(metadata) {
  const coverage = {
    minLat: Number(metadata['geospatial_lat_min']),
    minLon: Number(metadata['geospatial_lon_min']),
    maxLat: Number(metadata['geospatial_lat_max']),
    maxLon: Number(metadata['geospatial_lon_max']),
  };
  return Object.values(coverage).every(Number.isFinite) ? coverage : undefined;
}

class SourceErddapEUHFR extends Source {

  constructor({ fetchManager, src, datasets, mapping }) {
    super({ fetchManager });
    this.src = src;
    this.baseUrl = src.replace(/\/index\.html$/, '');
    this.datasets = datasets;

    // Per-station results, keyed by station code (e.g. 'CREU').
    this.stations = {};

    this.loadingPromise = this.load();
  }

  // e.g. 'EUHFR_NRTcurrent_HFR-ICATMAR-CREU_v3_table' -> 'CREU'
  stationFromDataset(datasetID) {
    const match = datasetID.match(/HFR-[^-]+-([A-Za-z0-9]+)_v3(_table)?$/);
    return match ? match[1] : datasetID;
  }

  // e.g. 'EUHFR_NRTcurrent_HFR-ICATMAR-CREU_v3_table' -> { network: 'ICATMAR', station: 'CREU', isTable: true, isTotal: false }
  // Same convention as stationFromDataset(), but also captures the network -
  // needed once station codes are no longer scoped to a single network.
  parseDatasetId(datasetID) {
    const match = datasetID.match(/HFR-([^-]+)-([A-Za-z0-9]+)_v3(_table)?$/);
    if (!match) return null;
    const [, network, station, table] = match;
    return { network, station, isTable: !!table, isTotal: station === 'Total' };
  }

  // For now, just fetch the datasets given in the catalogue (ICATMAR's).
  // Later: discover all EU HFR Node datasets dynamically instead of relying
  // on a fixed list (tying each network's Total to its station/radial
  // datasets, dedupe ICATMAR's doubled _v3/_v3_table entries, bbox-filter).
  async load() {
    await Promise.all(this.datasets.map(async dataset => {
      const infoUrl = `${this.baseUrl}/info/${dataset}/index.jsonlKVP`;
      const infoText = await this.fetchManager.fetch(SourceErddap.proxied(infoUrl)).then(res => res.text());
      const { variables, metadata } = this.parseERDDAPMetadata(infoText);

      // NC_GLOBAL's time_coverage_start/end - already in this same info
      // page, no separate allDatasets.jsonlKVP request needed.
      const station = this.stationFromDataset(dataset);
      this.stations[station] = {
        dataset,
        variables,
        metadata,
        startDate: metadata['time_coverage_start'] ? new Date(metadata['time_coverage_start']) : undefined,
        endDate: metadata['time_coverage_end'] ? new Date(metadata['time_coverage_end']) : undefined,
        coverage: coverageFrom(metadata),
      };
    }));

    const { startDate, endDate } = this.dateRange();
    this.startDate = startDate;
    this.endDate = endDate;
  }

  // Earliest start and latest end across all stations - each one may have
  // started/stopped reporting at a different time.
  dateRange() {
    const entries = Object.values(this.stations);
    const startDates = entries.map(s => s.startDate).filter(Boolean);
    const endDates = entries.map(s => s.endDate).filter(Boolean);
    return {
      startDate: startDates.length ? new Date(Math.min(...startDates)) : undefined,
      endDate: endDates.length ? new Date(Math.max(...endDates)) : undefined,
    };
  }


  // Discovers ICATMAR's station datasets dynamically (not the fixed "_table"
  // list load() uses from the catalogue). Uses the _table variant - since a
  // fix on the EU HFR Node side, ICATMAR's _table datasets now also carry
  // site_lat/site_lon as NC_GLOBAL attributes (this is currently confirmed
  // for ICATMAR only - see getAllNetworks() for other networks).
  // Populates this.stations with them (same shape as load()), so other code
  // can read that metadata straight off this source afterward. Returns
  // { total, stations } - the same shape Data/hfr/hfr-icatmar.js is stored
  // in, so callers don't need to care whether data came from the static file
  // or a live request.
  async getICATMARHFRStations() {
    const allDatasets = await SourceErddap.fetchAllDatasets(this.fetchManager, this.baseUrl);
    const icatmarDatasets = allDatasets.filter(d => d['datasetID'].includes('ICATMAR'));

    // The network's own Total dataset - its NC_GLOBAL attributes are shared
    // by every station, so they're kept once here instead of per-station.
    const totalDataset = icatmarDatasets.find(d => d['datasetID'].includes('Total'));
    const total = totalDataset ? await this.fetchMetadata(totalDataset['datasetID'], NETWORK_METADATA_KEYS) : undefined;

    const stationDatasets = icatmarDatasets.filter(d => {
      const id = d['datasetID'];
      return id.includes('_table') && !id.includes('Total');
    });

    const stations = await Promise.all(stationDatasets.map(async d => {
      const dataset = d['datasetID'];
      const infoUrl = `${this.baseUrl}/info/${dataset}/index.jsonlKVP`;
      const infoText = await this.fetchManager.fetch(SourceErddap.proxied(infoUrl)).then(res => res.text());
      const { variables, metadata } = this.parseERDDAPMetadata(infoText);

      const id = this.stationFromDataset(dataset);
      this.stations[id] = {
        dataset,
        variables,
        metadata,
        startDate: metadata['time_coverage_start'] ? new Date(metadata['time_coverage_start']) : undefined,
        endDate: metadata['time_coverage_end'] ? new Date(metadata['time_coverage_end']) : undefined,
        coverage: coverageFrom(metadata),
      };

      return {
        id,
        latitude: Number(metadata['site_lat']),
        longitude: Number(metadata['site_lon']),
        coverage: coverageFrom(metadata),
        metadata: pick(metadata, STATION_METADATA_KEYS),
      };
    }));

    return { total, stations: stations.filter(s => !Number.isNaN(s.latitude) && !Number.isNaN(s.longitude)) };
  }


  // Every network (each { total, stations }) on this EU HFR Node - ICATMAR
  // included, not treated specially. For browsing everything this ERDDAP
  // server has, not scoped to one network like getICATMARHFRStations() is.
  // Populates this.stations the same way load()/getICATMARHFRStations() do
  // (keyed by '<network>-<station>' here, since station codes are no longer
  // guaranteed unique across networks).
  async getAllNetworks() {
    const allDatasets = await SourceErddap.fetchAllDatasets(this.fetchManager, this.baseUrl);

    // Group dataset IDs by network, splitting each into its Total dataset and
    // its station datasets. Station datasets: ICATMAR's _table variant now
    // also carries site_lat/site_lon (a recent EU HFR Node fix), so it's
    // preferred there; every other network keeps the plain variant, since
    // that fix isn't confirmed for them yet.
    const byNetwork = new Map(); // network name -> { totalDataset, stationDatasets: [] }
    allDatasets.forEach(d => {
      const parsed = this.parseDatasetId(d['datasetID']);
      if (!parsed) return;

      if (!byNetwork.has(parsed.network)) byNetwork.set(parsed.network, { totalDataset: undefined, stationDatasets: [] });
      const entry = byNetwork.get(parsed.network);

      if (parsed.isTotal) { entry.totalDataset = d['datasetID']; return; }

      const preferTable = parsed.network === 'ICATMAR';
      if (parsed.isTable === preferTable) entry.stationDatasets.push(d['datasetID']);
    });

    // A dataset that fails to answer (the node or the proxy erroring now and
    // then) costs only itself, not every network
    const skipFailed = dataset => error => {
      console.warn(`EU HFR Node: skipping ${dataset}:`, error);
      return undefined;
    };

    return Promise.all([...byNetwork.entries()].map(async ([networkName, { totalDataset, stationDatasets }]) => {
      const total = totalDataset
        ? await this.fetchMetadata(totalDataset, NETWORK_METADATA_KEYS).catch(skipFailed(totalDataset))
        : undefined;

      const stations = await Promise.all(stationDatasets.map(dataset => (async () => {
        const infoUrl = `${this.baseUrl}/info/${dataset}/index.jsonlKVP`;
        const infoText = await this.fetchManager.fetch(SourceErddap.proxied(infoUrl)).then(res => res.text());
        const { variables, metadata } = this.parseERDDAPMetadata(infoText);

        const station = this.stationFromDataset(dataset);
        this.stations[`${networkName}-${station}`] = {
          dataset,
          variables,
          metadata,
          startDate: metadata['time_coverage_start'] ? new Date(metadata['time_coverage_start']) : undefined,
          endDate: metadata['time_coverage_end'] ? new Date(metadata['time_coverage_end']) : undefined,
          coverage: coverageFrom(metadata),
        };

        return {
          id: station,
          latitude: Number(metadata['site_lat']),
          longitude: Number(metadata['site_lon']),
          coverage: coverageFrom(metadata),
          metadata: {
            ...pick(metadata, STATION_METADATA_KEYS),
            // The network's code, from the dataset id - what identifies the
            // station's network everywhere (getAllNetworks()' groups, the
            // selection). The station's own `network` attribute is free text
            // each operator writes its own way ('HFR_Galicia', 'GULF OF
            // TRIESTE (GOT)'), kept as network_name.
            network: `HFR-${networkName}`,
            ...(metadata['network'] && metadata['network'] !== `HFR-${networkName}` ? { network_name: repairEncoding(metadata['network']) } : {}),
          },
        };
      })().catch(skipFailed(dataset))));

      return { total, stations: stations.filter(s => s && !Number.isNaN(s.latitude) && !Number.isNaN(s.longitude)) };
    }));
  }

  async fetchMetadata(dataset, keys) {
    const infoUrl = `${this.baseUrl}/info/${dataset}/index.jsonlKVP`;
    const infoText = await this.fetchManager.fetch(SourceErddap.proxied(infoUrl)).then(res => res.text());
    const { metadata } = this.parseERDDAPMetadata(infoText);
    return pick(metadata, keys);
  }

  // Discovers and caches the ICATMAR network's own Total dataset - its id and
  // coverage (this.total), needed by getNumberOfValidPointsForTotal(). Doesn't
  // touch per-station datasets (see getICATMARHFRStations() for those).
  async loadTotal() {
    if (this.total) return this.total;

    const allDatasets = await SourceErddap.fetchAllDatasets(this.fetchManager, this.baseUrl);
    const totalDatasetId = allDatasets.find(d => d['datasetID'].includes('ICATMAR') && d['datasetID'].includes('Total'))?.['datasetID'];
    if (!totalDatasetId) return undefined;

    const infoUrl = `${this.baseUrl}/info/${totalDatasetId}/index.jsonlKVP`;
    const infoText = await this.fetchManager.fetch(SourceErddap.proxied(infoUrl)).then(res => res.text());
    const { metadata } = this.parseERDDAPMetadata(infoText);

    this.total = {
      dataset: totalDatasetId,
      startDate: metadata['time_coverage_start'] ? new Date(metadata['time_coverage_start']) : undefined,
      endDate: metadata['time_coverage_end'] ? new Date(metadata['time_coverage_end']) : undefined,
    };
    return this.total;
  }

  // Per-hour count of valid (non-NaN, per countVariable) points for one
  // dataset, within [startDate, endDate] (endDate defaults to now). Only
  // works against a dataset's _table variant - ERDDAP's orderByCount()
  // aggregation isn't supported on griddap-backed datasets. Shared by
  // getNumberOfValidPointsPerStation() (countVariable 'RDVA', per station)
  // and getNumberOfValidPointsForTotal() (countVariable 'EWCT', for the Total) -
  // same mechanism, only the dataset/count column differ. `entry` is the
  // { dataset, startDate, endDate, validPoints, validPointsRange } object to
  // read/cache into (a station, or this.total) - cached results are kept in
  // entry.validPoints (keyed by timestamp), and the request is skipped
  // entirely if that range is already cached.
  async fetchValidPointsCount(entry, countVariable, startDate, endDate) {
    const end = endDate ?? new Date();

    const rangeStart = entry.startDate && entry.startDate > startDate ? entry.startDate : startDate;
    const rangeEnd = entry.endDate && entry.endDate < end ? entry.endDate : end;

    if (!entry.validPoints) entry.validPoints = {};
    if (rangeStart > rangeEnd) return entry.validPoints; // no overlap with this entry's coverage

    // Already covered by a previous call - nothing new to fetch.
    const range = entry.validPointsRange;
    if (range && rangeStart >= range.start && rangeEnd <= range.end) return entry.validPoints;

    const dataset = entry.dataset.endsWith('_table') ? entry.dataset : `${entry.dataset}_table`;
    const url = `${this.baseUrl}/tabledap/${dataset}.csv?time,${countVariable}`
      + `&time>=${rangeStart.toISOString()}&time<=${rangeEnd.toISOString()}`
      + `&${countVariable}!=NaN&orderByCount("time")`;

    const text = await this.fetchManager.fetch(SourceErddap.proxied(url), 1)
      .then(res => res.text())
      .catch(err => {
        if (err.name === 'HTTPError' && err.status === 404) return null; // no matching rows
        throw err;
      });

    if (text != null) {
      const lines = text.trim().split('\n').filter(Boolean).slice(2); // skip names/units header rows
      lines.forEach(line => {
        const [time, count] = line.split(',');
        entry.validPoints[time] = Number(count);
      });
    }

    entry.validPointsRange = {
      start: range ? new Date(Math.min(range.start, rangeStart)) : rangeStart,
      end: range ? new Date(Math.max(range.end, rangeEnd)) : rangeEnd,
    };

    return entry.validPoints;
  }

  // Per-hour count of valid (QC-passing, non-NaN RDVA) radial vectors for ONE
  // station, within [startDate, endDate] (endDate defaults to now).
  async getNumberOfValidPointsPerStation(id, startDate, endDate) {
    const station = this.stations[id] ?? await this.otherNetworkStation(id);
    if (!station) return { id, points: undefined };
    const points = station.isGriddap
      ? await this.fetchGriddapValidPointsCount(station, startDate, endDate)
      : await this.fetchValidPointsCount(station, 'RDVA', startDate, endDate);
    return { id, points };
  }

  // A station of ICATMAR's network that the node publishes under another
  // network rather than HFR-ICATMAR - Puertos del Estado's ALFA, SALO and VINA
  // are HFR-DeltaEbro's there. Its plain (griddap) dataset, as a station
  // entry like load()'s; undefined if no network has the code. Looked up once.
  otherNetworkStation(id) {
    this.otherNetworkStations ??= {};
    this.otherNetworkStations[id] ??= (async () => {
      const allDatasets = await SourceErddap.fetchAllDatasets(this.fetchManager, this.baseUrl);
      const dataset = allDatasets.map(d => d['datasetID'])
        .find(datasetID => { const parsed = this.parseDatasetId(datasetID); return parsed?.station === id && !parsed.isTable; });
      return dataset ? this.griddapEntry(dataset) : undefined;
    })().catch(error => {
      console.warn(`EU HFR Node: no dataset for ${id}:`, error);
      return undefined;
    });
    return this.otherNetworkStations[id];
  }

  // A plain (griddap) dataset as an entry fetchGriddapValidPointsCount() can
  // count and cache into - its time coverage read from its info. One per
  // dataset.
  griddapEntry(dataset) {
    this.griddapEntries ??= {};
    this.griddapEntries[dataset] ??= this.fetchMetadata(dataset, GRIDDAP_ENTRY_KEYS)
      .then(metadata => ({
        dataset,
        isGriddap: true,
        startDate: metadata['time_coverage_start'] ? new Date(metadata['time_coverage_start']) : undefined,
        endDate: metadata['time_coverage_end'] ? new Date(metadata['time_coverage_end']) : undefined,
        // Where the antenna is - what a polar grid's ranges and bearings
        // count from - and, where the station publishes it, the box its
        // radials cover
        site: { lat: Number(metadata['site_lat']), lon: Number(metadata['site_lon']) },
        coverage: coverageFrom(metadata),
      }))
      .catch(error => { delete this.griddapEntries[dataset]; throw error; });
    return this.griddapEntries[dataset];
  }

  // One station's radials at `hour` (a Date on the hour), from its griddap
  // dataset: the map in [hour - 30 min, hour + 30 min) closest to the hour,
  // never one from another hour - null when there is none, undefined when
  // the node has no dataset for the station at all (SCAL).
  //   { time, layout: 'polar' | 'grid', site: { lat, lon },
  //     lat, lon, velocity, direction: Float32Array (one entry per bin with
  //     data; velocity in m/s, positive away from the antenna; direction the
  //     bearing pointing away from it, degrees true),
  //     qc: Int8Array (QCflag, 1 = good), source: 'EU HFR Node',
  //     dataExtent: the box of its bins, coverage: the station's published
  //     radial extent [minLon, minLat, maxLon, maxLat], where it has one }
  // `network` is the station's network code; a station ICATMAR's network
  // takes in from another (Puertos del Estado's, HFR-DeltaEbro's here) is
  // found by its code.
  async getRadialField(network, stationId, hour) {
    const code = network.replace(/^HFR-/, '');
    const known = this.stations[`${code}-${stationId}`];
    const entry = known
      ? await this.griddapEntry(known.dataset.replace(/_table$/, ''))
      : await this.otherNetworkStation(stationId);
    if (!entry) return undefined;

    const key = `${entry.dataset}|${hour.toISOString()}`;
    this.radialFields ??= new Map();
    if (!this.radialFields.has(key)) {
      this.radialFields.set(key, this.fetchRadialField(entry, hour).catch(error => {
        this.radialFields.delete(key);
        throw error;
      }));
      // Least recently added out first
      if (this.radialFields.size > RADIAL_CACHE_SIZE) this.radialFields.delete(this.radialFields.keys().next().value);
    }
    const field = await this.radialFields.get(key);
    if (!field) return null;
    const c = entry.coverage;
    return { ...field, coverage: c ? [c.minLon, c.minLat, c.maxLon, c.maxLat] : undefined };
  }

  async fetchRadialField(entry, hour) {
    const from = new Date(hour.getTime() - HALF_HOUR_MS);
    const to = new Date(hour.getTime() + HALF_HOUR_MS);
    if (entry.startDate && to <= entry.startDate) return null;
    // Up to the window's end - or the dataset's last map, should that be
    // earlier: asking past it is an error. ERDDAP snaps both ends to the
    // nearest map, so what comes back is filtered to the window below.
    const stop = entry.endDate && to < entry.endDate ? `(${to.toISOString()})` : 'last';
    const selectors = encodeURIComponent(`[(${from.toISOString()}):1:${stop}][0][0:1:last][0:1:last]`);
    const url = `${this.baseUrl}/griddap/${entry.dataset}.nc?RDVA${selectors},QCflag${selectors}`;
    let buffer;
    try {
      buffer = await this.fetchManager.fetch(url, RADIAL_TTL_MINUTES).then(res => res.arrayBuffer());
    } catch (error) {
      if (error.name === 'HTTPError') return null; // nothing from that hour on
      throw error;
    }

    const file = readNetCDF3(buffer);
    const times = file.variables['time'].read(); // seconds since 1970
    // The map closest to the hour, inside the window
    let best = -1;
    times.forEach((seconds, k) => {
      const ms = seconds * 1000;
      if (ms < from.getTime() || ms >= to.getTime()) return;
      if (best < 0 || Math.abs(ms - hour) < Math.abs(times[best] * 1000 - hour)) best = k;
    });
    if (best < 0) return null;

    const rdva = file.variables['RDVA'];
    const [, , dimA, dimB] = rdva.dimensions; // RNGE, BEAR - or latitude, longitude
    const isPolar = dimA === 'RNGE';
    const axisA = file.variables[dimA].read();
    const axisB = file.variables[dimB].read();
    const perMap = axisA.length * axisB.length;
    const velocities = rdva.read().subarray(best * perMap, (best + 1) * perMap);
    const flags = file.variables['QCflag'].read().subarray(best * perMap, (best + 1) * perMap);
    const fill = rdva.attributes['_FillValue'];

    const site = entry.site;
    const lat = [], lon = [], velocity = [], direction = [], qc = [];
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    for (let a = 0; a < axisA.length; a++) {
      for (let b = 0; b < axisB.length; b++) {
        const v = velocities[a * axisB.length + b];
        if (Number.isNaN(v) || v === fill) continue;
        const [pLat, pLon] = isPolar ? destination(site, axisB[b], axisA[a]) : [axisA[a], axisB[b]];
        lat.push(pLat); lon.push(pLon); velocity.push(v); qc.push(flags[a * axisB.length + b]);
        direction.push(bearingAwayFrom(site, pLat, pLon));
        if (pLon < minLon) minLon = pLon; if (pLon > maxLon) maxLon = pLon;
        if (pLat < minLat) minLat = pLat; if (pLat > maxLat) maxLat = pLat;
      }
    }
    return {
      source: 'EU HFR Node',
      time: new Date(times[best] * 1000),
      layout: isPolar ? 'polar' : 'grid',
      site,
      lat: Float32Array.from(lat), lon: Float32Array.from(lon),
      velocity: Float32Array.from(velocity), direction: Float32Array.from(direction), qc: Int8Array.from(qc),
      dataExtent: lat.length ? [minLon, minLat, maxLon, maxLat] : [site.lon, site.lat, site.lon, site.lat],
    };
  }

  // Valid points per hour for one network as the node publishes it -
  // `network` its site code ('HFR-DeltaEbro') - its Total ('TOTALS') and each
  // of `stationIds`: an array of promises of { id, points }, one per entity,
  // like getNumberOfValidPointsPerStations(). A station's _table dataset is
  // counted with orderByCount (ICATMAR's), any other on its griddap QCflag.
  // points is undefined for a dataset the node doesn't have.
  getNumberOfValidPointsForNetwork(network, stationIds, startDate, endDate) {
    const code = network.replace(/^HFR-/, '');
    const count = async (id, dataset) => {
      try {
        const known = this.stations[`${code}-${id}`]; // from getAllNetworks()
        const entry = known?.dataset.endsWith('_table') ? known : await this.griddapEntry(known?.dataset ?? dataset);
        const points = entry.isGriddap
          ? await this.fetchGriddapValidPointsCount(entry, startDate, endDate)
          : await this.fetchValidPointsCount(entry, 'RDVA', startDate, endDate);
        return { id, points };
      } catch (error) {
        console.warn(`EU HFR Node: no valid points for ${network} ${id}:`, error);
        return { id, points: undefined };
      }
    };
    return [
      count('TOTALS', `EUHFR_NRTcurrent_HFR-${code}-Total_v3`),
      ...stationIds.map(id => count(id, `EUHFR_NRTcurrent_HFR-${code}-${id}_v3`)),
    ];
  }

  // fetchValidPointsCount() for a dataset with no _table variant: the
  // radials' QCflag grid as .nc, counting the cells with a radial in each map
  // - the same number orderByCount gives on a _table (QC-good and -bad
  // alike). Straight from the node, which allows CORS: binary is better kept
  // off the proxy. Cached into `entry` the same way.
  async fetchGriddapValidPointsCount(entry, startDate, endDate) {
    const end = endDate ?? new Date();
    const rangeStart = entry.startDate && entry.startDate > startDate ? entry.startDate : startDate;
    const rangeEnd = entry.endDate && entry.endDate < end ? entry.endDate : end;

    if (!entry.validPoints) entry.validPoints = {};
    if (rangeStart > rangeEnd) return entry.validPoints;
    const range = entry.validPointsRange;
    if (range && rangeStart >= range.start && rangeEnd <= range.end) return entry.validPoints;

    const selectors = `[(${rangeStart.toISOString()}):1:(${rangeEnd.toISOString()})][0][0:1:last][0:1:last]`;
    const url = `${this.baseUrl}/griddap/${entry.dataset}.nc?QCflag${encodeURIComponent(selectors)}`;
    const buffer = await this.fetchManager.fetch(url, 1)
      .then(res => res.arrayBuffer())
      .catch(err => {
        if (err.name === 'HTTPError' && err.status === 404) return null; // no map in the range
        throw err;
      });

    if (buffer) {
      const file = readNetCDF3(buffer);
      const values = file.variables['QCflag'].read();
      const fill = file.variables['QCflag'].attributes['_FillValue'];
      const times = file.variables['time'].read(); // seconds since 1970
      const perTime = values.length / times.length;
      times.forEach((seconds, k) => {
        let count = 0;
        for (let i = k * perTime; i < (k + 1) * perTime; i++) if (values[i] !== fill && !Number.isNaN(values[i])) count++;
        // Keyed as the _table counts are: '2026-10-21T01:00:00Z'
        if (count > 0) entry.validPoints[new Date(seconds * 1000).toISOString().replace('.000Z', 'Z')] = count;
      });
    }

    entry.validPointsRange = {
      start: range ? new Date(Math.min(range.start, rangeStart)) : rangeStart,
      end: range ? new Date(Math.max(range.end, rangeEnd)) : rangeEnd,
    };
    return entry.validPoints;
  }

  // Array of per-station promises (NOT a single Promise<object> resolved via
  // Promise.all) - lets a caller process each station's result as soon as IT
  // resolves, instead of waiting for the slowest one before touching any of
  // them. Only async to await loadingPromise first, since this.stations
  // isn't populated before load() resolves; building the array itself is
  // synchronous once that's done.
  async getNumberOfValidPointsPerStations(stationIds, startDate, endDate) {
    await this.loadingPromise;
    return stationIds.map(id => this.getNumberOfValidPointsPerStation(id, startDate, endDate));
  }

  // Per-hour count of valid (non-NaN eastward-velocity 'EWCT') grid points for
  // the ICATMAR network's Total dataset, within [startDate, endDate]. Same
  // _table/orderByCount mechanism as getNumberOfValidPointsPerStation(), just
  // against the Total dataset and its own count variable.
  async getNumberOfValidPointsForTotal(startDate, endDate) {
    await this.loadTotal();
    if (!this.total) return { id: 'TOTALS', points: undefined };
    const points = await this.fetchValidPointsCount(this.total, 'EWCT', startDate, endDate);
    return { id: 'TOTALS', points };
  }

}

export default SourceErddapEUHFR;
