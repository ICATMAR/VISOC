// Paste into the browser DevTools console while on an ERDDAP site itself
// (e.g. https://erddap.icatmar.cat/erddap/) - same-origin, so no CORS/proxy
// needed. Opens one tab per dataset's CSV download URL; allow popups for the
// site if the browser blocks some of them.

(async () => {
  const erddapUrl = 'https://erddap.icatmar.cat/erddap/index.html'
  const datasetsCommonKey = 'BUOY_'

  const startDate = '2026-01-01T00:00:00Z';
  const endDate = '2026-07-01T00:00:00Z';

  const baseUrl = erddapUrl.replace(/\/index\.html$/, '');

  // allDatasets.jsonlKVP lists every dataset on the server, one JSON object per line.
  async function fetchAllDatasets() {
    const url = `${baseUrl}/tabledap/allDatasets.jsonlKVP`;
    const text = await fetch(url).then(res => res.text());
    return text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  }

  // Variable names from the dataset's info page, in dataset column order, skipping station_id.
  async function fetchVariables(dataset) {
    const url = `${baseUrl}/info/${dataset}/index.jsonlKVP`;
    const text = await fetch(url).then(res => res.text());
    const rows = text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));

    const variables = [];
    rows.forEach(row => {
      const varName = row['Variable Name'];
      if (row['Row Type'] !== 'variable') return;
      if (varName === 'NC_GLOBAL' || varName === 'station_id') return;
      variables.push(varName);
    });
    return variables;
  }

  function buildDownloadUrl(dataset, variables) {
    const varsPart = variables.map(encodeURIComponent).join('%2C');
    return `${baseUrl}/tabledap/${dataset}.csv?${varsPart}&time%3E=${encodeURIComponent(startDate)}&time%3C=${encodeURIComponent(endDate)}`;
  }

  const allDatasets = await fetchAllDatasets();
  const buoyDatasets = allDatasets.map(d => d['datasetID']).filter(id => id.startsWith(datasetsCommonKey));

  for (const dataset of buoyDatasets) {
    try {
      const variables = await fetchVariables(dataset);
      const url = buildDownloadUrl(dataset, variables);
      console.log(`Opening ${dataset}`, url);
      window.open(url, '_blank');
      await new Promise(r => setTimeout(r, 2000)); // small gap so the popup blocker doesn't choke
    } catch (err) {
      console.error(`Failed for ${dataset}: ${err.message}`);
    }
  }

  console.log('Done.');
})();
