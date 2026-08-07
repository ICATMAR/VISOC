// ============================================================================
// data/transport/RequestManager.js
//
// The transport + cache engine. Its whole job: given a KEY, return a Promise of
// the raw response — going to the network only when necessary.
//
// It does these things, and nothing else (no time ranges, no products, no
// parsing — those live above it):
//
//   1. CACHE     ask the CacheStore first; a fresh hit skips the network.
//   2. DEDUP     if the same KEY is already being fetched, hand back the SAME
//                in-flight promise instead of starting a second fetch.
//   3. TTL       store each fetched value with a lifetime chosen by the caller.
//   4. FAILOVER  a key may have SEVERAL candidate URLs (mirror servers). We try
//                them in order and stop at the first success — so if ERDDAP-A is
//                down we transparently fall back to ERDDAP-B. Each attempt must
//                settle (throw / timeout) before the next is tried.
//   5. HEALTH    an optional shared EndpointHealth (circuit breaker) lets us SKIP
//                a server that's already known to be down, instead of retrying it
//                on every request. Because it's shared across all products, one
//                product's failure protects the others.
//
// KEY vs URL: the cache is keyed by a LOGICAL key that identifies the DATA, not
// by the mirror it came from. That way data fetched from mirror B satisfies a
// later request even if that request would have tried mirror A first. For a
// simple single-endpoint request, the key can just BE the URL.
//
// Everything it needs is INJECTED (dependency injection): the cache and the
// fetch function are passed into the constructor, never created here.
// ============================================================================

/** @typedef {import('./CacheStore.js').CacheStore} CacheStore */

export class RequestManager {
  /**
   * @param {Object} deps
   * @param {CacheStore} deps.cache                 where resolved values are stored
   * @param {(url:string)=>Promise<*>} deps.fetch    how to fetch one URL's raw body
   * @param {number} [deps.defaultTtlMs=0]          fallback TTL if none given (0 = never expire)
   * @param {number} [deps.timeoutMs=0]             per-attempt timeout (0 = no timeout);
   *                                                a hung mirror won't block failover
   * @param {import('./EndpointHealth.js').EndpointHealth} [deps.health]
   *                                                shared circuit breaker (optional)
   */
  constructor({ cache, fetch, defaultTtlMs = 0, timeoutMs = 0, health = null }) {
    this._cache = cache;
    this._fetch = fetch;
    this._defaultTtl = defaultTtlMs;
    this._timeoutMs = timeoutMs;
    this._health = health;

    // KEY -> pending Promise. Transient, in-memory: holds promises (can't go to
    // Redis) and de-dups concurrent requests. Entries removed once settled.
    /** @type {Map<string, Promise<*>>} */
    this._inflight = new Map();
  }

  /**
   * Get the raw response for `key`, from cache if possible, else the network.
   * Concurrent calls for the same key share one fetch.
   *
   * @param {string} key            logical cache/dedup key (may just be a URL)
   * @param {Object} [opts]
   * @param {number} [opts.ttlMs]   lifetime to cache a freshly-fetched value
   * @param {string[]} [opts.urls]  candidate URLs to try in order (mirrors);
   *                                defaults to [key] (i.e. the key is a URL)
   * @returns {Promise<*>}
   */
  request(key, { ttlMs, urls } = {}) {
    // 1) DEDUP — synchronous, before any await.
    const pending = this._inflight.get(key);
    if (pending) return pending;

    // 2) Build the work and register it synchronously.
    const ttl = ttlMs ?? this._defaultTtl;
    const candidates = urls ?? [key];
    const work = this._run(key, ttl, candidates);
    this._inflight.set(key, work);

    // 3) Clear the in-flight slot once settled (success OR failure). The
    //    `.catch(()=>{})` only silences THIS bookkeeping chain — the `work`
    //    returned to the caller still rejects normally.
    work
      .catch(() => {})
      .finally(() => {
        if (this._inflight.get(key) === work) this._inflight.delete(key);
      });

    return work;
  }

  /** Cache-then-fetch flow (with mirror failover on the fetch). */
  async _run(key, ttl, urls) {
    const cached = await this._cache.get(key);
    if (cached !== undefined) return cached;      // fresh hit -> no network

    const raw = await this._loadWithFailover(urls); // may throw -> propagates, NOT cached
    await this._cache.set(key, raw, ttl);           // store only on success
    return raw;
  }

  /**
   * Try candidate URLs in order; return the first success, else throw.
   * Endpoints the shared breaker has marked down are skipped (not retried).
   */
  async _loadWithFailover(urls) {
    let lastErr;
    let skipped = 0;
    for (const url of urls) {
      const id = endpointId(url);
      if (this._health && !this._health.canUse(id)) { skipped++; continue; } // known down

      try {
        const raw = this._timeoutMs > 0
          ? await raceTimeout(this._fetch(url), this._timeoutMs, url)
          : await this._fetch(url);
        this._health?.reportSuccess(id);   // endpoint answered -> healthy
        return raw;
      } catch (err) {
        this._health?.reportFailure(id);   // count toward opening the breaker
        lastErr = err;                     // and try the next candidate
      }
    }
    if (lastErr) throw lastErr;
    throw new Error(skipped
      ? 'RequestManager: all endpoints are marked down (cooling down)'
      : 'RequestManager: no URLs to fetch');
  }

  /** Force a key to be re-fetched next time (manual refresh / cache-bust). */
  async invalidate(key) {
    this._inflight.delete(key);
    await this._cache.delete(key);
  }

  /** Warm the cache without waiting (server pre-warming, hover-prefetch…). Best-effort. */
  prefetch(key, opts) {
    this.request(key, opts).catch(() => {});
  }
}


/** Identify the server behind a URL (its origin), so all its datasets share one breaker. */
function endpointId(url) {
  try {
    return new URL(url).origin;   // absolute URL -> "scheme://host:port"
  } catch {
    return 'local';               // relative URL (e.g. static files) -> one bucket
  }
}

/** Reject if `promise` doesn't settle within `ms` (so a hung mirror can't block failover). */
function raceTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
