import DP from './DataProduct.js';
import SourceErddapEUHFR from '../sources/SourceErddapEUHFR.js';
import SourceErddapHFRadars from '../sources/SourceErddapHFRadars.js';

class DPHFRTotals extends DP {

  // Per-hour count of valid grid points for the ICATMAR network's Total,
  // within [startDate, endDate] (endDate defaults to now). Same shape as
  // DPHFRStations.getNumberOfValidPointsPerStations()'s individual results
  // ({ id: 'TOTALS', points }), so DPHFRNetwork can combine them uniformly.
  //
  // GitHub isn't used as a fallback here yet, even though this product has a
  // SourceGithubHFR configured for it - SourceGithubHFR only estimates
  // per-station radial point counts from file sizes so far, not the Total.
  async getNumberOfValidPoints(startDate, endDate) {
    const euHFRSource = this.sources.find(s => s instanceof SourceErddapEUHFR);
    if (!euHFRSource) return { id: 'TOTALS', points: {} };

    try {
      return await euHFRSource.getNumberOfValidPointsForTotal(startDate, endDate);
    } catch (error) {
      console.error('Error loading EU HFR Node totals data:', error);
      return { id: 'TOTALS', points: {} };
    }
  }

  // MAPS of the totals, for the HFR dashboard's animation, from one
  // provider: 'ICATMAR' (ICATMAR's network) or 'EU' (every network on the EU
  // HFR Node). A provider can have several sources, each with getField(),
  // getLatestTime() and getAvailability(): they are tried in catalogue order
  // and the first with a map for the hour wins - for ICATMAR, its own ERDDAP,
  // then the EU HFR Node's copy of its network when that one is down or has a
  // gap, then GitHub, where the newest hours land before either ERDDAP has
  // them. The field says where it came from (`source`) and whether that was a
  // fallback.
  async getField(time, provider, bbox) {
    const sources = this.mapSources(provider);
    for (let i = 0; i < sources.length; i++) {
      try {
        const field = await sources[i].getField(time, bbox);
        if (field) {
          field.source = sources[i].label;
          field.isFallback = i > 0;
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
  // way. Every source of the provider is asked; an hour comes from the first
  // that has it, the same order getField() uses, so the timeline shows what
  // the map would.
  async getAvailability(provider, bbox, startDate) {
    const byNetwork = new Map();
    for (const source of this.mapSources(provider)) {
      // Where the sources so far end - GitHub only has to be asked past it
      const known = [...byNetwork.values()].flatMap(row => Object.keys(row.hours));
      const after = known.length ? new Date(known.sort().pop()) : undefined;
      let rows = [];
      try {
        rows = await source.getAvailability(bbox, startDate, after);
      } catch (error) {
        console.error(`HF radar availability from ${source.label}:`, error);
      }
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

  // The provider's map sources, in catalogue order
  mapSources(provider) {
    return this.sources.filter(s => s.provider === provider && typeof s.getField === 'function');
  }
}

export default DPHFRTotals;
