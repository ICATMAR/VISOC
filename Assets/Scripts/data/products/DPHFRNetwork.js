import DP from './DataProduct.js';
import SourceErddapEUHFR from '../sources/SourceErddapEUHFR.js';
import SourceGithubHFR from '../sources/SourceGithubHFR.js';
import hfrIcatmarNetwork from '../../../../Data/hfr/hfr-icatmar.js'

// Fields the static catalogue owns outright, rather than only filling in what
// the live sources don't publish - the same escape hatch the buoys keep for
// their display names (DPBuoys' STATIC_FIELDS), for the few values a source
// publishes worse than the curated file does.
//
// Positions: the catalogue's are each antenna's own %Origin, exactly as the
// radial file headers write it (PBCN 41.3475833 2.1740500). The EU HFR Node
// rounds site_lat/site_lon to 4-5 decimals and has PBCN about 1.5 km away from
// where its own files put it. Names: the EU HFR Node publishes none at all,
// only a dataset title, so this one is belt-and-braces.
const STATIC_STATION_FIELDS = ['name', 'latitude', 'longitude'];
// Same, within a station's metadata. The EU HFR Node serves institution
// double-encoded - its JSON literally carries Ã³ where 'ó' belongs,
// so the string arrives as 'DirecciÃ³ General de PolÃ­tica MarÃ­tima' and would
// render that way. The catalogue's copy is clean.
const STATIC_METADATA_FIELDS = ['institution'];

class DPHFRNetwork extends DP {


  // Get ICATMAR HFR network from static file. Stations are copied on the way
  // out: they are the app's first, synchronous paint and callers write to what
  // they get back (the map overlay merges live values straight into them), so
  // handing out the module's own objects would edit the static catalogue for
  // everything else reading it.
  getIcatmarNetwork() {
    return {
      ...hfrIcatmarNetwork,
      stations: hfrIcatmarNetwork.stations.map(station => ({ ...station, metadata: { ...station.metadata } })),
    };
  }

  // Every network (each { total, stations }) from all sources - see
  // loadAllNetworks(). That load is a few dozen requests and more than one
  // component needs what it returns (the map's status dots, the HFR platform
  // detail's status line), so it's memoized here: they share one load instead
  // of each triggering its own. Dropped again if it fails, so a later call
  // can retry.
  getAllNetworks(stationsProduct) {
    if (!this._allNetworksPromise) {
      this._allNetworksPromise = this.loadAllNetworks(stationsProduct)
        .catch(error => { this._allNetworksPromise = undefined; throw error; });
    }
    return this._allNetworksPromise;
  }

  // DPHFRNetwork has no sources of its own - station discovery belongs to
  // DPHFRStations (its EU HFR Node source already carries every ICATMAR
  // station dataset), so stationsProduct is required here. A network's
  // startDate/endDate might later come from its stations' latest data
  // instead of total's (a Total file is usually generated later than the
  // stations feeding it) - that would need totalsProduct passed in too.
  // Call getAllNetworks() rather than this - it's the memoized entry point.
  async loadAllNetworks(stationsProduct) {
    const euHFRSource = stationsProduct.sources.find(s => s instanceof SourceErddapEUHFR);
    const githubSource = stationsProduct.sources.find(s => s instanceof SourceGithubHFR);

    // Hfr networks with static info. A copy (see getIcatmarNetwork): with no
    // EU HFR Node source this is what the GitHub pass below writes its end
    // dates into, and that must not land on the static module itself.
    let hfrNetworks = [this.getIcatmarNetwork()];

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
      const icatmarNetwork = this.findICATMARNetwork(hfrNetworks);
      if (icatmarNetwork) {
        icatmarNetwork.stations.forEach(station => {
          const endDate = githubSource.stations[station.id]?.endDate;
          if (endDate) station.metadata.time_coverage_end = endDate.toISOString().replace('.000Z', 'Z');
        });
      }
    }

