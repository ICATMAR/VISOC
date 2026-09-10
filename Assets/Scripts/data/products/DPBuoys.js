import DP from './DataProduct.js';
import SourceBuoys from '../sources/SourceBuoys.js';
import buoys from '../../../../Data/buoys/buoys.js'

// Fields that are merged one for one across sources - everything else on a
// buoy (its id, its sensors, its dates) is merged by rules of its own below.
const BUOY_FIELDS = ['name', 'latitude', 'longitude', 'institution', 'acknowledgement', 'license', 'distanceToCoast', 'depth'];
// Same, for a sensor - kept atomic (first source wins outright), unlike
// 'variables' below which is merged key by key instead. 'metadata' is
// deliberately atomic: ERDDAP's dataset-level attributes (institution,
// nominal position, time_coverage_*) are what the app wants to show, and the
// catalogue lists the ERDDAP sources before the others for exactly that
// reason - a source with only file-format metadata (SourceGithubSOMO's TOA5
// header: logger model/serial, program name) shouldn't paper over that.
const SENSOR_FIELDS = ['metadata', 'url'];
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

// Whether an entry (a sensor) could hold anything inside [startDate, endDate].
// Deliberately permissive: a bound the source doesn't publish counts as "might
// reach", not "doesn't" - the MSM API never publishes a startDate at all (see
// SourceMSMAPI), so requiring proof of coverage would rule it out of every
// query.
function overlapsRange(entry, startDate, endDate) {
  if (entry.endDate && entry.endDate < startDate) return false;
  if (entry.startDate && entry.startDate > endDate) return false;
  return true;
}

