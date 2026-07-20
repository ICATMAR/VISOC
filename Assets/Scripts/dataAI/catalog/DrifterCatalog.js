// ============================================================================
// data/catalog/DrifterCatalog.js
//
// A DYNAMIC CatalogProvider: which drifters exist depends on ERDDAP's response.
// list(range) asks ERDDAP for the distinct deployments in a window and turns
// them into Things. Crucially, the discovery query goes THROUGH the shared
// RequestManager — so "the catalogue" is just another cached, TTL'd, failover-
// protected request, reusing everything the transport layer already gives us.
//
// (Mirrors the real HFRadar/Components/Map/OverlayDriftersICATMARERDDAPData.vue,
// which queries socat_data_drifters_ICATMAR with &distinct().)
// ============================================================================

import { CatalogProvider } from './CatalogProvider.js';
import { ThingKind } from '../model.js';

const DAY = 24 * 60 * 60 * 1000;

const DEFAULT_PARAMS = [
  'deployment_id', 'drifter_type', 'buoy_name', 'institution',
  'project', 'pi_name', 'exercise', 'latitude', 'longitude', 'time',
];

export class DrifterCatalog extends CatalogProvider {
  /**
   * @param {Object} cfg
   * @param {import('../transport/RequestManager.js').RequestManager} cfg.requestManager
   * @param {string} cfg.dataset                         ERDDAP dataset id
   * @param {string[]} cfg.baseUrls                      ERDDAP roots (mirrors)
   * @param {string} [cfg.proxy]
   * @param {[number,number,number,number]} [cfg.bbox]   [west, south, east, north]
   * @param {number} [cfg.ttlMs=300000]                  discovery cache lifetime
   * @param {string[]} [cfg.parameters]
   */
  constructor({ requestManager, dataset, baseUrls, proxy, bbox = [-20, 38, 30, 50], ttlMs = 5 * 60 * 1000, parameters = DEFAULT_PARAMS }) {
    super();
    this._rm = requestManager;
    this._dataset = dataset;
    this._baseUrls = baseUrls;
    this._proxy = proxy || null;
    this._bbox = bbox;
    this._ttlMs = ttlMs;
    this._parameters = parameters;
    /** Things discovered by the last list() calls, so get(id) can resolve. */
    this._discovered = new Map();
  }

  kind() {
    return ThingKind.DRIFTER;
  }

  async list(range) {
    // Snap the window to whole UTC days so the discovery key is stable within a
    // day (good cache reuse as "now" ticks forward).
    const start = new Date(Math.floor((range?.start?.getTime() ?? Date.now() - 15 * DAY) / DAY) * DAY);
    const end = new Date(Math.ceil((range?.end?.getTime() ?? Date.now()) / DAY) * DAY);

    const { key, urls } = this._discoveryRequest(start, end);
    const raw = await this._rm.request(key, { ttlMs: this._ttlMs, urls });

    const things = this._parse(raw);
    for (const t of things) this._discovered.set(t.id, t);
    return things;
  }

  async get(id) {
    // Resolve from what previous list() calls discovered. (A targeted ERDDAP
    // query by deployment_id could be added if get() is ever called first.)
    return this._discovered.get(id) ?? null;
  }

  // ---- internals ----

  _discoveryRequest(start, end) {
    const [west, south, east, north] = this._bbox;
    const query =
      `/tabledap/${this._dataset}.jsonlKVP?${this._parameters.join(',')}` +
      `&time>=${start.toISOString()}&time<=${end.toISOString()}` +
      `&longitude>=${west}&longitude<=${east}&latitude>=${south}&latitude<=${north}` +
      `&distinct()`;

    const key = `erddap-catalog:${this._dataset}:${start.toISOString()}:${end.toISOString()}:${this._bbox.join(',')}`;
    const urls = this._baseUrls.map((base) => this._wrap(base + query));
    return { key, urls };
  }

  /** Group the jsonl rows into one Thing per deployment, using the latest position. */
  _parse(raw) {
    const text = typeof raw === 'string' ? raw : String(raw ?? '');
    const byDep = new Map();

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let row;
      try { row = JSON.parse(trimmed); } catch { continue; }

      const dep = row.deployment_id;
      if (dep == null) continue;

      const existing = byDep.get(dep);
      if (!existing) {
        byDep.set(dep, { meta: row, latest: row });
      } else if (row.time && (!existing.latest.time || row.time > existing.latest.time)) {
        existing.latest = row;   // keep the most recent position
      }
    }

    const things = [];
    for (const [dep, { meta, latest }] of byDep) {
      things.push({
        id: String(dep),
        kind: ThingKind.DRIFTER,
        name: `${meta.drifter_type ?? 'Drifter'} ${meta.buoy_name ?? dep}`,
        locations: (latest.longitude != null && latest.latitude != null)
          ? [{ time: latest.time ? new Date(latest.time) : undefined, lon: latest.longitude, lat: latest.latitude }]
          : [],
        properties: {
          drifterType: meta.drifter_type,
          buoyName: meta.buoy_name,
          institution: meta.institution,
          project: meta.project,
          piName: meta.pi_name,
          exercise: meta.exercise,
          deploymentId: dep,
        },
      });
    }
    return things;
  }

  _wrap(url) {
    return this._proxy ? `${this._proxy}?url=${encodeURIComponent(url)}` : url;
  }
}
