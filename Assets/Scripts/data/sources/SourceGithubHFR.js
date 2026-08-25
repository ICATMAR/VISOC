import Source from './Source.js';

const GITHUB_API_URL = 'https://api.github.com/repos';
const REPO = 'ICATMAR/data';
const BRANCH = 'main';
const PATH = 'observational/hf_radar/currents/L2';

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

// How long load()'s repo-wide tree is cached for - short, since its only
// purpose is finding out how fresh each station's data currently is.
const TREE_TTL_MINUTES = 10;

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

  constructor({ fetchManager, src }) {
    super({ fetchManager });
    this.src = src;
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

  // Discovers every station's earliest/latest timestamp, from the repo's
  // file tree - fetched recursively in a SINGLE request (GitHub resolves a
  // branch name straight to its root tree), rather than walking every
  // station/month directory just to find out how fresh the data is.
  async load() {
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
  async getNumberOfValidPointsPerStations(stationIds, startDate, endDate) {
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

}

export default SourceGithubHFR;
