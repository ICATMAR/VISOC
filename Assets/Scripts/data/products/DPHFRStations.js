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

  // Get number of points per hour (only ICATMAR now). Returns an array of
  // per-station promises (not a single Promise<object>), so a caller (e.g.
  // DTAPHFR.vue) can process each station's result as soon as it resolves
  // instead of waiting for the slowest one. Each station's own promise
  // resolves with ERDDAP's result first, then - independently of every other
  // station's promise - fills in whatever hours ERDDAP's result is missing
  // from GitHub (ERDDAP occasionally lags behind the actual files, and SCAL
  // has no ERDDAP dataset at all), within the repo's retention window only.
  async getNumberOfValidPointsPerStations(stationIds, startDate, endDate) {
    stationIds = hfrIcatmarNetwork.stations.map(s => s.id);
    const end = endDate ?? new Date();

    const euHFRSource = this.sources.find(s => s instanceof SourceErddapEUHFRStations);
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
          if (!hours.some(time => points[time] == undefined)) return { id, points };

          // A GitHub failure shouldn't wipe out what ERDDAP already gave us -
          // just skip filling the gaps and return ERDDAP's points as-is.
          try {
            const fromGithub = await githubSource.getNumberOfValidPointsPerStations([id], githubStart, end);
            const githubPoints = fromGithub[id] ?? {};
            hours.forEach(time => {
              if (points[time] == undefined && githubPoints[time] != undefined) points[time] = githubPoints[time];
            });
          } catch (error) {
            console.error(`Error loading GitHub HFR station data for ${id}:`, error);
          }

          return { id, points };
        })
        .catch(error => {
          console.error(`Error loading number of valid points for station ${id}:`, error);
          return { id, points: {} };
        });
    });
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
