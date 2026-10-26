import DP from './DataProduct.js';
import SourceFileHFRRadials from '../sources/SourceFileHFRRadials.js';
import SourceErddapEUHFR from '../sources/SourceErddapEUHFR.js';
import SourceGithubHFR from '../sources/SourceGithubHFR.js';
import hfrIcatmarNetwork from '../../../../Data/hfr/hfr-icatmar.js'





class DPHFRStations extends DP {

  constructor(...args) {
    super(...args);
    // The stations with a request in flight ('HFR-<NETWORK>:<STATION>' →
    // how many), and a 'loading' event on every change - so the map can show
    // a station loading whenever any view asks for its data
    this.loadingCounts = new Map();
    this.loadingEvents = new EventTarget();
  }

  loadingKey(network, stationId) {
    return `HFR-${String(network ?? 'ICATMAR').replace(/^HFR-/, '')}:${stationId}`;
  }

  // REFRESH. Each station's newest data as the views were told:
  // 'HFR-<NETWORK>:<STATION>' -> ms - its EU HFR Node dataset's end, and for
  // ICATMAR's stations its last .ruv on GitHub. Taken from the sources as
  // they are, which only move on in refresh().
  stationEnds() {
    const euHFRSource = this.sources.find(s => s instanceof SourceErddapEUHFR);
    const githubSource = this.sources.find(s => s instanceof SourceGithubHFR);
    const ends = new Map();
    const note = (key, date) => { if (date) ends.set(key, Math.max(ends.get(key) ?? -Infinity, date.getTime())); };
    Object.entries(euHFRSource?.stations ?? {}).forEach(([key, entry]) => {
      // '<network>-<station>', or ICATMAR's '<station>'
      const cut = key.lastIndexOf('-');
      note(cut < 0 ? this.loadingKey('ICATMAR', key) : this.loadingKey(key.slice(0, cut), key.slice(cut + 1)), entry.endDate);
    });
    Object.entries(githubSource?.stations ?? {}).forEach(([id, coverage]) => note(this.loadingKey('ICATMAR', id), coverage.endDate));
    return ends;
  }

  // The EU HFR Node's dataset list and GitHub's manifest read again. A
  // change: { stations: [keys], reprocessed: { <key>: ['<ISO hour>'...] } } -
  // the stations whose newest data moved on (one first seen now isn't:
  // nobody was told of it before), and those with hours re-processed on
  // GitHub (the EU HFR Node doesn't re-process; a .ruv's version is its row
  // count in the manifest), whose cached files are then dropped
  async refresh() {
    const euHFRSource = this.sources.find(s => s instanceof SourceErddapEUHFR);
    const githubSource = this.sources.find(s => s instanceof SourceGithubHFR);
    const before = this.announcedEnds ?? this.stationEnds();
    const versionsBefore = this.announcedRadialVersions ?? await this.radialVersions();
    await Promise.all([euHFRSource?.refreshEnds(), githubSource?.refresh()].map(p => Promise.resolve(p).catch(error => {
      console.error('HF radar stations, refresh:', error);
    })));
    const after = this.stationEnds();
    this.announcedEnds = after;
    const moved = [...after.keys()].filter(key => before.has(key) && before.get(key) !== after.get(key));

    const versionsNow = await this.radialVersions();
    this.announcedRadialVersions = versionsNow;
    const reprocessed = {};
    versionsNow.forEach((versions, id) => {
      const previous = versionsBefore.get(id);
      if (!previous) return;
      const hours = [...versions].filter(([hour, token]) => previous.has(hour) && previous.get(hour) !== token).map(([hour]) => hour);
      if (hours.length === 0) return;
      githubSource.invalidateHours(hours, id);
      reprocessed[this.loadingKey('ICATMAR', id)] = hours;
      this.reprocessed ??= new Map();
      hours.forEach(hour => this.reprocessed.set(`${this.loadingKey('ICATMAR', id)}|${hour}`, Date.now()));
    });
    const stations = [...new Set([...moved, ...Object.keys(reprocessed)])];
    if (stations.length) this.changed({ stations, reprocessed });
  }

