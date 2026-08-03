class DPHFRNetwork {

  constructor ({ fetchManager, sources }) {
    this.sources = sources.map(src => new src.Class({ fetchManager, ...src }));

    console.log('DPHFRNetwork: sources loaded', this.sources);
  }
}

export default DPHFRNetwork;