import Source from './Source.js';
import SourceErddap from './SourceErddap.js';

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

      const station = this.stationFromDataset(dataset);
      this.stations[station] = { dataset, variables, metadata };
    }));
  }

}

export default SourceErddapEUHFRStations;
