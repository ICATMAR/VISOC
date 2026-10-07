import Source from './Source.js';

// Multi-model atmospheric forecast at a buoy, through ICATMAR's own
// Open-Meteo wrapper - the same endpoint the boiasomorrostro wind display
// reads:
//
//   https://api.icatmar.cat/openMeteoAPI?buoy=<BUOY_ID>
//
// answering
//
//   { buoy, latitude, longitude, units: { WSPD: 'm/s', ... },
//     models: { 'AROME-HD': { lastRun, available, updateIntervalSeconds, temporalResolutionSeconds }, ... },
//     data: { '2026-10-07T00Z': { 'AROME-HD': { WSPD, WDIR, GSPD }, 'ECMWF-IFS025': {...}, ... }, ... } }
//
// Keyed by buoy id, not by coordinates: the wrapper keeps its own list of
// buoys and answers with an HTML usage page (not JSON) for an id it doesn't
// know. That is reported as "no forecast for this buoy", not as a failure.
//
// The variables already arrive under standard codes and units (WSPD/GSPD in
// m/s, WDIR in degrees), so the catalogue's mapping has nothing to do here
// unless that changes. Starts at 00Z of the current day and runs ~72 h ahead.
//
// CORS-enabled, so unlike the ERDDAP sources it is not requested through the
// ICATMAR proxy.

const DATA_TTL = 30;     // minutes a forecast response is reused for - the models update every 3-6 h
const DATA_TIMEOUT = 30; // seconds

// The wrapper's own keys are hours written without minutes - '2026-10-07T00Z'
// - which Date can't parse as they are.
function parseTimestamp(stamp) {
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2})(?::(\d{2}))?(?::(\d{2}))?Z$/.exec(String(stamp).trim());
  const date = parts
    ? new Date(`${parts[1]}T${parts[2]}:${parts[3] || '00'}:${parts[4] || '00'}Z`)
    : new Date(stamp);
  return isNaN(date) ? undefined : date;
}


class SourceOpenMeteo extends Source {

  // `models` is the catalogue's list of the models to use, IN ORDER OF
  // PREFERENCE: [{ id: 'AROME-HD', label, institution, resolution }, ...].
  // Every model the API serves but the list doesn't name is ignored.
  constructor({ fetchManager, src, models }) {
    super({ fetchManager });
    this.src = src;
    this.api = 'Open-Meteo'; // read by DataProducts.vue to label this source
    this.models = models ?? [];

    // Per-model run information (lastRun, update interval, ...) as the API
    // last returned it - shown alongside the forecast so the user knows how
    // old the run is.
    this.modelsMetadata = {};

    // Nothing to load up front: the buoy list lives on the API side, and the
    // forecast is only asked for when someone wants it.
    this.loadingPromise = Promise.resolve();
  }

  // Forecast for one point (a buoy - `id` is what the API is keyed by) within
  // [startDate, endDate], as one series per model, in the catalogue's order of
  // preference:
  //
  //   [{ model, label, institution, resolution, run, rows: { '<ISO>': { <variable>: value } } }, ...]
  //
  // Values are raw, as the API names them - standardizing is DataProduct's job.
  async getPointSeries(point, startDate, endDate) {
    const url = `${this.src}?buoy=${encodeURIComponent(point.id)}`;
    const text = await this.fetchManager.fetch(url, DATA_TTL, DATA_TIMEOUT)
      .then(res => res.text())
      .catch(error => {
        // An unknown buoy is answered with a 400 and the API's HTML usage page
        if (error.name === 'HTTPError' && (error.status === 400 || error.status === 404)) return undefined;
        throw error;
      });

    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      console.log(`SourceOpenMeteo: no forecast for '${point.id}' (the API does not know this buoy yet)`);
      return [];
    }

    Object.assign(this.modelsMetadata, json.models ?? {});
    this.variables = Object.fromEntries(Object.entries(json.units ?? {}).map(([name, units]) => [name, { units }]));

    const series = this.models.map(model => ({ ...model, model: model.id, run: json.models?.[model.id], rows: {} }));
    Object.entries(json.data ?? {}).forEach(([stamp, byModel]) => {
      const date = parseTimestamp(stamp);
      if (!date || !byModel) return;
      if (startDate && date < startDate) return;
      if (endDate && date > endDate) return;

      series.forEach(entry => {
        const values = byModel[entry.model];
        if (!values) return;
        const record = {};
        Object.entries(values).forEach(([name, value]) => {
          const number = Number(value);
          if (value != null && isFinite(number)) record[name] = number;
        });
        if (Object.keys(record).length) entry.rows[date.toISOString()] = record;
      });
    });

    // Coverage, discovered from what came back
    const dates = series.flatMap(entry => Object.keys(entry.rows)).sort();
    if (dates.length) {
      this.startDate = new Date(dates[0]);
      this.endDate = new Date(dates[dates.length - 1]);
    }

    return series;
  }

}

export default SourceOpenMeteo;
