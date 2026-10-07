import DP from './DataProduct.js';

// Virtual buoys built out of real ones - e.g. BCNS (Barcelona), which takes its
// waves from Puertos del Estado's Port Barcelona buoy (PBCN) and its wind,
// water temperature and currents from Somorrostro (SOMO), two moorings a few
// kilometres apart that each measure well what the other doesn't.
//
// No sources of its own: like DPHFRNetwork, it composes another product -
// DPBuoys, which already knows how to find, merge and fetch every real buoy -
// and only decides which real buoy answers for which variable. Which ones,
// and how, is the catalogue's `aggregations`:
//
//   { id, name, description, positionFrom: '<buoyId>',
//     components: [{ buoyId, codes: [...], label }, { buoyId, default: true }] }
//
// A code listed by a component comes from that buoy; any other code comes
// from the component marked `default`.
//
// Every method also answers for REAL buoys, by passing straight through to
// DPBuoys, so a caller can treat this product as "all buoys, virtual ones
// included" without checking which kind it is asking about.
class DPAggregatedBuoys extends DP {

  constructor(catalogueDP, fetchManager, buoysProduct) {
    super(catalogueDP, fetchManager);
    this.buoysProduct = buoysProduct;
    this.aggregations = catalogueDP.aggregations ?? [];
  }

  getAggregation(buoyId) {
    return this.aggregations.find(aggregation => aggregation.id === buoyId);
  }

  isAggregated(buoyId) {
    return this.getAggregation(buoyId) != undefined;
  }

  // The real buoy a code is read from. A real buoy answers for itself.
  componentBuoyId(buoyId, code) {
    const aggregation = this.getAggregation(buoyId);
    if (!aggregation) return buoyId;
    const component = aggregation.components.find(c => c.codes?.includes(code))
      ?? aggregation.components.find(c => c.default)
      ?? aggregation.components[0];
    return component.buoyId;
  }

  // Every real buoy a virtual one is made of (just itself for a real one)
  componentBuoyIds(buoyId) {
    const aggregation = this.getAggregation(buoyId);
    return aggregation ? aggregation.components.map(c => c.buoyId) : [buoyId];
  }

  // A virtual buoy as a buoy object, out of its components' own (`buoys`, the
  // real ones, merged or static). Position from `positionFrom`, the rest of
  // the descriptive fields from it too where the aggregation doesn't say -
  // a virtual buoy has no hull, no depth of its own.
  buildBuoy(aggregation, buoys) {
    const components = aggregation.components.map(component => ({
      ...component,
      buoy: buoys.find(buoy => buoy.id === component.buoyId),
    }));
    const main = buoys.find(buoy => buoy.id === aggregation.positionFrom) ?? components[0]?.buoy ?? {};
    const institutions = [...new Set(components.map(c => c.buoy?.institution).filter(Boolean))];

    const endDates = components.map(c => c.buoy?.endDate).filter(Boolean);
    const startDates = components.map(c => c.buoy?.startDate).filter(Boolean);

    return {
      id: aggregation.id,
      name: aggregation.name,
      description: aggregation.description,
      latitude: main.latitude,
      longitude: main.longitude,
      depth: main.depth,
      distanceToCoast: main.distanceToCoast,
      license: main.license,
      institution: institutions.join(' / '),
      aggregated: true,
      components,
      sensors: [],
      startDate: startDates.length ? new Date(Math.min(...startDates)) : undefined,
      endDate: endDates.length ? new Date(Math.max(...endDates)) : undefined,
    };
  }

  // Static list - DPBuoys' static buoys plus the virtual ones built on them.
  // Synchronous, for a first paint before any source has answered.
  getBuoys() {
    const buoys = this.buoysProduct.getBuoys();
    return [...buoys, ...this.aggregations.map(aggregation => this.buildBuoy(aggregation, buoys))];
  }

  // Same, from DPBuoys' merged, live view of every buoy (see DPBuoys.loadBuoys)
  async loadBuoys() {
    const buoys = await this.buoysProduct.loadBuoys();
    return [...buoys, ...this.aggregations.map(aggregation => this.buildBuoy(aggregation, buoys))];
  }

  // Measurements for one buoy, in the shape DPBuoys.getBuoyDetailData returns:
  //
  //   { buoyId, data: { '<ISO>': { <code>: { value, sensor, source, buoy } } },
  //     used: { <code>: { source, sensor, buoy } }, missing: [<code>], errors: [...] }
  //
  // For a virtual buoy each component is asked for its own codes only, and
  // every value says which real buoy (`buoy`) it was measured on. Timestamps
  // are kept as each buoy reports them - the two do not report on the same
  // clock, and averaging them into a common interval is the caller's job.
  async getBuoyDetailData(buoyId, codes, startDate, endDate) {
    const aggregation = this.getAggregation(buoyId);
    if (!aggregation) return this.buoysProduct.getBuoyDetailData(buoyId, codes, startDate, endDate);

    const codesByComponent = new Map();
    codes.forEach(code => {
      const component = this.componentBuoyId(buoyId, code);
      if (!codesByComponent.has(component)) codesByComponent.set(component, []);
      codesByComponent.get(component).push(code);
    });

    const results = await Promise.all([...codesByComponent].map(([component, componentCodes]) =>
      this.buoysProduct.getBuoyDetailData(component, componentCodes, startDate, endDate)
        .catch(error => ({ buoyId: component, data: {}, used: {}, missing: componentCodes, errors: [`${component}: ${error.message ?? error}`] }))));

    const merged = { buoyId, data: {}, used: {}, missing: [], errors: [] };
    results.forEach(result => {
      const component = result.buoyId;
      Object.entries(result.data).forEach(([timestamp, byCode]) => {
        if (merged.data[timestamp] == undefined) merged.data[timestamp] = {};
        Object.entries(byCode).forEach(([code, point]) => {
          merged.data[timestamp][code] = { ...point, buoy: component };
        });
      });
      Object.entries(result.used).forEach(([code, used]) => { merged.used[code] = { ...used, buoy: component }; });
      merged.missing.push(...result.missing);
      merged.errors.push(...result.errors);
    });

    return merged;
  }

}

export default DPAggregatedBuoys;
