import Source from './Source.js';
import VectorField from '../VectorField.js';
import { parseTuv, tuvPoints, tuvCell } from '../parsers/tuv.js';
import { bearingAwayFrom } from '../geo.js';

const GITHUB_API_URL = 'https://api.github.com/repos';
const REPO = 'ICATMAR/data';
const BRANCH = 'main';
const PATH = 'observational/hf_radar/currents/L2';
// The repository as a website (GitHub Pages): files by URL with CORS and no
// API limit - where a station's radials (.ruv) are read from
const PAGES_URL = 'https://icatmar.github.io/data';
// What the repository has, kept up to date by a GitHub Action in
// ICATMAR/data: every hourly radial (.ruv, per station) and totals (.tuv)
// file and how many vectors it holds (its %TableRows) -
// { generated, radials: { STA: { 'YYYY-MM-DDTHH:MMZ': rows } }, totals: { hour: rows } }.
// One request tells which files exist, so none is asked for in vain.
const MANIFEST_URL = `${PAGES_URL}/observational/hf_radar/manifest.json`;
const MANIFEST_TTL_MINUTES = 5;
// A manifest hour ('2026-10-22T10:00Z') as the ISO string Dates give
const manifestHour = key => new Date(key.replace(/Z$/, ':00Z')).toISOString();
const RADIAL_CACHE_SIZE = 200;
// Parsed files kept in memory: a .tuv is ~800 KB of text and a few MB once
// parsed, a .ruv about a quarter of that - and GitHub only serves the newest
// hours the ERDDAPs don't have yet, about a dozen. The derived maps and
// radial fields (typed arrays, ~100 KB each) are kept longer.
const TOTALS_FILE_CACHE_SIZE = 24;
const RADIAL_FILE_CACHE_SIZE = 48;
const TOTALS_MAP_CACHE_SIZE = 72;
const RADIAL_TTL_MINUTES = 10;

// .ruv (CODAR LLUV radial) files are fixed-format tables: a constant header,
// then one ~242-byte line per radial vector. That makes the file size a
// near-exact linear function of the number of valid points, so the counts can
// be read off a directory request alone - no .ruv ever has to be downloaded:
//
//   validPoints = (fileBytes - headerBytes) / bytesPerPoint
//
// Calibrated against the EU HFR Node ERDDAP's RDVA counts (the same number
// SourceErddapEUHFR.getNumberOfValidPointsPerStation() returns) over
// 2026-07-30..2026-08-06 - ~1150 file/timestamp pairs, robust linear fit per
// station. R2 >= 0.9995 everywhere; residuals are within a few points, and the
// row count in the file matches ERDDAP's count exactly when both refer to the
// same revision of the file.
//
// bytesPerPoint is ~242 for every station (they all write the same table
// columns). Only headerBytes really differs, because the number of header
// lines is per-station configuration - TOSS writes 184 of them, the others
// ~120, hence its much larger fixed cost.
const CALIBRATION = {
  AREN: { headerBytes: 7970,  bytesPerPoint: 242.42 }, // R2 1.00000, +/- 1 pt
  BEGU: { headerBytes: 5376,  bytesPerPoint: 244.11 }, // R2 0.99989, +/- 2 pt (see note below)
  CNET: { headerBytes: 8674,  bytesPerPoint: 241.01 }, // R2 1.00000, +/- 0.1 pt
  CREU: { headerBytes: 2901,  bytesPerPoint: 245.56 }, // R2 0.99955, +/- 4 pt
  GNST: { headerBytes: 5720,  bytesPerPoint: 243.56 }, // R2 0.99976, +/- 3 pt
  PBCN: { headerBytes: 8010,  bytesPerPoint: 241.71 }, // R2 0.99992, +/- 2 pt
  TOSS: { headerBytes: 15735, bytesPerPoint: 242.06 }, // R2 1.00000, +/- 0.2 pt
};

// Used for stations with no calibration of their own - SCAL is the case that
// matters, since it's in the repository but not on the EU HFR Node, so there's
// no ERDDAP ground truth to fit it against. bytesPerPoint is safe to reuse
// (it's the same table format for all of them), but headerBytes is a guess:
// the calibrated ones range from 2.8 to 15.4 KiB, so expect an error of a few
// tens of points until such a station is calibrated properly.
const DEFAULT_CALIBRATION = { headerBytes: 7000, bytesPerPoint: 242.4 };

