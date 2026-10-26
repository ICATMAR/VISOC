import Source from './Source.js';
import VectorField from '../VectorField.js';
import { parseTuv, tuvPoints, tuvCell, TUV_TO_STANDARD } from '../parsers/tuv.js';

// A few ICATMAR totals .tuv files shipped with the app - the last resort of
// the HFR dashboard, so it still shows something when every external service
// fails. Read like ICATMAR's GitHub files (the same format), answering the
// same calls as the other map sources (see DPHFRTotals), for these hours only:
// a file never stands in for another hour.
//
// The files are only read when one of their hours is actually asked for: the
// hours themselves come from the file names, so the questions every source is
// asked at start (which hours, the newest one, the counts of a recent range)
// are answered without reading anything.

const HALF_HOUR_MS = 30 * 60 * 1000;
// The hour a time belongs to: 10:00 is 9:30 to 10:30
const hourOf = time => new Date(Math.floor((time.getTime() + HALF_HOUR_MS) / 3600000) * 3600000);
// The units of TUV_TO_STANDARD's variables, as the ERDDAPs publish them
const UNITS = { EWCT: 'm s-1', NSCT: 'm s-1', EWCS: 'm s-1', NSCS: 'm s-1', CCOV: 'm2 s-2', GDOP: '1' };

class SourceFileHFRTotals extends Source {

  constructor({ fetchManager, paths, provider }) {
    super({ fetchManager });
    this.paths = paths;
    this.provider = provider;

    // Start/end are known immediately from the file names - no fetch needed.
    const times = paths.map(p => this.timestampFromPath(p)).filter(Boolean).sort((a, b) => a - b);
    this.startDate = times[0];
    this.endDate = times[times.length - 1];

    this.fields = new Map(); // '<ISO hour>' -> VectorField
  }

  // The files, read the first time something needs them (see the top)
  get loadingPromise() {
    this.loading ??= this.load();
    return this.loading;
  }

  // The hours the files are from (by their names), in [startDate, endDate]
  hoursIn(startDate, endDate = new Date()) {
    return this.paths.map(p => this.timestampFromPath(p)).filter(time => time && time >= startDate && time <= endDate);
  }

