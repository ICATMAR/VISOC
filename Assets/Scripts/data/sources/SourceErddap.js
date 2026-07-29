import Source from './Source.js';

class SourceErddap extends Source {

  constructor({ fetchManager, src, dataset }) {
    super({ fetchManager });
    this.src = src;
    this.dataset = dataset;
    this.baseUrl = src.replace(/\/index\.html$/, ''); // remove index.html from src
    this.proxyUrl = 'https://api.icatmar.cat/proxy/';

    this.metadata = undefined;               // NC_GLOBAL attributes (dataset-level)
    this.availabilityTimestamps = undefined; // array of Date - only fetched if allDatasets.csv lacks min/max time
    this._availabilityPromise = undefined;   // ongoing getAvailabilityTimestamps() request, if any

    this.loadingPromise = this.load();
  }

  proxied(url) {
    return this.proxyUrl + '?url=' + encodeURIComponent(url);
  }

  async load() {
    // 1) allDatasets.csv - cheap way to try to get this dataset's min_time/max_time
    const allDatasetsUrl = `${this.baseUrl}/tabledap/allDatasets.csv`;
    const allDatasetsText = await this.fetchManager.fetch(this.proxied(allDatasetsUrl), 1).then(res => res.text());
    const datasetInfo = this.parseAllDatasets(allDatasetsText);
    if (!datasetInfo) {
      throw new Error(`Dataset '${this.dataset}' not found in ERDDAP source '${this.src}'`);
    }

    // 2) variables + metadata, from the dataset's own info page
    const infoUrl = `${this.baseUrl}/info/${this.dataset}/index.jsonlKVP`;
    const infoText = await this.fetchManager.fetch(this.proxied(infoUrl)).then(res => res.text());
    const { variables, metadata } = this.parseERDDAPMetadata(infoText);
    this.variables = variables;
    this.metadata = metadata;

    // 3) startDate/endDate: from allDatasets if present, otherwise fall back to
    //    requesting the full timestamp list and use its min/max.
    const startDateStr = datasetInfo['min_time'];
    const endDateStr = datasetInfo['max_time'];
    if (startDateStr && endDateStr) {
      this.startDate = new Date(startDateStr);
      this.endDate = new Date(endDateStr);
    } else {
      console.log(`Start/end date not found in allDatasets.csv for ${this.dataset}`);
      // In some Erddap datasets this request will take too long (NOAA-AOML dataset OSMC for example)
      // const timestamps = await this.getAvailabilityTimestamps();
      // this.startDate = timestamps[0];
      // this.endDate = timestamps[timestamps.length - 1];
    }
  }

  // Finds this dataset's row in ERDDAP's allDatasets.csv (list of every dataset on the server).
  parseAllDatasets(text) {
    const lines = text.trim().split('\n');
    const names = lines[0].split(',').map(h => h.trim());
    const datasets = lines.slice(2).map(line => {
      const cells = line.split(',');
      const row = {};
      names.forEach((name, i) => row[name] = (cells[i] == '' || cells[i] == 'NaN') ? undefined : cells[i]?.trim());
      return row;
    });
    return datasets.find(d => d['datasetID'] === this.dataset);
  }

  // All timestamps available for this dataset - only requested if allDatasets.csv
  // didn't already give us min_time/max_time. Cached: new / ongoing / resolved.
  getAvailabilityTimestamps() {
    if (this.availabilityTimestamps != undefined)
      return Promise.resolve(this.availabilityTimestamps);

    if (this._availabilityPromise == undefined) {
      const url = `${this.baseUrl}/tabledap/${this.dataset}.csv?time&orderBy("time")`;
      this._availabilityPromise = this.fetchManager.fetch(this.proxied(url)).then(res => res.text()).then(text => {
        const lines = text.trim().split('\n');
        const timestamps = lines.slice(2).map(line => new Date(line.split(',')[0]));
        this.availabilityTimestamps = timestamps;
        this._availabilityPromise = undefined;
        return timestamps;
      });
    }
    return this._availabilityPromise;
  }

}

export default SourceErddap;