// Its own .ruv files disagree with ERDDAP for ~6% of timestamps (by hundreds
// of points - e.g. 2026-07-30T05:00Z has 778 rows in the file but ERDDAP
// reports 1183), and its header line count varies between files, unlike every
// other station. That looks like the repository and the EU HFR Node holding
// different revisions of the same hour rather than a bad fit, but it does mean
// this station's estimates are the least trustworthy.
const UNSTABLE_STATIONS = ['BEGU'];

// SCAL isn't on the EU HFR Node, so DPHFRStations can't get its lat/lon or
// metadata from ERDDAP the way it does for the other ICATMAR stations.
// latitude/longitude and sensor_model are read straight off SCAL's own .ruv
// header (%Origin, %Manufacturer); institution/network aren't actually in
// that header, they're inferred from SCAL being one of ICATMAR's own
// stations same as the rest; doa_estimation_method is inferred from
// %RadialMusicParameters being present in the header (CODAR SeaSondes report
// direction of arrival via the MUSIC algorithm when that block is there).
// time_coverage_start/end aren't hardcoded here - load() fills those in from
// the actual file timestamps, same as it does for every other station.
const SCAL_METADATA = {
  latitude: 41.1862833,
  longitude: 1.6073000,
  metadata: {
    institution: 'ICATMAR',
    network: 'HFR-ICATMAR',
    sensor_model: 'CODAR',
    doa_estimation_method: 'Direction Finding',
  },
};

// TOTALS MAPS: the network's hourly totals (.tuv) in the same repository,
// read straight off raw.githubusercontent.com by file name - which needs no
// API request (and so isn't held to the API's 60 requests an hour), and is
// where the newest hours land first, before either ERDDAP has them. About
// 700 KB a file, so only worth it for those newest hours (see
// DPHFRTotals.getField, which tries the ERDDAPs first).
const RAW_URL = 'https://raw.githubusercontent.com';
const TOTALS_PATH = 'observational/hf_radar/currents/L3/tuv';
const TOTALS_TTL = 60;     // minutes - a published hour doesn't change

// How long load()'s repo-wide tree is cached for - short, since its only
// purpose is finding out how fresh each station's data currently is.
const TREE_TTL_MINUTES = 10;

// .ruv columns that are the EU HFR Node's variables under another name or
// unit: what the Point view merges them into (cm/s -> m/s). Columns only the
// files have are left out (the Point view follows ERDDAP's variables). The
// .tuv's are in parsers/tuv.js (TUV_TO_STANDARD).
const RUV_TO_STANDARD = {
  ESPC: { name: 'ESPC', scale: 0.01 }, ETMP: { name: 'ETMP', scale: 0.01 },
  // The .ruv's velocities are positive TOWARDS the antenna; the EU HFR Node
  // publishes them positive away (as RDVA) - checked: .ruv MAXV 36.418 cm/s
  // is the node's MAXV -0.364 m/s for the same bin and hour
  MAXV: { name: 'MAXV', scale: -0.01 }, MINV: { name: 'MINV', scale: -0.01 },
  ERSC: { name: 'ERSC' }, ERTC: { name: 'ERTC' }, SPRC: { name: 'SPRC' },
  PRIM: { name: 'QCflag' },
};

function pad(n) {
  return String(n).padStart(2, '0');
}


// Hourly radial files published to ICATMAR/data on GitHub, read through the
// GitHub contents API. That API reports each file's size in bytes for a whole
// directory in one request, which is all this source needs - it never fetches
// the .ruv files themselves.
//
// Parsing the .ruv contents is deliberately not implemented here yet;
// SourceFileHFRRadials already does that for locally served files.
class SourceGithubHFR extends Source {

  // `provider`: on the HFR totals product, which of the HFR dashboard's
  // choices this source can stand in for with its totals maps (see
  // getField). `label`: how it is named when it does.
  constructor({ fetchManager, src, provider, label }) {
    super({ fetchManager });
    this.src = src;
    this.provider = provider;
    this.label = label ?? 'GitHub';
    this.totalsMaps = new Map();   // '<ISO hour>' -> Promise<VectorField | null>
    this.repo = REPO; // exposed so DataProducts.vue can label/link this source, same as SourceErddap's `dataset`

    // One entry per station-month directory request, keyed '<station>/<year>/<month>'.
    // Holds the promise (not the resolved value) so concurrent callers share
    // the same in-flight request instead of each issuing their own.
    this.requests = new Map();

    // Per-station coverage, keyed by station id: { startDate, endDate }, plus
    // (SCAL only) latitude/longitude/metadata - discovered by load().
    this.stations = {};

    // Set by load() on a 403 - read by DataProducts.vue to tell "GitHub is
    // rate-limiting us" apart from "no data", which otherwise look the same
    // (both leave startDate/endDate undefined).
    this.isRateLimited = false;

    this.loadingPromise = this.load();
  }

