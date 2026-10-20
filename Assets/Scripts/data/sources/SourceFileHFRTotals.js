import Source from './Source.js';
import { parseTuv } from '../parsers/tuv.js';

class SourceFileHFRTotals extends Source {

  constructor({ fetchManager, paths }) {
    super({ fetchManager });
    this.paths = paths;

    // Start/end are known immediately from the file names - no fetch needed.
    const times = paths.map(p => this.timestampFromPath(p)).filter(Boolean).sort((a, b) => a - b);
    this.startDate = times[0];
    this.endDate = times[times.length - 1];

    this.loadingPromise = this.load();
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
      return { time: this.timestampFromPath(path), metadata, rows, stations };
    });

    this.data = snapshots.sort((a, b) => a.time - b.time);
  }

  // See parsers/tuv.js
  parseTuv(text) {
    return parseTuv(text);
  }
}

export default SourceFileHFRTotals;
