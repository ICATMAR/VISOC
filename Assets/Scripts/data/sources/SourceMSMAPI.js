import SourceBuoys from './SourceBuoys.js';

// ICATMAR's MSM API - the ingestion database behind the buoys, reachable at
// https://api.icatmar.cat/MSM_fast_api/. Two endpoints are used here:
//
//   GET /buoys
//     { "buoys": [{ id: '865583042277664', name: 'CDCR (Cadaqués)',
//                   lat: 42.3211716, lon: 3.3493733,
//                   latestTimestamp: '<ISO>', source: 'graphql_discovery' }, ...] }
//     `id` is the transmitter's IMEI, not a buoy name, so it is kept as
//     `msmId` and the buoy id is derived from `name` instead (see idFromName).
//
//   GET /buoys/{msmId}/data?start_date=&end_date=&parameters=&limit=
//     { "data": { "<ISO timestamp>": { "<sensor>": { "<param>": "<value>" } } } }
//     One block per sensor ('Gill', 'HMP155-2', 'ADCP', 'CTD', 'Waves', ...),
//     values as strings, plus a "parsedJson" key that is not a sensor. On an
//     error the payload carries `detail` instead of `data`.
//
// The API is on api.icatmar.cat and CORS-enabled, so - unlike the ERDDAP
// sources - none of this goes through the ICATMAR proxy.
//
// Values are returned RAW. Several of them are integer-scaled at the logger
// (the HFRadar viewer reads TEMP/PSAL as value * 0.0001 and DRYT/ATMS/RELH as
// value * 0.1), and that scaling belongs in the catalogue's `mapping`, not
// here - this source doesn't know which convention a given deployment used.

const LIST_TTL = 10;          // minutes the buoy list is cached for
const DATA_TTL = 10;          // minutes a data request is cached for
const DISCOVERY_HOURS = 24;   // window looked at to find out which sensors a buoy currently reports
const DISCOVERY_LIMIT = 200;  // records requested for that window - enough to see every sensor
const DISCOVERY_TIMEOUT = 20; // seconds; the API is slow, but load() shouldn't hang on it
const DATA_TIMEOUT = 60;      // seconds, for an explicit (and much larger) data request
const DEFAULT_LIMIT = 5000;   // same page size the other ICATMAR viewers ask for

// The API names its buoys after the nearest town, where the rest of ICATMAR
// names them after the river or cape they are moored off, so the names have to
// be translated to the ids everything else uses (the ERDDAP dataset ids, the
// static catalogue in Data/buoys/buoys.js). Keyed by the normalized API name
// (see idFromName): a buoy that isn't in here keeps its own name as its id.
const BUOY_IDS = {
  CAP_DE_CREUS: 'CDCR',
  TORDERA: 'TORD',
  TARRAGONA: 'TARR',
  TORTOSA: 'TORT',
};

// This API's sensor names against the ones the ERDDAP datasets use
// (BUOY_<buoy>_<sensor>), so a buoy carried by both - CDCR, TORT, TARR, TORD -
// comes out as one buoy with one set of sensors rather than each server's own.
// Keyed by the upper-cased API name; anything not listed keeps its own name.
//
// The two wind sensors are deliberately NOT folded together into one 'METEO':
// they report in different units (see the catalogue's sensorMapping), so
// merging them would put cm/s and m/s readings under the same code.
const SENSOR_IDS = {
  OLAS: 'WAVES',
  'RM YOUNG': 'RM_YOUNG', // spelled with a space here, YOUN on the ERDDAP side
  'HMP155-1': 'HMP1',
  'HMP155-2': 'HMP2',
};

// How far back the API keeps records. It publishes no coverage start of its
// own (only latestTimestamp per buoy), so this is configuration rather than
// something discovered - a buoy's startDate is derived from it. Raise it if the
// database is known to hold more; a value that's too small only means DPBuoys
// won't consider this source for older windows it could in fact have served.
const HISTORY_DAYS = 7;

// Keys of a record that are not sensors
const NOT_A_SENSOR = ['parsedJson'];

// Values that mean "nothing was measured" rather than a reading
const MISSING_VALUES = ['', 'NAN', 'NaN', 'null', 'None'];

// The API dates its requests without milliseconds, e.g. '2026-09-07T10:00:00Z'
const stamp = date => date.toISOString().substring(0, 19) + 'Z';


class SourceMSMAPI extends SourceBuoys {

  constructor({ fetchManager, src, discoverSensors = true }) {
    super({ fetchManager });
    this.src = src;
    this.baseUrl = src.replace(/\/+$/, ''); // the catalogue's src ends in '/'
    this.api = 'MSM';                       // read by DataProducts.vue to label this source
    this.servesData = true;

    // Whether load() also asks each buoy for a recent record to find out which
    // sensors it carries. Off means one single request (the buoy list), but
    // then the buoys come back with no sensors at all.
    this.discoverSensors = discoverSensors;

    this.loadingPromise = this.load();
  }

