import SourceBuoys from './SourceBuoys.js';
import SourceErddap from './SourceErddap.js';

// Every source has to report a buoy, and each of its sensors, under the same id
// as the others, otherwise DPBuoys merges nothing and the same mooring shows up
// twice - that matters for the buoys carried by both this server and the MSM
// API (CDCR, TORT, TARR, TORD). These two tables are this server's half of that
// agreement; the MSM API's half is BUOY_IDS/SENSOR_IDS in SourceMSMAPI.js.
//
// Keyed by the dataset id's own name (BUOY_<name>_<sensor>), and anything not
// listed is already the id everything else uses and passes through untouched.
const BUOY_IDS = {
  // Empty: this server's buoy ids are the ones everything else follows. An
  // entry here is only needed if a dataset ever spells one differently.
};

const SENSOR_IDS = {
  WAVE: 'WAVES',    // both spellings are in use, and they are the same sensor
  YOUN: 'RM_YOUNG', // the MSM API spells the same anemometer out in full
};

const DATA_TIMEOUT = 60; // seconds for one tabledap query
// Minutes a tabledap response is reused for. Has to be a real number rather
// than left open: DPBuoys re-asks for the block that is still filling on every
// poll, and this is what decides how often that becomes an actual request.
const DATA_TTL = 5;

// tabledap wants whole seconds - '2026-09-03T00:00:00Z', not the milliseconds
// toISOString() adds.
const stamp = date => date.toISOString().substring(0, 19) + 'Z';

class SourceErddapBuoys extends SourceBuoys {

  constructor({ fetchManager, src, datasetCommonKey }) {
    super({ fetchManager });
    this.src = src;
    this.baseUrl = src.replace(/\/index\.html$/, '');
    this.datasetCommonKey = datasetCommonKey;
    this.servesData = true;

    // this.buoys (see SourceBuoys) is filled in by load(): id, array of sensors
    // (metadata, variables...), lat-long, institution, acknowledgement
    this.loadingPromise = this.load();
  }

  async load() {
    // allDatasets.jsonlKVP lists every dataset on the server. Every buoy
    // dataset ID follows datasetCommonKey_<name>_<sensor> (e.g.
    // BUOY_MEDES_ADCP, BUOY_SOMO_CTD, ...)
    const allDatasets = await SourceErddap.fetchAllDatasets(this.fetchManager, this.baseUrl);
    const buoyDatasets = allDatasets.filter(d => d['datasetID'].startsWith(this.datasetCommonKey));

    // Fetch every sensor's info in parallel, but only group them into buoys
    // afterward, synchronously - doing the grouping inside the parallel map
    // risks two sensors of the same buoy both seeing no entry yet and each
    // creating their own, instead of sharing one.
    const sensorEntries = await Promise.all(buoyDatasets.map(async d => {
      const dataset = d['datasetID'];
      const withoutPrefix = dataset.slice(this.datasetCommonKey.length);
      const lastUnderscore = withoutPrefix.lastIndexOf('_');
      const datasetName = withoutPrefix.slice(0, lastUnderscore); // buoy, e.g. 'MONTGO'
      const datasetSensor = withoutPrefix.slice(lastUnderscore + 1); // sensor, e.g. 'ADCP'
      const name = BUOY_IDS[datasetName] ?? datasetName;
      const sensorId = SENSOR_IDS[datasetSensor] ?? datasetSensor;

      const infoUrl = `${this.baseUrl}/info/${dataset}/index.jsonlKVP`;
      const infoText = await this.fetchManager.fetch(SourceErddap.proxied(infoUrl)).then(res => res.text());
      const { variables, metadata } = this.parseERDDAPMetadata(infoText);

      const sensor = {
        id: sensorId,
        // Which dataset(s) this sensor's data actually lives in - needed to
        // build a tabledap query, and not derivable from the sensor id once
        // SENSOR_IDS has renamed it (WAVE -> WAVES) or two datasets have been
        // folded into one sensor.
        datasets: [dataset],
        variables: SourceErddapBuoys.stripSensorSuffix(variables, datasetSensor, dataset),
        metadata,
        startDate: metadata['time_coverage_start'] ? new Date(metadata['time_coverage_start']) : undefined,
        endDate: metadata['time_coverage_end'] ? new Date(metadata['time_coverage_end']) : undefined,
      };

      return { name, sensor };
    }));

    const buoysByName = new Map();
    sensorEntries.forEach(({ name, sensor }) => {
      if (!buoysByName.has(name)) {
        // lat/long, institution, acknowledgement and license are per-dataset
        // NC_GLOBAL attributes, but are expected to be the same across every
        // sensor of a buoy - taken from whichever sensor is processed first.
        const { metadata } = sensor;
        buoysByName.set(name, {
          id: name,
          sensors: [],
          latitude: metadata['nominal_latitude'] ? Number(metadata['nominal_latitude']) : undefined,
          longitude: metadata['nominal_longitude'] ? Number(metadata['nominal_longitude']) : undefined,
          institution: metadata['institution'],
          acknowledgement: metadata['acknowledgement'],
          license: metadata['license'],
        });
      }
      // Two datasets can describe the same sensor - both spellings of the wave
      // sensor land on WAVES (see SENSOR_IDS) - so they are folded into one
      // entry rather than showing up twice on the buoy.
      const sensors = buoysByName.get(name).sensors;
      const existing = sensors.find(s => s.id === sensor.id);
      if (existing) SourceErddapBuoys.mergeSensor(existing, sensor);
      else sensors.push(sensor);
    });

    // Each buoy's own startDate/endDate - earliest/latest among its sensors.
    this.buoys = [...buoysByName.values()].map(buoy => ({ ...buoy, ...SourceBuoys.dateRangeOf(buoy.sensors) }));

    const { startDate, endDate } = this.dateRange();
    this.startDate = startDate;
    this.endDate = endDate;
    this.coverageCheckedAt = Date.now(); // loading is itself a coverage check
  }

