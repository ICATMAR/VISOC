import Source from './Source.js';

class SourceErddapEUHFRStations extends Source {

  constructor({ fetchManager, src, datasets, mapping, bbox }) {
    super({ fetchManager });
  }

}

export default SourceErddapEUHFRStations;