  // ICATMAR/data's manifest (see MANIFEST_URL), indexed by ISO hour:
  // { generated, radials: { STA: Map(hour -> rows) }, totals: Map(hour -> rows) }
  // - or null when it can't be had (then the API fallbacks below are used).
  // Read again once MANIFEST_TTL_MINUTES have passed, so new hours appear -
  // or now, with `force` (see refresh): then past FetchManager's copy and the
  // Pages CDN's (max-age 600), with a stamp in the URL that changes every
  // minute, so the products refreshing together share one request.
  loadManifest({ force = false } = {}) {
    if (!force && this.manifestPromise && Date.now() - this.manifestAt < MANIFEST_TTL_MINUTES * 60000) return this.manifestPromise;
    this.manifestAt = Date.now();
    const url = force ? `${MANIFEST_URL}?t=${Math.floor(Date.now() / 60000)}` : MANIFEST_URL;
    this.manifestPromise = this.fetchManager.fetch(url, force ? 1 : MANIFEST_TTL_MINUTES)
      .then(res => res.json())
      .then(json => {
        // An hour is its file's row count - or [rows, sha] should the
        // manifest also give each file's git blob SHA. Its version (see
        // getVersions) is the SHA, or else the count: a file reprocessed
        // keeping its count goes unnoticed without the SHA.
        const rowsOf = value => Array.isArray(value) ? value[0] : value;
        const versionOf = value => Array.isArray(value) ? value[1] ?? value[0] : value;
        const index = hours => {
          const rows = new Map(), versions = new Map();
          Object.entries(hours ?? {}).forEach(([key, value]) => {
            rows.set(manifestHour(key), rowsOf(value));
            versions.set(manifestHour(key), String(versionOf(value)));
          });
          return { rows, versions };
        };
        const radials = {}, radialVersions = {};
        Object.entries(json.radials ?? {}).forEach(([station, hours]) => {
          ({ rows: radials[station], versions: radialVersions[station] } = index(hours));
        });
        const { rows: totals, versions: totalsVersions } = index(json.totals);
        this.manifest = { generated: json.generated, radials, totals, radialVersions, totalsVersions };
        return this.manifest;
      })
      .catch(error => {
        console.error('HF radar manifest unavailable - falling back to the GitHub API and asking for each file:', error);
        this.manifest = null;
        return null;
      });
    return this.manifestPromise;
  }

  // The manifest read again now (see the data products' refresh): whether
  // it changed since the last refresh - new hours, or files re-processed.
  // The stations' coverage is worked out from it again (in memory).
  async refresh() {
    const manifest = await this.loadManifest({ force: true });
    if (!manifest) return false;
    await this.load();
    const changed = manifest.generated !== this.refreshedGenerated;
    this.refreshedGenerated = manifest.generated;
    return changed;
  }

  // Every station's earliest/latest hour: from the manifest, or - without
  // it - from the repository's file tree (one GitHub API request)
  async load() {
    const manifest = await this.loadManifest();
    if (manifest) {
      Object.entries(manifest.radials).forEach(([station, hours]) => {
        const times = [...hours.keys()].map(key => new Date(key).getTime());
        if (times.length) this.stations[station] = { startDate: new Date(Math.min(...times)), endDate: new Date(Math.max(...times)) };
      });
    } else {
      await this.loadTree();
    }
    this.finishLoad();
  }

  // The fallback: the repo's file tree, fetched recursively in a SINGLE
  // request (GitHub resolves a branch name straight to its root tree)
  async loadTree() {
    this.isRateLimited = false;

    const url = `${GITHUB_API_URL}/${REPO}/git/trees/${BRANCH}?recursive=1`;
    const tree = await this.fetchManager.fetch(url, TREE_TTL_MINUTES)
      .then(res => res.json())
      .catch(err => {
        if (err.name === 'HTTPError' && err.status === 403) {
          console.error(`GitHub API rate limit reached while loading the repository tree (60 requests/hour when unauthenticated):`, err);
          this.isRateLimited = true;
        } else {
          console.error('Error loading GitHub HFR repository tree:', err);
        }
        return undefined;
      });
    if (!tree?.tree) return;

    const prefix = `${PATH}/`;
    tree.tree.forEach(entry => {
      if (entry.type !== 'blob' || !entry.path.startsWith(prefix)) return;
      const [station, , , fileName] = entry.path.slice(prefix.length).split('/');
      const time = this.timestampFromFileName(fileName);
      if (time == undefined) return;

      const date = new Date(time);
      const coverage = this.stations[station] ?? (this.stations[station] = {});
      if (coverage.startDate == undefined || date < coverage.startDate) coverage.startDate = date;
      if (coverage.endDate == undefined || date > coverage.endDate) coverage.endDate = date;
    });

  }

