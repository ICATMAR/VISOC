import scheduler from '../../scheduler.js';

class DataProduct {

  // The shortest time between two refreshes (see requestRefresh)
  static MIN_REFRESH_GAP_MS = 30 * 1000;

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
  }

  // Tells the views the product's data changed; `detail` says how (each
  // product its own)
  changed(detail = {}) {
    this.version++;
    this.changes.dispatchEvent(new CustomEvent('change', { detail }));
  }

  // Finds out whether the sources have new data, and calls changed() if so.
  // Nothing by default: each product knows what to re-check.
  async refresh() {}

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
