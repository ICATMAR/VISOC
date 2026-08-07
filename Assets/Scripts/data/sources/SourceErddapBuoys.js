import Source from './Source.js';
import SourceErddap from './SourceErddap.js';

// Earliest start and latest end among a list of entries (sensors or buoys -
// both carry startDate/endDate), shared by dateRange() and per-buoy dates.
function dateRangeOf(entries) {
  const startDates = entries.map(e => e.startDate).filter(Boolean);
  const endDates = entries.map(e => e.endDate).filter(Boolean);
  return {
    startDate: startDates.length ? new Date(Math.min(...startDates)) : undefined,
    endDate: endDates.length ? new Date(Math.max(...endDates)) : undefined,
  };
}

class SourceErddapBuoys extends Source {

  constructor({ fetchManager, src, datasetCommonKey }) {
    super({ fetchManager });
    this.src = src;
    this.baseUrl = src.replace(/\/index\.html$/, '');
    this.datasetCommonKey = datasetCommonKey;

    // Array of buoys. Inside each buoy object: id, array of sensors (metadata, variables...), lat-long, institution, acknowledgement
    this.buoys = [];

    this.loadingPromise = this.load();
  }

  async load() {
    // allDatasets.jsonlKVP lists every dataset on the server. Every buoy
    // dataset ID follows datasetCommonKey_<name>_<sensor> (e.g.
    // BUOY_MEDES_ADCP, BUOY_SOMO_CTD, ...)
    const allDatasets = await SourceErddap.fetchAllDatasets(this.fetchManager, this.baseUrl);
    const buoyDatasets = allDatasets.filter(d => d['datasetID'].startsWith(this.datasetCommonKey));

    // Fetch every sensor's info in parallel, but only group them into buoys
    // afterward, synchronously - doing the grouping inside the parallel map
    // risks two sensors of the same buoy both seeing no entry yet and each
    // creating their own, instead of sharing one.
    const sensorEntries = await Promise.all(buoyDatasets.map(async d => {
      const dataset = d['datasetID'];
      const withoutPrefix = dataset.slice(this.datasetCommonKey.length);
      const lastUnderscore = withoutPrefix.lastIndexOf('_');
      const name = withoutPrefix.slice(0, lastUnderscore); // buoy id, e.g. 'MONTGO'
      const sensorId = withoutPrefix.slice(lastUnderscore + 1); // e.g. 'ADCP'

      const infoUrl = `${this.baseUrl}/info/${dataset}/index.jsonlKVP`;
      const infoText = await this.fetchManager.fetch(SourceErddap.proxied(infoUrl)).then(res => res.text());
      const { variables, metadata } = this.parseERDDAPMetadata(infoText);

      const sensor = {
        id: sensorId,
        variables,
        metadata,
        startDate: metadata['time_coverage_start'] ? new Date(metadata['time_coverage_start']) : undefined,
        endDate: metadata['time_coverage_end'] ? new Date(metadata['time_coverage_end']) : undefined,
      };

      return { name, sensor };
    }));

    const buoysByName = new Map();
    sensorEntries.forEach(({ name, sensor }) => {
      if (!buoysByName.has(name)) {
        // lat/long, institution, acknowledgement and license are per-dataset
        // NC_GLOBAL attributes, but are expected to be the same across every
        // sensor of a buoy - taken from whichever sensor is processed first.
        const { metadata } = sensor;
        buoysByName.set(name, {
          id: name,
          sensors: [],
          latitude: metadata['nominal_latitude'] ? Number(metadata['nominal_latitude']) : undefined,
          longitude: metadata['nominal_longitude'] ? Number(metadata['nominal_longitude']) : undefined,
          institution: metadata['institution'],
          acknowledgement: metadata['acknowledgement'],
          license: metadata['license'],
        });
      }
      buoysByName.get(name).sensors.push(sensor);
    });

    // Each buoy's own startDate/endDate - earliest/latest among its sensors.
    this.buoys = [...buoysByName.values()].map(buoy => ({ ...buoy, ...dateRangeOf(buoy.sensors) }));

    const { startDate, endDate } = this.dateRange();
    this.startDate = startDate;
    this.endDate = endDate;
  }

  // Earliest start and latest end across every buoy/sensor - each may have
  // started/stopped reporting at a different time.
  dateRange() {
    return dateRangeOf(this.buoys.flatMap(buoy => buoy.sensors));
  }

}

export default SourceErddapBuoys;