  // When a station's radials for `hour` were found re-processed, if it was
  // while the page was open (ms) - for the views to say "updated"
  reprocessedAt(network, stationId, hour) {
    return this.reprocessed?.get(`${this.loadingKey(network, stationId)}|${new Date(hour).toISOString()}`);
  }

  // GitHub's version of each of ICATMAR's stations' .ruv over the last
  // week: Map(station -> Map(hour -> token)) - from the manifest, no request
  async radialVersions() {
    const githubSource = this.sources.find(s => s instanceof SourceGithubHFR);
    const result = new Map();
    if (!githubSource) return result;
    const end = new Date(), start = new Date(end.getTime() - 7 * 86400000);
    await Promise.all(hfrIcatmarNetwork.stations.map(async station => {
      result.set(station.id, await githubSource.getRadialVersions(station.id, start, end).catch(() => new Map()));
    }));
    return result;
  }

  // A read found a station's data for `hour`: past what the views were told,
  // refresh now rather than at the next tick
  noteStationHour(network, stationId, hour) {
    if (!hour) return;
    this.announcedEnds ??= this.stationEnds();
    const known = this.announcedEnds.get(this.loadingKey(network, stationId));
    if (known != undefined && new Date(hour).getTime() > known) this.requestRefresh();
  }

  isStationLoading(network, stationId) {
    return this.loadingCounts.has(this.loadingKey(network, stationId));
  }

  // Counts `promise` as a request for one station's data until it settles;
  // returns it as it is
  trackLoading(network, stationId, promise) {
    promise = Promise.resolve(promise);
    const key = this.loadingKey(network, stationId);
    const changed = () => this.loadingEvents.dispatchEvent(new Event('loading'));
    this.loadingCounts.set(key, (this.loadingCounts.get(key) ?? 0) + 1);
    changed();
    const settle = () => {
      const left = this.loadingCounts.get(key) - 1;
      if (left > 0) this.loadingCounts.set(key, left);
      else this.loadingCounts.delete(key);
      changed();
    };
    promise.then(settle, settle);
    return promise;
  }


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
  getRadials(network, stationId, hour) {
    return this.trackLoading(network, stationId, this.loadRadials(network, stationId, hour));
  }

  async loadRadials(network, stationId, hour) {
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
    this.noteStationHour(network, stationId, hour);
    return { ...field, extent: this.radialExtent(`${network}:${stationId}`, field) };
  }

  // One radial bin's series (see SourceErddapEUHFR.getRadialBinSeries) -
  // undefined for a station the EU HFR Node doesn't have (SCAL)
  async getRadialBinSeries(network, stationId, axisNames, a, b, startDate, endDate) {
    const euHFRSource = this.sources.find(s => s instanceof SourceErddapEUHFR);
    if (!euHFRSource) return undefined;
    return this.trackLoading(network, stationId, euHFRSource.getRadialBinSeries(network, stationId, axisNames, a, b, startDate, endDate));
  }

  // The hours ICATMAR's GitHub has a station's .ruv for, in [startDate, endDate]
  async getGithubRadialHours(stationId, startDate, endDate) {
    const githubSource = this.sources.find(s => s instanceof SourceGithubHFR);
    if (!githubSource || !hfrIcatmarNetwork.stations.some(s => s.id === stationId)) return [];
    const hours = await this.trackLoading('ICATMAR', stationId, Promise.resolve(githubSource.radialHours(stationId, startDate, endDate)));
    if (hours.length) this.noteStationHour('ICATMAR', stationId, hours[hours.length - 1]);
    return hours;
  }

