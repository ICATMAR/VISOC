class DPDrifters {

  constructor({ fetchManager, sources }) {
    this.sources = sources.map(src => new src.Class({ fetchManager, ...src }));

    console.log("DPDrifters: sources loaded", this.sources);
  }

}

export default DPDrifters;