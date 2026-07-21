class FetchManager {

  // Keep track of requests
  // URL is the key, and the value is { promise, response, expiresAt }.
  // This way, if the same URL is requested multiple times, it will only be fetched once.
  // The promise (or its resolved response) is reused until the TTL expires.
  // If the cache time expires, a new request will be made.
  static requests = new Map();

  constructor() {

  }

  // TTL (time to live), in minutes:
  //  undefined -> does not set a new expiry; still reloads if a previously set TTL expired
  //  0         -> forces a fresh fetch; does not set an expiry
  //  N         -> reuses the cache if not expired; sets a new expiry of N minutes when (re)fetched
  static fetch(url, ttl) {
    let entry = FetchManager.requests.get(url);
    if (entry == undefined) {
      entry = {};
      FetchManager.requests.set(url, entry);
    }

    // Already loading -> reuse the ongoing request
    if (entry.promise != undefined)
      return entry.promise;

    const isExpired = entry.expiresAt != undefined && Date.now() > entry.expiresAt;

    // Resolved and still valid -> reuse it (cloned: a Response body can only be read once)
    if (entry.response != undefined && !isExpired && ttl !== 0)
      return Promise.resolve(entry.response.clone());

    // Otherwise fetch: no cache yet, expired, or forced with ttl 0
    entry.response = undefined;
    entry.promise = fetch(url).then(res => { // global fetch, not recursive
      entry.response = res;
      entry.promise = undefined;
      entry.expiresAt = (typeof ttl === 'number' && ttl > 0) ? Date.now() + ttl * 60000 : undefined;
      return res.clone();
    }).catch(err => {
      entry.promise = undefined; // Allow retrying on the next call
      throw err;
    });

    return entry.promise;
  }

}

export default FetchManager;
