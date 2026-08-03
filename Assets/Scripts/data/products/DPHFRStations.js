class DPHFRStations {

  constructor ({ fetchManager, sources }) {
    this.sources = sources.map(src => new src.Class({ fetchManager, ...src }));

    console.log('DPHFRStations: sources loaded', this.sources);
  }
}

export default DPHFRStations;