// ============================================================================
// data/transport/CacheStore.js
//
// A CacheStore is a generic  key -> value  store with per-entry expiry (TTL).
// It knows NOTHING about HTTP, URLs, in-flight requests, or data products — it
// just remembers values under keys and forgets them when they expire or when it
// runs out of room.
//
// Two ideas worth understanding here:
//
//   INTERFACE — `CacheStore` below is an "interface": it declares the methods
//   every store must provide (get/set/has/delete/clear) but implements none of
//   them (they throw). It's a promise, in code form, about SHAPE. Any concrete
//   store (memory now, Redis later) `extends CacheStore` and fills in the
//   behaviour. Everything above depends on the interface, never on a specific
//   store — that's what lets us swap the implementation later.
//
//   ASYNC ON PURPOSE — every method returns a Promise, even the in-memory one
//   that could answer instantly. Why? A future RedisCacheStore MUST be async (it
//   talks over a socket). By making the interface async NOW, the code that uses a
//   CacheStore (the RequestManager, next step) is written with `await` from day
//   one — so swapping memory -> Redis later changes nothing above this file.
// ============================================================================


/**
 * The CacheStore interface. Concrete stores extend this and override every
 * method. Keys are strings (we'll use URLs); values are whatever you store.
 */
export class CacheStore {
  /** @returns {Promise<*|undefined>} the value, or undefined if missing/expired */
  async get(key) { throw new Error('CacheStore.get not implemented'); }

  /**
   * @param {string} key
   * @param {*} value
   * @param {number} [ttlMs]  lifetime in ms; omit or 0 = never expires
   * @returns {Promise<void>}
   */
  async set(key, value, ttlMs) { throw new Error('CacheStore.set not implemented'); }

  /** @returns {Promise<boolean>} */
  async has(key) { throw new Error('CacheStore.has not implemented'); }

  /** @returns {Promise<void>} */
  async delete(key) { throw new Error('CacheStore.delete not implemented'); }

  /** @returns {Promise<void>} */
  async clear() { throw new Error('CacheStore.clear not implemented'); }
}


/**
 * In-memory cache with TTL expiry and simple LRU (least-recently-used) eviction.
 *
 * It uses a plain Map, which keeps keys in INSERTION ORDER. We exploit that for
 * LRU: touching an entry (get/set) deletes and re-inserts it so it moves to the
 * "end" (most-recent). The oldest entry is therefore always the FIRST key in the
 * Map — the one we evict when we exceed `maxEntries`.
 */
export class MemoryCacheStore extends CacheStore {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.maxEntries=500]  evict least-recently-used past this count
   */
  constructor({ maxEntries = 500 } = {}) {
    super();
    this._maxEntries = maxEntries;
    /** @type {Map<string, {value:*, expiresAt:number}>} */
    this._map = new Map();
  }

  async get(key) {
    const entry = this._map.get(key);
    if (entry === undefined) return undefined;          // miss
    if (Date.now() > entry.expiresAt) {                 // expired -> drop it
      this._map.delete(key);
      return undefined;
    }
    // mark most-recently-used: delete + re-insert moves it to the end
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.value;
  }

  async set(key, value, ttlMs) {
    const expiresAt = ttlMs && ttlMs > 0 ? Date.now() + ttlMs : Infinity;
    if (this._map.has(key)) this._map.delete(key);      // reorder to newest
    this._map.set(key, { value, expiresAt });
    // evict oldest while over capacity (first key = least-recently-used)
    while (this._map.size > this._maxEntries) {
      const oldest = this._map.keys().next().value;
      this._map.delete(oldest);
    }
  }

  async has(key) {
    return (await this.get(key)) !== undefined;
  }

  async delete(key) {
    this._map.delete(key);
  }

  async clear() {
    this._map.clear();
  }

  /** Current number of stored entries (handy while debugging). */
  get size() {
    return this._map.size;
  }
}
