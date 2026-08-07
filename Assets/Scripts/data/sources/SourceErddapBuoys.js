import Source from './Source.js';
import SourceErddap from './SourceErddap.js';

class SourceErddapBuoys extends Source {

  constructor({ fetchManager, src, datasetCommonKey }) {
    super({ fetchManager });
    this.src = src;
    this.baseUrl = src.replace(/\/index\.html$/, '');
    this.datasetCommonKey = datasetCommonKey;

    // Per-buoy results, keyed by buoy name, then by dataset (one per sensor).
    this.buoys = {};

    this.loadingPromise = this.load();
  }

  async load() {
    // allDatasets.jsonlKVP lists every dataset on the server. Every buoy
    // dataset ID follows datasetCommonKey_<name>_<sensor> (e.g.
    // BUOY_MEDES_ADCP, BUOY_SOMO_CTD, ...)
    const allDatasets = await SourceErddap.fetchAllDatasets(this.fetchManager, this.baseUrl);

    await Promise.all(allDatasets.map(async d => {
      const dataset = d['datasetID'];
      const isBuoyDataset = dataset.startsWith(this.datasetCommonKey);
      if (!isBuoyDataset) return;

      const name = dataset.slice(this.datasetCommonKey.length).replace(/_[^_]+$/, ''); // Remove datasetCommonKey prefix and remove last _<sensor> suffix to get buoy name.
      const infoUrl = `${this.baseUrl}/info/${dataset}/index.jsonlKVP`;
      const infoText = await this.fetchManager.fetch(SourceErddap.proxied(infoUrl)).then(res => res.text());
      const { variables, metadata } = this.parseERDDAPMetadata(infoText);

      if (!this.buoys[name]) this.buoys[name] = {};
      this.buoys[name][dataset] = {
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

  // Earliest start and latest end across every buoy/sensor - each may have
  // started/stopped reporting at a different time.
  dateRange() {
    const entries = Object.values(this.buoys).flatMap(sensors => Object.values(sensors));
    const startDates = entries.map(s => s.startDate).filter(Boolean);
    const endDates = entries.map(s => s.endDate).filter(Boolean);
    return {
      startDate: startDates.length ? new Date(Math.min(...startDates)) : undefined,
      endDate: endDates.length ? new Date(Math.max(...endDates)) : undefined,
    };
  }

}

export default SourceErddapBuoys;
