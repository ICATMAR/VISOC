import Source from './Source.js';

class SourceFileHFRTotals extends Source {

  constructor({fetchManager, paths}) {
    super({ fetchManager });
    this.paths = paths;

    this.load();
  }

  // Load function
  async load() {

    // Get start-end dates from file names e.g. TOTL_CATS_2026_07_15_0900.tuv

    // Fetch files
    // Each file contains metadata for that timestamp (method, date, UUID) at the start
    // Then comes a table with the gridded data
    // At the end of the file there is a table with the stations. I would like you to merge this info-per-file and turn it into metadata-per-source, as I believe that all station tables are the same across files. If not, please let me know.   

  
  }
}

export default SourceFileHFRTotals;