  // Extracts the UTC timestamp from a filename, e.g. TOTL_CATS_2026_07_15_0900.tuv
  timestampFromPath(path) {
    const match = path.match(/(\d{4})_(\d{2})_(\d{2})_(\d{2})(\d{2})\.tuv$/);
    if (!match) return null;
    const [, year, month, day, hour, minute] = match;
    return new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute));
  }

  async load() {
    const texts = await Promise.all(this.paths.map(path => this.fetchManager.fetch(path).then(res => res.text())));

    // The station table is NOT constant across files - which sites contributed
    // (and how much: NUMV, coverage bounds, PATH, UUID) genuinely varies per
    // timestamp (e.g. a site can be offline for one snapshot and back for the
    // next), so it's kept per-snapshot, alongside that snapshot's grid.
    const snapshots = this.paths.map((path, i) => {
      const { metadata, variables, rows, stations } = this.parseTuv(texts[i]);
      if (!this.variables) this.variables = variables;
      return { time: this.timestampFromPath(path), path, metadata, rows, stations };
    });

    this.data = snapshots.sort((a, b) => a.time - b.time);
  }

  // See parsers/tuv.js
  parseTuv(text) {
    return parseTuv(text);
  }

  // The loaded snapshots, [] if the files couldn't be read
  async snapshots() {
    try {
      await this.loadingPromise;
    } catch (error) {
      console.error('HF radar static files:', error);
      return [];
    }
    return this.data ?? [];
  }

  // The snapshot of the hour `time`, or undefined
  async snapshotAt(time) {
    const key = hourOf(time).getTime();
    // No file of that hour: nothing to read
    if (!this.hoursIn(new Date(key - HALF_HOUR_MS), new Date(key + HALF_HOUR_MS)).some(t => hourOf(t).getTime() === key)) return undefined;
    return (await this.snapshots()).find(s => hourOf(s.time).getTime() === key);
  }

  async snapshotsIn(startDate, endDate = new Date()) {
    if (this.hoursIn(startDate, endDate).length === 0) return [];
    return (await this.snapshots()).filter(s => s.time >= startDate && s.time <= endDate);
  }

  // Where a value read from one of the files came from
  originOf(snapshot) {
    return { label: this.label, source: this.label, dataset: snapshot.path.split('/').pop(), url: snapshot.path };
  }

  // The map for the hour `time`, or null if no file is from that hour
  async getField(time) {
    const snapshot = await this.snapshotAt(time);
    if (!snapshot) return null;
    const key = snapshot.time.toISOString();
    if (!this.fields.has(key)) {
      const field = VectorField.fromPoints(tuvPoints(snapshot.rows), snapshot.time, 'ICATMAR');
      // Which file it is from, and where
      if (field) Object.assign(field, { dataset: this.originOf(snapshot).dataset, url: snapshot.path });
      this.fields.set(key, field);
    }
    return this.fields.get(key);
  }

  // From the file names - nothing read
  async getLatestTime() {
    return this.endDate;
  }

  // Which hours have a file from `startDate` on, each a full one (as
  // GitHub's) - from the file names, nothing read
  async getAvailability(bbox, startDate) {
    const hours = {};
    this.hoursIn(startDate).forEach(time => { hours[hourOf(time).toISOString()] = 1; });
    return [{ network: 'ICATMAR', hours }];
  }

  // How many vectors each file holds in [startDate, endDate], keyed as the
  // other sources' counts are
  async getValidPointsCount(startDate, endDate) {
    const points = {}, origins = {};
    (await this.snapshotsIn(startDate, endDate)).forEach(s => {
      const key = hourOf(s.time).toISOString().replace('.000Z', 'Z');
      points[key] = s.rows.length;
      origins[key] = this.originOf(s);
    });
    return { points, origins };
  }

  // The current at the grid cell nearest (lon, lat), hour by hour - as
  // SourceErddapHFRadars.getPointSeries answers it
  async getPointSeries(lon, lat, startDate, endDate) {
    const result = { cell: undefined, network: undefined, dataset: undefined, data: {} };
    (await this.snapshotsIn(startDate, endDate)).forEach(s => {
      const found = tuvCell(s.rows, lon, lat);
      const u = found?.values.EWCT, v = found?.values.NSCT;
      if (!Number.isFinite(u) || !Number.isFinite(v)) return;
      result.data[hourOf(s.time).toISOString()] = { u, v, speed: Math.hypot(u, v), direction: (Math.atan2(u, v) * 180 / Math.PI + 360) % 360, time: s.time };
      result.cell ??= found.cell;
      result.network ??= 'ICATMAR';
      result.dataset ??= this.originOf(s).dataset;
    });
    return result;
  }

  // Every variable of the grid cell nearest (lon, lat), hour by hour, under
  // the EU HFR Node's names - as SourceErddapHFRadars.getCellSeries answers
  // it. null when no file has the cell.
  async getCellSeries(network, lon, lat, startDate, endDate) {
    if (network && network !== 'ICATMAR') return null;
    const names = Object.values(TUV_TO_STANDARD).map(t => t.name);
    const result = {
      network: 'ICATMAR', dataset: undefined, cell: undefined, eastward: 'EWCT', northward: 'NSCT',
      variables: names.map(name => ({ name, attributes: { units: UNITS[name] } })),
      data: Object.fromEntries(names.map(name => [name, {}])),
      origins: {},
    };
    (await this.snapshotsIn(startDate, endDate)).forEach(s => {
      const found = tuvCell(s.rows, lon, lat);
      if (!found) return;
      const key = hourOf(s.time).toISOString();
      Object.entries(found.values).forEach(([name, value]) => { result.data[name][key] = value; });
      result.origins[key] = { ...this.originOf(s), cell: found.cell };
      result.cell ??= found.cell;
      result.dataset ??= this.originOf(s).dataset;
    });
    return result.cell ? result : null;
  }

  // A file's header, for describing where an hour came from
  async getDatasetMetadata(dataset) {
    const snapshot = (await this.snapshots()).find(s => this.originOf(s).dataset === dataset);
    return snapshot ? { ...snapshot.metadata, infoUrl: snapshot.path } : {};
  }
}

export default SourceFileHFRTotals;
