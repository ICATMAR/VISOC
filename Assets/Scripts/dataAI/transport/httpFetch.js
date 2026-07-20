// ============================================================================
// data/transport/httpFetch.js
//
// Provides the "fetch function" that RequestManager is injected with. Two
// flavours, IDENTICAL shape:   (url) => Promise<rawBody>
//
//   createHttpFetch() — the real one: network fetch + HTTP error handling +
//                       reading the response body into a usable form.
//   createMockFetch() — a routing stand-in: returns generated data per URL, so
//                       the entire pipeline (RequestManager -> parser -> product)
//                       runs with NO real server. This is how the current
//                       synthetic buoy/drifter data keeps working while we build.
//
// Both are FACTORY FUNCTIONS: a function whose job is to build and return a
// configured function. You call it once at startup and inject its result into
// RequestManager. Swapping real <-> mock is then a one-line change at wiring
// time (step 10). (A bigger factory shows up in step 9.)
//
// The important contract: whatever `rawBody` a flavour returns, a DataProduct's
// PARSER must understand it. So the mock returns data shaped like the real
// endpoint (e.g. ERDDAP CSV text, or a JSON object) — the SAME parser then works
// against mock and real alike.
// ============================================================================


// ---- Real transport ------------------------------------------------------

/**
 * Build the real fetch function.
 * @param {Object} [opts]
 * @param {typeof fetch} [opts.fetchImpl]  the underlying fetch (browser global by
 *   default; on Node you'd inject node's fetch / undici)
 * @param {string} [opts.baseUrl]          optional base to resolve relative URLs
 * @returns {(url:string)=>Promise<*>}
 */
export function createHttpFetch({ fetchImpl = globalThis.fetch, baseUrl = '' } = {}) {
  if (!fetchImpl) throw new Error('createHttpFetch: no fetch implementation available');

  return async function httpFetch(url) {
    const full = baseUrl ? new URL(url, baseUrl).toString() : url;
    const res = await fetchImpl(full);
    if (!res.ok) {
      // Throw on HTTP errors so RequestManager does NOT cache them (auto-retry).
      const err = new Error(`HTTP ${res.status} ${res.statusText} for ${full}`);
      err.status = res.status;
      throw err;
    }
    return readBody(res);
  };
}

/** Read a Response body into the form a parser will expect, based on content-type. */
async function readBody(res) {
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (type.includes('application/json')) return res.json();        // -> parsed object
  if (type.startsWith('text/') || type.includes('csv') || type.includes('plain')) {
    return res.text();                                             // -> string (ERDDAP CSV etc.)
  }
  return res.arrayBuffer();                                        // -> bytes (NetCDF, PNG grids…)
}


// ---- Mock transport ------------------------------------------------------

/**
 * Build a mock fetch that answers from registered ROUTES instead of the network.
 * A route is { test, respond }:
 *   - test:    a function(url)->bool, a RegExp, or a substring string
 *   - respond: function(url)-> rawBody (or a Promise of one)
 *
 * @param {Object} [opts]
 * @param {Array<{test:*, respond:(url:string)=>*}>} [opts.routes]
 * @param {(url:string)=>Promise<*>} [opts.fallback]  used when no route matches
 *   (e.g. the real httpFetch, so unmocked URLs still work)
 * @param {number} [opts.latencyMs]  fake delay, to exercise loading states
 * @returns {((url:string)=>Promise<*>) & { route: Function }}
 */
export function createMockFetch({ routes = [], fallback = null, latencyMs = 0 } = {}) {
  const list = routes.map(r => ({ match: toMatcher(r.test), respond: r.respond }));

  const mockFetch = async function mockFetch(url) {
    const route = list.find(r => r.match(url));
    if (!route) {
      if (fallback) return fallback(url);
      const err = new Error(`mockFetch: no route for ${url}`);
      err.status = 404;
      throw err;
    }
    if (latencyMs) await delay(latencyMs);
    return route.respond(url);
  };

  // Let callers add routes after creation (products register theirs later).
  mockFetch.route = (test, respond) => {
    list.push({ match: toMatcher(test), respond });
    return mockFetch; // chainable
  };

  return mockFetch;
}

/** Turn a function / RegExp / substring into a uniform (url)->bool matcher. */
function toMatcher(test) {
  if (typeof test === 'function') return test;
  if (test instanceof RegExp) return (url) => test.test(url);
  return (url) => url.includes(String(test));
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