  // Re-reads every dataset's minTime/maxTime and pushes them back onto the
  // sensors. One request for the whole server (allDatasets), which is why the
  // coverage check is cheap enough to do before every data request that has
  // gone stale - see SourceBuoys.getEndDate().
  async refreshCoverage() {
    const allDatasets = await SourceErddap.fetchAllDatasets(this.fetchManager, this.baseUrl);
    const byDataset = new Map(allDatasets.map(d => [d['datasetID'], d]));

    this.buoys.forEach(buoy => {
      buoy.sensors.forEach(sensor => {
        (sensor.datasets ?? []).forEach(dataset => {
          const row = byDataset.get(dataset);
          if (!row) return;
          if (row['minTime']) sensor.startDate = new Date(row['minTime']);
          if (row['maxTime']) sensor.endDate = new Date(row['maxTime']);
        });
      });
      Object.assign(buoy, SourceBuoys.dateRangeOf(buoy.sensors));
    });

    const { startDate, endDate } = this.dateRange();
    this.startDate = startDate;
    this.endDate = endDate;
  }

  // Measurements for one buoy within [startDate, endDate]:
  // { '<ISO timestamp>': { '<SENSOR>': { <variable>: value } } }, keyed by the
  // variable names this source publishes (suffix already stripped, see
  // stripSensorSuffix) rather than by standard code - mapping those is
  // DataProduct's job.
  //
  // `sensors` narrows what is asked for: { '<SENSOR>': ['WSPD', 'WDIR'] },
  // omitted meaning every sensor and every column. Worth passing - tabledap is
  // queried per dataset, and four columns of one sensor is a far smaller
  // response than every column of every sensor the buoy has.
  async getBuoyData(buoyId, startDate, endDate, { sensors } = {}) {
    const buoy = this.getBuoy(buoyId);
    if (!buoy) throw new Error(`Unknown buoy '${buoyId}' in ${this.src}`);

    const wantedSensors = sensors ? buoy.sensors.filter(s => sensors[s.id]) : buoy.sensors;

    // One query per dataset, not per sensor: a sensor's columns can come from
    // more than one dataset (see mergeSensor), and each tabledap request can
    // only name one.
    const queries = [];
    wantedSensors.forEach(sensor => {
      const wanted = sensors?.[sensor.id] ?? Object.keys(sensor.variables ?? {});
      const byDataset = new Map();
      wanted.forEach(name => {
        const attributes = sensor.variables?.[name];
        if (!attributes) return; // this sensor doesn't publish it
        const dataset = attributes.dataset ?? sensor.datasets?.[0];
        if (!dataset) return;
        if (!byDataset.has(dataset)) byDataset.set(dataset, []);
        // rawName is the column as ERDDAP spells it, suffix and all
        byDataset.get(dataset).push({ name, column: attributes.rawName ?? name });
      });
      byDataset.forEach((columns, dataset) => queries.push({ sensor, dataset, columns }));
    });

    const results = await Promise.all(queries.map(query => this.fetchQuery(query, startDate, endDate)));

    const rows = {};
    results.forEach(result => {
      Object.entries(result).forEach(([timestamp, values]) => {
        if (rows[timestamp] == undefined) rows[timestamp] = {};
        rows[timestamp][values.sensorId] = { ...rows[timestamp][values.sensorId], ...values.values };
      });
    });

    return rows;
  }

