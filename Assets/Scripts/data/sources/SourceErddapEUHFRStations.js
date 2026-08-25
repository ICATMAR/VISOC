import Source from './Source.js';
import SourceErddap from './SourceErddap.js';


// Kept from the network's (the 'Total' dataset's) NC_GLOBAL attributes - shared
// across every station, so kept once instead of repeated on each of them.
const NETWORK_METADATA_KEYS = ['acknowledgement', 'institution', 'site_code','citation', 'comment', 'distribution_statement', 'license', 'summary'];
// Kept from each station's NC_GLOBAL attributes.
const STATION_METADATA_KEYS = ['doa_estimation_method', 'institution', 'network', 'title', 'sensor_model', 'summary', 'wmo_platform_code', 'time_coverage_start', 'time_coverage_end'];

function pick(metadata, keys) {
  const picked = {};
  keys.forEach(key => { if (metadata[key] !== undefined) picked[key] = metadata[key]; });
  return picked;
}

class SourceErddapEUHFRStations extends Source {

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
  // for ICATMAR only - see getAllStations() for other networks).
  // Populates this.stations with them (same shape as load()), so other code
  // can read that metadata straight off this source afterward. Returns
  // { network, stations } - the same shape Data/staticData.js is stored in,
  // so callers don't need to care whether positions came from the static
  // file or a live request.
  async getICATMARHFRStations() {
    const allDatasets = await SourceErddap.fetchAllDatasets(this.fetchManager, this.baseUrl);
    const icatmarDatasets = allDatasets.filter(d => d['datasetID'].includes('ICATMAR'));

    // The network's own dataset - its NC_GLOBAL attributes are shared by
    // every station, so they're kept once here instead of per-station.
    const totalDataset = icatmarDatasets.find(d => d['datasetID'].includes('Total'));
    const network = totalDataset ? await this.fetchMetadata(totalDataset['datasetID'], NETWORK_METADATA_KEYS) : undefined;

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
      };

      return {
        id,
        latitude: Number(metadata['site_lat']),
        longitude: Number(metadata['site_lon']),
        metadata: pick(metadata, STATION_METADATA_KEYS),
      };
    }));

    return { network, stations: stations.filter(s => !Number.isNaN(s.latitude) && !Number.isNaN(s.longitude)) };
  }


  // Every network and station on this EU HFR Node - ICATMAR included, not
  // treated specially. For browsing everything this ERDDAP server has, not
  // scoped to one network like getICATMARHFRStations() is. Populates
  // this.stations the same way load()/getICATMARHFRStations() do (keyed by
  // '<network>-<station>' here, since station codes are no longer guaranteed
  // unique across networks). Returns one { network, stations } group per
  // network - same per-group shape as getICATMARHFRStations() returns.
  async getAllStations() {
    const allDatasets = await SourceErddap.fetchAllDatasets(this.fetchManager, this.baseUrl);

    // Group dataset IDs by network, splitting each into its Total dataset and
    // its station datasets. Station datasets: ICATMAR's _table variant now
    // also carries site_lat/site_lon (a recent EU HFR Node fix), so it's
    // preferred there; every other network keeps the plain variant, since
    // that fix isn't confirmed for them yet.
    const byNetwork = new Map(); // network name -> { total, stationDatasets: [] }
    allDatasets.forEach(d => {
      const parsed = this.parseDatasetId(d['datasetID']);
      if (!parsed) return;

      if (!byNetwork.has(parsed.network)) byNetwork.set(parsed.network, { total: undefined, stationDatasets: [] });
      const entry = byNetwork.get(parsed.network);

      if (parsed.isTotal) { entry.total = d['datasetID']; return; }

      const preferTable = parsed.network === 'ICATMAR';
      if (parsed.isTable === preferTable) entry.stationDatasets.push(d['datasetID']);
    });

    return Promise.all([...byNetwork.entries()].map(async ([networkName, { total, stationDatasets }]) => {
      const network = total ? await this.fetchMetadata(total, NETWORK_METADATA_KEYS) : undefined;

      const stations = await Promise.all(stationDatasets.map(async dataset => {
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
        };

        return {
          id: station,
          latitude: Number(metadata['site_lat']),
          longitude: Number(metadata['site_lon']),
          metadata: pick(metadata, STATION_METADATA_KEYS),
        };
      }));

      return { network, stations: stations.filter(s => !Number.isNaN(s.latitude) && !Number.isNaN(s.longitude)) };
    }));
  }

  async fetchMetadata(dataset, keys) {
    const infoUrl = `${this.baseUrl}/info/${dataset}/index.jsonlKVP`;
    const infoText = await this.fetchManager.fetch(SourceErddap.proxied(infoUrl)).then(res => res.text());
    const { metadata } = this.parseERDDAPMetadata(infoText);
    return pick(metadata, keys);
  }



  // Per-hour count of valid (QC-passing, non-NaN RDVA) radial vectors for ONE
  // station, within [startDate, endDate] (endDate defaults to now). Only
  // works against a dataset's _table variant - ERDDAP's orderByCount()
  // aggregation isn't supported on griddap-backed datasets. Caches results in
  // this.stations[id].validPoints (keyed by timestamp), and skips the
  // request entirely if that range is already cached.
  async getNumberOfValidPointsPerStation(id, startDate, endDate) {
    const end = endDate ?? new Date();
    const station = this.stations[id];
    if (!station) return { id, points: undefined };

    // Limit the request to what this station actually covers.
    const rangeStart = station.startDate && station.startDate > startDate ? station.startDate : startDate;
    const rangeEnd = station.endDate && station.endDate < end ? station.endDate : end;

    if (!station.validPoints) station.validPoints = {};
    if (rangeStart > rangeEnd) return { id, points: station.validPoints }; // no overlap with this station's coverage

    // Already covered by a previous call - nothing new to fetch.
    const range = station.validPointsRange;
    if (range && rangeStart >= range.start && rangeEnd <= range.end) return { id, points: station.validPoints };

    const dataset = station.dataset.endsWith('_table') ? station.dataset : `${station.dataset}_table`;
    const url = `${this.baseUrl}/tabledap/${dataset}.csv?time,RDVA`
      + `&time>=${rangeStart.toISOString()}&time<=${rangeEnd.toISOString()}`
      + `&RDVA!=NaN&orderByCount("time")`;

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
        station.validPoints[time] = Number(count);
      });
    }

    station.validPointsRange = {
      start: range ? new Date(Math.min(range.start, rangeStart)) : rangeStart,
      end: range ? new Date(Math.max(range.end, rangeEnd)) : rangeEnd,
    };

    return { id, points: station.validPoints };
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

}

export default SourceErddapEUHFRStations;
