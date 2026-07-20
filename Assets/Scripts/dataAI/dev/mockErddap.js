// ============================================================================
// data/dev/mockErddap.js
//
// A development helper: a mock-fetch ROUTE that answers ERDDAP tabledap
// (.jsonlKVP) requests with synthetic data, in the exact format the real
// ErddapSource.parse expects. Register it on createMockFetch(), and the whole
// data stack runs with no server. Swap to the real httpFetch later — the parser
// is unchanged because the mock speaks the real wire format.
// ============================================================================

/**
 * Build a mock route for one dataset.
 * @param {Object} cfg
 * @param {string} cfg.dataset                          dataset id to match in the URL
 * @param {Object.<string,(d:Date)=>number|null>} cfg.values   column -> value(date)
 * @param {number} [cfg.stepMs=3600000]                 sample cadence (hourly)
 * @returns {{ test:(url:string)=>boolean, respond:(url:string)=>string }}
 */
export function erddapMockRoute({ dataset, values, stepMs = 3600_000 }) {
  const test = (url) => url.includes(`${dataset}.jsonlKVP`);

  const respond = (url) => {
    const columns = extractColumns(url);            // e.g. ['time','TEMP']
    const { start, end } = extractTimeRange(url);
    if (!start || !end) return '\n';

    const lines = [];
    // align first sample up to the next whole step
    let t = Math.ceil(start.getTime() / stepMs) * stepMs;
    for (; t <= end.getTime(); t += stepMs) {
      const d = new Date(t);
      const row = { time: d.toISOString() };
      for (const col of columns) {
        if (col === 'time') continue;
        const fn = values[col];
        if (fn) row[col] = fn(d);
      }
      lines.push(JSON.stringify(row));
    }
    return lines.join('\n') + '\n';
  };

  return { test, respond };
}

// ---- tiny URL parsers (mirror what ErddapSource.blockRequest builds) --------

function extractColumns(url) {
  const q = url.split('?')[1] || '';
  const colPart = q.split('&')[0] || '';
  return decodeURIComponent(colPart).split(',').filter(Boolean);
}

function extractTimeRange(url) {
  const geMatch = url.match(/time>=([^&]+)/);
  const leMatch = url.match(/time<=([^&]+)/);
  return {
    start: geMatch ? new Date(decodeURIComponent(geMatch[1])) : null,
    end: leMatch ? new Date(decodeURIComponent(leMatch[1])) : null,
  };
}
