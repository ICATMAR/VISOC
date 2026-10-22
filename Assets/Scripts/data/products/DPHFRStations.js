import DP from './DataProduct.js';
import SourceFileHFRRadials from '../sources/SourceFileHFRRadials.js';
import SourceErddapEUHFR from '../sources/SourceErddapEUHFR.js';
import SourceGithubHFR from '../sources/SourceGithubHFR.js';
import hfrIcatmarNetwork from '../../../../Data/hfr/hfr-icatmar.js'





class DPHFRStations extends DP {


  // Get stations from static file
  getICATMARHFRStations() {
    return hfrIcatmarNetwork.stations;
  }


  // Returns { total, stations } - total is the shared, network-wide metadata
  // (or undefined if unavailable); stations is
  // [{ name, latitude, longitude, metadata }, ...]. Same shape whether it
  // came from the static file or a live EU HFR Node request, so callers
  // don't need to care which one it was.
  async loadICATMARHFRStations() {

    // EU HFR Node - one dataset per station, plus the Total dataset's own
    // metadata, shared across every station.
    const euHFRSource = this.sources.find(s => s instanceof SourceErddapEUHFR);
    if (euHFRSource) {
      try {
        return await euHFRSource.getICATMARHFRStations();
      } catch (error) {
        console.error('Error loading EU HFR Node station data:', error);
      }
    }

    // Static radials files - one %Origin/%Site header per station, shared
    // across all its snapshots. No network-wide metadata available this way.
    const radials = this.sources.find(s => s instanceof SourceFileHFRRadials);
    if (radials) {
      try {
        await radials.loadingPromise;
        const snapshot = radials.data?.[0];
        const stations = Object.entries(snapshot?.stations ?? {}).map(([name, { metadata }]) => {
          const [latitude, longitude] = (metadata['Origin'] ?? '').trim().split(/\s+/).map(Number);
          return { name, latitude, longitude, metadata: {} };
        }).filter(s => !Number.isNaN(s.latitude) && !Number.isNaN(s.longitude));

        return { total: undefined, stations };
      } catch (error) {
        console.error('Error loading static HFR radials data:', error);
      }
    }
  }



  


  // Every hourly timestamp (ISO string, no milliseconds - matching how both
  // ERDDAP and GitHub key their results) in [startDate, endDate] - used to
  // tell which hours a station's ERDDAP result is missing.
  hourlyTimestamps(startDate, endDate) {
    const hours = [];
    for (let t = startDate.getTime(); t <= endDate.getTime(); t += 3600000) hours.push(new Date(t).toISOString().replace('.000Z', 'Z'));
    return hours;
  }

  // Get number of points per hour (only ICATMAR now). Returns an array of
  // per-station promises (not a single Promise<object>), so a caller (e.g.
  // DTAPHFR.vue) can process each station's result as soon as it resolves
  // instead of waiting for the slowest one. Each station's own promise
  // resolves with ERDDAP's result first, then - independently of every other
  // station's promise - fills in whatever hours ERDDAP's result is missing
  // from GitHub (ERDDAP occasionally lags behind the actual files, and SCAL
  // has no ERDDAP dataset at all), within the repo's retention window only.
  // One station's radials at `hour` (see SourceErddapEUHFR.getRadialField):
  // the EU HFR Node's first; for one of ICATMAR's stations, its .ruv on
  // ICATMAR's GitHub when the node has no map that hour (or no dataset at all,
  // SCAL). null for an hour with no map anywhere, undefined for a station
  // neither source has. `extent` is added: the station's radial extent - its
  // published coverage, or the box of every bin seen in the hours loaded so
  // far, so a map fitted to it settles rather than jumping hour to hour.
  async getRadials(network, stationId, hour) {
    const euHFRSource = this.sources.find(s => s instanceof SourceErddapEUHFR);
    const githubSource = this.sources.find(s => s instanceof SourceGithubHFR);
    let field = euHFRSource
      ? await euHFRSource.getRadialField(network, stationId, hour).catch(error => {
        console.warn(`EU HFR Node radials of ${stationId}:`, error);
        return null;
      })
      : undefined;
    const isICATMARs = hfrIcatmarNetwork.stations.some(s => s.id === stationId);
    if (!field && githubSource && isICATMARs) {
      const fromGithub = await githubSource.getRadialField(stationId, hour);
      field = fromGithub ?? (field === undefined ? null : field);
    }
    if (!field) return field;
    return { ...field, extent: this.radialExtent(`${network}:${stationId}`, field) };
  }

  radialExtent(key, field) {
    if (field.coverage) return field.coverage;
    this.radialExtents ??= {};
    const known = this.radialExtents[key];
    const [minLon, minLat, maxLon, maxLat] = field.dataExtent;
    this.radialExtents[key] = known
      ? [Math.min(known[0], minLon), Math.min(known[1], minLat), Math.max(known[2], maxLon), Math.max(known[3], maxLat)]
      : field.dataExtent;
    return this.radialExtents[key];
  }

  async getNumberOfValidPointsPerStations(stationIds, startDate, endDate) {
    stationIds = hfrIcatmarNetwork.stations.map(s => s.id);
    const end = endDate ?? new Date();

    const euHFRSource = this.sources.find(s => s instanceof SourceErddapEUHFR);
    let erddapPromises = stationIds.map(id => Promise.resolve({ id, points: {} }));
    if (euHFRSource) {
      try {
        erddapPromises = await euHFRSource.getNumberOfValidPointsPerStations(stationIds, startDate, end);
      } catch (error) {
        console.error('Error loading EU HFR Node station data:', error);
      }
    }

    const githubSource = this.sources.find(s => s instanceof SourceGithubHFR);
    const repoDaysAvailability = 14; // github only stores the last 14 days of radial data
    const githubStart = new Date(Math.max(startDate, end - repoDaysAvailability * 86400000));
    const hours = githubSource && githubStart <= end ? this.hourlyTimestamps(githubStart, end) : [];

    return erddapPromises.map((promise, i) => {
      const id = stationIds[i];
      return promise
        .then(async result => {
          const points = result?.points ?? {};
          // Where each hour's count came from: the EU HFR Node's, unless
          // GitHub filled it in below
          const origins = {};
          Object.keys(points).forEach(time => { origins[time] = result.source; });
          if (!hours.some(time => points[time] == undefined)) return { id, points, origins };

          // A GitHub failure shouldn't wipe out what ERDDAP already gave us -
          // just skip filling the gaps and return ERDDAP's points as-is.
          try {
            const fromGithub = await githubSource.getNumberOfValidPointsPerStations([id], githubStart, end);
            const githubPoints = fromGithub[id] ?? {};
            const githubOrigin = { label: 'ICATMAR GitHub', dataset: `ICATMAR/data · L2/${id}`, url: `https://github.com/ICATMAR/data/tree/main/observational/hf_radar/currents/L2/${id}` };
            hours.forEach(time => {
              if (points[time] == undefined && githubPoints[time] != undefined) {
                points[time] = githubPoints[time];
                origins[time] = githubOrigin;
              }
            });
          } catch (error) {
            console.error(`Error loading GitHub HFR station data for ${id}:`, error);
          }

          return { id, points, origins };
        })
        .catch(error => {
          console.error(`Error loading number of valid points for station ${id}:`, error);
          return { id, points: {} };
        });
    });
  }



}


export default DPHFRStations;
