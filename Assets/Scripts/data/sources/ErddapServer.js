// One ERDDAP server's dataset list (allDatasets), shared by every source that
// reads that server - the HF radar totals, the stations, the buoys, the
// forecasts, each in its own data product. FetchManager already shares the
// request; this shares what the list SAYS: one copy, re-read by whoever needs
// a fresher one, and compared with the last at every read, so a source learns
// of new data in its datasets whichever product happened to read the list.
//
//   const server = ErddapServer.for(fetchManager, 'https://erddap.icatmar.cat/erddap');
//   const rows = await server.datasets();            // Map(datasetID -> row)
//   server.changes.addEventListener('change', e => e.detail); // { updated, added, removed }
//
// Per dataset, a read that succeeds says:
//   updated  its maxTime moved, or its minTime changed (a new forecast run)
//   added    it wasn't on the list before
//   removed  it isn't on the list any more (ERDDAP unloads a dataset it can't
//            load - it may come back)
// A read that fails (the server or the proxy down, a timeout) changes
// nothing: the last list is kept, and only `reachable` goes false.

const PROXY_URL = 'https://api.icatmar.cat/proxy/';
// How long a read of the list is trusted (as FetchManager's TTL for it)
const LIST_TTL_MS = 60 * 1000;
// Servers that answer the browser themselves (cross-origin allowed): read
// directly, by every source, from the first read on
const DIRECT_HOSTS = ['erddap.hfrnode.eu'];

class ErddapServer {

  static servers = new Map(); // baseUrl -> ErddapServer

  // The server at `baseUrl` (no trailing /index.html). `direct`: it answers
  // the browser itself (cross-origin allowed), so its list is read without
  // the proxy - by every source, once one says so.
  static for(fetchManager, baseUrl, { direct = false } = {}) {
    let server = ErddapServer.servers.get(baseUrl);
    if (!server) ErddapServer.servers.set(baseUrl, server = new ErddapServer(fetchManager, baseUrl));
    if (direct) server.direct = true;
    return server;
  }

  constructor(fetchManager, baseUrl) {
    this.fetchManager = fetchManager;
    this.baseUrl = baseUrl;
    this.direct = DIRECT_HOSTS.some(host => baseUrl.includes(`//${host}/`));
    this.rows = undefined;     // Map(datasetID -> row), the last good list
    this.readAt = 0;           // when it was read
    this.reading = undefined;  // the read in flight
    this.reachable = undefined;
    this.changes = new EventTarget();
  }

  listUrl() {
    const url = `${this.baseUrl}/tabledap/allDatasets.jsonlKVP`;
    return this.direct ? url : `${PROXY_URL}?url=${encodeURIComponent(url)}`;
  }

  // The list: the last one while it is fresh (or one being read), else read
  // again. `force`: read again now (a product's refresh) - past FetchManager
  // too, unless another read finished less than a minute ago. Resolves to
  // the last good list when a read fails; rejects only if there has never
  // been one.
  datasets({ force = false } = {}) {
    if (this.reading) return this.reading;
    const fresh = this.rows && Date.now() - this.readAt < LIST_TTL_MS;
    if (fresh && !force) return Promise.resolve(this.rows);
    this.reading = this.read(fresh ? 1 : 0).finally(() => { this.reading = undefined; });
    return this.reading;
  }

  // The last good list's row for a dataset, without reading anything
  row(datasetID) {
    return this.rows?.get(datasetID);
  }

  async read(ttl) {
    let rows;
    try {
      const text = await this.fetchManager.fetch(this.listUrl(), ttl).then(res => res.text());
      rows = new Map(text.trim().split('\n').filter(line => line).map(line => JSON.parse(line)).map(row => [row['datasetID'], row]));
    } catch (error) {
      if (this.reachable !== false) this.changes.dispatchEvent(new CustomEvent('unreachable', { detail: { error } }));
      this.reachable = false;
      if (!this.rows) throw error;
      console.warn(`ERDDAP ${this.baseUrl}: dataset list unavailable, keeping the last one:`, error.message ?? error);
      return this.rows;
    }
    if (this.reachable === false) this.changes.dispatchEvent(new Event('reachable'));
    this.reachable = true;

    const before = this.rows;
    this.rows = rows;
    this.readAt = Date.now();
    if (before) {
      const updated = [], added = [], removed = [];
      rows.forEach((row, id) => {
        const old = before.get(id);
        if (!old) added.push(id);
        else if (old['maxTime'] !== row['maxTime'] || old['minTime'] !== row['minTime']) updated.push(id);
      });
      before.forEach((row, id) => { if (!rows.has(id)) removed.push(id); });
      if (updated.length || added.length || removed.length) {
        this.changes.dispatchEvent(new CustomEvent('change', { detail: { updated, added, removed } }));
      }
    }
    return rows;
  }

  // A source's datasets in a change: which of `ids` (or matching `test`)
  // were updated, added, removed
  static mine(detail, test) {
    return {
      updated: detail.updated.filter(test),
      added: detail.added.filter(test),
      removed: detail.removed.filter(test),
    };
  }
}

export default ErddapServer;
