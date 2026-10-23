import DP from './DataProduct.js';
import SourceErddapEUHFR from '../sources/SourceErddapEUHFR.js';
import SourceErddapHFRadars from '../sources/SourceErddapHFRadars.js';

// The same quantity under ICATMAR's ERDDAP's name (u, v...) for the EU HFR
// Node's (EWCT, NSCT... - also the names GitHub's and the static .tuv files
// are read under, see parsers/tuv.js). Same units on both.
const ICATMAR_NAMES = {
  EWCT: 'u', NSCT: 'v', EWCS: 'stdu', NSCS: 'stdv', CCOV: 'cov', GDOP: 'gdop',
  QCflag: 'qcflag', VART_QC: 'vart_qc', GDOP_QC: 'gdop_qc', DDNS_QC: 'ddns_qc', CSPD_QC: 'cspd_qc',
};
const quantityOf = name => ICATMAR_NAMES[name] ?? name;

class DPHFRTotals extends DP {

  // Per-hour count of valid grid points for the ICATMAR network's Total,
  // within [startDate, endDate] (endDate defaults to now). Same shape as
  // DPHFRStations.getNumberOfValidPointsPerStations()'s individual results
  // ({ id: 'TOTALS', points }), so DPHFRNetwork can combine them uniformly.
  //
  // The sources in catalogue order, an hour from the first that has it:
  // ICATMAR's ERDDAP (recent, then historic - every cell of the griddap's
  // QC flag), the EU HFR Node (its _table's count), ICATMAR's GitHub (the
  // manifest's count of each .tuv), the static files. Each grids the radars
  // its own way, so their counts for one hour differ a little (GitHub's run
  // higher than the node's). `origins` says each hour's.
  async getNumberOfValidPoints(startDate, endDate) {
    const end = endDate ?? new Date();
    // The node's copy of ICATMAR's network is counted by its _table (listed
    // before it), not counted again from its griddap
    const countedServers = new Set();
    const counters = [];
    this.sources.forEach(source => {
      if (source instanceof SourceErddapEUHFR) {
        countedServers.add(source.baseUrl);
        counters.push(async () => {
          const result = await source.getNumberOfValidPointsForTotal(startDate, endDate);
          return { points: result.points ?? {}, source: result.source };
        });
      } else if (typeof source.totalsCounts === 'function') {
        counters.push(async () => {
          const points = await source.totalsCounts(startDate, end);
          const origins = Object.fromEntries(Object.keys(points).map(time => [time, source.originOf(source.totalsUrl(new Date(time)))]));
          return { points, origins };
        });
      } else if (source.provider === 'ICATMAR' && typeof source.getValidPointsCount === 'function' && !countedServers.has(source.baseUrl)) {
        counters.push(() => source.getValidPointsCount(startDate, end));
      }
    });
    const answers = await Promise.all(counters.map(count => count().catch(error => {
      console.error('Error loading HF radar totals counts:', error);
      return null;
    })));
    const points = {}, origins = {};
    let first;
    answers.forEach(answer => {
      Object.entries(answer?.points ?? {}).forEach(([time, count]) => {
        if (points[time] != undefined) return;
        points[time] = count;
        origins[time] = answer.origins?.[time] ?? answer.source;
        first ??= origins[time];
      });
    });
    return { id: 'TOTALS', points, origins, source: first };
  }

  // MAPS of the totals, for the HFR dashboard's animation, from one
  // provider: 'ICATMAR' (ICATMAR's network) or 'EU' (every network on the EU
  // HFR Node). A provider can have several sources, each with getField(),
  // getLatestTime() and getAvailability(): they are tried in catalogue order
  // and the first with a map for the hour wins - for ICATMAR, its own ERDDAP
  // (recent, then historic), then the EU HFR Node's copy of its network when
  // that one is down or has a gap, then GitHub, where the newest hours land
  // before either ERDDAP has them, then the static files. The field says
  // where it came from (`source`) and whether that was a fallback (a source
  // other than the provider's own: ICATMAR's ERDDAP for ICATMAR).
  // The grid point with data nearest (lon, lat) at `time`, on the grid of
  // whichever source serves that hour's map - ICATMAR's ERDDAP, the EU HFR
  // Node or GitHub's .tuv, each with its own grid - within one grid spacing
  // (VectorField.nearestCell): { lon, lat, network, source } or null. What a
  // click on the map snaps to. The sources in catalogue order, as getField
  // tries them: the first with a map for the hour answers. An ERDDAP is
  // asked for just the cells around the point (SourceErddapHFRadars.
  // nearestGridPoint); a file (GitHub, static) is read whole anyway.
  async nearestGridPoint(time, provider, lon, lat) {
    // Only the networks around the point, wider than a grid spacing (3-6 km)
    const bbox = [lon - 0.1, lat - 0.1, lon + 0.1, lat + 0.1];
    for (const source of this.mapSources(provider)) {
      let cell;
      try {
        if (typeof source.nearestGridPoint === 'function') {
          cell = await source.nearestGridPoint(time, lon, lat);
        } else {
          const field = await source.getField(time, bbox);
          cell = field ? null : undefined;
          (field?.parts ?? (field ? [field] : [])).forEach(part => {
            const found = part.nearestCell(lon, lat);
            if (found && (!cell || found.distance < cell.distance)) cell = { ...found, network: part.label };
          });
        }
      } catch (error) {
        console.error(`HF radar grid point from ${source.label}:`, error);
        continue;
      }
      // No map for the hour here: the next source's
      if (cell === undefined) continue;
      return cell ? { lon: cell.lon, lat: cell.lat, network: cell.network, source: source.label } : null;
    }
    return null;
  }

