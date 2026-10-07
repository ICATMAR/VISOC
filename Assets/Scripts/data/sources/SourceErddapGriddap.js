import SourceErddap from './SourceErddap.js';

// One gridded (griddap) ERDDAP dataset, read as TIME SERIES AT A POINT - what a
// forecast at a buoy needs, as opposed to a whole map. Shared by the forecast
// sources (SourceErddapWaveForecast, SourceErddapSeaSurfaceForecast), which
// only differ in which dataset and which variables they read.
//
// The catch with a point on a grid is the coast: the cell nearest a buoy can
// be land (masked, NaN everywhere) - e.g. Somorrostro, 2 km off Barcelona, on
// the 1 km sea surface grid. So a point is first resolved to the nearest SEA
// cell (see nearestValidCell), once per point, and the series is then read at
// that cell's exact coordinates.
//
// Metadata, variables and coverage come from SourceErddap.load(), same as any
// other ERDDAP dataset.

const DATA_TTL = 30;     // minutes a forecast response is reused for - a run is published once or twice a day
const DATA_TIMEOUT = 60; // seconds

// How far (degrees) around a point to look for a sea cell, tried in order -
// the first one that has any wins. Small first: most buoys are well offshore
// and their own cell is valid, so the first, cheapest box nearly always does.
const SEARCH_RADII = [0.05, 0.15, 0.4];

// Fill values that slip through as numbers instead of NaN (WAVEWATCH III's is
// 9.96921E36, ROMS' 1.0E20)
const MAX_VALID = 1e19;

// griddap wants whole seconds - '2026-09-03T00:00:00Z', not the milliseconds
// toISOString() adds.
const stamp = date => date.toISOString().substring(0, 19) + 'Z';


class SourceErddapGriddap extends SourceErddap {

  // `model` (an id), `label`, `institution`, `forcing`, `resolution`: what
  // this dataset is, as the catalogue describes it - carried onto every series
  // it returns, so a forecast value can always say which model produced it.
  // `variables`: the dataset's own variable names to read, overriding the
  // subclass' default list.
  constructor({ fetchManager, src, dataset, bbox, model, label, forcing, resolution, variables }) {
    super({ fetchManager, src, dataset, bbox });
    this.model = model ?? dataset;
    this.label = label ?? dataset;
    this.forcing = forcing;
    this.resolution = resolution;
    this.requestedVariables = variables;

    // point key -> Promise of { latitude, longitude } of its nearest sea cell
    // (or undefined if there is none nearby). Promises, so concurrent callers
    // share one search.
    this.cells = new Map();
  }

  // Variables read when the catalogue doesn't say - overridden per subclass
  defaultVariables() { return []; }

  // Variable used to tell sea from land when looking for the nearest cell -
  // any variable that is masked over land does.
  probeVariable() { return this.dataVariables()[0]; }

  dataVariables() {
    return this.requestedVariables ?? this.defaultVariables();
  }

  // A griddap variable's dimensions, in order - 'time, depth, latitude,
  // longitude' - read from the dataset's info (the 'Value' of its variable
  // row). parseERDDAPMetadata keeps attributes only, so this reads the same
  // (cached) info response again rather than changing that shared parser.
  async dimensionsOf(name) {
    if (this.dimensions == undefined) {
      const infoUrl = `${this.baseUrl}/info/${this.dataset}/index.jsonlKVP`;
      const text = await this.fetchManager.fetch(this.proxied(infoUrl)).then(res => res.text());
      this.dimensions = {};
      text.trim().split('\n').filter(line => line).forEach(line => {
        const row = JSON.parse(line);
        if (row['Row Type'] !== 'variable') return;
        this.dimensions[row['Variable Name']] = String(row['Value'] ?? '').split(',').map(d => d.trim()).filter(Boolean);
      });
    }
    // Default to the usual order, for a variable the info didn't describe
    return this.dimensions[name] ?? ['time', 'latitude', 'longitude'];
  }

  // A griddap selector for one variable: `selectors` gives the constraint for
  // time/latitude/longitude, every other dimension (depth) takes its first
  // index - the surface, for the datasets read here.
  async selectorFor(name, selectors) {
    const dimensions = await this.dimensionsOf(name);
    return name + dimensions.map(dimension => `[${selectors[dimension] ?? '0'}]`).join('');
  }

  // The nearest sea cell to a point (see the top of this file), searched once
  // per point and remembered.
  nearestValidCell(latitude, longitude) {
    const key = `${latitude},${longitude}`;
    if (!this.cells.has(key)) {
      const promise = this.searchValidCell(latitude, longitude).catch(error => {
        this.cells.delete(key); // don't keep a failed search - the next call should retry
        throw error;
      });
      this.cells.set(key, promise);
    }
    return this.cells.get(key);
  }

