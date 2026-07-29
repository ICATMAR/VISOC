import Source from './Source.js';

class SourceErddap extends Source {

  constructor({ fetchManager, src, dataset, bbox }) {
    super({ fetchManager });
    this.src = src;
    this.dataset = dataset;
    this.baseUrl = src.replace(/\/index\.html$/, ''); // remove index.html from src
    this.proxyUrl = 'https://api.icatmar.cat/proxy/';
    this.bbox = bbox;

    this.metadata = undefined;  // NC_GLOBAL attributes (dataset-level)
    this.recentWindowDays = 2;  // how far back getEndTimestamp() checks for recent data

    this.loadingPromise = this.load();
  }

  proxied(url) {
    return this.proxyUrl + '?url=' + encodeURIComponent(url);
  }

  // ERDDAP constraint string for this.bbox ({minLat, minLon, maxLat, maxLon}),
  // or '' if no bbox is set. A variable can be constrained without being
  // included in the requested columns, so this works alongside e.g. `?time`.
  bboxConstraint() {
    if (!this.bbox) return '';
    const { minLat, minLon, maxLat, maxLon } = this.bbox;
    return `&latitude>=${minLat}&latitude<=${maxLat}&longitude>=${minLon}&longitude<=${maxLon}`;
  }

  async load() {
    // 1) allDatasets.csv - cheap way to try to get this dataset's minTime/maxTime
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
    const startDateStr = datasetInfo['minTime'];
    const endDateStr = datasetInfo['maxTime'];
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

  // Midnight UTC, `recentWindowDays` days ago. Rounded to the day (instead of
  // Date.now()) so the value - and therefore the query URL below - stays
  // constant all day and only changes once every hour, instead of on every call.
  // That's what lets FetchManager's cache actually be hit repeatedly.
  recentWindowStart() {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - this.recentWindowDays);
    date.setUTCMinutes(0, 0, 0);
    return date.toISOString();
  }

  // Timestamp of the most recent data point since recentWindowStart(), or null
  // if there's none. Only requested if allDatasets.csv didn't already give us
  // max_time. No caching of our own here - FetchManager caches the request
  // itself for X minutes, so calling this again within that window just
  // re-parses the same cached response instead of hitting the network.
  async getEndTimestamp() {
    const since = this.recentWindowStart();
    const url = `${this.baseUrl}/tabledap/${this.dataset}.csv?time&time>=${since}${this.bboxConstraint()}&orderBy("time")`;
    const text = await this.fetchManager.fetch(this.proxied(url), 1).then(res => res.text());
    const lines = text.trim().split('\n').filter(line => line);
    const dataLines = lines.slice(2);
    return dataLines.length ? new Date(dataLines[dataLines.length - 1].split(',')[0]) : null;
  }

}

export default SourceErddap;
