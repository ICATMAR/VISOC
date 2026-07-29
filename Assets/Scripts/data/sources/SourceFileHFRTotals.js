import Source from './Source.js';

// Parses one .tuv value: a quoted string ("CREU") keeps its content, anything
// else that looks numeric becomes a Number - works for both tables generically
// without needing to know which columns are strings vs numbers.
function parseCell(raw) {
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  const num = Number(raw);
  return Number.isNaN(num) ? raw : num;
}


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

  // Parses one .tuv (CODAR LLUV totals) file: header metadata (%Key: Value
  // lines), the gridded current-vector table, and the trailing station/site
  // table - both tables self-describe their own columns via %TableColumnTypes:.
  parseTuv(text) {
    const lines = text.split('\n');

    const metadata = {};
    let variables = null;
    let rows = [];
    let stations = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith('%TableColumnTypes:')) {
        const names = line.slice('%TableColumnTypes:'.length).trim().split(/\s+/);
        i++;
        while (i < lines.length && !lines[i].startsWith('%TableStart')) i++;
        i++; // past %TableStart:
        while (i < lines.length && lines[i].startsWith('%%')) i++; // skip label/unit comment lines

        const tableRows = [];
        while (i < lines.length && !lines[i].startsWith('%TableEnd')) {
          const raw = lines[i].trim();
          if (raw) {
            // Grid rows have no prefix; station rows are prefixed with '%'.
            const cells = raw.replace(/^%/, '').trim().split(/\s+/).map(parseCell);
            const row = {};
            names.forEach((name, idx) => row[name] = cells[idx]);
            tableRows.push(row);
          }
          i++;
        }

        if (variables == null) {
          // First table: the gridded current data
          variables = {};
          names.forEach(name => variables[name] = {});
          rows = tableRows;
        } else {
          // Second table: station/site list
          stations = tableRows;
        }
        continue; // already advanced past %TableEnd; don't increment again below
      }

      // Generic %Key: Value metadata line (skip %% comments and %Table*
      // structural markers, which are handled above).
      if (line.startsWith('%') && !line.startsWith('%%') && !line.startsWith('%Table')) {
        const match = line.match(/^%([^:]+):\s?(.*)$/);
        if (match) metadata[match[1].trim()] = match[2].trim();
      }

      i++;
    }

    return { metadata, variables, rows, stations };
  }

}

export default SourceFileHFRTotals;
