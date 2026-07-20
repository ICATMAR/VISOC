// ============================================================================
// data/products/Source.js
//
// A Source is ONE backend that can serve part of a dataset over time — e.g. a
// live ERDDAP endpoint, or the pre-made 6-month archive files. A DataProduct is
// *composed of* one or more Sources; the product asks each source to handle the
// portion of a requested range that it covers.
//
// This is the "interface" pattern again (like CacheStore): a base class that
// declares the methods every source must provide, but implements none of them.
// Concrete sources (ErddapSource, ArchiveFileSource) come in step 6b and fill
// these in.
//
// A source answers, for its own backend:
//   coverage()             which time window it can serve
//   blocksFor(a, b)        how it tiles that window into cache-able blocks
//   blockRequest(block, …) the { key, urls } to fetch one block
//   ttlFor(block)          how long that block may be cached
//   parse(raw, block)      how to turn the raw response into Observations
//
// blockRequest returns a LOGICAL cache key plus an ORDERED list of candidate
// URLs. Multiple URLs = mirror servers tried in order (failover): if the first
// ERDDAP is down, RequestManager falls through to the next. The key identifies
// the data (mirror-independent), so whichever mirror answers fills the cache.
// ============================================================================

export class Source {
  /**
   * Does this source provide the given variable? Lets a product route a request
   * to the right backend when variables come from different datasets — e.g. an
   * ICATMAR buoy whose ADCP / CTD / METEO sensors are separate ERDDAP datasets.
   * @param {string} varCode
   * @returns {boolean}
   */
  provides(varCode) { throw new Error('Source.provides not implemented'); }

  /**
   * The time window this source can serve.
   * @returns {{start: Date|null, end: Date|null}}
   *   start=null means "since forever"; end=null means "up to now / open-ended".
   */
  coverage() { throw new Error('Source.coverage not implemented'); }

  /**
   * Tile [start, end) the way THIS source likes: fixed blocks via RangeTiler
   * for live data, or manifest-defined halves for the archive.
   * @param {Date} start
   * @param {Date} end
   * @returns {import('../tiling/RangeTiler.js').Block[]}
   */
  blocksFor(start, end) { throw new Error('Source.blocksFor not implemented'); }

  /**
   * Describe how to fetch one block: a canonical logical `key` (aligned block +
   * stable param order, mirror-independent) and an ordered list of candidate
   * `urls` (mirrors) to try until one succeeds.
   * @param {import('../tiling/RangeTiler.js').Block} block
   * @param {string[]} varCodes
   * @param {Object} [params]
   * @returns {{ key: string, urls: string[] }}
   */
  blockRequest(block, varCodes, params) { throw new Error('Source.blockRequest not implemented'); }

  /**
   * Cache lifetime (ms) for a block (use RangeTiler.ttlForBlock for the
   * open/closed rule; archived files -> Infinity).
   * @param {import('../tiling/RangeTiler.js').Block} block
   * @returns {number}
   */
  ttlFor(block) { throw new Error('Source.ttlFor not implemented'); }

  /**
   * Parse one block's raw response into Observations, grouped by variable code.
   * @param {*} raw                     whatever httpFetch returned
   * @param {import('../tiling/RangeTiler.js').Block} block
   * @returns {Object.<string, import('../model.js').Observation[]>}
   */
  parse(raw, block) { throw new Error('Source.parse not implemented'); }
}
