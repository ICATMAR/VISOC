

class Source {

  constructor({ fetchManager }) {
    this.fetchManager = fetchManager;

    // Nothing is known until the data is actually fetched - discovered, not declared.
    this.data = undefined;      // raw rows, once loaded
    this.variables = undefined; // { rawName: { unit } }, discovered from the data itself
    this.startDate = undefined; // Date, discovered from the data itself
    this.endDate = undefined;   // Date, discovered from the data itself
  }

  // Subclasses implement: fetch + parse (if not already loaded), and return the
  // raw rows within [startDate, endDate]. Standardizing (raw name/unit -> standard
  // code) is NOT this source's job - that happens above, in DataProduct.
  async getRange(startDate, endDate) { throw new Error('getRange() not implemented'); }

  // Parses ERDDAP's info/dataset metadata format (jsonlKVP: one JSON object
  // per line, each declaring a variable + its data type, or an attribute on a
  // variable / on NC_GLOBAL for dataset-level metadata). Shared by any source
  // that reads this format, whether fetched live (SourceErddap) or from a
  // static .jsonl export (SourceFileDrifters).
  parseERDDAPMetadata(text) {
    const rows = text.trim().split('\n').filter(line => line).map(line => JSON.parse(line));

    const variables = {};
    const metadata = {};

    rows.forEach(row => {
      const varName = row['Variable Name'];
      const attrName = row['Attribute Name'];
      const value = row['Value'];

      if (varName === 'NC_GLOBAL') {
        if (attrName) metadata[attrName] = value;
        return;
      }

      if (!variables[varName]) variables[varName] = {};
      if (row['Row Type'] === 'variable') variables[varName].dataType = row['Data Type'];
      else if (attrName) variables[varName][attrName] = value;
    });

    return { variables, metadata };
  }

}


export default Source;