  // One network's grid points with data at `time`, as the source labelled
  // `sourceLabel` has them (the source a series read that hour from - each
  // grids the radars its own way), or else the source serving that hour's
  // map: [{ lon, lat }], [] when there is no map. Only the networks around
  // (lon, lat) are asked for. What the Point view's detail draws its grid from.
  async getGridPoints(time, provider, network, lon, lat, sourceLabel) {
    const bbox = [lon - 0.05, lat - 0.05, lon + 0.05, lat + 0.05];
    // A label can name several sources (ICATMAR's ERDDAP: recent and
    // historic): the first of them with the hour's map
    const labelled = sourceLabel ? this.mapSources(provider).filter(s => s.label === sourceLabel) : [];
    let field = null;
    try {
      if (labelled.length === 0) field = await this.getField(time, provider, bbox);
      for (const source of labelled) {
        field = await source.getField(time, bbox);
        if (field) break;
      }
    } catch (error) {
      console.error(`HF radar grid from ${sourceLabel ?? provider}:`, error);
    }
    if (!field) return [];
    const parts = field.parts ?? [field];
    return (parts.find(part => part.label === network) ?? parts[0]).cellsWithData();
  }

  async getField(time, provider, bbox) {
    const sources = this.mapSources(provider);
    for (let i = 0; i < sources.length; i++) {
      try {
        const field = await sources[i].getField(time, bbox);
        if (field) {
          field.source = sources[i].label;
          field.isFallback = sources[i].label !== sources[0].label;
          return field;
        }
      } catch (error) {
        console.error(`HF radar currents from ${sources[i].label}:`, error);
      }
    }
    return null;
  }

  // Which hours have maps, one row per network, from `startDate` on:
  // [{ network, hours: { '<ISO hour>': fraction } }] - a fraction of that
  // network's fullest map in the range, since sources count points their own
  // way. Every source of the provider is asked for the WHOLE range - not only
  // past the hours the ones before it have: an ERDDAP can have gaps (the EU
  // HFR Node missing hours it has the next ones of) that GitHub fills, as the
  // map does - and an hour comes from the first that has it, the same order
  // getField() uses, so the timeline shows what the map would.
  async getAvailability(provider, bbox, startDate) {
    const byNetwork = new Map();
    const answers = await Promise.all(this.mapSources(provider).map(source =>
      source.getAvailability(bbox, startDate).catch(error => {
        console.error(`HF radar availability from ${source.label}:`, error);
        return [];
      })));
    for (const rows of answers) {
      rows.forEach(row => {
        const max = Math.max(0, ...Object.values(row.hours));
        if (max === 0) return;
        const merged = byNetwork.get(row.network) ?? { network: row.network, hours: {} };
        Object.entries(row.hours).forEach(([hour, count]) => {
          if (merged.hours[hour] == undefined) merged.hours[hour] = count / max;
        });
        byNetwork.set(row.network, merged);
      });
    }
    return [...byNetwork.values()];
  }

  // The time of the provider's newest map in `bbox`, from any of its sources
  async getLatestTime(provider, bbox) {
    const times = await Promise.all(this.mapSources(provider).map(source =>
      source.getLatestTime(bbox).catch(error => {
        console.error(`Latest HF radar map from ${source.label}:`, error);
        return undefined;
      })));
    const valid = times.filter(Boolean);
    return valid.length ? new Date(Math.max(...valid)) : undefined;
  }

