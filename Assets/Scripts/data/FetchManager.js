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
  // Timeout, in seconds: aborts the underlying fetch (and rejects) if it hasn't resolved in time.
  // Only applies when this call actually starts a new network request (not to cached/ongoing ones).
  // Requests routed through the ICATMAR proxy embed the real target in
  // ?url=... (URL-encoded) - decode it so error messages can show both,
  // since the proxied form alone doesn't say which server is unreachable.
  static targetUrl(url) {
    if (!url.includes('api.icatmar.cat/proxy')) return undefined;
    const match = url.match(/[?&]url=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }

  static fetch(url, ttl, timeout = 30) {
    let entry = FetchManager.requests.get(url);
    if (entry == undefined) {
      entry = {};
      FetchManager.requests.set(url, entry);
    }

    // Already loading -> reuse the ongoing request, but give THIS caller its
    // own clone (entry.promise may end up awaited by several callers, and a
    // promise resolves to ONE shared value - handing that out directly would
    // mean two callers reading the same Response, so the second .text()/
    // .json() throws "body stream already read").
    if (entry.promise != undefined)
      return entry.promise.then(res => res.clone());

    const isExpired = entry.expiresAt != undefined && Date.now() > entry.expiresAt;

    // Resolved and still valid -> reuse it (cloned: a Response body can only be read once)
    if (entry.response != undefined && !isExpired && ttl !== 0)
      return Promise.resolve(entry.response.clone());

    // Otherwise fetch: no cache yet, expired, or forced with ttl 0
    entry.response = undefined;

    const controller = new AbortController();
    const timeoutId = typeof timeout === 'number' ? setTimeout(() => controller.abort(), timeout * 1000) : undefined;

    entry.promise = fetch(url, { signal: controller.signal }).then(res => { // global fetch, not recursive
      clearTimeout(timeoutId);

      // fetch() only rejects on network failure - a 4xx/5xx response still
      // resolves normally, so that has to be checked explicitly here.
      if (!res.ok) {
        const target = FetchManager.targetUrl(url);
        const httpError = new Error(`HTTP ${res.status} ${res.statusText}: ${url}${target ? ` (${target})` : ''}`);
        httpError.name = 'HTTPError'; // lets callers tell this apart from other fetch errors
        httpError.status = res.status;
        throw httpError;
      }

      entry.response = res; // stays UNREAD forever - every caller only ever clones it
      entry.promise = undefined;
      entry.expiresAt = (typeof ttl === 'number' && ttl > 0) ? Date.now() + ttl * 60000 : undefined;
      return res; // return the original - callers clone it themselves (see above and below)
    }).catch(err => {
      clearTimeout(timeoutId);
      entry.promise = undefined; // Allow retrying on the next call
      if (err.name === 'AbortError') {
        const target = FetchManager.targetUrl(url);
        const timeoutError = new Error(`Fetch timed out after ${timeout}s: ${url}${target ? ` (${target})` : ''}`);
        timeoutError.name = 'TimeoutError'; // lets callers tell this apart from other fetch errors
        throw timeoutError;
      }
      throw err;
    });

    return entry.promise.then(res => res.clone());
  }

}

export default FetchManager;
