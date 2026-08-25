import DP from './DataProduct.js';
import SourceErddapEUHFR from '../sources/SourceErddapEUHFR.js';
import SourceGithubHFR from '../sources/SourceGithubHFR.js';
import hfrIcatmarNetwork from '../../../../Data/hfr/hfr-icatmar.js'

class DPHFRNetwork extends DP {

  // Get all networks (each { total, stations }) from all sources.
  // DPHFRNetwork has no sources of its own - station discovery belongs to
  // DPHFRStations (its EU HFR Node source already carries every ICATMAR
  // station dataset), so stationsProduct is required here. A network's
  // startDate/endDate might later come from its stations' latest data
  // instead of total's (a Total file is usually generated later than the
  // stations feeding it) - that would need totalsProduct passed in too.
  async getAllNetworks(stationsProduct) {
    const euHFRSource = stationsProduct.sources.find(s => s instanceof SourceErddapEUHFR);
    const githubSource = stationsProduct.sources.find(s => s instanceof SourceGithubHFR);

    // Hfr networks with static info
    let hfrNetworks = [hfrIcatmarNetwork];

    // Load EUHFRSource
    if (euHFRSource) {
      try {
        hfrNetworks = await euHFRSource.getAllNetworks();

        // Merge hfrIcatmarNetwork from static file with data from euHFRSource -
        // static values are kept as-is, live ones only fill in what static is
        // missing. Replaces the live ICATMAR entry in-place with the merged one.
        const liveIcatmarIndex = hfrNetworks.findIndex(net => net.stations.some(s => hfrIcatmarNetwork.stations.some(icatmarStation => icatmarStation.id === s.id)));
        if (liveIcatmarIndex !== -1) {
          const { merged, notMatchingKeys } = this.mergeICATMARNetwork(hfrNetworks[liveIcatmarIndex]);
          hfrNetworks[liveIcatmarIndex] = merged;
          this.notMatchingKeys = notMatchingKeys; // for debugging - not surfaced anywhere yet
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
      if (icatmarNetwork) {
        icatmarNetwork.stations.forEach(station => {
          const endDate = githubSource.stations[station.id]?.endDate;
          if (endDate) station.metadata.time_coverage_end = endDate.toISOString().replace('.000Z', 'Z');
        });
      }
    }

    return hfrNetworks;
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
  // merged { total, stations } plus notMatchingKeys ({ total: {}, stations: [] })
  // listing every key that existed on both sides with a different value.
  mergeICATMARNetwork(liveGroup) {
    const notMatchingKeys = { total: {}, stations: [] };

    const total = this.mergeKeepingStatic(hfrIcatmarNetwork.total, liveGroup?.total, notMatchingKeys.total);

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

    return { merged: { total, stations }, notMatchingKeys };
  }

  // Combines DPHFRStations' per-station promises with DPHFRTotals' one
  // promise for the network Total, into a single array - one promise per
  // entity (each of the network's stations, plus 'TOTALS'), each resolving
  // independently as its own data arrives. stationsProduct/totalsProduct are
  // DPHFRStations/DPHFRTotals instances - passed in rather than looked up
  // here, since a DataProduct only knows its own sources, not its siblings'
  // (DataService is what already holds references to all of them).
  async getNumberOfValidPointsPerNetwork(stationsProduct, totalsProduct, startDate, endDate) {
    const stationPromises = await stationsProduct.getNumberOfValidPointsPerStations(undefined, startDate, endDate);

    const totalsPromise = totalsProduct.getNumberOfValidPoints(startDate, endDate).catch(error => {
      console.error('Error loading number of valid points for TOTALS:', error);
      return { id: 'TOTALS', points: {} };
    });

    return [...stationPromises, totalsPromise];
  }

}

export default DPHFRNetwork;
