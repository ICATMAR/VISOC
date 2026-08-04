import DP from './DataProduct.js';
import SourceFileHFRRadials from '../sources/SourceFileHFRRadials.js';
import SourceErddapEUHFRStations from '../sources/SourceErddapEUHFRStations.js';

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

}


export default DPHFRStations;
