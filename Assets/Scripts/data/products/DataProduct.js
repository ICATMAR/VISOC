class DataProduct {

  constructor({ fetchManager, sources }) {
    this.sources = sources.map(src => {
      const source = new src.Class({ fetchManager, ...src });
      source.institution = src.institution;
      return source;
    });

    console.log(`${this.constructor.name}: sources loaded`, this.sources);
  }

}

export default DataProduct;
