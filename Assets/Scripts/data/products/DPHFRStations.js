import DP from './DataProduct.js';
import SourceFileHFRRadials from '../sources/SourceFileHFRRadials.js';
import SourceErddapEUHFRStations from '../sources/SourceErddapEUHFRStations.js';
import SourceGithubHFR from '../sources/SourceGithubHFR.js';
import hfrIcatmarNetwork from '../../../../Data/hfr/hfr-icatmar.js'





class DPHFRStations extends DP {


  // Get stations from static file
  getICATMARHFRStations() {
    return hfrIcatmarNetwork.stations;
  }


  // Returns { network, stations } - network is the shared, network-wide
  // metadata (or undefined if unavailable); stations is
  // [{ name, latitude, longitude, metadata }, ...]. Same shape whether it
  // came from the static file or a live EU HFR Node request, so callers
  // don't need to care which one it was.
  async loadICATMARHFRStations() {

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



  


  // Get all stations from all sources
  async getAllStations() {
    // Get sources
    const euHFRSource = this.sources.find(s => s instanceof SourceErddapEUHFRStations);
    const githubSource = this.sources.find(s => s instanceof SourceGithubHFR);

    // Hfr networks with static info
    let hfrNetworks = [hfrIcatmarNetwork];

    // Load EUHFRSource
    if (euHFRSource) {
      try {
        hfrNetworks = await euHFRSource.getAllStations();

        // Merge hfrIcatmarNetwork from static file with data from euHFRSource -
        // static values are kept as-is, live ones only fill in what static is
        // missing. Replaces the live ICATMAR entry in-place with the merged one.
        const liveIcatmarIndex = hfrNetworks.findIndex(net => net.stations.some(s => hfrIcatmarNetwork.stations.some(icatmarStation => icatmarStation.id === s.id)));
        if (liveIcatmarIndex !== -1) {
          const { merged, notMatchingKeys } = this.mergeICATMARNetwork(hfrNetworks[liveIcatmarIndex]);
          hfrNetworks[liveIcatmarIndex] = merged;
          this.notMatchingKeys = notMatchingKeys; // for debugging - not surfaced anywhere yet
          //console.log(this.notMatchingKeys);
        }
      } catch (error) {
        console.error('Error loading EU HFR Node station data:', error);
      }
    }
    
    // Load GithubSource
    if (githubSource) {
      await githubSource.loadingPromise;
      // Modify end date of icatmar stations
      const icatmarNetwork = hfrNetworks.find(net => net.stations.some(s => hfrIcatmarNetwork.stations.some(icatmarStation => icatmarStation.id === s.id)));
      if (icatmarNetwork){
        icatmarNetwork.stations.forEach(station => {
          const endDate = githubSource.stations[station.id]?.endDate;
          if (endDate) station.metadata.time_coverage_end = endDate.toISOString().replace('.000Z', 'Z');
        });
      } 
    }

    return hfrNetworks;
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
    stationIds = hfrIcatmarNetwork.stations.map(s => s.id);
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
      let repoDaysAvailability = 14; // github only stores the last 14 days of radial data
      const githubStart = new Date(Math.max(startDate, end - repoDaysAvailability * 86400000));
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






  // Keeps every value already in staticObj; only fills in keys staticObj is
  // missing, from liveObj. A key present in both with a different value is
  // NOT overwritten - it's recorded into notMatching instead, for inspection.
  mergeKeepingStatic(staticObj, liveObj, notMatching) {
    const merged = { ...staticObj };
    Object.entries(liveObj ?? {}).forEach(([key, liveValue]) => {
      if (!(key in staticObj)) merged[key] = liveValue;
      else if (staticObj[key] !== liveValue) notMatching[key] = { static: staticObj[key], live: liveValue };
    });
    return merged;
  }

  // Merges the live EU HFR Node ICATMAR group into the static hfr-icatmar.js
  // one (static wins on conflicts - see mergeKeepingStatic). Returns the
  // merged { network, stations } plus notMatchingKeys ({ network: {}, stations: [] })
  // listing every key that existed on both sides with a different value.
  mergeICATMARNetwork(liveGroup) {
    const notMatchingKeys = { network: {}, stations: [] };

    const network = this.mergeKeepingStatic(hfrIcatmarNetwork.network, liveGroup?.network, notMatchingKeys.network);

    const stations = hfrIcatmarNetwork.stations.map(staticStation => {
      const liveStation = liveGroup?.stations.find(s => s.id === staticStation.id);
      if (!liveStation) return staticStation; // e.g. SCAL - not on the EU HFR Node

      const stationNotMatching = {};
      const { metadata: liveMetadata, ...liveRest } = liveStation;
      const merged = this.mergeKeepingStatic(staticStation, liveRest, stationNotMatching);
      merged.metadata = this.mergeKeepingStatic(staticStation.metadata, liveMetadata, stationNotMatching);

      if (Object.keys(stationNotMatching).length) notMatchingKeys.stations.push({ id: staticStation.id, ...stationNotMatching });
      return merged;
    });

    return { merged: { network, stations }, notMatchingKeys };
  }
}


export default DPHFRStations;
