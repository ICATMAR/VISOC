// ============================================================================
// data/status/StatusProvider.js
//
// Tells you how fresh a Thing is: active / delayed / inactive + last update.
//
// There's no cheap status endpoint yet, so DerivedStatusProvider computes it
// from DATA: it asks for the Thing's "liveness" variable over a recent window
// and looks at the timestamp of the last non-null Observation. Because that goes
// through the cached getSeries, if the timeline already loaded that buoy the
// status is free (a cache hit) — no extra request.
//
// It's behind a StatusProvider interface, so later an ApiStatusProvider (hitting
// a cheap endpoint, or reading ERDDAP's time_coverage_end metadata) can replace
// it without touching any view.
// ============================================================================

import { StatusState, ThingKind } from '../model.js';

/** Interface: every status provider answers get(thing) -> Status. */
export class StatusProvider {
  /**
   * @param {import('../model.js').Thing} thing
   * @returns {Promise<import('../model.js').Status>}
   */
  async get(thing) { throw new Error('StatusProvider.get not implemented'); }
}


const HOUR = 60 * 60 * 1000;

// active if last update <= delayedH ago; delayed if <= inactiveH ago; else inactive.
const DEFAULT_THRESHOLDS = {
  [ThingKind.BUOY]:        { delayedH: 2, inactiveH: 24 },
  [ThingKind.HFR_STATION]: { delayedH: 3, inactiveH: 24 },
  [ThingKind.HFR_NETWORK]: { delayedH: 3, inactiveH: 24 },
  [ThingKind.DRIFTER]:     { delayedH: 3, inactiveH: 24 },
  _default:                { delayedH: 3, inactiveH: 24 },
};


export class DerivedStatusProvider extends StatusProvider {
  /**
   * @param {Object} deps
   * @param {(thingId:string, varCode:string, range:import('../model.js').TimeRange)
   *         => Promise<import('../model.js').Datastream>} deps.getSeries
   *   how to load a series (wired to DataManager.getSeries in the graph)
   * @param {Object} [deps.thresholds]
   * @param {(thing:import('../model.js').Thing)=>string|null} [deps.statusVarFor]
   *   which variable indicates liveness (default: first of defaultDatastreams)
   * @param {number} [deps.lookbackMs]   how far back to look for the last obs
   * @param {()=>number} [deps.now]
   */
  constructor({ getSeries, thresholds = DEFAULT_THRESHOLDS, statusVarFor, lookbackMs = 48 * HOUR, now = () => Date.now() }) {
    super();
    this._getSeries = getSeries;
    this._thresholds = thresholds;
    this._statusVarFor = statusVarFor || defaultStatusVar;
    this._lookbackMs = lookbackMs;
    this._now = now;
  }

  async get(thing) {
    const varCode = this._statusVarFor(thing);
    if (!varCode) return this._classify(thing, null);

    const now = this._now();
    const range = { start: new Date(now - this._lookbackMs), end: new Date(now) };

    let lastUpdate = null;
    try {
      const ds = await this._getSeries(thing.id, varCode, range);   // cached
      lastUpdate = lastValidTime(ds);
    } catch {
      // server down / no data -> leave lastUpdate null -> inactive
    }
    return this._classify(thing, lastUpdate);
  }

  _classify(thing, lastUpdate) {
    if (!lastUpdate) {
      return { thingId: thing.id, state: StatusState.INACTIVE, lastUpdate: null, hoursAgo: null };
    }
    const hoursAgo = (this._now() - lastUpdate.getTime()) / HOUR;
    const th = this._thresholds[thing.kind] ?? this._thresholds._default;
    const state = hoursAgo <= th.delayedH ? StatusState.ACTIVE
                : hoursAgo <= th.inactiveH ? StatusState.DELAYED
                : StatusState.INACTIVE;
    return { thingId: thing.id, state, lastUpdate, hoursAgo };
  }
}


/** Default liveness variable: the first entry of the Thing's defaultDatastreams. */
function defaultStatusVar(thing) {
  const dd = thing.defaultDatastreams;
  return dd ? (Object.keys(dd)[0] ?? null) : null;
}

/** Timestamp of the last non-null observation in a datastream, or null. */
function lastValidTime(datastream) {
  const obs = datastream?.observations;
  if (!obs) return null;
  for (let i = obs.length - 1; i >= 0; i--) {
    if (obs[i].result != null) return obs[i].phenomenonTime;
  }
  return null;
}
