import Source from './Source.js';

// Data Deriva-1
// https://erddap.icatmar.cat/erddap/tabledap/socat_data_drifters_ICATMAR.htmlTable?buoy_name%2Ctime%2Clatitude%2Clongitude%2Ctemperature&exercise=%22DERIVA-1%22&distinct()
// --> ./Data/drifters/drifters_deriva1.csv
// Metadata Deriva-1
// https://erddap.icatmar.cat/erddap/tabledap/socat_data_drifters_ICATMAR.htmlTable?deployment_id%2Cbuoy_name%2Cdrifter_type%2Cinstitution%2Cproject%2Cpi_name%2Cexercise&exercise=%22DERIVA-1%22&distinct()
// --> ./Data/drifters_deriva1_meta.csv


class SourceFileDrifters extends Source {

  constructor({ fetchManager, path}) {
    super({ fetchManager });
    this.path = path;
    // Load data
    this.loadingPromise = this.load();
  }


  async load(){
    // Fetch data
    this.fetchManager.fetch(this.path).then(res => res.text()).then((r) => {
      // Fetch metadata
      this.fetchManager.fetch(this.path.replace('.csv', '_meta.csv')).then(res => res.text()).then((m) => {
        // Parse data
        const lines = r.trim().split('\n');
        const names = lines[0].split(',').map(h => h.trim());
        const units = lines[1].split(',').map(u => u.trim());

        // Parse metadata
        const metaLines = m.trim().split('\n');
        const metaNames = metaLines[0].split(',').map(h => h.trim());

        // Find (the only) common name (id) between data and metadata
        const id = names.find(name => metaNames.includes(name));

        // Create a map of metadata by id
        const metadataMap = {};
        metaLines.slice(1).forEach(line => {
          // Split line by commas, but ignore commas inside quotes
          const cells = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
                            .map(s => s.replace(/^"(.*)"$/, '$1'));
          const metaRow = {};
          metaNames.forEach((name, i) => metaRow[name] = cells[i]?.trim());
          metadataMap[metaRow[id]] = metaRow;
        });

        // Iterate data
        const rows = lines.slice(2).map(line => {
          const cells = line.split(',');
          const row = {};
          names.forEach((name, i) => row[name] = cells[i]?.trim());
          // Merge metadata fields directly onto the row (flat - not nested under
          // row.metadata - so every field, measured or descriptive, is reached
          // the same way: row[name]).
          Object.assign(row, metadataMap[row[id]]);
          // Normalize time and timestamp
          row.timestamp = row.time;
          row.time = new Date(row.time);
          return row;
        });
        // Variables and units (later to extend with metadata? CF...)
        const variables = {};
        names.forEach((name, i) => variables[name] = { unit: units[i] || undefined });

        // Store source data, variables, and startDate/endDate
        this.data = rows;
        this.variables = variables;
        this.startDate = rows.reduce((min, row) => row.time < min ? row.time : min, rows[0].time);
        this.endDate = rows.reduce((max, row) => row.time > max ? row.time : max, rows[0].time);

      }).catch(console.error);




    }).catch(console.error);
  }
}

export default SourceFileDrifters;
