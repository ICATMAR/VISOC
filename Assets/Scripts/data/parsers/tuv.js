// Parser for CODAR LLUV totals files (.tuv) - shared by the sources that read
// them (local files, the ICATMAR GitHub repository).

// Parses one .tuv value: a quoted string ("CREU") keeps its content, anything
// else that looks numeric becomes a Number - works for both tables generically
// without needing to know which columns are strings vs numbers.
function parseCell(raw) {
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  const num = Number(raw);
  return Number.isNaN(num) ? raw : num;
}

// Parses one .tuv (CODAR LLUV totals) file: header metadata (%Key: Value
// lines), the gridded current-vector table, and the trailing station/site
// table - both tables self-describe their own columns via %TableColumnTypes:.
export function parseTuv(text) {
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
