import Source from './Source.js';
import SourceErddap from './SourceErddap.js';

// Kept from each station's NC_GLOBAL attributes.
const STATION_METADATA_KEYS = ['doa_estimation_method', 'institution', 'network', 'title', 'sensor_model', 'summary', 'wmo_platform_code', 'time_coverage_start'];
// Kept from the network's (the 'Total' dataset's) NC_GLOBAL attributes - shared
// across every station, so kept once instead of repeated on each of them.
const NETWORK_METADATA_KEYS = ['acknowledgement', 'institution', 'site_code','citation', 'comment', 'distribution_statement', 'license', 'summary'];

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
  // list load() uses from the catalogue) - the plain, non-table variant is
  // what actually carries site_lat/site_lon as NC_GLOBAL attributes.
  // Populates this.stations with them (same shape as load()), so other code
  // can read that metadata straight off this source afterward. Returns
  // { network, stations } - the same shape Data/staticData.js is stored in,
  // so callers don't need to care whether positions came from the static
  // file or a live request.
  async getICATMARStationPositions() {
    const allDatasets = await SourceErddap.fetchAllDatasets(this.fetchManager, this.baseUrl);
    const icatmarDatasets = allDatasets.filter(d => d['datasetID'].includes('ICATMAR'));

    // The network's own dataset - its NC_GLOBAL attributes are shared by
    // every station, so they're kept once here instead of per-station.
    const totalDataset = icatmarDatasets.find(d => d['datasetID'].includes('Total'));
    const network = totalDataset ? await this.fetchMetadata(totalDataset['datasetID'], NETWORK_METADATA_KEYS) : undefined;

    const stationDatasets = icatmarDatasets.filter(d => {
      const id = d['datasetID'];
      return !id.endsWith('_table') && !id.includes('Total');
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

  async fetchMetadata(dataset, keys) {
    const infoUrl = `${this.baseUrl}/info/${dataset}/index.jsonlKVP`;
    const infoText = await this.fetchManager.fetch(SourceErddap.proxied(infoUrl)).then(res => res.text());
    const { metadata } = this.parseERDDAPMetadata(infoText);
    return pick(metadata, keys);
  }

}

export default SourceErddapEUHFRStations;
