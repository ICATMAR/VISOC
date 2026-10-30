import scheduler from '../../scheduler.js';

class DataProduct {

  // The shortest time between two refreshes (see requestRefresh)
  static MIN_REFRESH_GAP_MS = 30 * 1000;
  // How often a source whose load failed (its server down) is loaded again
  static RETRY_LOAD_MS = 5 * 60 * 1000;

  constructor(catalogueDP, fetchManager) {
    this.fetchManager = fetchManager; // kept for subclasses' own supplementary fetches, beyond their configured sources
    this.name = catalogueDP.name;
    this.description = catalogueDP.description;
    this.type = catalogueDP.type;

    this.sources = catalogueDP.sources.map(src => {
      const source = new src.Class({ fetchManager, ...src });
      source.institution = src.institution;
      // How the app names the source to the user (a source may set its own)
      source.label ??= src.label;
      // What it is for, where several share a server (service status panel)
      source.role = src.role;
      // Standardizing raw names/units into standard codes is the product's
      // job, not the source's (see Source.js), so the catalogue's mapping is
      // carried here rather than inside the source.
      source.mapping = src.mapping;
      source.sensorMapping = src.sensorMapping;
      return source;
    });

    console.log(`${this.constructor.name}: sources loaded`, this.sources);

    // What the product has can change while the page is open (new hours
    // published): refresh() finds out, and changed() tells whoever listens -
    // the views, through dataProductMixin - with a 'change' event
    this.changes = new EventTarget();
    this.version = 0;

    // A source found new data in its server's index (an ERDDAP's dataset
    // list, the GitHub manifest), read by this product or any other: refresh
    // now rather than at the next turn - past the gap between refreshes, as a
    // new index is rare and always worth it. refresh() decides what to tell
    // the views, as on any turn.
    this.sources.forEach(source => source.updates?.addEventListener('updated', () => {
      this.refreshedAt = undefined;
      this.requestRefresh();
    }));

    // A source whose load failed (its server down when the page opened) is
    // loaded again every RETRY_LOAD_MS, on the app's clock, until it works -
    // then it says it has new data (Source.updates), and the refresh above
    // tells the views. Nothing is shown about it meanwhile.
    this.sources.forEach(source => this.followLoad(source));
    scheduler.every(`${this.constructor.name}:${this.name}:retryLoads`, DataProduct.RETRY_LOAD_MS, () => this.retryFailedLoads());
  }

  // Notes when a source's (current) load fails, for retryFailedLoads
  followLoad(source) {
    const promise = source.loadingPromise;
    if (typeof promise?.then !== 'function') return;
    promise.then(
      () => { if (source.loadingPromise === promise) source.loadFailedAt = undefined; },
      () => { if (source.loadingPromise === promise) source.loadFailedAt = Date.now(); });
  }

  retryFailedLoads() {
    this.sources.forEach(source => {
      if (!source.loadFailedAt || Date.now() - source.loadFailedAt < DataProduct.RETRY_LOAD_MS - 1000) return;
      if (typeof source.load !== 'function') return;
      source.loadFailedAt = undefined;
      const promise = source.load();
      source.loadingPromise = promise;
      this.followLoad(source);
      this.sourceReloading(source, promise);
      promise.then(() => {
        console.info(`${this.constructor.name}: ${source.label ?? source.src} is back`);
        source.notifyUpdated?.();
      }, error => console.warn(`${this.constructor.name}: ${source.label ?? source.src} still unavailable:`, error?.message ?? error));
    });
  }

  // A source is being loaded again (see retryFailedLoads) - for products
  // that keep track of their sources' loads (DPBuoys)
  sourceReloading(source, promise) {}

  // Tells the views the product's data changed; `detail` says how (each
  // product its own)
  changed(detail = {}) {
    this.version++;
    this.changes.dispatchEvent(new CustomEvent('change', { detail }));
  }

  // Finds out whether the sources have new data, and calls changed() if so.
  // Each product with its own way overrides it; by default (the drifters)
  // every source re-checks how far it reaches (its refresh()), and those
  // whose end moved since the views were last told are the change:
  // { sources: [labels] }
  async refresh() {
    const sources = this.sources.filter(source => typeof source.refresh === 'function');
    if (sources.length === 0) return;
    await (this.announcedSourceEnds ??= this.sourceEnds());
    await Promise.all(sources.map(source => source.refresh().catch(error => {
      console.error(`${this.constructor.name}: refresh of ${source.label ?? source.src} failed`, error);
    })));
    const before = await this.announcedSourceEnds;
    const now = await this.sourceEnds();
    this.announcedSourceEnds = Promise.resolve(now);
    const moved = this.sources.filter(source => now.get(source) !== before.get(source)).map(source => source.label ?? source.src);
    if (moved.length) this.changed({ sources: moved });
  }

  // Each source's end (ms), once its load has settled - what the views were told
  async sourceEnds() {
    await Promise.allSettled(this.sources.map(source => source.loadingPromise));
    return new Map(this.sources.map(source => [source, source.endDate?.getTime()]));
  }

  // refresh() now - one at a time, and no sooner than MIN_REFRESH_GAP_MS
  // after the last (a read that found something new asks for it too, and
  // several may)
  requestRefresh() {
    if (this.refreshing) return this.refreshing;
    if (this.refreshedAt && Date.now() - this.refreshedAt < DataProduct.MIN_REFRESH_GAP_MS) return Promise.resolve();
    this.refreshedAt = Date.now();
    this.refreshing = Promise.resolve(this.refresh())
      .catch(error => console.error(`${this.constructor.name}: refresh failed`, error))
      .finally(() => { this.refreshing = null; });
    return this.refreshing;
  }

  // requestRefresh() every `minutes`, on the app's one clock (scheduler.js):
  // not while the tab is hidden, and at once on coming back if one ran out
  // meanwhile - a hidden tab's timers can't be trusted to fire
  startRefresh(minutes) {
    this.refreshedAt ??= Date.now();
    this.announcedSourceEnds ??= this.sourceEnds(); // for the default refresh()
    scheduler.every(`${this.constructor.name}:${this.name}:refresh`, minutes * 60000, () => this.requestRefresh());
  }

  // Where a value came from, as the user is told: { label, url }, from what
  // the value records about its source (the source's `src`)
  originOf(src) {
    if (!src) return undefined;
    const source = this.sources.find(s => s.src === src);
    return { label: source?.label ?? src, url: source?.src ?? src };
  }

  // What the catalogue says about one of a source's raw variables:
  // { code, unitTransform }, both optional. `sensorMapping` is for sources
  // whose sensors disagree with each other (two instruments reporting a
  // 'temperature' in different units) and wins over the source-wide `mapping`.
  variableMapping(source, name, sensorId) {
    return source.sensorMapping?.[sensorId]?.[name] ?? source.mapping?.[name];
  }

  // The standard code a raw variable is known by. A variable the catalogue
  // doesn't map keeps its own name - it isn't dropped, it just stays raw.
  standardCode(source, name, sensorId) {
    return this.variableMapping(source, name, sensorId)?.code ?? name;
  }

  // A raw value in the unit its standard code is defined in
  standardValue(source, name, value, sensorId) {
    const unitTransform = this.variableMapping(source, name, sensorId)?.unitTransform;
    return unitTransform ? unitTransform(value) : value;
  }

  // A whole record - { rawName: value } -> { standardCode: value }
  standardize(source, values, sensorId) {
    const record = {};
    Object.entries(values).forEach(([name, value]) => {
      record[this.standardCode(source, name, sensorId)] = this.standardValue(source, name, value, sensorId);
    });
    return record;
  }

}

export default DataProduct;
