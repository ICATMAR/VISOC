// ============================================================================
// data/tiling/RangeTiler.js
//
// Pure time math (no fetching, no state) for the 1-D block strategy.
//
// The idea: never request the exact [start, end] a view asks for. Instead cover
// it with fixed, CANONICAL blocks aligned to multiples of `blockMs` from the
// epoch (UTC). Because the alignment is deterministic, two different requests
// that touch the same period land on the SAME block -> the same URL -> a cache
// hit.
//
//   Example (7-day blocks):
//     ask for  Jul 1–7   -> block [Jun 29 .. Jul 6), [Jul 6 .. Jul 13)
//     ask for  Jun 30    -> block [Jun 29 .. Jul 6)   <- already cached!
//
// We fetch WHOLE blocks, then `slice` the result back to the exact window the
// view wanted, and `merge` adjacent blocks (deduping the shared seam point).
//
// Note: this handles FIXED-duration blocks (hours/days/weeks). Variable-length
// blocks (calendar months, the 6-month archive halves) are defined by a Source's
// own boundary list (its manifest) — but the slice/merge helpers below work the
// same regardless of how the blocks were produced.
// ============================================================================

/**
 * @typedef {Object} Block
 * @property {Date} start   inclusive
 * @property {Date} end     exclusive  (half-open [start, end))
 */


/**
 * Cover [start, end) with canonical, aligned, fixed-duration blocks.
 * The first block may begin before `start` and the last may end after `end`
 * (we fetch whole blocks and slice afterwards).
 *
 * @param {Date|number} start
 * @param {Date|number} end
 * @param {number} blockMs   block size in milliseconds (> 0)
 * @returns {Block[]}
 */
export function blocksForRange(start, end, blockMs) {
  if (!(blockMs > 0)) throw new Error('blocksForRange: blockMs must be > 0');
  const startMs = toMs(start);
  const endMs = toMs(end);
  if (endMs <= startMs) return [];

  const blocks = [];
  const first = alignDown(startMs, blockMs);         // snap start down to a boundary
  for (let t = first; t < endMs; t += blockMs) {
    blocks.push({ start: new Date(t), end: new Date(t + blockMs) });
  }
  return blocks;
}

/**
 * TTL policy helper implementing the "open vs closed block" rule:
 *   - a block that CONTAINS `now` is still growing        -> short TTL
 *   - a block entirely in the past is immutable           -> long TTL
 * A DataProduct calls this from its `ttlFor(block)`.
 *
 * @param {Block} block
 * @param {Object} opts
 * @param {number} opts.openTtlMs     e.g. 60_000  (latest block refresh interval)
 * @param {number} opts.closedTtlMs   e.g. 24*3600_000 (or Infinity for archived)
 * @param {Date|number} [opts.now]
 * @returns {number}
 */
export function ttlForBlock(block, { openTtlMs, closedTtlMs, now = Date.now() }) {
  const t = toMs(now);
  const isOpen = toMs(block.start) <= t && t < toMs(block.end);
  return isOpen ? openTtlMs : closedTtlMs;
}


// ---- Reassembly ----------------------------------------------------------

/**
 * Keep only Observations whose phenomenonTime falls in [start, end).
 * @param {import('../model.js').Observation[]} observations
 * @param {Date|number} start
 * @param {Date|number} end
 * @returns {import('../model.js').Observation[]}
 */
export function sliceObservations(observations, start, end) {
  const s = toMs(start);
  const e = toMs(end);
  return observations.filter((o) => {
    const t = o.phenomenonTime.getTime();
    return t >= s && t < e;
  });
}

/**
 * Merge Observation arrays from several blocks into one time-ordered series,
 * dropping duplicates at block seams (same timestamp kept once).
 * @param {import('../model.js').Observation[][]} arrays
 * @returns {import('../model.js').Observation[]}
 */
export function mergeObservations(arrays) {
  const all = [].concat(...arrays);
  all.sort((a, b) => a.phenomenonTime - b.phenomenonTime);

  const out = [];
  let lastT = null;
  for (const o of all) {
    const t = o.phenomenonTime.getTime();
    if (t === lastT) continue;    // seam duplicate -> skip
    out.push(o);
    lastT = t;
  }
  return out;
}

/**
 * Convenience: merge block results, then slice to the exact requested window.
 * This is what a DataProduct calls after fetching all its blocks.
 * @param {import('../model.js').Observation[][]} arrays
 * @param {Date|number} start
 * @param {Date|number} end
 * @returns {import('../model.js').Observation[]}
 */
export function stitch(arrays, start, end) {
  return sliceObservations(mergeObservations(arrays), start, end);
}


// ---- internals -----------------------------------------------------------

/** Snap a timestamp down to the nearest lower multiple of blockMs (canonical). */
function alignDown(ms, blockMs) {
  return Math.floor(ms / blockMs) * blockMs;
}

/** Accept either a Date or epoch-ms and return epoch-ms. */
function toMs(d) {
  return d instanceof Date ? d.getTime() : +d;
}
