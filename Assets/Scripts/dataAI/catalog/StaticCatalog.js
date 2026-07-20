// ============================================================================
// data/catalog/StaticCatalog.js
//
// A CatalogProvider whose Things are a fixed, bundled list (buoys, HFR stations,
// HFR network…). No fetching — `list()` just returns the config, `get()` looks
// it up by id. One generic class serves every static kind; you create one
// instance per kind with its config (no need for separate HfrCatalog /
// BuoyCatalog classes).
// ============================================================================

import { CatalogProvider } from './CatalogProvider.js';

export class StaticCatalog extends CatalogProvider {
  /**
   * @param {Object} cfg
   * @param {string} cfg.kind                            ThingKind.*
   * @param {import('../model.js').Thing[]} cfg.things   the bundled Things
   */
  constructor({ kind, things }) {
    super();
    this._kind = kind;
    this._things = things;
    this._byId = new Map(things.map((t) => [t.id, t]));
  }

  kind() {
    return this._kind;
  }

  async list(/* range ignored — static */) {
    return this._things;
  }

  async get(id) {
    return this._byId.get(id) ?? null;
  }
}
