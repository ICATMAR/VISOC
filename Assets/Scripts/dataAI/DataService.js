// ============================================================================
// data/DataService.js
//
// THE BOUNDARY (interface). This is the only surface the Vue views talk to. Both
// the in-browser DataManager and a future HTTP DataServiceClient implement it —
// so moving the data layer to a shared Node service later is a one-line swap at
// wiring time, with no view changes.
//
// Named plainly (no "I" prefix) to match the other interfaces in this layer
// (CacheStore, Source, CatalogProvider, StatusProvider).
//
// Everything it returns is plain, JSON-serializable model.js data (Thing,
// Datastream, FieldTile, Status), so those same objects can travel over HTTP.
// ============================================================================

export class DataService {
  /**
   * @param {string} kind                                ThingKind.*
   * @param {import('./model.js').TimeRange} [range]     needed by dynamic kinds
   * @returns {Promise<import('./model.js').Thing[]>}
   */
  async listThings(kind, range) { throw new Error('DataService.listThings not implemented'); }

  /**
   * @param {string} id
   * @returns {Promise<import('./model.js').Thing|null>}
   */
  async getThing(id) { throw new Error('DataService.getThing not implemented'); }

  /**
   * One time-series by its datastream code.
   * @param {string} thingId
   * @param {string} varCode
   * @param {import('./model.js').TimeRange} range
   * @param {Object} [params]
   * @returns {Promise<import('./model.js').Datastream>}
   */
  async getSeries(thingId, varCode, range, params) { throw new Error('DataService.getSeries not implemented'); }

  /**
   * The time-series a SIMPLE view should use for a standard parameter — resolves
   * the Thing's defaultDatastreams (which sensor/depth) then getSeries.
   * @param {string} thingId
   * @param {string} paramCode      ObservedProperty code, e.g. 'TEMP'
   * @param {import('./model.js').TimeRange} range
   * @param {Object} [params]
   * @returns {Promise<import('./model.js').Datastream>}
   */
  async getDefaultDatastream(thingId, paramCode, range, params) { throw new Error('DataService.getDefaultDatastream not implemented'); }

  /**
   * Gridded field tiles (HFR fields, model grids).
   * @param {string} thingId
   * @param {string} varCode
   * @param {import('./model.js').TimeRange} range
   * @param {[number,number,number,number]} [bbox]
   * @param {Object} [params]
   * @returns {Promise<import('./model.js').FieldTile[]>}
   */
  async getField(thingId, varCode, range, bbox, params) { throw new Error('DataService.getField not implemented'); }

  /**
   * Freshness/availability of a Thing (the map status dot).
   * @param {string} thingId
   * @returns {Promise<import('./model.js').Status>}
   */
  async getStatus(thingId) { throw new Error('DataService.getStatus not implemented'); }
}
