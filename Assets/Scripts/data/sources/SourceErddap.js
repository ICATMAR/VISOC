import Source from './Source.js';
import ErddapServer from './ErddapServer.js';

const PROXY_URL = 'https://api.icatmar.cat/proxy/';

class SourceErddap extends Source {

  constructor({ fetchManager, src, dataset, bbox }) {
    super({ fetchManager });
    this.src = src;
    this.dataset = dataset;
    this.baseUrl = src.replace(/\/index\.html$/, ''); // remove index.html from src
    this.bbox = bbox;

    this.metadata = undefined;  // NC_GLOBAL attributes (dataset-level)
    this.recentWindowDays = 2;  // how far back getEndTimestamp() checks for recent data

    this.watchServer();
    this.loadingPromise = this.load();
    // Said once here rather than left unhandled: a dataset the server doesn't
    // list (ERDDAP unloads one it can't load, or it isn't published yet) is a
    // notice - it may be back later - and anything else an error. Whoever
    // awaits loadingPromise still gets the rejection.
    this.loadingPromise.catch(error => {
      if (error.name === 'DatasetMissing') console.info(`ERDDAP: ${error.message} - not on the server for now`);
      else console.error(`ERDDAP: could not load '${this.dataset}' from ${this.src}:`, error);
    });
  }

  static proxied(url) {
    return PROXY_URL + '?url=' + encodeURIComponent(url);
  }

  proxied(url) {
    return SourceErddap.proxied(url);
  }

  // ERDDAP's allDatasets (every dataset on the server, one object per dataset
  // keyed by column name: datasetID, minTime, maxTime, minLatitude, ...) -
  // the server's ONE shared copy (see ErddapServer): every source on the
  // server reads the same list, and learns from any read of it
  static async fetchAllDatasets(fetchManager, baseUrl) {
    return [...(await ErddapServer.for(fetchManager, baseUrl).datasets()).values()];
  }

  // This source's dataset on its server's shared list: its dates follow the
  // list, it is missing while the list doesn't have it (ERDDAP unloads a
  // dataset it can't load) and loaded again when it is back. New data is
  // said (see Source.updates); a dataset gone is not - nothing new to show.
  watchServer() {
    if (!this.dataset) return;
    ErddapServer.for(this.fetchManager, this.baseUrl).changes.addEventListener('change', ({ detail }) => {
      if (detail.removed.includes(this.dataset)) this.datasetRemoved();
      else if (detail.added.includes(this.dataset)) this.datasetAdded();
      else if (detail.updated.includes(this.dataset)) this.datasetUpdated(ErddapServer.for(this.fetchManager, this.baseUrl).row(this.dataset));
    });
  }
  datasetRemoved() {
    if (!this.isMissing) console.info(`ERDDAP: '${this.dataset}' no longer on ${this.src} - not asked for until it is back`);
    this.isMissing = true;
  }
  datasetAdded() {
    this.isMissing = false;
    this.loadingPromise = this.load();
    this.loadingPromise.then(() => this.notifyUpdated(), error => console.error(`ERDDAP: could not load '${this.dataset}' again:`, error));
  }
  datasetUpdated(row) {
    if (row?.['minTime']) this.startDate = new Date(row['minTime']);
    if (row?.['maxTime']) this.endDate = new Date(row['maxTime']);
    this.notifyUpdated();
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
    // 1) allDatasets.jsonlKVP - cheap way to try to get this dataset's minTime/maxTime
    const allDatasets = await SourceErddap.fetchAllDatasets(this.fetchManager, this.baseUrl);
    const datasetInfo = allDatasets.find(d => d['datasetID'] === this.dataset);
    this.isMissing = !datasetInfo;
    if (!datasetInfo) {
      const missing = new Error(`Dataset '${this.dataset}' not found in ERDDAP source '${this.src}'`);
      missing.name = 'DatasetMissing';
      throw missing;
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
      console.log(`Start/end date not found in allDatasets.jsonlKVP for ${this.dataset}. Checking if there is recent data.`);
      this.endDate = await this.getEndTimestamp();
      if (this.endDate != undefined) console.log('Latest entry for ' + this.dataset +' is on ' + this.endDate);
      else console.log('No recent data  in the last ' + this.recentWindowDays + ' days found for ' + this.dataset);
    }
  }

  // How far the dataset reaches now (see DataProduct's default refresh):
  // from the server's shared list, or - where the list doesn't say (NOAA's
  // OSMC) - the recent-data query again. Whether the end moved.
  async refresh() {
    await this.loadingPromise?.catch(() => {});
    if (this.isMissing || !this.dataset) return false;
    const row = (await ErddapServer.for(this.fetchManager, this.baseUrl).datasets()).get(this.dataset);
    if (!row) return false;
    const before = this.endDate?.getTime();
    if (row['minTime'] && row['maxTime']) {
      this.startDate = new Date(row['minTime']);
      this.endDate = new Date(row['maxTime']);
    } else {
      const end = await this.getEndTimestamp();
      if (end) this.endDate = end;
    }
    return this.endDate?.getTime() !== before;
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
  // if there's none. Only requested if allDatasets.jsonlKVP didn't already give us
  // max_time. No caching of our own here - FetchManager caches the request
  // itself for X minutes, so calling this again within that window just
  // re-parses the same cached response instead of hitting the network.
  async getEndTimestamp() {
    const since = this.recentWindowStart();
    const url = `${this.baseUrl}/tabledap/${this.dataset}.csv?time&time>=${since}${this.bboxConstraint()}&orderBy("time")`;

    const text = await this.fetchManager.fetch(this.proxied(url), 1, 5)
      .then(res => res.text())
      .catch(err => {
        if (err.name === 'TimeoutError') {
          console.log(`Timed out checking recent data for ${this.dataset}: ${err.message}`);
          return null;
        }
        // ERDDAP returns 404 (not 200 + empty body) when a query matches zero
        // rows - that just means no recent data, not a real failure.
        if (err.name === 'HTTPError' && err.status === 404) {
          console.log(`No recent data found for ${this.dataset}: ${err.message}`);
          return null;
        }
        throw err;
      });
    if (text == null) return null;

    const lines = text.trim().split('\n').filter(line => line);
    const dataLines = lines.slice(2);
    return dataLines.length ? new Date(dataLines[dataLines.length - 1].split(',')[0]) : null;
  }

}

export default SourceErddap;
