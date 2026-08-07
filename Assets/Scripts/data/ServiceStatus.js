

class ServiceStatus {

  constructor(fetchManager) {
    this.fetchManager = fetchManager;
    this.proxyURL = 'https://api.icatmar.cat/proxy/';
    this.statusTTL = 1; // Minutes each service check stays cached in the FetchManager
    this.services = {
      icatmarErddap: 'https://erddap.icatmar.cat/erddap/index.html',
      msm: 'https://api.icatmar.cat/MSM_fast_api/buoys/',
      ais: 'https://api.icatmar.cat/ais',
      ifremerErddap: 'https://erddap.ifremer.fr/erddap/index.html',
      noaaErddap: 'https://erddap.aoml.noaa.gov/gdp/erddap/index.html',
      eunodeErddap: 'https://erddap.hfrnode.eu/erddap/index.html',
    };
  }

  // Returns the status of all data services.
  // ttl follows FetchManager's own rules (0 = force reload, e.g. a refresh
  // button; defaults to statusTTL). No caching/dedup needed here: the
  // FetchManager already caches (and dedups concurrent calls to) each URL, and
  // every call below hits the same URLs — so repeated/concurrent calls reuse
  // the same fetches.
  async requestAllStatus(ttl = this.statusTTL) {
    if (!navigator.onLine)
      return { hasInternet: false };

    // Checked directly (not through fetchURL()) because a 429 needs to be
    // told apart from every other failure - the proxy is rate-limiting us,
    // not down, and none of the services below can be checked either way
    // (they all go through the same proxy).
    let isProxyOn = false;
    let isProxyRateLimited = false;
    try {
      const res = await this.fetchManager.fetch(this.proxyURL, ttl);
      const text = await res.text();
      isProxyOn = text.includes('ProxyServerAPI RUNNING');
    } catch (err) {
      isProxyRateLimited = err.status === 429;
    }
    if (!isProxyOn)
      return { hasInternet: true, isProxyOn: false, isProxyRateLimited };

    const [icatmarErddap, msm, ais, ifremerErddap, noaaErddap, eunodeErddap] = await Promise.all([
      this.checkProxied(this.services.icatmarErddap, ttl, text => !text.includes('Service Unavailable')),
      this.fetchURL(this.services.msm, ttl, text => JSON.parse(text).buoys != undefined),
      this.checkProxied(this.services.ais, ttl, text => !text.includes('Service Unavailable')),
      this.checkProxied(this.services.ifremerErddap, ttl, text => !text.includes('Service Unavailable')),
      this.checkProxied(this.services.noaaErddap, ttl, text => !text.includes('Service Unavailable')),
      this.checkProxied(this.services.eunodeErddap, ttl, text => !text.includes('Service Unavailable')),
    ]);

    return { hasInternet: true, isProxyOn: true, icatmarErddap, msm, ais, ifremerErddap, noaaErddap, eunodeErddap };
  }

  // Requests a URL through the proxy. Defaults to checking the response is ok.
  checkProxied(url, ttl, validate) {
    return this.fetchURL(this.proxyURL + '?url=' + encodeURIComponent(url), ttl, validate);
  }

  // Fetches a URL (cached `ttl` minutes) and validates the response text. Never throws: false on any failure.
  async fetchURL(url, ttl, validate) {
    try {
      const res = await this.fetchManager.fetch(url, ttl);
      const text = await res.text();
      return validate ? validate(text) : res.ok;
    } catch (e) {
      // For some reason MSM url is turned into http?
      return e;
    }
  }

}


export default ServiceStatus;
