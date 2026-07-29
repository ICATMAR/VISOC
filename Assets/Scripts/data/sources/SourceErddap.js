import Source from './Source.js';

class SourceErddap extends Source {

  constructor({ fetchManager, src, dataset }) {
    super({ fetchManager });
    this.src = src;
    this.dataset = dataset;
    this.baseUrl = src.replace(/\/index\.html$/, ''); // remove index.html from src
    this.proxyUrl = 'https://api.icatmar.cat/proxy/';

    this.metadata = undefined;             // NC_GLOBAL attributes (dataset-level)
    this.recentWindowHours = 48;           // how far back getEndTimestamp() checks for recent data
    this.endTimestamp = undefined;         // Date | null (checked, no recent data) - only fetched if allDatasets.csv lacks max_time
    this._endTimestampPromise = undefined; // ongoing getEndTimestamp() request, if any

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

    // 3) startDate/endDate: from allDatasets if present. Otherwise, a full
    //    historical scan is too slow/expensive for some ERDDAP datasets (e.g.
    //    NOAA-AOML's OSMC), so we only check for RECENT data instead - startDate
    //    stays unknown in that case.
    const startDateStr = datasetInfo['min_time'];
    const endDateStr = datasetInfo['max_time'];
    if (startDateStr && endDateStr) {
      this.startDate = new Date(startDateStr);
      this.endDate = new Date(endDateStr);
    } else {
      console.log(`Start/end date not found in allDatasets.csv for ${this.dataset}. Checking if there is recent data.`);
      this.endDate = await this.getEndTimestamp();
      if (this.endDate != undefined) console.log('Latest entry for ' + this.dataset +' is on ' + this.endDate);
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

  // Timestamp of the most recent data point in the last `recentWindowHours`
  // hours, or null if there's none. Only requested if allDatasets.csv didn't
  // already give us max_time. Cached: new / ongoing / resolved (endTimestamp
  // stays undefined until checked, then becomes a Date or null).
  getEndTimestamp() {
    if (this.endTimestamp !== undefined)
      return Promise.resolve(this.endTimestamp);

    if (this._endTimestampPromise == undefined) {
      const since = new Date(Date.now() - this.recentWindowHours * 3600 * 1000).toISOString();
      const url = `${this.baseUrl}/tabledap/${this.dataset}.csv?time&time>=${since}&orderBy("time")`;
      this._endTimestampPromise = this.fetchManager.fetch(this.proxied(url)).then(res => res.text()).then(text => {
        const lines = text.trim().split('\n').filter(line => line);
        const dataLines = lines.slice(2);
        this.endTimestamp = dataLines.length ? new Date(dataLines[dataLines.length - 1].split(',')[0]) : null;
        this._endTimestampPromise = undefined;
        return this.endTimestamp;
      });
    }
    return this._endTimestampPromise;
  }

}

export default SourceErddap;
