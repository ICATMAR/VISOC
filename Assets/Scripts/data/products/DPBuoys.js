import DP from './DataProduct.js';
import SourceBuoys from '../sources/SourceBuoys.js';
import buoys from '../../../../Data/buoys/buoys.js'

// Fields that are merged one for one across sources - everything else on a
// buoy (its id, its sensors, its dates) is merged by rules of its own below.
const BUOY_FIELDS = ['name', 'latitude', 'longitude', 'institution', 'acknowledgement', 'license', 'distanceToCoast', 'depth'];
// Same, for a sensor
const SENSOR_FIELDS = ['variables', 'metadata', 'url'];
// Fields the static file owns outright, rather than only filling in when no
// source knows them: it is the curated catalogue of display names, and the
// sources' own labels are neither consistent nor meant to be read (the MSM API
// calls the Tordera buoy 'BLANES' and Cap de Creus 'CDCR (Cadaqués)'). Each
// source keeps its own name on its own buoy objects regardless.
const STATIC_FIELDS = ['name'];

// Copies over only what the target doesn't already know. First source to say
// something wins, so the order the catalogue lists them in is the order of
// preference - and a source that only knows part of a buoy (the MSM API has no
// institution, the SOMO repository no name) never blanks out what another one
// already filled in.
function fillMissing(target, source, fields) {
  fields.forEach(field => {
    if (target[field] == undefined && source[field] != undefined) target[field] = source[field];
  });
}

// The widest range the two of them cover. A source that only knows how fresh a
// buoy is (endDate, no startDate) can still push the end forward.
function widenDates(target, source) {
  if (source.startDate && (!target.startDate || source.startDate < target.startDate)) target.startDate = source.startDate;
  if (source.endDate && (!target.endDate || source.endDate > target.endDate)) target.endDate = source.endDate;
}


class DPBuoys extends DP {

  // Get buoys
  getBuoys() {
    // Return static buoy data
    return buoys;
  }

  // Get start-end dates per buoy
  // Maybe later will be updateBuoys?
  async loadBuoys() {
    // Iterate sources and wait until they are all loaded
    const sources = this.sources.filter(s => s instanceof SourceBuoys);
    await Promise.all(sources.map(s => s.loadingPromise.catch(error => {
      console.error('Error loading buoys source:', error);
    })));

    // Then merge datasets into one - the same buoy is usually covered by
    // several sources, each knowing a different part of it: the ERDDAP servers
    // hold the historical range and the sensors' variables (and can split one
    // buoy's sensors across both servers), the MSM API knows the position and
    // how fresh the data is, the SOMO repository runs ahead of all of them.
    // Merging keeps whichever source spoke first for each field, so the
    // catalogue's order is the order of preference.
    const buoysById = new Map();
    // Which sources know a given buoy, read by getBuoyData(). Every source
    // names it by the same id: the ones whose servers don't (the MSM API) do
    // that translation themselves, on the way out.
    this.providers = new Map();

    sources.forEach(source => {
      source.buoys.forEach(buoy => {
        if (!this.providers.has(buoy.id)) this.providers.set(buoy.id, []);
        this.providers.get(buoy.id).push(source);

        // Standard codes are worked out here, per source: the mapping that
        // turns 'Corr_WindS' into WSPD is the catalogue's, and each source has
        // its own.
        const sensors = buoy.sensors.map(sensor => ({ ...sensor, codes: this.sensorCodes(source, sensor) }));

        const merged = buoysById.get(buoy.id);
        if (!merged) buoysById.set(buoy.id, { ...buoy, sensors });
        else this.mergeBuoy(merged, { ...buoy, sensors });
      });
    });

    // The static file fills in what no source publishes (the buoy's name, its
    // depth, how far offshore it is) and is a fallback for whatever buoy the
    // sources didn't cover - including all of them, if every source failed.
    buoys.forEach(buoy => {
      const merged = buoysById.get(buoy.id);
      if (!merged) {
        buoysById.set(buoy.id, { ...buoy, sensors: [] }); // copied: the static list is shared, and callers write to what they get back
        return;
      }
      fillMissing(merged, buoy, BUOY_FIELDS);
      STATIC_FIELDS.forEach(field => { if (buoy[field] != undefined) merged[field] = buoy[field]; });
    });

    return [...buoysById.values()];
  }

  // Folds one source's view of a buoy into the merged one: fields it is the
  // first to know, sensors it is the first to report, and a date range widened
  // to cover both.
  mergeBuoy(merged, buoy) {
    fillMissing(merged, buoy, BUOY_FIELDS);
    widenDates(merged, buoy);

    buoy.sensors.forEach(sensor => {
      const existing = merged.sensors.find(s => s.id === sensor.id);
      if (!existing) {
        merged.sensors.push({ ...sensor });
        return;
      }
      // Same sensor from two sources - e.g. SOMO's CTD, which is on both
      // ERDDAP servers and in the repository. Keep what we have and take only
      // what it doesn't know yet.
      fillMissing(existing, sensor, SENSOR_FIELDS);
      widenDates(existing, sensor);
      // Codes are the exception: one source can publish a variable another
      // doesn't, so they add up instead of being filled in.
      existing.codes = [...new Set([...(existing.codes ?? []), ...(sensor.codes ?? [])])];
    });
  }

  // The names a sensor's records come back under once standardized: the
  // standard code of every variable the catalogue maps, and the raw name of
  // everything it doesn't cover (nothing is dropped for being unmapped).
  sensorCodes(source, sensor) {
    const names = Object.keys(sensor.variables ?? {});
    return [...new Set(names.map(name => this.standardCode(source, name, sensor.id)))];
  }

  // Measurements for one buoy within [startDate, endDate], in standard codes:
  // { '<ISO timestamp>': { '<SENSOR>': { <code>: value } } }.
  //
  // Every source that can serve them is asked - they cover different periods
  // (ERDDAP the history, the repository the last few hours) and different
  // sensors - and their rows are merged. Where two of them describe the same
  // sensor at the same timestamp, the one the catalogue lists first wins.
  async getBuoyData(buoyId, startDate, endDate) {
    await this.loadBuoys(); // fills this.providers

    const providers = (this.providers.get(buoyId) ?? []).filter(source => source.servesData);
    if (providers.length === 0) {
      console.log(`No source serves measurements for buoy '${buoyId}'`);
      return {};
    }

    const perSource = await Promise.all(providers.map(async source => {
      const rows = await source.getBuoyData(buoyId, startDate, endDate).catch(error => {
        console.error(`Error loading data of buoy '${buoyId}' from ${source.src}:`, error);
        return {};
      });
      return { source, rows };
    }));

    const data = {};
    perSource.forEach(({ source, rows }) => {
      Object.entries(rows).forEach(([timestamp, bySensor]) => {
        if (data[timestamp] == undefined) data[timestamp] = {};
        Object.entries(bySensor).forEach(([sensorId, values]) => {
          // Spread the standardized record UNDER what's already there, so a
          // later source only fills in codes no earlier one had.
          data[timestamp][sensorId] = { ...this.standardize(source, values, sensorId), ...data[timestamp][sensorId] };
        });
      });
    });

    return data;
  }
}



export default DPBuoys;