  // The current at one point, hour by hour, from one provider, as numbers:
  // its sources in catalogue order, as for the maps, an hour coming from the
  // first that has it (ICATMAR's ERDDAP - recent, then historic - then the EU
  // HFR Node's copy of its network, then the static files). Sources without
  // point series (GitHub - a file per hour is too heavy for a series) are
  // skipped.
  //   { cell, data: { '<ISO hour>': { u, v, speed, direction, time, source } },
  //     used: [{ source, dataset, network, cell, hours }] } - which sources
  //     filled how many of the hours, for describing the series
  async getPointSeries(provider, lon, lat, startDate, endDate, options) {
    const result = { cell: undefined, data: {}, used: [] };
    for (const source of this.mapSources(provider).filter(s => typeof s.getPointSeries === 'function')) {
      try {
        const series = await source.getPointSeries(lon, lat, startDate, endDate, options);
        result.cell ??= series.cell;
        result.cells ??= series.cells;
        let hours = 0;
        Object.entries(series.data).forEach(([hour, value]) => {
          if (result.data[hour]) return;
          // Each hour says where it was read: sources grid the radars
          // differently (ICATMAR's processing vs the EU HFR Node's)
          result.data[hour] = { ...value, source: source.label, network: series.network, dataset: series.dataset, cell: series.cell };
          hours++;
        });
        if (hours > 0) result.used.push({ source: source.label, dataset: series.dataset, network: series.network, cell: series.cell, cells: series.cells, hours });
      } catch (error) {
        console.error(`HF radar series from ${source.label}:`, error);
      }
    }
    return result;
  }

  // One grid cell's every variable, hour by hour (see
  // SourceErddapHFRadars.getCellSeries) - from the provider's sources in
  // catalogue order, an hour coming from the first that has its velocity
  // (all of the hour's values from that one source). The first series found
  // sets the variables' names (ICATMAR's ERDDAP: u, v...; the EU HFR Node's:
  // EWCT, NSCT...); a later source's values go under the same quantity's name
  // (seriesName), what has none is left out. `source`/`dataset` are the
  // first's; `origins` says each hour's ({ label, source, dataset, url, cell }).
  async getCellSeries(provider, network, lon, lat, startDate, endDate) {
    let result = null;
    for (const source of this.mapSources(provider).filter(s => typeof s.getCellSeries === 'function')) {
      let series;
      try {
        series = await source.getCellSeries(network, lon, lat, startDate, endDate);
      } catch (error) {
        console.error(`HF radar cell from ${source.label}:`, error);
        continue;
      }
      const hours = Object.keys(series?.data[series.eastward] ?? {});
      if (hours.length === 0) continue;
      const originOf = hour => series.origins?.[hour] ?? { label: source.label, source: source.label, dataset: series.dataset, cell: series.cell };
      if (!result) {
        result = { ...series, source: source.label, data: Object.fromEntries(Object.entries(series.data).map(([name, values]) => [name, { ...values }])), origins: {} };
        // Any hour with a value - an hour's QC can be there without its velocity
        Object.values(series.data).forEach(values => Object.keys(values).forEach(hour => { result.origins[hour] ??= originOf(hour); }));
        continue;
      }
      hours.forEach(hour => {
        if (result.data[result.eastward][hour] != undefined) return;
        // The whole hour from this source: nothing of the earlier one's left
        Object.values(result.data).forEach(values => { delete values[hour]; });
        Object.entries(series.data).forEach(([name, values]) => {
          const target = this.seriesName(result, name);
          if (target && values[hour] != undefined) result.data[target][hour] = values[hour];
        });
        result.origins[hour] = originOf(hour);
      });
    }
    return result;
  }

  // The name `series` (a getCellSeries result) has for the quantity another
  // source calls `name` - EWCT is ICATMAR's u - or undefined if it has none
  seriesName(series, name) {
    if (series.data[name]) return name;
    return Object.keys(series.data).find(own => quantityOf(own) === quantityOf(name));
  }

  // The hours ICATMAR's GitHub has a totals file for, in [startDate, endDate]
  async getGithubHours(startDate, endDate) {
    const github = this.sources.find(s => typeof s.totalsHours === 'function');
    return github ? github.totalsHours(startDate, endDate) : [];
  }

  // One grid cell at one hour from ICATMAR's GitHub (see
  // SourceGithubHFR.getTotalsCell) - the hours the ERDDAPs don't have yet
  async getGithubCell(hour, lon, lat) {
    const github = this.sources.find(s => typeof s.getTotalsCell === 'function');
    return github ? github.getTotalsCell(hour, lon, lat) : null;
  }

  // The header of ICATMAR's totals .tuv on GitHub for an hour - the file the
  // hour's values were read from, already in memory - or null
  async getGithubFileHeader(hour) {
    const github = this.sources.find(s => typeof s.totalsFile === 'function');
    return github ? (await github.totalsFile(hour))?.metadata ?? null : null;
  }

  // A dataset's description from the source that serves it (by its label, as
  // getPointSeries' `used` names it - a label can name several sources, the
  // one with the dataset is asked)
  async getDatasetMetadata(provider, sourceLabel, dataset) {
    const labelled = this.mapSources(provider).filter(s => s.label === sourceLabel && s.getDatasetMetadata);
    const source = labelled.find(s => s.datasets?.includes(dataset)) ?? labelled[0];
    return source ? source.getDatasetMetadata(dataset) : {};
  }

  // The provider's map sources, in catalogue order
  mapSources(provider) {
    return this.sources.filter(s => s.provider === provider && typeof s.getField === 'function');
  }
}

export default DPHFRTotals;
