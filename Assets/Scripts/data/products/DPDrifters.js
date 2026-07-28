import SourceErddap from '../sources/SourceErddap.js';
import SourceFileDrifters from '../sources/SourceFileDrifters.js';

class DPDrifters {

  constructor(fetchManager) {
    this.sources = [
      new SourceErddap({ fetchManager, src: 'https://erddap.icatmar.cat/erddap/index.html', dataset: 'socat_data_drifters_ICATMAR' }),
      new SourceFileDrifters({ fetchManager, path: './Data/drifters/drifters_deriva1.csv'}),
    ];

    console.log("DPDrifters: sources loaded", this.sources);
  }

}

export default DPDrifters;