import DP from './DataProduct.js';

// Shared base for the forecast products read AT A POINT (a buoy):
// DPWindForecast, DPWaveForecast and DPSeaSurfaceForecast.
//
// Each of their sources answers getPointSeries(point, startDate, endDate) with
// one or more SERIES - one per model it serves - in its own order of
// preference (see SourceOpenMeteo, SourceErddapGriddap):
//
//   [{ model, label, institution, ..., rows: { '<ISO>': { <raw name>: value } } }]
//
// and the product ranks them all by that order: the catalogue's order of
// sources first, then each source's own order of models. At every timestamp
// the best-ranked series that has a value wins. That is what "AROME first,
// then ECMWF" means in practice: AROME only reaches a day or two ahead, so the
// higher-resolution model covers what it can and the longer one takes over
// where it stops, without any date being hardcoded.
class DPForecast extends DP {

  // Forecast at one point - { id, latitude, longitude } (sources keyed by buoy
  // use the id, gridded ones the position) - within [startDate, endDate], in
  // standard codes, every source merged into one answer (what a buoy's cells
  // show - see getPointSeriesBySource for each source on its own):
  //
  //   { data: { '<ISO>': { <code>: { value, model, source, rawName, derivedFrom } } },
  //     series: [{ model, label, institution, forcing, resolution, cell, source,
  //                startDate, endDate, usedFrom, usedTo }],
  //     errors: [...] }
  //
  // `series` lists every series that came back, ranked, with the part of the
  // window each one actually supplied (usedFrom/usedTo, undefined if it was
  // never needed) - what an info panel uses to say which model is shown when.
  //
  // `options` is handed to every source as it is - { interval } asks the
  // sources that serve several time steps (SourceCMEMS) for one of them; the
  // others ignore it.
  async getPointForecast(point, startDate, endDate, options) {
    const { ranked, errors } = await this.fetchRanked(point, startDate, endDate, options);

    const data = {};
    const series = ranked.map(entry => this.describeSeries(entry));

    // Best-ranked first, so a code a timestamp already has is never
    // overwritten. A code the better series doesn't carry at all (GFS has no
    // gusts) can still be filled by a later one - each value says which model
    // it came from.
    ranked.forEach((entry, index) => {
      Object.entries(this.standardizedRecords(entry)).forEach(([timestamp, record]) => {
        if (data[timestamp] == undefined) data[timestamp] = {};
        let supplied = false;
        Object.entries(record).forEach(([code, value]) => {
          if (data[timestamp][code] != undefined) return;
          data[timestamp][code] = value;
          supplied = true;
        });
        if (!supplied) return;
        const summary = series[index];
        const date = new Date(timestamp);
        if (summary.usedFrom == undefined || date < summary.usedFrom) summary.usedFrom = date;
        if (summary.usedTo == undefined || date > summary.usedTo) summary.usedTo = date;
      });
    });

    return { data, series, errors };
  }

  // Every source's series at one point, each on its own instead of merged -
  // what a comparison of the models needs (DTHFRCompare). Only the series
  // with data within the window, in the same ranking as getPointForecast:
  //
  //   { series: [{ model, label, institution, ..., startDate, endDate,
  //                data: { '<ISO>': { <code>: { value, model, source, rawName, derivedFrom } } } }],
  //     errors: [...] }
  async getPointSeriesBySource(point, startDate, endDate, options) {
    const { ranked, errors } = await this.fetchRanked(point, startDate, endDate, options);
    const series = ranked
      .map(entry => ({ ...this.describeSeries(entry), data: this.standardizedRecords(entry) }))
      .filter(entry => Object.keys(entry.data).length);
    return { series, errors };
  }

  // Every source's series, in ranking order - the catalogue's order of
  // sources first, then each source's own order of models - each with the
  // source it came from. A source that fails is reported in `errors` and
  // skipped, so the others still answer.
  async fetchRanked(point, startDate, endDate, options) {
    const errors = [];
    const perSource = await Promise.all(this.sources.map(async source => {
      const series = await source.getPointSeries(point, startDate, endDate, options).catch(error => {
        errors.push(`${source.dataset ?? source.src}: ${error.message ?? error}`);
        console.error(`Error loading the forecast at '${point.id ?? `${point.latitude}, ${point.longitude}`}' from ${source.dataset ?? source.src}:`, error);
        return [];
      });
      return series.map(entry => ({ ...entry, source }));
    }));
    return { ranked: perSource.flat(), errors };
  }

  // What a series is, without its values
  describeSeries(entry) {
    const timestamps = Object.keys(entry.rows).sort();
    return {
      model: entry.model, label: entry.label, institution: entry.institution ?? entry.source.institution,
      forcing: entry.forcing, resolution: entry.resolution, cell: entry.cell, run: entry.run,
      interval: entry.interval, statistic: entry.statistic,
      dataset: entry.dataset, datasets: entry.datasets, source: entry.source.src,
      // Who serves it, as opposed to who runs the model: the source's own
      // institution, and the API's name for an API (Open-Meteo)
      provider: entry.source.institution, api: entry.source.api,
      startDate: timestamps.length ? new Date(timestamps[0]) : undefined,
      endDate: timestamps.length ? new Date(timestamps[timestamps.length - 1]) : undefined,
      usedFrom: undefined, usedTo: undefined,
    };
  }

  // A series' rows in standard codes, each value saying where it came from:
  // { '<ISO>': { <code>: { value, model, source, rawName, derivedFrom } } }.
  // Codes without a finite value are left out, and so is a timestamp left
  // with none.
  standardizedRecords(entry) {
    const records = {};
    Object.entries(entry.rows).forEach(([timestamp, values]) => {
      const record = this.derive(this.standardize(entry.source, values));
      // Which of the source's own names each code came from ('hs' for
      // VHM0) - a code with none was computed (see derive) from the record
      const rawNames = {};
      Object.keys(values).forEach(name => {
        const code = this.standardCode(entry.source, name);
        if (rawNames[code] == undefined) rawNames[code] = name;
      });
      const codes = {};
      Object.entries(record).forEach(([code, value]) => {
        if (value == undefined || !isFinite(value)) return;
        codes[code] = {
          value, model: entry.model, source: entry.source.src,
          rawName: rawNames[code], derivedFrom: rawNames[code] ? undefined : Object.keys(values),
        };
      });
      if (Object.keys(codes).length) records[timestamp] = codes;
    });
    return records;
  }

  // Codes computed from others once a record is standardized - e.g. wind
  // speed and direction from its components (see DPWindForecast). Products
  // whose sources all publish what they need leave it as it is.
  derive(record) {
    return record;
  }

  // Who produces what this product shows - the institution behind each source
  // and, for a model forced by another (WAVEWATCH III forced by AROME), the
  // institution behind the forcing too. [{ name, role }], deduplicated.
  institutions() {
    const list = [];
    const add = (name, role) => {
      if (name && !list.some(entry => entry.name === name && entry.role === role)) list.push({ name, role });
    };
    this.sources.forEach(source => {
      (source.models ?? []).forEach(model => add(model.institution, `${model.label ?? model.id} (${this.name.toLowerCase()})`));
      if (source.api) add(source.api, `forecast API (${this.name.toLowerCase()})`);
      else add(source.institution, `${source.label ?? source.dataset} (${this.name.toLowerCase()})`);
      if (source.forcing) add(source.forcing.institution, `${source.forcing.model} forcing (${this.name.toLowerCase()})`);
    });
    return list;
  }

}

export default DPForecast;
