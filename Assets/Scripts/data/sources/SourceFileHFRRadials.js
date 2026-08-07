import Source from './Source.js';

// Parses one .ruv value: a quoted string keeps its content, anything else
// that looks numeric becomes a Number - same convention as SourceFileHFRTotals.
function parseCell(raw) {
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  const num = Number(raw);
  return Number.isNaN(num) ? raw : num;
}


class SourceFileHFRRadials extends Source {

  constructor({ fetchManager, path, stations, fileStart, fileEnd, mapping }) {
    super({ fetchManager });
    this.path = path;
    this.stations = stations;
    this.fileStart = fileStart;
    this.fileEnd = fileEnd;

    // Start/end are known immediately from the config - no fetch needed.
    this.startDate = this.parseHourString(fileStart);
    this.endDate = this.parseHourString(fileEnd);

    this.loadingPromise = this.load();
  }

  // 'yyyy-mm-ddThh' -> UTC Date at that hour.
  parseHourString(str) {
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/);
    const [, year, month, day, hour] = match;
    return new Date(Date.UTC(+year, +month - 1, +day, +hour));
  }

  // Every hourly timestamp from startDate to endDate (inclusive) - one radial
  // file exists per station per hour.
  hourlyRange() {
    const hours = [];
    for (let t = this.startDate.getTime(); t <= this.endDate.getTime(); t += 3600000) hours.push(new Date(t));
    return hours;
  }

  // e.g. station 'CREU', 2026-07-25T09:00Z -> './Data/hfr/radials/RDLm_CREU_2026_07_25_0900_l2b.ruv'
  filePath(station, time) {
    const pad = n => String(n).padStart(2, '0');
    const y = time.getUTCFullYear();
    const m = pad(time.getUTCMonth() + 1);
    const d = pad(time.getUTCDate());
    const h = pad(time.getUTCHours());
    return `${this.path}RDLm_${station}_${y}_${m}_${d}_${h}00_l2b.ruv`;
  }

  async load() {
    const entries = [];
    this.hourlyRange().forEach(time => {
      this.stations.forEach(station => entries.push({ time, station, path: this.filePath(station, time) }));
    });

    const texts = await Promise.all(entries.map(e => this.fetchManager.fetch(e.path).then(res => res.text())));

    // Organized by timestamp, then by station name within each timestamp -
    // e.g. this.data[i] = { time, stations: { CREU: { metadata, rows }, ... } }
    const snapshots = new Map();
    entries.forEach((entry, i) => {
      const { metadata, variables, rows } = this.parseLLUV(texts[i]);
      if (!this.variables) this.variables = variables;

      const key = entry.time.getTime();
      if (!snapshots.has(key)) snapshots.set(key, { time: entry.time, stations: {} });
      snapshots.get(key).stations[entry.station] = { metadata, rows };
    });

    this.data = [...snapshots.values()].sort((a, b) => a.time - b.time);
  }

  // Parses one .ruv (CODAR LLUV radial) file: header metadata (%Key: Value
  // lines) and the main per-cell radial-velocity table, which self-describes
  // its own columns via %TableColumnTypes: - same convention as the .tuv
  // totals files. Diagnostic tables that follow (receiver/timing stats)
  // aren't needed here, so parsing stops once the first table is read.
  parseLLUV(text) {
    const lines = text.split('\n');

    const metadata = {};
    let variables = null;
    let rows = [];

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
            const cells = raw.split(/\s+/).map(parseCell);
            const row = {};
            names.forEach((name, idx) => row[name] = cells[idx]);
            tableRows.push(row);
          }
          i++;
        }

        variables = {};
        names.forEach(name => variables[name] = {});
        rows = tableRows;
        break; // only the radial-vector table is needed
      }

      // Generic %Key: Value metadata line (skip %% comments and %Table*
      // structural markers, which are handled above).
      if (line.startsWith('%') && !line.startsWith('%%') && !line.startsWith('%Table')) {
        const match = line.match(/^%([^:]+):\s?(.*)$/);
        if (match) metadata[match[1].trim()] = match[2].trim();
      }

      i++;
    }

    return { metadata, variables, rows };
  }

}

export default SourceFileHFRRadials;
