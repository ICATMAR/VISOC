import SourceBuoys from './SourceBuoys.js';

// The Somorrostro buoy's own logger tables, as published to ICATMAR/data on
// GitHub Pages. This is the rawest of the buoy sources: the CR1000X writes
// these files and they are pushed to the repository as they are, so they run
// ahead of the ERDDAP servers (which ingest from here) - which is exactly what
// makes this source worth having when ERDDAP is stale or down.
//
// GitHub Pages serves them with `access-control-allow-origin: *` and an
// exposed Last-Modified, so unlike the ERDDAP sources nothing here goes
// through the ICATMAR proxy. Same files the boiasomorrostro wind display
// reads.
//
// The tables are TOA5: line 1 is the logger/table environment, line 2 the
// column names, lines 3-4 their units and aggregation, then one quoted CSV row
// per timestamp. They hold months of data (0.7-1.2 MB each), so load() only
// HEADs them for freshness and the download+parse waits until someone actually
// asks for measurements. Note the files' Last-Modified is a real instant,
// unlike the row timestamps (see parseTimestamp).

const BASE_URL = 'https://icatmar.github.io/data/observational/insitu/Boies/SOMO/BoiaSomorrostro_cr1000xs_';
const REPO = 'ICATMAR/data';
const BUOY_ID = 'SOMO';

// The tables read here. `id` is the sensor id the ERDDAP buoy datasets use
// (BUOY_SOMO_METEO, BUOY_SOMO_CTD), so both sources describe the same sensor
// when DPBuoys merges them.
//
// Also published for this buoy, but not read here: Doppler.dat (the current
// profiler - its cells are packed as 'speed direction' text rather than one
// column per value, so it needs its own parsing), Sami.dat (raw pCO2 frames as
// hex blobs), System.dat and Status.dat (logger housekeeping: batteries, panel
// temperature, memory).
const SENSORS = [
  { id: 'METEO', file: 'Meteo.dat' },
  { id: 'CTD', file: 'SBE37_SMPO.dat' },
];

const FILE_TTL = 5;      // minutes a downloaded table is cached for
const FILE_TIMEOUT = 60;  // seconds - these are MB-sized files

const TIMESTAMP_COLUMN = 'TIMESTAMP';
// The Meteo table carries the buoy's GPS fix, so the position is read from the
// data rather than hardcoded - this buoy is moored, but it does get moved.
const LATITUDE_COLUMN = 'Latitude';
const LONGITUDE_COLUMN = 'Longitude';

// The logger writes 1000 m/s for a failed wind reading and the repository
// serves it raw (ERDDAP quality-controls the same rows to NaN, so this only
// bites here). On those rows the direction column still holds a
// plausible-looking number, so the whole wind block goes, not just the speed.
// The strongest real reading in the record is 27 m/s, so the exact threshold
// hardly matters.
const MAX_WIND_SPEED = 500;
const WIND_SPEED_COLUMNS = ['Corr_WindS', 'Rel_WS'];
const WIND_COLUMNS = ['Rel_WindDir', 'Corr_WindDir', 'Corr_WindS', 'WindDir_True', 'Rel_WS'];

// What the logger writes where there is no reading
const MISSING_VALUES = ['', 'NAN', 'NaN'];

// Row timestamps are read as UTC, exactly as the logger writes them. They have
// been running on the buoy's local wall clock (Europe/Madrid, so an hour or two
// ahead of the real instant, which is why boiasomorrostro/wind.js converts
// them), but that is being fixed at the logger - so no correction is applied
// here. Until the fix lands, recent rows can read slightly in the future.
function parseTimestamp(timestamp) {
  const date = new Date(String(timestamp).trim().replace(' ', 'T') + 'Z');
  return isNaN(date) ? undefined : date;
}

// TOA5 is quoted CSV, and some columns really do hold commas inside their
// quotes (the Status table's messages, for one), so a line can't just be split
// on ','. Unquoted cells are returned as they are, '""' is an escaped quote.
function splitCSV(line) {
  const cells = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char !== '"') { cell += char; continue; }
      if (line[i + 1] === '"') { cell += '"'; i++; continue; }
      quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { cells.push(cell); cell = ''; continue; }
    cell += char;
  }
  cells.push(cell);

  return cells;
}