  finishLoad() {
    if (this.stations['SCAL']) Object.assign(this.stations['SCAL'], SCAL_METADATA);

    // Earliest/latest across every station - same as SourceErddapEUHFR's
    // own startDate/endDate, read by DataProducts.vue for this source's status dot.
    const coverages = Object.values(this.stations);
    this.startDate = coverages.length ? new Date(Math.min(...coverages.map(c => c.startDate))) : undefined;
    this.endDate = coverages.length ? new Date(Math.max(...coverages.map(c => c.endDate))) : undefined;
  }

  // GitHub's contents API: a JSON array of { name, size, ... }, one entry per
  // file, with `size` in bytes - no download needed. It's CORS-enabled, so
  // unlike the ERDDAP sources this doesn't have to go through the ICATMAR
  // proxy. It returns up to 1000 entries per directory, comfortably above the
  // 744 files a month of hourly radials can hold, so there's no pagination to
  // handle here.
  requestUrl(station, year, month) {
    return `${GITHUB_API_URL}/${REPO}/contents/${PATH}/${station}/${year}/${pad(month)}?ref=${BRANCH}`;
  }

  // Unauthenticated GitHub API calls are limited to 60 per hour per IP, and
  // one query over a week costs one request per station per month spanned -
  // so these are worth caching hard. A month that's already over can't gain
  // new files, so it's cached for a day; the current one gets a new file
  // every hour, so it's only held for 10 minutes.
  requestTtl(year, month) {
    const now = new Date();
    const isCurrentMonth = year === now.getUTCFullYear() && month === now.getUTCMonth() + 1;
    return isCurrentMonth ? 10 : 1440;
  }

  // e.g. 'RDLm_AREN_2026_08_01_0100_l2b.ruv' -> '2026-08-01T01:00:00Z',
  // the same timestamp format the ERDDAP sources key their results by.
  timestampFromFileName(name) {
    const match = name.match(/^RDLm_[A-Za-z0-9]+_(\d{4})_(\d{2})_(\d{2})_(\d{2})(\d{2})_l2b\.ruv$/);
    if (!match) return undefined;
    const [, year, month, day, hour, minute] = match;
    return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
  }

  // { '<ISO timestamp>': sizeInBytes } for one station-month directory, or {}
  // if that directory doesn't exist - a station simply has no folder for a
  // month it didn't report in, which the API answers with a 404 rather than an
  // empty list.
  async fetchMonthRequest(station, year, month) {
    const key = `${station}/${year}/${pad(month)}`;
    if (this.requests.has(key)) return this.requests.get(key);

    const promise = this.fetchManager.fetch(this.requestUrl(station, year, month), this.requestTtl(year, month))
      .then(res => res.json())
      .then(files => {
        const sizes = {};
        files.forEach(file => {
          const time = this.timestampFromFileName(file.name);
          if (time != undefined) sizes[time] = file.size;
        });
        return sizes;
      })
      .catch(err => {
        // Don't keep a rejected promise around - the next call should be free
        // to retry (a rate-limited request in particular is worth retrying later).
        this.requests.delete(key);

        if (err.name === 'HTTPError' && err.status === 404) return {}; // no data for that station/month
        if (err.name === 'HTTPError' && err.status === 403) {
          console.error(`GitHub API rate limit reached while requesting ${key} (60 requests/hour when unauthenticated):`, err);
          return {};
        }
        throw err;
      });

    this.requests.set(key, promise);
    return promise;
  }