  // One tabledap CSV request:
  //   <base>/tabledap/<dataset>.csv?time,WSPD,WDIR&time>=...&time<=...
  // Answers { '<ISO>': { sensorId, values: { name: value } } }. ERDDAP replies
  // 404 when a query matches no rows at all (not 200 with an empty body), which
  // means "nothing in that window", not a failure.
  async fetchQuery({ sensor, dataset, columns }, startDate, endDate) {
    const url = `${this.baseUrl}/tabledap/${dataset}.csv`
      + `?time,${columns.map(c => c.column).join(',')}`
      + `&time>=${stamp(startDate)}&time<=${stamp(endDate)}`;

    const text = await this.fetchManager.fetch(SourceErddap.proxied(url), DATA_TTL, DATA_TIMEOUT)
      .then(res => res.text())
      .catch(error => {
        if (error.name === 'HTTPError' && error.status === 404) return undefined; // no rows in range
        throw error;
      });
    if (text == undefined) return {};

    return SourceErddapBuoys.parseCSV(text, sensor.id, columns);
  }

  // ERDDAP CSV: line 1 the column names, line 2 their units, then one row per
  // timestamp. Missing values arrive as NaN or as an empty cell and are
  // dropped, so a gap stays a gap instead of being read as a real 0.
  static parseCSV(text, sensorId, columns) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 3) return {}; // header and units only - no rows

    const header = lines[0].split(',');
    const timeIndex = header.indexOf('time');
    if (timeIndex < 0) throw new Error(`Unexpected ERDDAP CSV: no time column in ${header.join(',')}`);

    const rows = {};
    lines.slice(2).forEach(line => {
      const cells = line.split(',');
      const date = new Date(cells[timeIndex]);
      if (isNaN(date)) return;

      const values = {};
      columns.forEach(({ name, column }) => {
        const cell = cells[header.indexOf(column)];
        if (cell == undefined) return;
        const value = Number(cell.trim());
        if (cell.trim() === '' || !isFinite(value)) return;
        values[name] = value;
      });
      if (Object.keys(values).length === 0) return;

      rows[date.toISOString()] = { sensorId, values };
    });

    return rows;
  }

  // Folds a second dataset's view of a sensor into the first: its variables
  // are added (the first dataset's win on a name they share), the datasets it
  // covers are recorded alongside, and the coverage grows to whichever of the
  // two starts earliest and ends latest. The first one's metadata is kept
  // as-is - it is one instrument, described twice.
  static mergeSensor(sensor, other) {
    console.warn(`SourceErddapBuoys: merging sensor ${sensor.id} with another dataset's view of it ${other.id}`);
    Object.entries(other.variables).forEach(([name, attributes]) => {
      if (sensor.variables[name] == undefined) sensor.variables[name] = attributes;
    });
    sensor.datasets = [...new Set([...(sensor.datasets ?? []), ...(other.datasets ?? [])])];
    if (other.startDate && (!sensor.startDate || other.startDate < sensor.startDate)) sensor.startDate = other.startDate;
    if (other.endDate && (!sensor.endDate || other.endDate > sensor.endDate)) sensor.endDate = other.endDate;
  }

  // ERDDAP suffixes a dataset's variables with its own sensor name - the WAVE
  // dataset's significant wave height is SWHT_WAVE - which says nothing the
  // sensor id doesn't already say, and stops the same measurement lining up
  // across sensors and sources. Dropped here, so the catalogue's mapping only
  // ever has to know SWHT. A variable that already exists unsuffixed keeps its
  // own entry rather than being overwritten by the suffixed one.
  //
  // `rawName` and `dataset` are recorded alongside because a tabledap query has
  // to name the column exactly as ERDDAP spells it, in the dataset that holds
  // it - neither of which survives the renaming (see fetchQuery).
  static stripSensorSuffix(variables, sensor, dataset) {
    const suffix = `_${sensor}`.toUpperCase();

    const renamed = {};
    Object.entries(variables).forEach(([name, attributes]) => {
      const bare = name.toUpperCase().endsWith(suffix) ? name.slice(0, -suffix.length) : name;
      const key = bare && renamed[bare] == undefined ? bare : name;
      renamed[key] = { ...attributes, rawName: name, dataset };
    });

    return renamed;
  }

}

export default SourceErddapBuoys;
