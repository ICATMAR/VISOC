// ============================================================================
// data/products/DataProduct.js
//
// A DataProduct wraps ONE dataset and turns a view's request into cached,
// stitched data. It is the layer where everything below converges:
//
//   getSeries(varCode, range)
//     -> plan which Source covers each part of the range   (planCoverage)
//     -> tile each part into blocks                         (source.blocksFor)
//     -> fetch each block (cached + de-duped)               (RequestManager)
//     -> parse each block into Observations                 (source.parse)
//     -> merge + slice to the exact window                  (RangeTiler.stitch)
//     -> return one Datastream                              (model.js shape)
//
// A product is COMPOSED of Sources (dependency injection again): live ERDDAP,
// the archive files, etc. Sources are passed in HIGHEST PRIORITY FIRST — where
// two overlap, the earlier one wins (so the immutable archive is preferred over
// live ERDDAP, and ERDDAP fills the recent tail the archive doesn't cover yet).
//
// getSeries (1-D) is implemented here. getField (2-D) is added later with the
// HFR products, because it needs the FieldTiler.
// ============================================================================

import { stitch } from '../tiling/RangeTiler.js';
import { Provenance } from '../model.js';

/** @typedef {import('./Source.js').Source} Source */

export class DataProduct {
  /**
   * @param {Object} deps
   * @param {string} deps.thingId
   * @param {import('../transport/RequestManager.js').RequestManager} deps.requestManager
   * @param {Source[]} deps.sources                 highest priority first
   * @param {Array<{code:string, kind:'series'|'field', observedProperty:string,
   *                unit:string, sensorId?:string, depth?:number, name?:string}>} [deps.variables]
   * @param {string} [deps.provenance]              Provenance.* (default observation)
   */
  constructor({ thingId, requestManager, sources, variables = [], provenance = Provenance.OBSERVATION }) {
    this._thingId = thingId;
    this._rm = requestManager;
    this._sources = sources;
    this._variables = variables;
    this._provenance = provenance;
  }

  /** All variables this product exposes (each entry describes one Datastream/field). */
  listVariables() {
    return this._variables;
  }

  /** Look up one variable's metadata by its code. */
  variable(code) {
    return this._variables.find((v) => v.code === code) || null;
  }

  /**
   * Fetch one 1-D time-series as a Datastream, assembled from cached blocks.
   * @param {string} varCode
   * @param {import('../model.js').TimeRange} range
   * @param {Object} [params]   extra query hints passed through to the source
   * @returns {Promise<import('../model.js').Datastream>}
   */
  async getSeries(varCode, range, params = {}) {
    const meta = this.variable(varCode);
    if (meta && meta.kind === 'field') {
      throw new Error(`getSeries: '${varCode}' is a field variable — use getField()`);
    }

    // 1) Which sources can provide this variable, and which serves which part
    //    of the range? (Filter by variable first — different sensors of a buoy
    //    may live in different datasets — then split by time coverage.)
    const providers = this._sources.filter((s) => s.provides(varCode));
    if (providers.length === 0) throw new Error(`No source provides '${varCode}' for ${this._thingId}`);
    const segments = planCoverage(range.start, range.end, providers);

    // 2) For every segment, tile into blocks and fetch each block. All fetches
    //    run in parallel; RequestManager de-dups and caches them.
    const tasks = [];
    for (const seg of segments) {
      const blocks = seg.source.blocksFor(seg.start, seg.end);
      for (const block of blocks) {
        const { key, urls } = seg.source.blockRequest(block, [varCode], params);
        const ttlMs = seg.source.ttlFor(block);
        tasks.push(
          this._rm.request(key, { ttlMs, urls })            // urls = mirrors (failover)
            .then((raw) => seg.source.parse(raw, block))
            .then((byVar) => byVar[varCode] || [])
        );
      }
    }

    // 3) Merge all blocks, dedupe seams, slice to the exact requested window.
    const arrays = await Promise.all(tasks);
    const observations = stitch(arrays, range.start, range.end);

    // 4) Wrap in a Datastream (plain, model.js-shaped data).
    return {
      id: `${this._thingId}:${varCode}`,
      thingId: this._thingId,
      observedProperty: meta?.observedProperty ?? varCode,
      unit: meta?.unit ?? '',
      sensorId: meta?.sensorId,
      depth: meta?.depth ?? null,
      provenance: this._provenance,
      observations,
    };
  }

  /** 2-D gridded access — added with the HFR products (needs FieldTiler). */
  async getField(/* varCode, range, bbox, params */) {
    throw new Error('getField not implemented by this product');
  }
}


// ---- coverage planning ----------------------------------------------------
// Split [start, end) among the sources, preferring earlier (higher-priority)
// ones where coverage overlaps. Returns time-ordered segments {source, start, end}.
// This is plain interval subtraction: each source "claims" the parts of the
// still-uncovered range that fall inside its coverage window; whatever is left
// drops through to the next source.

/**
 * @param {Date} start
 * @param {Date} end
 * @param {Source[]} sources   highest priority first
 * @returns {Array<{source: Source, start: Date, end: Date}>}
 */
function planCoverage(start, end, sources) {
  let uncovered = [{ start: toMs(start), end: toMs(end) }];
  const segments = [];

  for (const source of sources) {
    if (uncovered.length === 0) break;
    const cov = source.coverage();
    const covStart = cov.start != null ? toMs(cov.start) : -Infinity;
    const covEnd = cov.end != null ? toMs(cov.end) : Infinity;

    const stillUncovered = [];
    for (const gap of uncovered) {
      const iStart = Math.max(gap.start, covStart);   // intersection of gap ∩ coverage
      const iEnd = Math.min(gap.end, covEnd);
      if (iStart < iEnd) {
        segments.push({ source, start: new Date(iStart), end: new Date(iEnd) });
        if (gap.start < iStart) stillUncovered.push({ start: gap.start, end: iStart }); // left leftover
        if (iEnd < gap.end) stillUncovered.push({ start: iEnd, end: gap.end });         // right leftover
      } else {
        stillUncovered.push(gap);                     // this source covers none of the gap
      }
    }
    uncovered = stillUncovered;
  }

  // Anything still in `uncovered` has no source and is simply omitted (a gap).
  segments.sort((a, b) => a.start - b.start);
  return segments;
}

function toMs(d) {
  return d instanceof Date ? d.getTime() : +d;
}
