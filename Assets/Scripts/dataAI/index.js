// ============================================================================
// data/index.js
//
// CONSTRUCTS THE GRAPH — the one place that news-up every piece of the data
// layer and injects each into the next, then returns a single DataService the
// app hands to the views as `$data`.
//
// "Constructs the graph" = wiring / composition root. Every other file only
// declares WHAT it needs (via its constructor); here we decide WHICH concrete
// things get plugged into whom. Because all those dependencies are injected, the
// choices are made HERE and nowhere else — swap mock<->real fetch, or Memory<->
// Redis cache, or in-browser<->HTTP DataService, all from this single function.
//
// Order matters only for who-holds-whom, not who's-created-first: e.g. the
// StatusProvider needs DataManager.getSeries, so we build DataManager first and
// hand the status provider a closure over it.
// ============================================================================

import { MemoryCacheStore } from './transport/CacheStore.js';
import { RequestManager } from './transport/RequestManager.js';
import { EndpointHealth } from './transport/EndpointHealth.js';
import { createHttpFetch, createMockFetch } from './transport/httpFetch.js';

import { Catalog } from './catalog/Catalog.js';
import { StaticCatalog } from './catalog/StaticCatalog.js';
import { DrifterCatalog } from './catalog/DrifterCatalog.js';
import { buoyThings } from './catalog/things/buoys.js';

import { ProductFactory } from './products/ProductFactory.js';
import { buoyDataSources } from './products/config/buoyDataSources.js';

import { DerivedStatusProvider } from './status/StatusProvider.js';
import { DataManager } from './DataManager.js';
import { ThingKind } from './model.js';

/**
 * Build the whole data layer and return the DataService the app uses.
 *
 * @param {Object} [config]
 * @param {boolean} [config.mock=false]         use the mock transport (offline dev)
 * @param {Array} [config.mockRoutes=[]]        routes for the mock fetch (see dev/mockErddap.js)
 * @param {string} [config.proxy]               CORS proxy prefix for real endpoints
 * @param {number} [config.timeoutMs=15000]     per-request attempt timeout
 * @param {number} [config.cacheMaxEntries=500]
 * @param {number} [config.breakerCooldownMs=300000]
 * @returns {import('./DataService.js').DataService}
 */
export function createDataService({
  mock = false,
  mockRoutes = [],
  proxy = null,
  timeoutMs = 15_000,
  cacheMaxEntries = 500,
  breakerCooldownMs = 5 * 60 * 1000,
} = {}) {

  // --- transport (cache + breaker + fetch + request manager) ---
  const cache = new MemoryCacheStore({ maxEntries: cacheMaxEntries });
  const health = new EndpointHealth({ cooldownMs: breakerCooldownMs });
  const fetch = mock
    ? createMockFetch({ latencyMs: 120, routes: mockRoutes })
    : createHttpFetch();
  const requestManager = new RequestManager({ cache, fetch, timeoutMs, health });

  // --- catalog (what exists): static buoys + dynamic drifters ---
  const catalog = new Catalog({
    providers: [
      new StaticCatalog({ kind: ThingKind.BUOY, things: buoyThings }),
      new DrifterCatalog({
        requestManager,
        dataset: 'socat_data_drifters_ICATMAR',
        baseUrls: ['https://erddap.icatmar.cat/erddap'],
        proxy,
      }),
      // TODO: StaticCatalog for HFR stations + the HFR network Thing.
    ],
  });

  // --- products (how to fetch): the factory maps descriptors -> Sources ---
  const productFactory = new ProductFactory({
    requestManager,
    descriptors: buoyDataSources,   // add HFR / drifter descriptors here later
  });

  // --- the DataService the views call ---
  const dataManager = new DataManager({ catalog, productFactory });

  // --- status (derived from data): needs getSeries, so wire it after ---
  const statusProvider = new DerivedStatusProvider({
    getSeries: (thingId, varCode, range) => dataManager.getSeries(thingId, varCode, range),
  });
  dataManager.setStatusProvider(statusProvider);

  // expose the shared breaker (for a future "server down" UI indicator)
  dataManager.health = health;

  return dataManager;
}
