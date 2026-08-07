// ============================================================================
// data/products/BuoyErddapProduct.js
//
// A DataProduct for a buoy whose data lives in ERDDAP tabledap dataset(s).
// It's a thin specialization of DataProduct: it just builds the ErddapSource(s)
// from a buoy config and hands them to the base class. All the fetch/cache/tile/
// stitch machinery is inherited unchanged.
//
// Simple buoy  = one dataset            -> pass one `dataset` config.
// ICATMAR buoy = ADCP + CTD + METEO     -> pass several `datasets`, each with
//                its own variables; provides() routes each variable correctly.
// ============================================================================

import { DataProduct } from './DataProduct.js';
import { ErddapSource } from './ErddapSource.js';
import { Provenance } from '../model.js';

const DAY = 24 * 60 * 60 * 1000;

export class BuoyErddapProduct extends DataProduct {
  /**
   * @param {Object} cfg
   * @param {string} cfg.thingId
   * @param {import('../transport/RequestManager.js').RequestManager} cfg.requestManager
   * @param {string[]} cfg.baseUrls                 ERDDAP roots (mirrors)
   * @param {string} [cfg.proxy]
   * @param {Array<Object>} cfg.datasets            one entry per dataset:
   *   { dataset, variables:[{code,column,observedProperty,unit,sensorId?,depth?,scale?}],
   *     coverage? }
   * @param {number} [cfg.blockMs=7*DAY]
   * @param {number} [cfg.openTtlMs=60000]
   * @param {number} [cfg.closedTtlMs=7*DAY]
   */
  constructor({ thingId, requestManager, baseUrls, proxy, datasets, blockMs = 7 * DAY, openTtlMs = 60_000, closedTtlMs = 7 * DAY }) {
    // One ErddapSource per dataset.
    const sources = datasets.map((d) => new ErddapSource({
      dataset: d.dataset,
      baseUrls,
      proxy,
      variables: d.variables,
      coverage: d.coverage,
      blockMs, openTtlMs, closedTtlMs,
    }));

    // Flatten all datasets' variables as the product's variable list, tagging
    // each as a 1-D series (buoys are point time-series).
    const variables = datasets.flatMap((d) =>
      d.variables.map((v) => ({ ...v, kind: 'series' })));

    super({ thingId, requestManager, sources, variables, provenance: Provenance.OBSERVATION });
  }
}
