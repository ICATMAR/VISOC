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
  // standard codes:
  //
  //   { data: { '<ISO>': { <code>: { value, model, source } } },
  //     series: [{ model, label, institution, forcing, resolution, cell, source,
  //                startDate, endDate, usedFrom, usedTo }],
  //     errors: [...] }
  //
  // `series` lists every series that came back, ranked, with the part of the
  // window each one actually supplied (usedFrom/usedTo, undefined if it was
  // never needed) - what an info panel uses to say which model is shown when.
  async getPointForecast(point, startDate, endDate) {
    const errors = [];

    const perSource = await Promise.all(this.sources.map(async source => {
      const series = await source.getPointSeries(point, startDate, endDate).catch(error => {
        errors.push(`${source.dataset ?? source.src}: ${error.message ?? error}`);
        console.error(`Error loading the forecast at '${point.id ?? `${point.latitude}, ${point.longitude}`}' from ${source.dataset ?? source.src}:`, error);
        return [];
      });
      return series.map(entry => ({ ...entry, source }));
    }));
    const ranked = perSource.flat();

    const data = {};
    const series = ranked.map(entry => {
      const timestamps = Object.keys(entry.rows).sort();
      return {
        model: entry.model, label: entry.label, institution: entry.institution ?? entry.source.institution,
        forcing: entry.forcing, resolution: entry.resolution, cell: entry.cell, run: entry.run,
        dataset: entry.dataset, source: entry.source.src,
        startDate: timestamps.length ? new Date(timestamps[0]) : undefined,
        endDate: timestamps.length ? new Date(timestamps[timestamps.length - 1]) : undefined,
        usedFrom: undefined, usedTo: undefined,
      };
    });

    // Best-ranked first, so a code a timestamp already has is never
    // overwritten. A code the better series doesn't carry at all (GFS has no
    // gusts) can still be filled by a later one - each value says which model
    // it came from.
    ranked.forEach((entry, index) => {
      Object.entries(entry.rows).forEach(([timestamp, values]) => {
        const record = this.derive(this.standardize(entry.source, values));
        if (data[timestamp] == undefined) data[timestamp] = {};
        let supplied = false;
        Object.entries(record).forEach(([code, value]) => {
          if (value == undefined || !isFinite(value) || data[timestamp][code] != undefined) return;
          data[timestamp][code] = { value, model: entry.model, source: entry.source.src };
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
