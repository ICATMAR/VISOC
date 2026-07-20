// ============================================================================
// data/DataManager.js
//
// The in-browser implementation of IDataService — the single object the views
// call. It doesn't fetch or parse anything itself; it ROUTES:
//   - "what exists"      -> Catalog
//   - "give me data"     -> ProductFactory -> DataProduct
//   - "how fresh"        -> StatusProvider
//
// getDefaultDatastream is the one bit of app logic here: it resolves a Thing's
// defaultDatastreams (which sensor/depth the simple views use) before delegating
// to getSeries.
// ============================================================================

import { DataService } from './DataService.js';

export class DataManager extends DataService {
  /**
   * @param {Object} deps
   * @param {import('./catalog/Catalog.js').Catalog} deps.catalog
   * @param {import('./products/ProductFactory.js').ProductFactory} deps.productFactory
   * @param {import('./status/StatusProvider.js').StatusProvider} [deps.statusProvider]
   */
  constructor({ catalog, productFactory, statusProvider = null }) {
    super();
    this._catalog = catalog;
    this._factory = productFactory;
    this._status = statusProvider;
  }

  /** Late wiring — lets the graph create the status provider after DataManager. */
  setStatusProvider(statusProvider) {
    this._status = statusProvider;
  }

  // ---- catalog ----
  listThings(kind, range) {
    return this._catalog.listThings(kind, range);
  }
  getThing(id) {
    return this._catalog.getThing(id);
  }

  // ---- data ----
  async getSeries(thingId, varCode, range, params) {
    const { product } = await this._resolve(thingId);
    return product.getSeries(varCode, range, params);
  }

  async getDefaultDatastream(thingId, paramCode, range, params) {
    const { thing, product } = await this._resolve(thingId);
    // Resolve the standard parameter to the default datastream code for this
    // Thing (which sensor/depth). Fall back to the param code itself.
    const code = thing.defaultDatastreams?.[paramCode] ?? paramCode;
    return product.getSeries(code, range, params);
  }

  async getField(thingId, varCode, range, bbox, params) {
    const { product } = await this._resolve(thingId);
    return product.getField(varCode, range, bbox, params);
  }

  // ---- status ----
  async getStatus(thingId) {
    const thing = await this._catalog.getThing(thingId);
    if (!thing) throw new Error(`DataManager: unknown thing '${thingId}'`);
    if (!this._status) throw new Error('DataManager: no status provider configured');
    return this._status.get(thing);
  }

  // ---- internals ----
  async _resolve(thingId) {
    const thing = await this._catalog.getThing(thingId);
    if (!thing) throw new Error(`DataManager: unknown thing '${thingId}'`);
    const product = this._factory.create(thing);
    if (!product) throw new Error(`DataManager: no product configured for '${thingId}'`);
    return { thing, product };
  }
}
