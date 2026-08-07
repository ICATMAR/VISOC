// ============================================================================
// data/products/ProductFactory.js
//
// A FACTORY: its whole job is to CREATE the right DataProduct for a Thing, so
// callers never write `new ErddapSource(...)` themselves. It hides two things:
//   - which Source CLASS to build (by the descriptor's `type`)
//   - and the boilerplate of assembling a DataProduct from those sources.
//
// A per-Thing DESCRIPTOR (config, keyed by thing id) is a LIST of sources, each
// with its OWN `type` — so one buoy can mix a static-file archive with a live
// ERDDAP source, and an HFR station can mix mirrors + datasets. The
// `_sourcesForOne()` switch is the heart of the factory — the single spot that
// turns one source's `type` into a concrete Source class. Add StaticFileSource /
// MsmApiSource / PuertosApiSource here later; nothing else changes.
//
// Products are cached per thing id, so repeated requests reuse one instance.
// ============================================================================

import { DataProduct } from './DataProduct.js';
import { ErddapSource } from './ErddapSource.js';
import { Provenance } from '../model.js';

const DAY = 24 * 60 * 60 * 1000;

export class ProductFactory {
  /**
   * @param {Object} deps
   * @param {import('../transport/RequestManager.js').RequestManager} deps.requestManager
   * @param {Object.<string,Object>|Map} deps.descriptors   thingId -> data-source descriptor
   * @param {number} [deps.blockMs=7*DAY]
   * @param {number} [deps.openTtlMs=60000]
   * @param {number} [deps.closedTtlMs=7*DAY]
   */
  constructor({ requestManager, descriptors, blockMs = 7 * DAY, openTtlMs = 60_000, closedTtlMs = 7 * DAY }) {
    this._rm = requestManager;
    this._descriptors = descriptors;
    this._blockMs = blockMs;
    this._openTtlMs = openTtlMs;
    this._closedTtlMs = closedTtlMs;
    this._products = new Map();   // thingId -> DataProduct (cache)
  }

  /**
   * Build (or return the cached) DataProduct for a Thing.
   * @param {import('../model.js').Thing} thing
   * @returns {DataProduct|null}   null if no descriptor is configured for it
   */
  create(thing) {
    if (this._products.has(thing.id)) return this._products.get(thing.id);

    const descriptor = this._descriptorFor(thing.id);
    if (!descriptor) return null;

    // A descriptor is a LIST of source descriptors, each with its own `type`.
    // They compose: tiered by time (archive + live) via coverage, routed by
    // variable via provides(), and mirror-failed-over via each source's urls.
    // Order = priority (earlier wins where coverage overlaps).
    const sourceDescs = descriptor.sources ?? [];
    const sources = sourceDescs.flatMap((s) => this._sourcesForOne(s));
    const variables = this._variablesFor(sourceDescs);

    const product = new DataProduct({
      thingId: thing.id,
      requestManager: this._rm,
      sources,
      variables,
      provenance: descriptor.provenance ?? Provenance.OBSERVATION,
    });

    this._products.set(thing.id, product);
    return product;
  }

  // ---- the dispatch: ONE source descriptor's `type` -> Source class ----
  _sourcesForOne(s) {
    switch (s.type) {
      case 'erddap':
        // one ErddapSource per dataset (a buoy split across ADCP/CTD/METEO
        // becomes several sources; provides() routes each variable)
        return (s.datasets ?? [s]).map((ds) => new ErddapSource({
          dataset: ds.dataset,
          baseUrls: s.baseUrls,
          proxy: s.proxy,
          variables: ds.variables,
          coverage: ds.coverage ?? s.coverage,
          blockMs: this._blockMs,
          openTtlMs: this._openTtlMs,
          closedTtlMs: this._closedTtlMs,
        }));

      // case 'static-file': return [ new StaticFileSource({ ...s, blockMs: this._blockMs }) ];
      // case 'msm':         return [ new MsmApiSource({ ...s, requestManager: this._rm }) ];
      // case 'puertos':     return [ new PuertosApiSource({ ...s }) ];

      default:
        throw new Error(`ProductFactory: unsupported source type '${s.type}'`);
    }
  }

  /** Gather variables from every source, de-duped by code (archive + live share the same variable). */
  _variablesFor(sourceDescs) {
    const byCode = new Map();
    for (const s of sourceDescs) {
      for (const ds of (s.datasets ?? [s])) {
        for (const v of (ds.variables ?? [])) {
          if (!byCode.has(v.code)) byCode.set(v.code, { kind: 'series', ...v });
        }
      }
    }
    return [...byCode.values()];
  }

  _descriptorFor(thingId) {
    return this._descriptors instanceof Map
      ? this._descriptors.get(thingId) ?? null
      : this._descriptors[thingId] ?? null;
  }
}
