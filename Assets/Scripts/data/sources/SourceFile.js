import Source from './Source.js';

class SourceFile extends Source {

  constructor({ fetchManager, path, timeColumn = 'time' }) {
    super({ fetchManager });
    this.path = path;
    this.timeColumn = timeColumn;
    this.format = path.split('.').pop().toLowerCase(); // 'json' | 'csv', from the file extension
    this.load().then(() => console.log(this.startDate, this.endDate)).catch(console.error);
  }

  async getRange(startDate, endDate) {
    if (!this.data) await this.load();
    return this.data.filter(row => row.time >= startDate && row.time <= endDate);
  }

  // Fetches + parses the file once. Discovers variables and startDate/endDate
  // from the data itself - nothing about the file's content is assumed beforehand.
  async load() {
    const res = await this.fetchManager.fetch(this.path);
    const { rows, variables } = await this.parseRows(res);

    // Normalize the time column into a real Date under `row.time`, so every
    // row has an unambiguous timestamp regardless of the source's raw column name.
    rows.forEach(row => row.time = new Date(row[this.timeColumn]));

    this.data = rows;
    this.variables = variables;
    this.startDate = rows.reduce((min, row) => row.time < min ? row.time : min, rows[0].time);
    this.endDate = rows.reduce((max, row) => row.time > max ? row.time : max, rows[0].time);
  }

  async parseRows(res) {
    switch (this.format) {
      case 'json': return this.parseJson(await res.json());
      case 'csv':  return this.parseCsv(await res.text());
      default: throw new Error(`SourceFile: unsupported format '${this.format}'`);
    }
  }

  // JSON: array of flat row objects. The format doesn't self-describe units.
  parseJson(rows) {
    const variables = {};
    Object.keys(rows[0] ?? {}).forEach(name => variables[name] = { unit: undefined });
    return { rows, variables };
  }

  // ERDDAP .csv convention: line 1 = column names, line 2 = units, then data.
  parseCsv(text) {
    const lines = text.trim().split('\n');
    const names = lines[0].split(',').map(h => h.trim());
    const units = lines[1].split(',').map(u => u.trim());

    const variables = {};
    names.forEach((name, i) => variables[name] = { unit: units[i] || undefined });

    const rows = lines.slice(2).map(line => {
      const cells = line.split(',');
      const row = {};
      names.forEach((name, i) => row[name] = cells[i]?.trim());
      return row;
    });

    return { rows, variables };
  }

}

export default SourceFile;