  // Every (year, month) pair the range touches, so a range crossing a month
  // boundary requests both directories.
  monthsInRange(startDate, endDate) {
    const months = [];
    const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    while (cursor <= endDate) {
      months.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return months;
  }

  // { '<station>': { '<ISO timestamp>': sizeInBytes } } for each given station
  // within [startDate, endDate]. Exposed on its own because the file size is a
  // useful signal in itself (a missing hour is a missing file, not a zero),
  // and because it's the raw measurement the point counts are derived from.
  async getFileSizesPerStations(stationIds, startDate, endDate) {
    const end = endDate ?? new Date();
    const months = this.monthsInRange(startDate, end);

    const entries = await Promise.all(stationIds.map(async id => {
      const monthSizes = await Promise.all(months.map(({ year, month }) => this.fetchMonthRequest(id, year, month)));

      // A month request covers the whole month, so trim it back to the
      // requested range.
      const sizes = {};
      monthSizes.forEach(month => {
        Object.entries(month).forEach(([time, size]) => {
          const date = new Date(time);
          if (date >= startDate && date <= end) sizes[time] = size;
        });
      });

      return [id, sizes];
    }));

    return Object.fromEntries(entries);
  }

  // Number of valid radial points a .ruv of `bytes` holds, from this station's
  // calibration. Clamped at 0: a file smaller than its own header has no data
  // rows at all (and the fitted header is an average, so it can land slightly
  // above a genuinely empty file's size).
  estimateValidPoints(station, bytes) {
    const { headerBytes, bytesPerPoint } = CALIBRATION[station] ?? DEFAULT_CALIBRATION;
    return Math.max(0, Math.round((bytes - headerBytes) / bytesPerPoint));
  }

  // Per-hour count of valid radial vectors for each given station within
  // [startDate, endDate] (endDate defaults to now): { '<station>': { '<ISO
  // timestamp>': count } }. Note this is a plain object, unlike
  // SourceErddapEUHFR.getNumberOfValidPointsPerStations(), which returns an
  // array of per-station promises instead.
  //
  // These are ESTIMATES derived from file size (see CALIBRATION above), not
  // counted points - accurate to within a few points for the calibrated
  // stations. The advantage over the ERDDAP source is cost and coverage: one
  // request per station-month instead of one per station, and it also covers
  // stations the EU HFR Node doesn't publish (SCAL), plus hours that are in
  // the repository but not yet ingested there.
  //
  // With the manifest: its exact counts (each file's %TableRows - the EU HFR
  // Node's same count), no listing and no estimate.
  async getNumberOfValidPointsPerStations(stationIds, startDate, endDate) {
    const manifest = await this.loadManifest();
    if (manifest) {
      const from = startDate.getTime(), to = (endDate ?? new Date()).getTime();
      return Object.fromEntries(stationIds.map(id => {
        const points = {};
        manifest.radials[id]?.forEach((rows, key) => {
          const t = new Date(key).getTime();
          if (t >= from && t <= to && rows != undefined) points[key.replace('.000Z', 'Z')] = rows;
        });
        return [id, points];
      }));
    }
    const sizesPerStation = await this.getFileSizesPerStations(stationIds, startDate, endDate);

    const entries = Object.entries(sizesPerStation).map(([id, sizes]) => {
      if (!CALIBRATION[id]) console.warn(`No .ruv size calibration for station '${id}' - falling back to a generic one, point counts may be off by tens of points.`);
      else if (UNSTABLE_STATIONS.includes(id)) console.warn(`Station '${id}' has .ruv files that disagree with ERDDAP for some hours - its point counts are less reliable.`);

      const points = {};
      Object.entries(sizes).forEach(([time, bytes]) => points[time] = this.estimateValidPoints(id, bytes));
      return [id, points];
    });

    return Object.fromEntries(entries);
  }


  // TOTALS MAPS (see TOTALS_PATH)

  totalsUrl(hour) {
    const y = hour.getUTCFullYear(), m = pad(hour.getUTCMonth() + 1), d = pad(hour.getUTCDate()), h = pad(hour.getUTCHours());
    return `${RAW_URL}/${REPO}/${BRANCH}/${TOTALS_PATH}/${y}/${m}/TOTL_CATS_${y}_${m}_${d}_${h}00.tuv`;
  }

  // The totals map for the hour `time` (files are on the hour), or null if
  // the repository has none. Points the processing flagged (VFLG != 0) are
  // left out; VELU/VELV are in cm/s.
  // "No map" isn't kept: the hour may be in the next manifest (a map asked
  // for before its file was published - the neighbour hours the map
  // preloads - would otherwise stay empty all session). Not costly: an hour
  // the manifest doesn't list is no request.
  getField(time) {
    const hour = new Date(Math.round(time.getTime() / 3600000) * 3600000);
    const key = hour.toISOString();
    if (!this.totalsMaps.has(key)) {
      const promise = (async () => {
        const file = await this.totalsFile(hour);
        if (!file) return null;
        const field = VectorField.fromPoints(tuvPoints(file.rows), hour, 'ICATMAR');
        // Which file it is from, and where
        if (field) Object.assign(field, { dataset: this.originOf(this.totalsUrl(hour)).dataset, url: this.totalsUrl(hour) });
        else if (this.totalsMaps.get(key) === promise) this.totalsMaps.delete(key);
        return field;
      })().catch(error => { this.totalsMaps.delete(key); throw error; });
      this.totalsMaps.set(key, promise);
      if (this.totalsMaps.size > TOTALS_MAP_CACHE_SIZE) this.totalsMaps.delete(this.totalsMaps.keys().next().value);
    }
    return this.totalsMaps.get(key);
  }

  // One station's radials at `hour` (on the hour: CODAR's are hourly), from
  // its .ruv on the repository's website - the same shape as
  // SourceErddapEUHFR.getRadialField(), for when the EU HFR Node has none
  // (SCAL, or hours it hasn't published yet). null when the file isn't there.
  // The .ruv's VELO is positive TOWARDS the antenna; the field's velocity, as
  // the EU HFR Node's RDVA, is positive away - so it is worked out from the
  // vector itself (VELU/VELV, cm/s) along the bearing away from the site.
  // qc is the primary QC flag (PRIM: 1 passed every test).
  getRadialField(stationId, hour) {
    const key = `${stationId}|${hour.toISOString()}`;
    this.radialFields ??= new Map();
    if (!this.radialFields.has(key)) {
      // "No radials" isn't kept (see getField)
      const promise = this.fetchRadialField(stationId, hour).then(field => {
        if (!field && this.radialFields.get(key) === promise) this.radialFields.delete(key);
        return field;
      }, error => {
        this.radialFields.delete(key);
        throw error;
      });
      this.radialFields.set(key, promise);
      if (this.radialFields.size > RADIAL_CACHE_SIZE) this.radialFields.delete(this.radialFields.keys().next().value);
    }
    return this.radialFields.get(key);
  }

  radialUrl(stationId, hour) {
    const [y, m, d, h] = [hour.getUTCFullYear(), hour.getUTCMonth() + 1, hour.getUTCDate(), hour.getUTCHours()].map(n => String(n).padStart(2, '0'));
    return `${PAGES_URL}/${PATH}/${stationId}/${y}/${m}/RDLm_${stationId}_${y}_${m}_${d}_${h}00_l2b.ruv`;
  }

  // A station's .ruv for an hour, parsed ({ metadata, rows }) - null when the
  // repository doesn't have it. Shared by the radial maps and the Point view.
  async radialFile(stationId, hour) {
    // Not in the manifest: not in the repository - nothing to ask for
    const manifest = await this.loadManifest();
    if (manifest && !manifest.radials[stationId]?.has(hour.toISOString())) return null;
    const key = `${stationId}|${hour.toISOString()}`;
    this.radialFiles ??= new Map();
    if (!this.radialFiles.has(key)) {
      this.radialFiles.set(key, this.fetchManager.fetch(this.radialUrl(stationId, hour) + this.bustOf(key), RADIAL_TTL_MINUTES)
        .then(res => res.text()).then(text => parseTuv(text))
        .catch(error => {
          if (error.name === 'HTTPError' && error.status === 404) return null;
          this.radialFiles.delete(key);
          throw error;
        }));
      if (this.radialFiles.size > RADIAL_FILE_CACHE_SIZE) this.radialFiles.delete(this.radialFiles.keys().next().value);
    }
    return this.radialFiles.get(key);
  }

  // One radial bin of a station's .ruv at an hour, for the Point view: its
  // values under the EU HFR Node's names where it is the same quantity (in
  // the same units: m/s) - see RUV_TO_STANDARD. The bin by its range (km) and
  // bearing (deg). { values: { <name>: value }, origin } or null.
  async getRadialBin(stationId, hour, range, bearing) {
    const file = await this.radialFile(stationId, hour);
    if (!file) return null;
    const row = file.rows.find(r => Math.abs(r.RNGE - range) < 0.05 && Math.abs(r.BEAR - bearing) < 0.5);
    if (!row) return null;
    const [siteLat, siteLon] = String(file.metadata['Origin'] ?? '').trim().split(/\s+/).map(Number);
    const values = {};
    Object.entries(RUV_TO_STANDARD).forEach(([column, { name, scale }]) => {
      if (Number.isFinite(row[column])) values[name] = row[column] * (scale ?? 1);
    });
    // RDVA: positive away from the antenna, from the vector itself (the .ruv's
    // VELO is positive towards it)
    if ([row.LATD, row.LOND, row.VELU, row.VELV].every(Number.isFinite) && Number.isFinite(siteLat)) {
      const away = bearingAwayFrom({ lat: siteLat, lon: siteLon }, row.LATD, row.LOND) * Math.PI / 180;
      values.RDVA = (row.VELU * Math.sin(away) + row.VELV * Math.cos(away)) / 100;
    }
    return { values, origin: this.originOf(this.radialUrl(stationId, hour)) };
  }

  // One grid cell of ICATMAR's totals .tuv at an hour, for the Point view and
  // Compare: under the EU HFR Node's names where it is the same quantity (m/s,
  // m2/s2). The cell nearest (lon, lat),
  // within half a grid cell. { values, cell: { latitude, longitude }, origin } or null.
  async getTotalsCell(hour, lon, lat) {
    const file = await this.totalsFile(hour);
    if (!file) return null;
    const found = tuvCell(file.rows, lon, lat);
    return found ? { ...found, origin: this.originOf(this.totalsUrl(hour)) } : null;
  }

  // ICATMAR's totals .tuv for an hour, parsed - shared by the maps and the
  // cell reads, so a file the map already fetched costs nothing more
  async totalsFile(hour) {
    // Not in the manifest: not in the repository - nothing to ask for
    const manifest = await this.loadManifest();
    if (manifest && !manifest.totals.has(hour.toISOString())) return null;
    const key = hour.toISOString();
    this.totalsFiles ??= new Map();
    if (!this.totalsFiles.has(key)) {
      this.totalsFiles.set(key, this.fetchManager.fetch(this.totalsUrl(hour) + this.bustOf(key), TOTALS_TTL, 60)
        .then(res => res.text()).then(text => parseTuv(text))
        .catch(error => {
          if (error.name === 'HTTPError' && error.status === 404) return null;
          this.totalsFiles.delete(key);
          throw error;
        }));
      if (this.totalsFiles.size > TOTALS_FILE_CACHE_SIZE) this.totalsFiles.delete(this.totalsFiles.keys().next().value);
    }
    return this.totalsFiles.get(key);
  }

  // REPROCESSING. ICATMAR re-processes hours already published: an hour's
  // file can change. Its version per hour, from the manifest (no request):
  // Map('<ISO hour>' -> token) for [startDate, endDate] - the totals, or a
  // station's radials
  async getVersions(startDate, endDate) {
    return this.versionsIn((await this.loadManifest())?.totalsVersions, startDate, endDate);
  }
  async getRadialVersions(stationId, startDate, endDate) {
    return this.versionsIn((await this.loadManifest())?.radialVersions?.[stationId], startDate, endDate);
  }
  versionsIn(versions, startDate, endDate) {
    const found = new Map();
    const from = startDate.getTime(), to = endDate.getTime();
    versions?.forEach((token, key) => {
      const t = new Date(key).getTime();
      if (t >= from && t <= to) found.set(key, token);
    });
    return found;
  }

  // Hours whose file changed: what was kept of them is dropped, and they are
  // read again past FetchManager's copy and the Pages CDN's (a query with
  // the new version - Pages ignores it). `stationId`: a station's radials;
  // without it, the totals.
  invalidateHours(hours, stationId) {
    this.bust ??= new Map();
    hours.forEach(hour => {
      if (stationId) {
        const key = `${stationId}|${hour}`;
        this.radialFiles?.delete(key);
        this.radialFields?.delete(key);
        this.bust.set(key, Date.now());
      } else {
        this.totalsFiles?.delete(hour);
        this.totalsMaps?.delete(hour);
        this.bust.set(hour, Date.now());
      }
    });
  }
  bustOf(key) {
    const stamp = this.bust?.get(key);
    return stamp ? `?v=${stamp}` : '';
  }

  // The hours in [startDate, endDate] the repository has a totals .tuv /
  // a station's .ruv for, from the manifest (ISO strings, oldest first) - none
  // without it
  async totalsHours(startDate, endDate) {
    return this.hoursIn((await this.loadManifest())?.totals, startDate, endDate);
  }
  async radialHours(stationId, startDate, endDate) {
    return this.hoursIn((await this.loadManifest())?.radials[stationId], startDate, endDate);
  }
  // How many vectors each totals .tuv holds in [startDate, endDate], from the
  // manifest (its %TableRows): { 'YYYY-MM-DDTHH:00:00Z': rows } - none
  // without it
  async totalsCounts(startDate, endDate) {
    const totals = (await this.loadManifest())?.totals;
    const counts = {};
    this.hoursIn(totals, startDate, endDate).forEach(key => {
      const rows = totals.get(key);
      if (rows != undefined) counts[key.replace('.000Z', 'Z')] = rows;
    });
    return counts;
  }
  hoursIn(hours, startDate, endDate) {
    if (!hours) return [];
    const from = startDate.getTime(), to = Math.min(endDate.getTime(), Date.now());
    return [...hours.keys()].filter(key => { const t = new Date(key).getTime(); return t >= from && t <= to; }).sort();
  }

  // Where a value read from the repository came from
  originOf(url) {
    return { label: 'ICATMAR GitHub', dataset: url.split('/').pop(), url };
  }

  async fetchRadialField(stationId, hour) {
    const file = await this.radialFile(stationId, hour);
    if (!file) return null;
    const { metadata, rows } = file;
    const [siteLat, siteLon] = String(metadata['Origin'] ?? '').trim().split(/\s+/).map(Number);
    if (!Number.isFinite(siteLat) || !Number.isFinite(siteLon)) return null;
    const site = { lat: siteLat, lon: siteLon };

    const lat = [], lon = [], velocity = [], direction = [], qc = [], ax = [], bx = [], rangeCell = [];
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    rows.forEach(row => {
      const { LATD: pLat, LOND: pLon, VELU: u, VELV: v } = row;
      if (![pLat, pLon, u, v].every(Number.isFinite)) return;
      const away = bearingAwayFrom(site, pLat, pLon);
      const rad = away * Math.PI / 180;
      lat.push(pLat); lon.push(pLon); direction.push(away);
      velocity.push((u * Math.sin(rad) + v * Math.cos(rad)) / 100);
      qc.push(row.PRIM ?? 1);
      ax.push(row.RNGE); bx.push(row.BEAR);
      // The spectra range cell: RNGE is SPRC range resolutions from the antenna
      rangeCell.push(Number.isFinite(row.SPRC) ? row.SPRC : -1);
      if (pLon < minLon) minLon = pLon; if (pLon > maxLon) maxLon = pLon;
      if (pLat < minLat) minLat = pLat; if (pLat > maxLat) maxLat = pLat;
    });
    return {
      source: 'GitHub',
      origin: this.originOf(this.radialUrl(stationId, hour)),
      time: hour,
      layout: 'polar',
      axisNames: ['RNGE', 'BEAR'], ax: Float32Array.from(ax), bx: Float32Array.from(bx),
      // Each bin's range cell (SPRC; -1 where a row lacks it)
      rangeCell: Int16Array.from(rangeCell),
      site,
      lat: Float32Array.from(lat), lon: Float32Array.from(lon),
      velocity: Float32Array.from(velocity), direction: Float32Array.from(direction), qc: Int8Array.from(qc),
      dataExtent: lat.length ? [minLon, minLat, maxLon, maxLat] : [site.lon, site.lat, site.lon, site.lat],
    };
  }

  // The newest hour with a totals file, from the manifest (undefined
  // without it - no probing)
  async getLatestTime() {
    const manifest = await this.loadManifest();
    if (!manifest?.totals.size) return undefined;
    const now = Date.now();
    const times = [...manifest.totals.keys()].map(key => new Date(key).getTime()).filter(t => t <= now);
    return times.length ? new Date(Math.max(...times)) : undefined;
  }

  // Which hours have a totals file from `startDate` on, from the manifest
  // (none without it - no probing). A file's points aren't comparable to the
  // ERDDAPs' counts, so every hour found counts as a full one:
  // [{ network, hours: { '<ISO hour>': 1 } }]
  async getAvailability(bbox, startDate) {
    const manifest = await this.loadManifest();
    const found = {};
    const from = startDate.getTime();
    const now = Date.now();
    manifest?.totals.forEach((rows, key) => {
      const t = new Date(key).getTime();
      if (t >= from && t <= now) found[key] = 1;
    });
    return [{ network: 'ICATMAR', hours: found }];
  }
}

export default SourceGithubHFR;