    return hfrNetworks;
  }

  // The live ICATMAR group out of getAllNetworks()' networks - matched by its
  // stations, since the groups carry the EU HFR Node's own network names.
  findICATMARNetwork(networks) {
    return networks.find(net => net.stations.some(s => hfrIcatmarNetwork.stations.some(icatmarStation => icatmarStation.id === s.id)));
  }

  // The ICATMAR stations as the app should show them: everything the live
  // sources publish - position, coverage box, calibration date, and a
  // time_coverage_end that getAllNetworks() has already advanced to the GitHub
  // repo's own last file wherever the repo is ahead of ERDDAP (it regularly
  // is, which is what made stations read as stale while their data was
  // arriving) - filled in from the static catalogue wherever they publish
  // nothing, and the static entry outright for a station no source covers
  // (SCAL). Pair it with getIcatmarNetwork().stations for the first,
  // synchronous paint, then swap in what this resolves to - the same two-step
  // every buoy view uses.
  async getICATMARStations(stationsProduct) {
    const networks = await this.getAllNetworks(stationsProduct);
    return this.findICATMARNetwork(networks)?.stations ?? this.getIcatmarNetwork().stations;
  }

  // Keeps every value the live source published; only fills in keys it didn't
  // publish, from staticObj. Same order of preference the buoys use (see
  // DPBuoys.fillMissing): whoever actually serves the data wins, and the
  // static catalogue is there for what nobody publishes and for whatever the
  // sources didn't cover. This is the reverse of what this file used to do -
  // static winning is why stations showed calibration dates two years out of
  // date while the EU HFR Node had the current ones.
  //
  // staticOwns lists the exceptions (see STATIC_STATION_FIELDS). Either way a
  // key both sides know with a different value is recorded into notMatching,
  // along with which one was kept, so drift on either side stays visible.
  mergePreferringLive(liveObj, staticObj, notMatching, staticOwns = []) {
    const merged = { ...liveObj };
    Object.entries(staticObj ?? {}).forEach(([key, staticValue]) => {
      if (staticValue == undefined) return;
      const liveValue = merged[key];
      const keepStatic = liveValue == undefined || staticOwns.includes(key);
      if (liveValue != undefined && liveValue !== staticValue)
        notMatching[key] = { static: staticValue, live: liveValue, kept: keepStatic ? 'static' : 'live' };
      if (keepStatic) merged[key] = staticValue;
    });
    return merged;
  }

  // Merges the live EU HFR Node ICATMAR group with the static hfr-icatmar.js
  // one, the live values winning (see mergePreferringLive). Returns the merged
  // { total, stations } plus notMatchingKeys ({ total: {}, stations: [] })
  // listing every key that existed on both sides with a different value.
  // STATIC_STATION_FIELDS / STATIC_METADATA_FIELDS are the exceptions, where
  // the curated file wins instead.
  mergeICATMARNetwork(liveGroup) {
    const notMatchingKeys = { total: {}, stations: [] };

    const total = this.mergePreferringLive(liveGroup?.total, hfrIcatmarNetwork.total, notMatchingKeys.total);

    const stations = hfrIcatmarNetwork.stations.map(staticStation => {
      const liveStation = liveGroup?.stations.find(s => s.id === staticStation.id);
      // e.g. SCAL - not on the EU HFR Node. Copied rather than handed out
      // as-is: callers (loadAllNetworks' own GitHub pass, for one) write to
      // what they get back, and the static module is shared with everything
      // else that reads it.
      if (!liveStation) return { ...staticStation, metadata: { ...staticStation.metadata } };

      const stationNotMatching = {};
      const { metadata: liveMetadata, ...liveRest } = liveStation;
      const { metadata: staticMetadata, ...staticRest } = staticStation;
      const merged = this.mergePreferringLive(liveRest, staticRest, stationNotMatching, STATIC_STATION_FIELDS);
      merged.metadata = this.mergePreferringLive(liveMetadata, staticMetadata, stationNotMatching, STATIC_METADATA_FIELDS);

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
