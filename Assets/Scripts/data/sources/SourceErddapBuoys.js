import Source from './Source.js';
import SourceErddap from './SourceErddap.js';

class SourceErddapBuoys extends Source {

  constructor({ fetchManager, src, datasets }) {
    super({ fetchManager });
    this.src = src;
    this.baseUrl = src.replace(/\/index\.html$/, '');
    this.datasets = datasets;
  }

}

export default SourceErddapBuoys;