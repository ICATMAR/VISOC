// ============================================================================
// data/products/ErddapSource.js
//
// A concrete Source for an ERDDAP tabledap dataset (the ".jsonlKVP" format:
// one JSON object per line). It knows how to:
//   - say which variables it provides and what time window it covers
//   - tile a range into fixed blocks (RangeTiler)
//   - build a LOGICAL key + candidate URLs (mirrors, optional CORS proxy)
//   - parse jsonl rows into Observations, applying per-variable unit scaling
//
// One ErddapSource = one dataset. A buoy split across ADCP / CTD / METEO
// datasets on ICATMAR's ERDDAP is modeled as THREE ErddapSources on the same
// product; `provides()` routes each variable to the right one.
// ============================================================================

import { Source } from './Source.js';
import { blocksForRange, ttlForBlock } from '../tiling/RangeTiler.js';

export class ErddapSource extends Source {
  /**
   * @param {Object} cfg
   * @param {string}   cfg.dataset                 ERDDAP dataset id
   * @param {string[]} cfg.baseUrls                one or more ERDDAP roots (mirrors),
   *                                               e.g. ['https://erddap.icatmar.cat/erddap']
   * @param {string}   [cfg.proxy]                 CORS proxy prefix (…/proxy/?url=)
   * @param {Array<{code:string, column:string, observedProperty:string, unit:string,
   *                kind?:string, sensorId?:string, depth?:number, scale?:number}>} cfg.variables
   * @param {number}   cfg.blockMs                 block size (e.g. 7 days)
   * @param {number}   cfg.openTtlMs               TTL for the block containing "now"
   * @param {number}   cfg.closedTtlMs             TTL for past blocks
   * @param {{start: Date|null, end: Date|null}} [cfg.coverage]  default: all time
   * @param {string}   [cfg.timeColumn='time']
   */
  constructor(cfg) {
    super();
    this._dataset = cfg.dataset;
    this._baseUrls = cfg.baseUrls;
    this._proxy = cfg.proxy || null;
    this._variables = cfg.variables;
    this._blockMs = cfg.blockMs;
    this._openTtlMs = cfg.openTtlMs;
    this._closedTtlMs = cfg.closedTtlMs;
    this._coverage = cfg.coverage || { start: null, end: null };
    this._timeColumn = cfg.timeColumn || 'time';
    this._byCode = new Map(this._variables.map((v) => [v.code, v]));
  }

  provides(varCode) {
    return this._byCode.has(varCode);
  }

  coverage() {
    return this._coverage;
  }

  blocksFor(start, end) {
    return blocksForRange(start, end, this._blockMs);
  }

  ttlFor(block) {
    return ttlForBlock(block, { openTtlMs: this._openTtlMs, closedTtlMs: this._closedTtlMs });
  }

  blockRequest(block, varCodes) {
    const columns = [this._timeColumn, ...varCodes.map((c) => this._byCode.get(c).column)];
    const query =
      `/tabledap/${this._dataset}.jsonlKVP?${columns.join(',')}` +
      `&${this._timeColumn}>=${block.start.toISOString()}` +
      `&${this._timeColumn}<=${block.end.toISOString()}`;

    // Logical key: mirror-independent, so whichever mirror answers fills the cache.
    const key = `erddap:${this._dataset}:${[...varCodes].sort().join('+')}` +
      `:${block.start.toISOString()}:${this._blockMs}`;

    // Candidate URLs: each mirror, optionally wrapped in the CORS proxy.
    const urls = this._baseUrls.map((base) => this._wrap(base + query));

    return { key, urls };
  }

  parse(raw) {
    const text = typeof raw === 'string' ? raw : String(raw ?? '');
    const byVar = {};
    for (const v of this._variables) byVar[v.code] = [];

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let row;
      try { row = JSON.parse(trimmed); } catch { continue; }

      const t = row[this._timeColumn];
      if (t == null) continue;
      const phenomenonTime = new Date(t);

      for (const v of this._variables) {
        if (!(v.column in row)) continue;             // column not in this response
        const raw = row[v.column];
        const scaled = raw == null ? null : Number(raw) * (v.scale ?? 1);
        byVar[v.code].push({
          phenomenonTime,
          result: Number.isFinite(scaled) ? scaled : null,
        });
      }
    }
    return byVar;
  }

  /** Wrap a real URL in the CORS proxy if configured. */
  _wrap(url) {
    return this._proxy ? `${this._proxy}?url=${encodeURIComponent(url)}` : url;
  }
}