// A cell as the logger wrote it -> a number, a string (serial numbers, status
// words, the CTD's own date/time strings), or undefined for a missing reading,
// so it can be dropped instead of being read as a perfectly plausible 0.
function parseValue(raw) {
  const text = String(raw).trim();
  if (MISSING_VALUES.includes(text)) return undefined;
  const number = Number(text);
  return isFinite(number) ? number : text;
}


class SourceGithubSOMO extends SourceBuoys {

  constructor({ fetchManager, src }) {
    super({ fetchManager });
    this.src = src;
    this.repo = REPO; // read by DataProducts.vue to label/link this as a Github source
    this.servesData = true;

    // One entry per table, keyed by sensor id: the promise of its parsed
    // contents. Holds the promise (not the parsed value) so concurrent callers
    // share one download instead of each starting their own.
    this.tables = new Map();

    this.buoys = [{
      id: BUOY_ID,
      sensors: SENSORS.map(sensor => ({ ...sensor, url: BASE_URL + sensor.file })),
      // latitude/longitude/dates are discovered, see load() and loadTable()
    }];

    this.loadingPromise = this.load();
  }

  // This source only ever covers the one buoy
  buoy() {
    return this.buoys[0];
  }

  getSensor(sensorId) {
    return this.buoy().sensors.find(sensor => sensor.id === sensorId);
  }

  // How fresh each table is, from a HEAD - not the MB-sized file itself. The
  // rows are only downloaded when someone asks for measurements (loadTable),
  // and endDate is replaced by the real last row when that happens: until
  // then, Last-Modified is a good enough stand-in (the file is published a few
  // minutes after the row it ends on).
  async load() {
    await Promise.all(this.buoy().sensors.map(async sensor => {
      sensor.lastModified = await this.fetchLastModified(sensor.url).catch(err => {
        console.error(`Could not reach ${sensor.url}:`, err);
        return undefined;
      });
      if (sensor.endDate == undefined) sensor.endDate = sensor.lastModified;
    }));

    this.updateDates();
  }

  // Deliberately NOT through the FetchManager: it caches by URL alone, so a
  // HEAD cached here would later be handed to loadTable() as a response with
  // an empty body.
  async fetchLastModified(url) {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
    if (!res.ok) {
      const error = new Error(`HTTP ${res.status} ${res.statusText}: ${url}`);
      error.name = 'HTTPError';
      error.status = res.status;
      throw error;
    }
    const lastModified = res.headers.get('Last-Modified');
    return lastModified ? new Date(lastModified) : undefined;
  }

  // Buoy- and source-level coverage always follow the sensors', so this is
  // called again every time a table is parsed and its dates get sharper.
  updateDates() {
    const buoy = this.buoy();
    Object.assign(buoy, SourceBuoys.dateRangeOf(buoy.sensors));

    const { startDate, endDate } = this.dateRange();
    this.startDate = startDate;
    this.endDate = endDate;
  }

  // Downloads and parses one table, once. Everything the header lines describe
  // (variables, logger metadata) and everything only the rows can say (the
  // real coverage, the buoy's position) lands on the sensor here - before this
  // runs, a sensor only knows how fresh its file is.
  loadTable(sensorId, { force = false } = {}) {
    if (force) this.tables.delete(sensorId);
    if (this.tables.has(sensorId)) return this.tables.get(sensorId);

    const sensor = this.getSensor(sensorId);
    if (!sensor) return Promise.reject(new Error(`Unknown sensor '${sensorId}' for buoy ${BUOY_ID}`));

    const promise = this.fetchManager.fetch(sensor.url, force ? 0 : FILE_TTL, FILE_TIMEOUT)
      .then(res => res.text())
      .then(text => {
        const table = this.parseTOA5(text);

        sensor.variables = table.variables;
        sensor.metadata = table.metadata;
        sensor.startDate = table.startDate;
        sensor.endDate = table.endDate ?? sensor.lastModified;
        // Only the Meteo table carries a GPS fix; the others leave it alone.
        if (table.position) Object.assign(this.buoy(), table.position);
        this.updateDates();

        return table;
      })
      .catch(err => {
        this.tables.delete(sensorId); // don't keep a rejected promise around - the next call should retry
        throw err;
      });

    this.tables.set(sensorId, promise);
    return promise;
  }

