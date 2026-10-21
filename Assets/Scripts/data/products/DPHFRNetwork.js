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

// Two entries for the same station code are the same site when within
// SAME_SITE_KM of each other - codes alone can repeat across networks
const SAME_SITE_KM = 2;
function isSameSite(a, b) {
  const dLat = (a.latitude - b.latitude) * 111.2;
  const dLon = (a.longitude - b.longitude) * 111.2 * Math.cos(a.latitude * Math.PI / 180);
  return Math.hypot(dLat, dLon) <= SAME_SITE_KM;
}

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
        const liveIcatmarIndex = hfrNetworks.indexOf(this.findICATMARNetwork(hfrNetworks));
        if (liveIcatmarIndex !== -1) {
          const { merged, notMatchingKeys } = this.mergeICATMARNetwork(hfrNetworks[liveIcatmarIndex], hfrNetworks);
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

  // The live ICATMAR group out of getAllNetworks()' networks - by its code,
  // HFR-ICATMAR. Not by sharing station codes with the static list: that list
  // also holds Puertos del Estado's ALFA, SALO and VINA (ICATMAR uses them in
  // its own totals), which the EU HFR Node publishes under HFR-DeltaEbro - so
  // the DeltaEbro group would match first. Station codes are only the
  // fallback, and only ICATMAR's own stations', for a node without site codes.
  findICATMARNetwork(networks) {
    const code = hfrIcatmarNetwork.total.site_code;
    const byCode = networks.find(net => net.total?.site_code === code);
    if (byCode) return byCode;
    const own = hfrIcatmarNetwork.stations.filter(s => s.metadata?.institution !== 'Puertos del Estado').map(s => s.id);
    return networks.find(net => net.stations.some(s => own.includes(s.id)));
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
  mergeICATMARNetwork(liveGroup, allNetworks = []) {
    const notMatchingKeys = { total: {}, stations: [] };

    const total = this.mergePreferringLive(liveGroup?.total, hfrIcatmarNetwork.total, notMatchingKeys.total);

    const stations = hfrIcatmarNetwork.stations.map(staticStation => {
      const liveStation = liveGroup?.stations.find(s => s.id === staticStation.id);
      if (!liveStation) {
        // Not in the node's HFR-ICATMAR: ICATMAR's own processing takes in
        // more stations than the node's does. Flagged, so a view of what the
        // node publishes can leave it out.
        // - Puertos del Estado's ALFA, SALO and VINA are on the node all the
        //   same, under HFR-DeltaEbro: the same antenna at the same site, so
        //   that copy gives its status and metadata - still shown as
        //   ICATMAR's network, and as Puertos del Estado's.
        // - SCAL is nowhere on it. Copied rather than handed out as-is:
        //   callers (loadAllNetworks' own GitHub pass, for one) write to
        //   what they get back, and the static module is shared with
        //   everything else that reads it.
        const elsewhere = allNetworks.filter(network => network !== liveGroup)
          .flatMap(network => network.stations)
          .find(s => s.id === staticStation.id && isSameSite(s, staticStation));
        if (!elsewhere) return { ...staticStation, metadata: { ...staticStation.metadata }, notOnEUNode: true };
        return { ...this.mergeStation(elsewhere, staticStation, notMatchingKeys, [...STATIC_METADATA_FIELDS, 'network']), notOnEUNode: true };
      }
      return this.mergeStation(liveStation, staticStation, notMatchingKeys, STATIC_METADATA_FIELDS);
    });

    return { merged: { total, stations }, notMatchingKeys };
  }

  // One of getAllNetworks()' groups by its code ('HFR-DeltaEbro'): the
  // Total's site code, or its stations' network should the Total's metadata
  // have failed to load
  networkCode(network) {
    return network?.total?.site_code ?? network?.stations[0]?.metadata?.network;
  }

  // getNumberOfValidPointsPerNetwork() for any network on the EU HFR Node,
  // as the node publishes it: `network` is one of getAllNetworks()' groups.
  // Without the static catalogue and GitHub that the ICATMAR network's own
  // counts draw on - those are for ICATMAR's processing, not the node's.
  getNumberOfValidPointsForEUNetwork(stationsProduct, network, startDate, endDate) {
    const euHFRSource = stationsProduct.sources.find(s => s instanceof SourceErddapEUHFR);
    const code = this.networkCode(network);
    if (!euHFRSource || !code) return [];
    const stationIds = network.stations.filter(s => !s.notOnEUNode).map(s => s.id);
    return euHFRSource.getNumberOfValidPointsForNetwork(code, stationIds, startDate, endDate);
  }

  // One station: live winning, but for the static fields (see
  // mergePreferringLive), and for `staticMetadata` within its metadata
  mergeStation(liveStation, staticStation, notMatchingKeys, staticMetadata) {
    const stationNotMatching = {};
    const { metadata: liveMetadata, ...liveRest } = liveStation;
    const { metadata: staticMetadataValues, ...staticRest } = staticStation;
    const merged = this.mergePreferringLive(liveRest, staticRest, stationNotMatching, STATIC_STATION_FIELDS);
    merged.metadata = this.mergePreferringLive(liveMetadata, staticMetadataValues, stationNotMatching, staticMetadata);

    if (Object.keys(stationNotMatching).length) notMatchingKeys.stations.push({ id: staticStation.id, ...stationNotMatching });
    return merged;
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