  // Buoy id from the API's display name: 'CDCR (Cadaqués)' -> 'CDCR',
  // 'TORTOSA (Delta)' -> 'TORT', 'BLANES' -> 'TORD'. The parenthesised part is
  // a place rather than part of the name, and what is left is looked up in
  // BUOY_IDS so this source reports a buoy under the same id as every other
  // source - which is what lets DPBuoys merge them by id alone.
  static idFromName(name) {
    const normalized = String(name ?? '')
      .replace(/\([^)]*\)/g, '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return BUOY_IDS[normalized] ?? normalized;
  }

  // Sensor id from the API's own name: upper-cased ('Gill' -> 'GILL') and then
  // looked up in SENSOR_IDS ('Waves' -> 'WAVE'), so a sensor the ERDDAP
  // datasets also publish (BUOY_<buoy>_CTD, BUOY_<buoy>_ADCP, ...) lands on the
  // same id here and merges instead of doubling up.
  static sensorId(name) {
    const normalized = String(name).trim().toUpperCase();
    return SENSOR_IDS[normalized] ?? normalized;
  }

  // What a buoy's `latestTimestamp` says about its coverage: the end is
  // measured, the start is inferred from HISTORY_DAYS (the API doesn't publish
  // one). Both are needed for DPBuoys to weigh this source against the others
  // for a given window rather than assume a role for it.
  static coverageOf(latestTimestamp) {
    if (!latestTimestamp) return { startDate: undefined, endDate: undefined };
    const endDate = new Date(latestTimestamp);
    if (isNaN(endDate)) return { startDate: undefined, endDate: undefined };
    return { startDate: new Date(endDate.getTime() - HISTORY_DAYS * 86400000), endDate };
  }

  // Re-reads every buoy's latest timestamp - one request for the whole list,
  // which is what makes the coverage check before a data request affordable
  // (see SourceBuoys.getEndDate).
  async refreshCoverage() {
    const url = `${this.baseUrl}/buoys`;
    const json = await this.fetchManager.fetch(url, LIST_TTL).then(res => res.json());
    if (!Array.isArray(json?.buoys)) throw new Error(`No buoys in the response of ${url}`);

    json.buoys.forEach(published => {
      const buoy = this.getBuoy(SourceMSMAPI.idFromName(published.name));
      if (!buoy) return; // a buoy that appeared since load() - picked up on the next one
      const coverage = SourceMSMAPI.coverageOf(published.latestTimestamp);
      Object.assign(buoy, coverage);
      // Sensor-level dates follow the buoy's: the list is per buoy, and this
      // API gives no way to ask when one sensor last reported.
      buoy.sensors.forEach(sensor => { if (coverage.endDate) sensor.endDate = coverage.endDate; });
    });

    const { startDate, endDate } = this.dateRange();
    this.startDate = startDate;
    this.endDate = endDate;
  }

  async load() {
    const url = `${this.baseUrl}/buoys`;
    const json = await this.fetchManager.fetch(url, LIST_TTL).then(res => res.json());
    if (!Array.isArray(json?.buoys)) throw new Error(`No buoys in the response of ${url}`);

    this.buoys = json.buoys.map(buoy => ({
      id: SourceMSMAPI.idFromName(buoy.name),
      msmId: String(buoy.id),
      name: buoy.name,
      latitude: buoy.lat != undefined ? Number(buoy.lat) : undefined,
      longitude: buoy.lon != undefined ? Number(buoy.lon) : undefined,
      sensors: [],
      ...SourceMSMAPI.coverageOf(buoy.latestTimestamp),
    }));

    if (this.discoverSensors) {
      await Promise.all(this.buoys.map(buoy => this.loadSensors(buoy).catch(err => {
        // One buoy that can't be read (slow, or no recent record) shouldn't
        // cost us the whole list - it just stays sensorless.
        console.error(`Could not read the sensors of buoy '${buoy.id}' from ${this.src}:`, err);
      })));
    }

    const { startDate, endDate } = this.dateRange();
    this.startDate = startDate;
    this.endDate = endDate;
    this.coverageCheckedAt = Date.now(); // loading is itself a coverage check
  }

