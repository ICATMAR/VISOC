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
    // Proxy
    const proxyURL = 'https://api.icatmar.cat/proxy/';
    const proxiedUrl = proxyURL + '?url=' + encodeURIComponent(allDatasetsUrl);

    this.loadingPromise = this.fetchManager.fetch(proxiedUrl, 1).then(res => res.text()).then(text => {
      // Parse ERDDAP's CSV response
      const lines = text.trim().split('\n');
      const names = lines[0].split(',').map(h => h.trim());
      const units = lines[1].split(',').map(u => u.trim());

      const datasets = lines.slice(2).map(line => {
        const cells = line.split(',');
        const dataset = {};
        names.forEach((name, i) => dataset[name] = cells[i] == '' ? undefined : cells[i] == 'NaN' ? undefined : cells[i]?.trim());
        return dataset;
      });

      // Find the dataset with the specified name
      const datasetInfo = datasets.find(d => d['datasetID'] === this.dataset);
      if (!datasetInfo) {
        throw new Error(`Dataset '${this.dataset}' not found in ERDDAP source '${this.src}'`);
      }

      // Find start and end dates
      const startDateStr = datasetInfo['min_time'];
      const endDateStr = datasetInfo['max_time'];
      if (!startDateStr || !endDateStr) {
        console.log("Start or end date not found in dataset info, fetching max-min times from ERDDAP " + this.dataset);
        // Load max-min times of the dataset
        const maxMinUrl = `${baseUrl}/tabledap/${this.dataset}.csv?time&orderBy("time")`;
        // Proxy
        const proxiedMaxMinUrl = proxyURL + '?url=' + encodeURIComponent(maxMinUrl);
        // Request
        return this.fetchManager.fetch(proxiedMaxMinUrl, 1).then(res => res.text()).then(text => {
          // Parse the response to extract start and end dates
          const lines = text.trim().split('\n');
          const times = lines.slice(2).map(line => line.split(',')[0]);
          this.start = new Date(times[0]);
          this.end = new Date(times[times.length - 1]);
        }).catch(console.error);
      } else {
        this.start = new Date(startDateStr);
        this.end = new Date(endDateStr);
      }
    }).catch(console.error);    
  }
}

export default SourceErddap;
