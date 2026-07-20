// ============================================================================
// data/catalog/Catalog.js
//
// The catalog FACADE. Views/DataManager talk to this; it routes to the right
// per-kind CatalogProvider. It doesn't know or care whether a provider is static
// or dynamic — they all satisfy the same CatalogProvider interface.
// ============================================================================

/** @typedef {import('./CatalogProvider.js').CatalogProvider} CatalogProvider */

export class Catalog {
  /**
   * @param {Object} deps
   * @param {CatalogProvider[]} deps.providers   one per ThingKind
   */
  constructor({ providers }) {
    this._providers = providers;
    this._byKind = new Map(providers.map((p) => [p.kind(), p]));
  }

  /**
   * List Things of one kind.
   * @param {string} kind                                ThingKind.*
   * @param {import('../model.js').TimeRange} [range]    used by dynamic kinds
   * @returns {Promise<import('../model.js').Thing[]>}
   */
  async listThings(kind, range) {
    const provider = this._byKind.get(kind);
    if (!provider) throw new Error(`Catalog: no provider for kind '${kind}'`);
    return provider.list(range);
  }

  /**
   * Find a Thing by id across all kinds (first provider that has it wins).
   * @param {string} id
   * @returns {Promise<import('../model.js').Thing|null>}
   */
  async getThing(id) {
    for (const provider of this._providers) {
      const thing = await provider.get(id);
      if (thing) return thing;
    }
    return null;
  }
}