  // Which sensors a buoy carries, and which parameters each of them reports -
  // discovered from the data itself (there is no metadata endpoint), by
  // reading the last day of records before the buoy's latest timestamp.
  async loadSensors(buoy) {
    const end = buoy.endDate ?? new Date();
    const start = new Date(end.getTime() - DISCOVERY_HOURS * 3600000);
    const rows = await this.getBuoyData(buoy.id, start, new Date(end.getTime() + 60000), {
      limit: DISCOVERY_LIMIT,
      timeout: DISCOVERY_TIMEOUT,
    });

    const sensors = new Map();
    Object.entries(rows).forEach(([timestamp, bySensor]) => {
      const date = new Date(timestamp);
      Object.entries(bySensor).forEach(([id, values]) => {
        if (!sensors.has(id)) {
          // No units or long names anywhere in the response, so `variables`
          // only records which parameters exist - same shape as the ERDDAP
          // sources' variables, with the attributes simply unknown.
          sensors.set(id, { id, variables: {}, metadata: {} });
        }
        const sensor = sensors.get(id);
        Object.keys(values).forEach(name => {
          if (sensor.variables[name] == undefined) sensor.variables[name] = {};
        });
        // Only an end date: this window is the one we asked for, not the
        // sensor's coverage, so its start says nothing.
        if (!isNaN(date) && (sensor.endDate == undefined || date > sensor.endDate)) sensor.endDate = date;
      });
    });

    buoy.sensors = [...sensors.values()];
    return buoy.sensors;
  }

  // Rows for one buoy within [startDate, endDate]:
  // { '<ISO timestamp>': { '<SENSOR>': { <parameter>: value } } }, values raw
  // (see the note at the top).
  //
  // `sensors` ({ '<SENSOR>': ['WSPD', 'WDIR'] }) narrows the request: this API
  // has no per-sensor endpoint, so every sensor still comes back and the
  // caller filters, but the parameter names are unioned into the request's
  // `parameters` filter the way the HFRadar viewer does, which does make the
  // response smaller. `parameters` can also be passed directly instead.
  async getBuoyData(buoyId, startDate, endDate, { sensors, parameters, limit = DEFAULT_LIMIT, timeout = DATA_TIMEOUT } = {}) {
    const buoy = this.getBuoy(buoyId);
    if (!buoy) throw new Error(`Unknown buoy '${buoyId}' in ${this.src}`);

    if (!parameters && sensors) {
      parameters = [...new Set(Object.values(sensors).flat())];
    }

    const query = [`limit=${limit}`];
    if (startDate) query.push(`start_date=${stamp(startDate)}`);
    if (endDate) query.push(`end_date=${stamp(endDate)}`);
    if (parameters?.length) query.push(`parameters=${parameters.join(',')}`);
    const url = `${this.baseUrl}/buoys/${buoy.msmId}/data?${query.join('&')}`;

    const json = await this.fetchManager.fetch(url, DATA_TTL, timeout).then(res => res.json());
    // A failed query still answers 200, with `detail` where `data` should be
    if (json?.data == undefined) throw new Error(`No data for buoy '${buoyId}' from ${url}: ${json?.detail ?? 'no detail'}`);

    return this.parseRecords(json.data);
  }

  // { '<timestamp>': { '<sensor>': { param: '<value>' } } } as the API returns
  // it -> the same, with sensor ids normalized, non-sensor keys dropped, empty
  // readings dropped and numbers parsed.
  parseRecords(records) {
    const rows = {};

    Object.entries(records).forEach(([timestamp, bySensor]) => {
      if (bySensor == undefined || typeof bySensor !== 'object') return;

      const values = {};
      Object.entries(bySensor).forEach(([name, parameters]) => {
        if (NOT_A_SENSOR.includes(name)) return;
        if (parameters == undefined || typeof parameters !== 'object') return;

        const parsed = {};
        Object.entries(parameters).forEach(([parameter, value]) => {
          const parsedValue = SourceMSMAPI.parseValue(value);
          if (parsedValue !== undefined) parsed[parameter] = parsedValue;
        });
        if (Object.keys(parsed).length) values[SourceMSMAPI.sensorId(name)] = parsed;
      });
      if (Object.keys(values).length === 0) return;

      // Keyed by a real ISO timestamp, so rows from here line up with the ones
      // the other buoy sources return. A key that can't be parsed is kept as
      // it came rather than dropped.
      const date = new Date(timestamp);
      rows[isNaN(date) ? timestamp : date.toISOString()] = values;
    });

    return rows;
  }

  // Every value arrives as a string. Numbers are parsed; anything else
  // (instrument serials, status words) is kept as it came, and a missing
  // reading becomes undefined so it can be dropped rather than read as 0.
  static parseValue(value) {
    if (value == undefined) return undefined;
    const text = String(value).trim();
    if (MISSING_VALUES.includes(text)) return undefined;
    const number = Number(text);
    return isFinite(number) ? number : text;
  }

}

export default SourceMSMAPI;
