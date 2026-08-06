import DP from './DataProduct.js';
import SourceFileHFRRadials from '../sources/SourceFileHFRRadials.js';
import SourceErddapEUHFRStations from '../sources/SourceErddapEUHFRStations.js';
import SourceGithubHFR from '../sources/SourceGithubHFR.js';

// ICATMAR/data (GitHub) only keeps HFR radial files for the last two weeks -
// confirmed active (commits still landing daily) on 2026-08-06, so a request
// further back than that would just come back empty.
const GITHUB_RETENTION_DAYS = 14;

class DPHFRStations extends DP {

  // Precomputed positions file - FetchManager caches it after the first
  // request, so multiple calls to getHFRStationPositions() only fetch it once.
  static staticPositionsPath = './Data/staticData.json';

  // Returns { network, stations } - network is the shared, network-wide
  // metadata (or undefined if unavailable); stations is
  // [{ name, latitude, longitude, metadata }, ...]. Same shape whether it
  // came from the static file or a live EU HFR Node request, so callers
  // don't need to care which one it was.
  async getICATMARHFRStations() {
    // Static file - tried first: cheap (one small local fetch) and avoids
    // querying ERDDAP at all when the positions are already known. Only
    // falls through to the live sources below if this file is missing/unreadable.
    try {
      const text = await this.fetchManager.fetch(DPHFRStations.staticPositionsPath).then(res => res.text());
      return JSON.parse(text);
    } catch (error) {
      console.error(`No static station positions file (${DPHFRStations.staticPositionsPath}), falling back to live sources:`, error);
    }

    // EU HFR Node - one dataset per station, plus the network's own dataset
    // for the shared network-wide metadata.
    const euHFRSource = this.sources.find(s => s instanceof SourceErddapEUHFRStations);
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

        return { network: undefined, stations };
      } catch (error) {
        console.error('Error loading static HFR radials data:', error);
      }
    }
  }



  // Every network and station on the EU HFR Node (ICATMAR included, not just
  // it) - one { network, stations } group per network.
  async getAllStations() {
    const euHFRSource = this.sources.find(s => s instanceof SourceErddapEUHFRStations);
    if (euHFRSource) {
      try {
        return await euHFRSource.getAllStations();
      } catch (error) {
        console.error('Error loading EU HFR Node station data:', error);
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

  // Get number of points per hour (only ICATMAR now). ERDDAP is queried
  // first; GitHub then fills in only whatever ERDDAP's result is missing for
  // a station (ERDDAP occasionally lags behind the actual files, and SCAL has
  // no ERDDAP dataset at all), and only within GITHUB_RETENTION_DAYS, since
  // that's all the repository keeps.
  async getNumberOfValidPointsPerStations(stationIds, startDate, endDate) {
    stationIds = ['CNET', 'CREU', 'BEGU', 'TOSS', 'AREN', 'PBCN', 'GNST', 'SCAL'];
    const end = endDate ?? new Date();

    let result = {};
    const euHFRSource = this.sources.find(s => s instanceof SourceErddapEUHFRStations);
    if (euHFRSource) {
      try {
        result = await euHFRSource.getNumberOfValidPointsPerStations(stationIds, startDate, end);
      } catch (error) {
        console.error('Error loading EU HFR Node station data:', error);
      }
    }

    const githubSource = this.sources.find(s => s instanceof SourceGithubHFR);
    if (githubSource) {
      const githubStart = new Date(Math.max(startDate, end - GITHUB_RETENTION_DAYS * 86400000));
      if (githubStart <= end) {
        const hours = this.hourlyTimestamps(githubStart, end);
        const missingStations = stationIds.filter(id => hours.some(time => result[id]?.[time] == undefined));

        if (missingStations.length) {
          try {
            const fromGithub = await githubSource.getNumberOfValidPointsPerStations(missingStations, githubStart, end);
            missingStations.forEach(id => {
              const points = result[id] ?? (result[id] = {});
              hours.forEach(time => {
                if (points[time] == undefined && fromGithub[id]?.[time] != undefined) points[time] = fromGithub[id][time];
              });
            });
          } catch (error) {
            console.error('Error loading GitHub HFR station data:', error);
          }
        }
      }
    }

    return result;
  }
}


export default DPHFRStations;