  async searchValidCell(latitude, longitude) {
    const probe = this.probeVariable();
    if (!probe) return undefined;

    for (const radius of SEARCH_RADII) {
      // The latest time step only - a land cell is land at every time step, so
      // one is enough to tell them apart.
      const selector = await this.selectorFor(probe, {
        time: '(last)',
        latitude: `(${latitude - radius}):(${latitude + radius})`,
        longitude: `(${longitude - radius}):(${longitude + radius})`,
      });
      const url = `${this.baseUrl}/griddap/${this.dataset}.csv?${selector}`;
      const text = await this.fetchManager.fetch(this.proxied(url), DATA_TTL, DATA_TIMEOUT).then(res => res.text());

      let best;
      SourceErddapGriddap.parseCSV(text).forEach(row => {
        if (!isFinite(row.values[probe])) return;
        // Equirectangular distance - plenty at a few km
        const dLat = row.latitude - latitude;
        const dLon = (row.longitude - longitude) * Math.cos(latitude * Math.PI / 180);
        const distance = dLat * dLat + dLon * dLon;
        if (best == undefined || distance < best.distance) best = { latitude: row.latitude, longitude: row.longitude, distance };
      });
      if (best) return { latitude: best.latitude, longitude: best.longitude, distanceKm: Math.sqrt(best.distance) * 111.2 };
    }

    console.log(`${this.constructor.name}: no sea cell of ${this.dataset} near ${latitude}, ${longitude}`);
    return undefined;
  }

  // Forecast at one point ({ latitude, longitude }) within [startDate,
  // endDate], as a list holding this dataset's one series:
  //
  //   [{ model, label, institution, forcing, resolution, cell, rows: { '<ISO>': { <variable>: value } } }]
  //
  // Same shape as SourceOpenMeteo's, so a forecast product can rank series
  // from either kind of source the same way. Empty when the dataset doesn't
  // reach the window or has no sea cell near the point. Values are raw, as the
  // dataset names them - standardizing is DataProduct's job.
  async getPointSeries(point, startDate, endDate) {
    await this.loadingPromise;

    // Only ask for the part of the window the dataset actually holds - griddap
    // errors on a time outside the axis rather than returning nothing.
    const from = new Date(Math.max(startDate.getTime(), this.startDate?.getTime() ?? -Infinity));
    const to = new Date(Math.min(endDate.getTime(), this.endDate?.getTime() ?? Infinity));
    if (from > to) return [];

    if (this.bbox) {
      const { minLat, minLon, maxLat, maxLon } = this.bbox;
      if (point.latitude < minLat || point.latitude > maxLat || point.longitude < minLon || point.longitude > maxLon) return [];
    }

    const cell = await this.nearestValidCell(point.latitude, point.longitude);
    if (!cell) return [];

    const selectors = {
      time: `(${stamp(from)}):1:(${stamp(to)})`,
      latitude: `(${cell.latitude})`,
      longitude: `(${cell.longitude})`,
    };
    const names = this.dataVariables().filter(name => this.variables?.[name] != undefined);
    const query = (await Promise.all(names.map(name => this.selectorFor(name, selectors)))).join(',');
    const url = `${this.baseUrl}/griddap/${this.dataset}.csv?${query}`;

    const text = await this.fetchManager.fetch(this.proxied(url), DATA_TTL, DATA_TIMEOUT).then(res => res.text());

    const rows = {};
    SourceErddapGriddap.parseCSV(text).forEach(row => {
      const values = {};
      names.forEach(name => { if (isFinite(row.values[name])) values[name] = row.values[name]; });
      if (Object.keys(values).length) rows[row.date.toISOString()] = values;
    });

    return [{
      model: this.model,
      label: this.label,
      institution: this.institution,
      forcing: this.forcing,
      resolution: this.resolution,
      dataset: this.dataset,
      cell,
      rows,
    }];
  }

  // griddap CSV: line 1 the column names, line 2 their units, then one row per
  // grid point - time, the dimensions, then each variable. Masked or fill
  // values come back as NaN.
  static parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 3) return [];

    const header = lines[0].split(',');
    const timeIndex = header.indexOf('time');
    const latIndex = header.indexOf('latitude');
    const lonIndex = header.indexOf('longitude');

    return lines.slice(2).map(line => {
      const cells = line.split(',');
      const values = {};
      header.forEach((name, i) => {
        if (i === timeIndex) return;
        const value = Number(cells[i]);
        values[name] = isFinite(value) && Math.abs(value) < MAX_VALID ? value : NaN;
      });
      return {
        date: timeIndex >= 0 ? new Date(cells[timeIndex]) : undefined,
        latitude: Number(cells[latIndex]),
        longitude: Number(cells[lonIndex]),
        values,
      };
    }).filter(row => row.date == undefined || !isNaN(row.date));
  }

}

export default SourceErddapGriddap;
