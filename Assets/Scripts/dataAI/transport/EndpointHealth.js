// ============================================================================
// data/transport/EndpointHealth.js
//
// A shared "circuit breaker" for endpoints (servers). If a server keeps failing,
// we OPEN its breaker and stop using it for a cooldown period, so we don't keep
// hammering something that's down. After the cooldown, the next request is let
// through as a PROBE: success closes the breaker; another failure re-opens it.
//
// Why shared: ONE instance is injected into the ONE RequestManager that all
// products use. So if several data products hit the same ERDDAP, and it goes
// down, the FIRST failure trips the breaker and every other product then skips
// that server until it recovers — exactly the behaviour you asked for.
//
// An endpoint is identified by its server (URL origin, e.g. "https://erddap.a"),
// so all datasets served by that host share one breaker.
//
// Implicit states:
//   closed     healthy            -> canUse = true
//   open       failing, in cooldown -> canUse = false  (skipped)
//   half-open  cooldown elapsed   -> canUse = true (one probe allowed)
// ============================================================================

export class EndpointHealth {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.failureThreshold=2]  consecutive failures before opening
   * @param {number} [opts.cooldownMs=300000]   how long to skip a down server (default 5 min;
   *                                             set e.g. 3600000 for 1 hour)
   * @param {() => number} [opts.now]            clock (injectable for tests)
   */
  constructor({ failureThreshold = 2, cooldownMs = 5 * 60 * 1000, now = () => Date.now() } = {}) {
    this._threshold = failureThreshold;
    this._cooldownMs = cooldownMs;
    this._now = now;
    /** @type {Map<string, {failures:number, openUntil:number}>} */
    this._map = new Map();
  }

  /**
   * May we use this endpoint right now? (Pure read — no state change.)
   * Returns false only while the breaker is OPEN and still cooling down.
   * @param {string} id
   * @returns {boolean}
   */
  canUse(id) {
    const e = this._map.get(id);
    if (!e) return true;                 // never failed -> healthy
    return this._now() >= e.openUntil;   // past the cooldown -> allow a probe
  }

  /** Report a successful request: the endpoint is healthy again. */
  reportSuccess(id) {
    this._map.delete(id);                // reset: failures cleared, breaker closed
  }

  /** Report a failed request: count it, and open the breaker past the threshold. */
  reportFailure(id) {
    const e = this._map.get(id) ?? { failures: 0, openUntil: 0 };
    e.failures += 1;
    if (e.failures >= this._threshold) {
      e.openUntil = this._now() + this._cooldownMs;   // (re)open for a cooldown
    }
    this._map.set(id, e);
  }

  // ---- introspection (for a UI "server down" indicator, or debugging) ----

  /** Is this endpoint currently skipped? */
  isDown(id) {
    return !this.canUse(id);
  }

  /** Epoch-ms when a down endpoint will next be probed (0 if healthy). */
  retryAt(id) {
    const e = this._map.get(id);
    return e && this._now() < e.openUntil ? e.openUntil : 0;
  }
}
