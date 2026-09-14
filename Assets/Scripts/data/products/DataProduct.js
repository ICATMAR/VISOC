class DataProduct {

  constructor(catalogueDP, fetchManager) {
    this.fetchManager = fetchManager; // kept for subclasses' own supplementary fetches, beyond their configured sources
    this.name = catalogueDP.name;
    this.description = catalogueDP.description;
    this.type = catalogueDP.type;

    this.sources = catalogueDP.sources.map(src => {
      const source = new src.Class({ fetchManager, ...src });
      source.institution = src.institution;
      // Standardizing raw names/units into standard codes is the product's
      // job, not the source's (see Source.js), so the catalogue's mapping is
      // carried here rather than inside the source.
      source.mapping = src.mapping;
      source.sensorMapping = src.sensorMapping;
      return source;
    });

    console.log(`${this.constructor.name}: sources loaded`, this.sources);
  }

  // What the catalogue says about one of a source's raw variables:
  // { code, unitTransform }, both optional. `sensorMapping` is for sources
  // whose sensors disagree with each other (two instruments reporting a
  // 'temperature' in different units) and wins over the source-wide `mapping`.
  variableMapping(source, name, sensorId) {
    return source.sensorMapping?.[sensorId]?.[name] ?? source.mapping?.[name];
  }

  // The standard code a raw variable is known by. A variable the catalogue
  // doesn't map keeps its own name - it isn't dropped, it just stays raw.
  standardCode(source, name, sensorId) {
    return this.variableMapping(source, name, sensorId)?.code ?? name;
  }

  // A raw value in the unit its standard code is defined in
  standardValue(source, name, value, sensorId) {
    const unitTransform = this.variableMapping(source, name, sensorId)?.unitTransform;
    return unitTransform ? unitTransform(value) : value;
  }

  // A whole record - { rawName: value } -> { standardCode: value }
  standardize(source, values, sensorId) {
    const record = {};
    Object.entries(values).forEach(([name, value]) => {
      record[this.standardCode(source, name, sensorId)] = this.standardValue(source, name, value, sensorId);
    });
    return record;
  }

}

export default DataProduct;