  // One radial bin at one hour from ICATMAR's GitHub (see
  // SourceGithubHFR.getRadialBin) - ICATMAR's stations, the hours the EU HFR
  // Node doesn't have
  async getGithubRadialBin(stationId, hour, range, bearing) {
    const githubSource = this.sources.find(s => s instanceof SourceGithubHFR);
    if (!githubSource || !hfrIcatmarNetwork.stations.some(s => s.id === stationId)) return null;
    return this.trackLoading('ICATMAR', stationId, githubSource.getRadialBin(stationId, hour, range, bearing));
  }

  // A station dataset's metadata on the EU HFR Node (see
  // SourceErddapEUHFR.getDatasetMetadata)
  getDatasetMetadata(network, stationId, dataset) {
    const euHFRSource = this.sources.find(s => s instanceof SourceErddapEUHFR);
    if (!euHFRSource) return Promise.resolve({});
    return this.trackLoading(network, stationId, euHFRSource.getDatasetMetadata(dataset));
  }

  // The header of a station's .ruv on ICATMAR's GitHub for an hour - the
  // file the hour's values were read from, already in memory - or null
  async getGithubRadialHeader(stationId, hour) {
    const githubSource = this.sources.find(s => s instanceof SourceGithubHFR);
    if (!githubSource) return null;
    return (await githubSource.radialFile(stationId, hour))?.metadata ?? null;
  }

  // A station's radial bin with data nearest (lon, lat) at `hour` - what a
  // shared link to a radial Point is rebuilt from (urlState.js), in the shape
  // MapLayerHFRRadials.onClick gives the Point view - or null when the
  // station has no bin within ~2 km there that hour
  async nearestRadialBin(network, stationId, hour, lon, lat) {
    const field = await this.getRadials(network, stationId, hour);
    if (!field?.lat?.length) return null;
    const cosLat = Math.cos(lat * Math.PI / 180);
    let best = -1, bestDistance = Infinity;
    for (let i = 0; i < field.lat.length; i++) {
      const distance = Math.hypot((field.lon[i] - lon) * cosLat, field.lat[i] - lat);
      if (distance < bestDistance) { bestDistance = distance; best = i; }
    }
    if (best < 0 || bestDistance > 0.02) return null;
    return {
      kind: 'radial', network, station: stationId, site: field.site,
      lon: field.lon[best], lat: field.lat[best], axisNames: field.axisNames,
      a: field.ax[best], b: field.bx[best], direction: field.direction[best],
    };
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
    // Never past now: there are no files from the future to ask for
    const githubEnd = new Date(Math.min(end, Date.now()));
    const hours = githubSource && githubStart <= githubEnd ? this.hourlyTimestamps(githubStart, githubEnd) : [];

    return erddapPromises.map((promise, i) => {
      const id = stationIds[i];
      return this.trackLoading('ICATMAR', id, promise
        .then(async result => {
          const points = result?.points ?? {};
          // Where each hour's count came from: the EU HFR Node's, unless
          // GitHub filled it in below
          const origins = {};
          Object.keys(points).forEach(time => { origins[time] = result.source; });
          if (!hours.some(time => points[time] == undefined)) return { id, points, origins };

          // The hours the EU HFR Node doesn't have, from ICATMAR's GitHub:
          // the manifest's exact count of each hour's .ruv (see
          // SourceGithubHFR.getNumberOfValidPointsPerStations). A failure
          // leaves ERDDAP's points as they are.
          try {
            const fromGithub = await githubSource.getNumberOfValidPointsPerStations([id], githubStart, githubEnd);
            const githubPoints = fromGithub[id] ?? {};
            hours.forEach(time => {
              if (points[time] != undefined || githubPoints[time] == undefined) return;
              points[time] = githubPoints[time];
              origins[time] = githubSource.originOf(githubSource.radialUrl(id, new Date(time)));
            });
          } catch (error) {
            console.error(`Error loading GitHub HFR station data for ${id}:`, error);
          }

          return { id, points, origins };
        })
        .catch(error => {
          console.error(`Error loading number of valid points for station ${id}:`, error);
          return { id, points: {} };
        }));
    });
  }



}


export default DPHFRStations;
