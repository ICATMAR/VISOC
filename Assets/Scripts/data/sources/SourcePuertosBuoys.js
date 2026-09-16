import SourceBuoys from './SourceBuoys.js';
import buoys from '../../../../Data/buoys/buoys.js';

// Puertos del Estado's buoy network, through the endpoint the portus.puertos.es
// mobile app uses:
//
//   /cma2/app/CMA/adhoc/station_data?station=<id>&params=Hm0,Tm02&from=YYYYMMDD@HHmm&to=...
//
// answering { content: [ header, rows ] } where header[0] names the time column
// and the rest name the parameters WITH their units appended ('Hm0(m)',
// 'WaterTemp(ºC)'), and each row is [ epochSeconds, [value], [value], ... ] -
// every reading wrapped in an array of its own.
//
// Which buoys exist, what each one can be asked for and when it was deployed
// all come from Data/buoys/buoys.js rather than from the API: there is no
// catalogue endpoint to discover them from. An entry is one of this source's
// as soon as it carries `params`.
//
// Unlike the ICATMAR servers this one is not CORS-enabled, so every request
// goes through the ICATMAR proxy.

const PROXY_URL = 'https://api.icatmar.cat/proxy/';
const API_URL = 'https://movil.puertos.es/cma2/app/CMA/adhoc/station_data';

// What the API writes where a sensor had nothing to report. Compared with a
// little room rather than exactly: it is a float, and only the magnitude
// matters - no real reading of any of these parameters is anywhere near it.
const MISSING_VALUE = -9999;

const DATA_TTL = 5;      // minutes a data response is reused for
const DATA_TIMEOUT = 60; // seconds

const pad = n => String(n).padStart(2, '0');

// The API dates a request as YYYYMMDD@HHmm, in UTC.
const stamp = date => `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`
  + `@${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`;

// 'Hm0(m)' -> { name: 'Hm0', units: 'm' }. The request asks for bare parameter
// names and the response hands them back with the unit glued on, so the two
// only line up once it is taken off again - and the unit is worth keeping
// while we have it.
function splitHeader(column) {
  const match = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(String(column).trim());
  return match ? { name: match[1], units: match[2] } : { name: String(column).trim() };
}


class SourcePuertosBuoys extends SourceBuoys {

  constructor({ fetchManager, src }) {
    super({ fetchManager });
    this.src = src;
    this.api = 'Puertos del Estado'; // read by DataProducts.vue to label this source
    this.servesData = true;

    this.loadingPromise = this.load();
  }

  static proxied(url) {
    return PROXY_URL + '?url=' + encodeURIComponent(url);
  }

  // No request: the network is described by the static catalogue, which is
  // also the only place that says what each buoy can be asked for.
  async load() {
    this.buoys = buoys
      .filter(buoy => Array.isArray(buoy.params) && buoy.params.length)
      .map(buoy => {
        return {
          id: buoy.id,
          // The number this API knows the buoy by, which is not the id the
          // rest of the app uses - hence the separate field in the catalogue.
          // Falls back to the id for an entry that predates the split.
          station: String(buoy.puertosId ?? buoy.id),
          name: buoy.name,
          latitude: buoy.latitude,
          longitude: buoy.longitude,
          institution: buoy.institution,
          // One sensor per buoy, named after the hull rather than after an
          // instrument: this API reports a buoy's readings as one set and
          // never says which instrument inside it took them. So a Triaxys
          // wave buoy has a single 'Triaxys' sensor and no instrument - the
          // type IS as specific as the source gets.
          sensors: [{
            id: buoy.type ?? 'BUOY',
            variables: Object.fromEntries(buoy.params.map(param => [param, {}])),
            metadata: {},
            startDate: buoy.installed ? new Date(buoy.installed) : undefined,
            endDate: new Date(),
          }],
          startDate: buoy.installed ? new Date(buoy.installed) : undefined,
          // Assumed, not measured: the API has no catalogue endpoint to ask
          // how fresh a station is, so it claims to reach now. If it has in
          // fact fallen behind, DPBuoys finds out when a request comes back
          // empty and falls through to another source (see fetchSpan).
          endDate: new Date(),
        };
      });

    const { startDate, endDate } = this.dateRange();
    this.startDate = startDate;
    this.endDate = endDate;
    this.coverageCheckedAt = Date.now();
  }

  // Nothing to re-ask - the coverage is the catalogue's, and the end is
  // assumed (see load). Moving the assumed end forward keeps a long-running
  // session from deciding this source stops at the moment the page opened.
  async refreshCoverage() {
    const now = new Date();
    this.buoys.forEach(buoy => {
      buoy.endDate = now;
      buoy.sensors.forEach(sensor => { sensor.endDate = now; });
    });
    this.endDate = now;
  }

  // Rows for one buoy within [startDate, endDate]:
  // { '<ISO timestamp>': { '<SENSOR>': { <parameter>: value } } }, keyed by the
  // bare parameter names this source publishes - turning those into standard
  // codes is DataProduct's job.
  //
  // `sensors` ({ 'Triaxys': ['Hm0', 'MeanDir'] }) narrows what is asked for.
  // Worth passing: the API takes the parameter list in the query, so a
  // wave-only request doesn't drag the whole station's instrumentation back.
  async getBuoyData(buoyId, startDate, endDate, { sensors } = {}) {
    const buoy = this.getBuoy(buoyId);
    if (!buoy) throw new Error(`Unknown buoy '${buoyId}' in ${this.src}`);

    const sensor = buoy.sensors[0];
    if (!sensor) return {};

    // Everything this buoy has, unless the caller narrowed it - and then only
    // what it actually publishes, since the API errors on a parameter the
    // station doesn't carry rather than ignoring it.
    const published = Object.keys(sensor.variables ?? {});
    const wanted = (sensors?.[sensor.id] ?? published).filter(param => published.includes(param));
    if (wanted.length === 0) return {};

    const url = `${API_URL}?station=${buoy.station}&params=${wanted.join(',')}`
      + `&from=${stamp(startDate)}&to=${stamp(endDate)}`;

    const json = await this.fetchManager.fetch(SourcePuertosBuoys.proxied(url), DATA_TTL, DATA_TIMEOUT)
      .then(res => res.json());

    return this.parseContent(json, sensor);
  }

  // { content: [ header, rows ] } -> rows keyed by timestamp and sensor.
  // Records the units the header carries onto the sensor's variables on the
  // way past - it is the only place this source ever learns them.
  parseContent(json, sensor) {
    const [header, content] = json?.content ?? [];
    if (!Array.isArray(header) || !Array.isArray(content)) {
      throw new Error(`Unexpected response from ${this.src}: no content`);
    }

    // header[0] is the time column; the rest line up with the row's own cells
    const columns = header.slice(1).map(splitHeader);
    columns.forEach(({ name, units }) => {
      if (units && sensor.variables?.[name] && sensor.variables[name].units == undefined) {
        sensor.variables[name].units = units;
      }
    });

    const rows = {};
    content.forEach(row => {
      const date = new Date(Number(row[0]) * 1000);
      if (isNaN(date)) return;

      const values = {};
      columns.forEach(({ name }, index) => {
        // Every reading arrives wrapped in an array of its own
        const cell = row[index + 1];
        const value = parseFloat(Array.isArray(cell) ? cell[0] : cell);
        if (!isFinite(value) || value <= MISSING_VALUE) return;
        values[name] = value;
      });
      if (Object.keys(values).length === 0) return;

      rows[date.toISOString()] = { [sensor.id]: values };
    });

    return rows;
  }

}

export default SourcePuertosBuoys;
