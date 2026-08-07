import Source from './Source.js';

// Data Deriva-1 (time-varying) - change htmlTable for csv in the url
// https://erddap.icatmar.cat/erddap/tabledap/socat_data_drifters_ICATMAR.htmlTable?buoy_name%2Ctime%2Clatitude%2Clongitude%2Ctemperature&exercise=%22DERIVA-1%22&distinct()
// --> drifters_deriva1.csv
// Time-invariant data for Deriva-1 - change htmlTable for jsonlKVP in the url
// https://erddap.icatmar.cat/erddap/tabledap/socat_data_drifters_ICATMAR.htmlTable?deployment_id%2Cbuoy_name%2Cdrifter_type%2Cinstitution%2Cproject%2Cpi_name%2Cexercise&exercise=%22DERIVA-1%22&distinct()
// --> drifters_deriva1_timeless.jsonl
// Metadata drifters - change htmlTable for jsonlKVP in the url
// https://erddap.icatmar.cat/erddap/info/socat_data_drifters_ICATMAR/index.htmlTable
// --> drifters_metadata.jsonl


class SourceFileDrifters extends Source {

  constructor({ fetchManager, path }) {
    super({ fetchManager });
    this.path = path;
    this.timelessPath = path.replace('.csv', '_timeless.jsonl');
    this.metaPath = path.substring(0, path.lastIndexOf('/') + 1) + 'drifters_metadata.jsonl';

    this.metadata = undefined; // NC_GLOBAL attributes, from drifters_metadata.jsonl

    this.loadingPromise = this.load();
  }

  async load() {
    const [dataText, timelessText, metaText] = await Promise.all([
      this.fetchManager.fetch(this.path).then(res => res.text()),
      this.fetchManager.fetch(this.timelessPath).then(res => res.text()),
      this.fetchManager.fetch(this.metaPath).then(res => res.text()),
    ]);

    // Data (time-varying): line 1 = names, line 2 = units, then rows
    const dataLines = dataText.trim().split('\n');
    const names = dataLines[0].split(',').map(h => h.trim());

    // Timeless (time-invariant, one row per drifter): jsonlKVP, one object per line
    const timelessRows = timelessText.trim().split('\n').filter(line => line).map(line => JSON.parse(line));

    // Find the (only) common column between data and timeless rows - the join key
    const id = names.find(name => Object.keys(timelessRows[0] ?? {}).includes(name));

    const timelessMap = {};
    timelessRows.forEach(row => timelessMap[row[id]] = row);

    // Data rows, with the matching timeless fields merged in flat (not nested)
    const rows = dataLines.slice(2).map(line => {
      const cells = line.split(',');
      const row = {};
      names.forEach((name, i) => row[name] = cells[i]?.trim());
      Object.assign(row, timelessMap[row[id]]);
      row.timestamp = row.time;
      row.time = new Date(row.time);
      return row;
    });

    const { variables, metadata } = this.parseERDDAPMetadata(metaText);

    this.data = rows;
    this.variables = variables;
    this.metadata = metadata;
    this.startDate = rows.reduce((min, row) => row.time < min ? row.time : min, rows[0].time);
    this.endDate = rows.reduce((max, row) => row.time > max ? row.time : max, rows[0].time);
  }

}

export default SourceFileDrifters;
