

class StatusProvider {

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

    const isProxyOn = await this.fetchURL(this.proxyURL, ttl, text => text.includes('ProxyServerAPI RUNNING'));
    if (!isProxyOn)
      return { hasInternet: true, isProxyOn: false };

    const [icatmarErddap, msm, ais, ifremerErddap, noaaErddap] = await Promise.all([
      this.checkProxied(this.services.icatmarErddap, ttl, text => !text.includes('Service Unavailable')),
      this.checkProxied(this.services.msm, ttl, text => JSON.parse(text).buoys != undefined),
      this.checkProxied(this.services.ais, ttl),
      this.checkProxied(this.services.ifremerErddap, ttl, text => !text.includes('Service Unavailable')),
      this.checkProxied(this.services.noaaErddap, ttl, text => !text.includes('Service Unavailable')),
    ]);

    return { hasInternet: true, isProxyOn: true, icatmarErddap, msm, ais, ifremerErddap, noaaErddap };
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
    } catch {
      return false;
    }
  }

}


export default StatusProvider;
