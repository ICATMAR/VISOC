

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

}


export default Source;