// Whether an entry provably spans the whole of [startDate, endDate] - both its
// own bounds have to be known, so a source that doesn't publish coverage can
// overlap but never "cover".
function coversRange(entry, startDate, endDate) {
  return Boolean(entry.startDate && entry.endDate
    && entry.startDate <= startDate && entry.endDate >= endDate);
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

        // Standardized here, per source - the mapping that turns 'Corr_WindS'
        // into WSPD is the catalogue's, and each source has its own. This is
        // what makes the merge below collapse SOMO's raw RH and ERDDAP's
        // already-standard RELH into one RELH entry instead of two.
        const sensors = buoy.sensors.map(sensor => ({ ...sensor, variables: this.standardizeVariables(source, sensor) }));

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
      // variables is the exception to "first source wins": one source can
      // publish a standard code another doesn't (e.g. ERDDAP's tabledap
      // columns are a subset of the SOMO logger's own), so they add up
      // instead of being filled in. Keyed by standard code (see
      // standardizeVariables), so a code both sources declare - SOMO's raw RH
      // and ERDDAP's already-standard RELH, once both are resolved - lands on
      // one entry instead of two; whichever source's attributes were recorded
      // first are kept.
      existing.variables = { ...(sensor.variables ?? {}), ...(existing.variables ?? {}) };
    });
  }

  // A sensor's variables, re-keyed from the source's raw names to standard
  // codes (the raw name of anything the catalogue doesn't map, same as
  // DataProduct.standardCode() - nothing is dropped for being unmapped). Each
  // code keeps its raw column's own attributes (units, aggregation, ...).
  // Two raw names that resolve to the same code - SOMO's RH and ERDDAP's
  // already-standard RELH, say - collapse into one entry; the first one seen
  // keeps its attributes, so the merge in mergeBuoy only ever adds entries,
  // never overwrites.
  standardizeVariables(source, sensor) {
    const variables = {};
    Object.entries(sensor.variables ?? {}).forEach(([name, attributes]) => {
      const code = this.standardCode(source, name, sensor.id);
      if (variables[code] == undefined) variables[code] = attributes;
    });
    return variables;
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

  // Which standard codes a source's sensor publishes, and under which of its
  // OWN variable names - the inverse of standardizeVariables(), needed because
  // a request has to name the source's columns ('Corr_WindS'), not the code
  // they map to (WSPD). First name wins on a collision, same as there.
  publishedNamesByCode(source, sensor) {
    const names = {};
    Object.keys(sensor.variables ?? {}).forEach(name => {
      const code = this.standardCode(source, name, sensor.id);
      if (names[code] == undefined) names[code] = name;
    });
    return names;
  }

  // Every source/sensor that could answer for each requested code, ranked -
  // { [buoyId]: { [code]: [{ source, sensorId, name, covers }, ...] } }.
  //
  // Pure: it reads the coverage and variable lists the sources already hold
  // (refreshed by getEndDate() before this runs), so choosing where to ask
  // costs no requests of its own. Ranked by whether a candidate provably spans
  // the whole window first, then by the order the catalogue lists the sources -
  // but only as a STARTING order: a candidate that then fails, or turns out to
  // hold nothing for the window, is dropped in favour of the next one (see
  // fetchBuoyVariables), so a source that has fallen behind loses on what it
  // actually returns rather than on an assumption about its role.
  planVariablesData(codes, startDate, endDate) {
    const wanted = new Set(codes);
    const byBuoy = {};
    const warnings = [];

    this.providers.forEach((sources, buoyId) => {
      const candidatesByCode = {};

      sources.forEach((source, sourceIndex) => {
        if (!source.servesData) return; // metadata only - nothing to request
        const buoy = source.getBuoy(buoyId);
        if (!buoy) return;

        buoy.sensors.forEach(sensor => {
          // A source that dates the buoy but not its sensors (the MSM API)
          // still has usable coverage - fall back to the buoy's own.
          const coverage = {
            startDate: sensor.startDate ?? buoy.startDate,
            endDate: sensor.endDate ?? buoy.endDate,
          };
          if (!overlapsRange(coverage, startDate, endDate)) return;

          const names = this.publishedNamesByCode(source, sensor);
          Object.entries(names).forEach(([code, name]) => {
            if (!wanted.has(code)) return;
            if (candidatesByCode[code] == undefined) candidatesByCode[code] = [];
            candidatesByCode[code].push({
              source, sourceIndex, sensorId: sensor.id, name,
              covers: coversRange(coverage, startDate, endDate),
            });
          });
        });
      });

      Object.entries(candidatesByCode).forEach(([code, candidates]) => {
        candidates.sort((a, b) => (b.covers - a.covers) || (a.sourceIndex - b.sourceIndex));

        // Two DIFFERENT instruments on one buoy reporting the same code is
        // ambiguous and worth saying out loud - the wind on SOMO's METEO table
        // and on its RM_YOUNG sensor are not the same measurement. The same
        // sensor id from several sources is not: that is one instrument two
        // servers both carry, which is the whole point of merging them.
        const sensorIds = [...new Set(candidates.map(c => c.sensorId))];
        if (sensorIds.length > 1) {
          warnings.push(`Buoy '${buoyId}': ${code} is published by more than one sensor (${sensorIds.join(', ')}) - using ${candidates[0].sensorId}`);
        }
      });

      if (Object.keys(candidatesByCode).length) byBuoy[buoyId] = candidatesByCode;
    });

    return { byBuoy, warnings };
  }

  // Measurements for every buoy, for a set of standard codes, within a window.
  //
  // Returns as soon as the plan is made, handing back ONE PROMISE PER BUOY so
  // the caller can render each row as its data lands instead of waiting for
  // the slowest server:
  //
  //   { codes, startDate, endDate, warnings, promises: [Promise, ...] }
  //
  // and each of those promises resolves to
  //
  //   { buoyId, data: { '<ISO>': { <code>: { value, sensor, source } } },
  //     used: { <code>: { source, sensor } }, missing: [<code>], errors: [...] }
  //
  // Every value carries the sensor and source it came from, so a point on a
  // chart can always be traced back to the instrument and server that served
  // it.
  async getVariablesData(codes, startDate, endDate) {
    await this.loadBuoys(); // fills this.providers and the per-source sensor metadata

    // Ask every source how far it currently reaches BEFORE deciding who to
    // request from - re-asking the server only where its last answer has gone
    // stale (see SourceBuoys.getEndDate). A source that can't answer keeps
    // whatever coverage it had; it just competes with stale numbers.
    const sources = [...new Set([...this.providers.values()].flat())].filter(source => source.servesData);
    await Promise.all(sources.map(source => source.getEndDate().catch(error => {
      console.error(`Could not check how fresh ${source.src} is:`, error);
    })));

    const { byBuoy, warnings } = this.planVariablesData(codes, startDate, endDate);
    warnings.forEach(warning => console.warn(warning));

    const promises = Object.entries(byBuoy).map(([buoyId, candidatesByCode]) =>
      this.fetchBuoyVariables(buoyId, candidatesByCode, startDate, endDate));

    return { codes: [...codes], startDate, endDate, warnings, promises };
  }

  // One buoy's values, working down each code's ranked candidates until one
  // actually delivers. Rounds rather than one pass: the best candidate per code
  // is grouped by source so each source is asked once (its own getBuoyData
  // splits that into per-dataset/per-table requests as needed), and whatever a
  // round fails to produce - the request threw, or came back with nothing for
  // that code - falls through to the next candidate on the next round. That is
  // what makes a server going down mid-session a non-event, and what stops a
  // source that has silently fallen behind from shadowing one that hasn't.
  async fetchBuoyVariables(buoyId, candidatesByCode, startDate, endDate) {
    const pending = new Map(Object.entries(candidatesByCode).map(([code, candidates]) => [code, [...candidates]]));
    const data = {};
    const used = {};
    const errors = [];

    while (pending.size > 0) {
      // Group this round's leading candidates by source: one request each.
      const groups = new Map();
      pending.forEach((candidates, code) => {
        const candidate = candidates[0];
        if (candidate == undefined) return;
        if (!groups.has(candidate.source)) groups.set(candidate.source, { sensors: {}, codes: [] });
        const group = groups.get(candidate.source);
        if (group.sensors[candidate.sensorId] == undefined) group.sensors[candidate.sensorId] = [];
        if (!group.sensors[candidate.sensorId].includes(candidate.name)) group.sensors[candidate.sensorId].push(candidate.name);
        group.codes.push({ code, sensorId: candidate.sensorId });
      });
      if (groups.size === 0) break;

      const results = await Promise.all([...groups].map(async ([source, group]) => {
        const rows = await source.getBuoyData(buoyId, startDate, endDate, { sensors: group.sensors })
          .catch(error => {
            errors.push(`Buoy '${buoyId}' from ${source.src}: ${error.message ?? error}`);
            console.error(`Error loading ${group.codes.map(c => c.code).join(', ')} of buoy '${buoyId}' from ${source.src}:`, error);
            return undefined; // fall through to the next candidate below
          });
        return { source, group, rows };
      }));

      const delivered = new Set();
      results.forEach(({ source, group, rows }) => {
        if (rows == undefined) return; // request failed - nothing delivered
        Object.entries(rows).forEach(([timestamp, bySensor]) => {
          Object.entries(bySensor).forEach(([sensorId, values]) => {
            const standardized = this.standardize(source, values, sensorId);
            group.codes.forEach(({ code, sensorId: wantedSensor }) => {
              if (sensorId !== wantedSensor) return;
              const value = standardized[code];
              if (value == undefined) return;
              if (data[timestamp] == undefined) data[timestamp] = {};
              data[timestamp][code] = { value, sensor: sensorId, source: source.src };
              delivered.add(code);
              used[code] = { source: source.src, sensor: sensorId };
            });
          });
        });
      });

      // Anything this round didn't deliver drops its leading candidate and
      // tries the next one; a code with none left is simply missing.
      pending.forEach((candidates, code) => {
        if (delivered.has(code)) { pending.delete(code); return; }
        candidates.shift();
        if (candidates.length === 0) pending.delete(code);
      });
    }

    const missing = Object.keys(candidatesByCode).filter(code => used[code] == undefined);
    return { buoyId, data, used, missing, errors };
  }
}



export default DPBuoys;
