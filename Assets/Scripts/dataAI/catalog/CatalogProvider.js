// ============================================================================
// data/catalog/CatalogProvider.js
//
// A CatalogProvider answers "which Things of my kind exist?" — the identity +
// config of platforms, NOT their time-series data. One provider per ThingKind.
//
// The same interface hides whether the list is STATIC (bundled config, e.g.
// buoys / HFR) or DYNAMIC (discovered from a server, e.g. drifters). Callers get
// a Promise either way, so they don't care which it is.
//
// (Interface pattern again — a base class declaring the methods; concrete
// providers extend it.)
// ============================================================================

export class CatalogProvider {
  /**
   * Which ThingKind this provider serves.
   * @returns {string}   one of model.js ThingKind.*
   */
  kind() { throw new Error('CatalogProvider.kind not implemented'); }

  /**
   * List the Things. `range` matters only for dynamic providers (e.g. drifters
   * active in a time window); static providers ignore it.
   * @param {import('../model.js').TimeRange} [range]
   * @returns {Promise<import('../model.js').Thing[]>}
   */
  async list(range) { throw new Error('CatalogProvider.list not implemented'); }

  /**
   * Fetch one Thing by id, or null if this provider doesn't have it.
   * @param {string} id
   * @returns {Promise<import('../model.js').Thing|null>}
   */
  async get(id) { throw new Error('CatalogProvider.get not implemented'); }
}