  // Rows for the buoy within [startDate, endDate] (both optional):
  // { '<ISO timestamp>': { '<SENSOR>': { <column>: value } } }. Values are the
  // logger's own columns and units - mapping 'Corr_WindS' onto WSPD and the
  // rest is DataProduct's job, not this one's.
  async getBuoyData(buoyId = BUOY_ID, startDate, endDate) {
    if (buoyId !== BUOY_ID) throw new Error(`Unknown buoy '${buoyId}' in ${this.src} - it only publishes ${BUOY_ID}`);

    const tables = await Promise.all(this.buoy().sensors.map(async sensor => [sensor.id, await this.loadTable(sensor.id)]));

    const rows = {};
    tables.forEach(([sensorId, table]) => {
      table.rows.forEach(({ date, values }) => {
        if (startDate && date < startDate) return;
        if (endDate && date > endDate) return;
        const timestamp = date.toISOString();
        if (rows[timestamp] == undefined) rows[timestamp] = {};
        rows[timestamp][sensorId] = { ...values }; // copied: the parsed table is cached and reused
      });
    });

    return rows;
  }

  // One TOA5 table -> { variables, metadata, rows, startDate, endDate, position }.
  // Rows come out in file order, which is chronological.
  parseTOA5(text) {
    const lines = text.trim().split(/\r?\n/); // the logger writes CRLF
    if (lines.length < 4) throw new Error('Unexpected TOA5 file: fewer than the four header lines');

    // "TOA5","BoiaSomorrostro_cr1000xs","CR1000X","27337","CR1000X.8.2.1","CPU:IcatmarBoiaBarcelona.CR1X","18906","Meteo"
    const [format, station, model, serial, osVersion, program, signature, table] = splitCSV(lines[0]);
    const metadata = {
      format, table_name: table, station_name: station,
      logger_model: model, logger_serial: serial, os_version: osVersion,
      program_name: program, program_signature: signature,
    };

    const names = splitCSV(lines[1]);
    const units = splitCSV(lines[2]);        // e.g. 'm/s', '°C', 'hPa' - blank where the logger declares none
    const aggregations = splitCSV(lines[3]); // 'Smp', 'Avg', 'Max', ... - blank on TIMESTAMP/RECORD

    const timeIndex = names.indexOf(TIMESTAMP_COLUMN);
    if (timeIndex < 0) throw new Error(`Unexpected TOA5 file: no ${TIMESTAMP_COLUMN} column`);

    // Same shape as the ERDDAP sources' variables ({ name: { attributes } }),
    // and 'units' is the attribute name ERDDAP uses too. TIMESTAMP is not one
    // of them - it becomes each row's date.
    const variables = {};
    names.forEach((name, i) => {
      if (i === timeIndex || !name) return;
      variables[name] = {};
      if (units[i]) variables[name].units = units[i];
      if (aggregations[i]) variables[name].aggregation = aggregations[i];
    });

    const rows = [];
    for (let i = 4; i < lines.length; i++) {
      const cells = splitCSV(lines[i]);
      if (cells.length < names.length) continue; // a row still being written when we downloaded the file

      const date = parseTimestamp(cells[timeIndex]);
      if (!date) continue;

      const values = {};
      names.forEach((name, j) => {
        if (j === timeIndex || !name) return;
        const value = parseValue(cells[j]);
        if (value !== undefined) values[name] = value;
      });
      this.dropFailedWind(values);

      rows.push({ date, values });
    }

    return {
      variables,
      metadata,
      rows,
      startDate: rows.length ? rows[0].date : undefined,
      endDate: rows.length ? rows[rows.length - 1].date : undefined,
      position: this.positionOf(rows),
    };
  }

  // Drops a row's whole wind block when the anemometer failed (see
  // MAX_WIND_SPEED) - the direction that comes with a 1000 m/s speed looks
  // perfectly ordinary, and would otherwise be drawn as a real bearing.
  dropFailedWind(values) {
    const failed = WIND_SPEED_COLUMNS.some(column => typeof values[column] === 'number' && values[column] > MAX_WIND_SPEED);
    if (failed) WIND_COLUMNS.forEach(column => delete values[column]);
  }

  // The buoy's position, from the most recent row that carries a GPS fix (the
  // logger writes NAN, or an out-of-range value while the receiver is still
  // acquiring). Undefined for a table without those columns.
  positionOf(rows) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const latitude = rows[i].values[LATITUDE_COLUMN];
      const longitude = rows[i].values[LONGITUDE_COLUMN];
      if (typeof latitude !== 'number' || typeof longitude !== 'number') continue;
      if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
      return { latitude, longitude };
    }
    return undefined;
  }

}

export default SourceGithubSOMO;
