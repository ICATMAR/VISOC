import Source from './Source.js';

class SourceErddap extends Source {

  constructor({ fetchManager, src, dataset}) {
    super({ fetchManager });
    this.src = src;
    this.dataset = dataset;

    // Construct url with all datasets
    // Remove index.html from src
    const baseUrl = src.replace(/\/index\.html$/, '');
    const allDatasetsUrl = `${baseUrl}/tabledap/allDatasets.csv`;
    this.fetchManager.fetch(allDatasetsUrl).then(res => {
      debugger;
      // Parse ERDDAP's CSV response
      const lines = text.trim().split('\n');
      const names = lines[0].split(',').map(h => h.trim());
      const units = lines[1].split(',').map(u => u.trim());

      const datasets = lines.slice(2).map(line => {
        const cells = line.split(',');
        const dataset = {};
        names.forEach((name, i) => dataset[name] = cells[i]);
        return dataset;
      });

      // Find the dataset with the specified name
      const datasetInfo = datasets.find(d => d['datasetID'] === this.dataset);
      if (!datasetInfo) {
        throw new Error(`Dataset '${this.dataset}' not found in ERDDAP source '${this.src}'`);
      }

      // Find start and end dates
      debugger;
      const startDateStr = datasetInfo['min_time'];
      const endDateStr = datasetInfo['max_time'];
      if (!startDateStr || !endDateStr) {
        throw new Error(`Dataset '${this.dataset}' does not have valid start and end dates`);
      }
      this.start = new Date(startDateStr);
      this.end = new Date(endDateStr);
    });    
  }
}

export default SourceErddap;
