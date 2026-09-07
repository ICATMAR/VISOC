import SourceBuoys from './SourceBuoys.js';
import SourceErddap from './SourceErddap.js';

// Every source has to report a buoy, and each of its sensors, under the same id
// as the others, otherwise DPBuoys merges nothing and the same mooring shows up
// twice - that matters for the buoys carried by both this server and the MSM
// API (CDCR, TORT, TARR, TORD). These two tables are this server's half of that
// agreement; the MSM API's half is BUOY_IDS/SENSOR_IDS in SourceMSMAPI.js.
//
// Keyed by the dataset id's own name (BUOY_<name>_<sensor>), and anything not
// listed is already the id everything else uses and passes through untouched.
const BUOY_IDS = {
  // Empty: this server's buoy ids are the ones everything else follows. An
  // entry here is only needed if a dataset ever spells one differently.
};

const SENSOR_IDS = {
  YOUN: 'RM_YOUNG', // the MSM API spells the same anemometer out in full
};

class SourceErddapBuoys extends SourceBuoys {

  constructor({ fetchManager, src, datasetCommonKey }) {
    super({ fetchManager });
    this.src = src;
    this.baseUrl = src.replace(/\/index\.html$/, '');
    this.datasetCommonKey = datasetCommonKey;

    // this.buoys (see SourceBuoys) is filled in by load(): id, array of sensors
    // (metadata, variables...), lat-long, institution, acknowledgement
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
      const datasetName = withoutPrefix.slice(0, lastUnderscore); // buoy, e.g. 'MONTGO'
      const datasetSensor = withoutPrefix.slice(lastUnderscore + 1); // sensor, e.g. 'ADCP'
      const name = BUOY_IDS[datasetName] ?? datasetName;
      const sensorId = SENSOR_IDS[datasetSensor] ?? datasetSensor;

      const infoUrl = `${this.baseUrl}/info/${dataset}/index.jsonlKVP`;
      const infoText = await this.fetchManager.fetch(SourceErddap.proxied(infoUrl)).then(res => res.text());
      const { variables, metadata } = this.parseERDDAPMetadata(infoText);

      const sensor = {
        id: sensorId,
        variables: SourceErddapBuoys.stripSensorSuffix(variables, datasetSensor),
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
    this.buoys = [...buoysByName.values()].map(buoy => ({ ...buoy, ...SourceBuoys.dateRangeOf(buoy.sensors) }));

    const { startDate, endDate } = this.dateRange();
    this.startDate = startDate;
    this.endDate = endDate;
  }

  // ERDDAP suffixes a dataset's variables with its own sensor name - the WAVE
  // dataset's significant wave height is SWHT_WAVE - which says nothing the
  // sensor id doesn't already say, and stops the same measurement lining up
  // across sensors and sources. Dropped here, so the catalogue's mapping only
  // ever has to know SWHT. A variable that already exists unsuffixed keeps its
  // own entry rather than being overwritten by the suffixed one.
  static stripSensorSuffix(variables, sensor) {
    const suffix = `_${sensor}`.toUpperCase();

    const renamed = {};
    Object.entries(variables).forEach(([name, attributes]) => {
      const bare = name.toUpperCase().endsWith(suffix) ? name.slice(0, -suffix.length) : name;
      renamed[bare && renamed[bare] == undefined ? bare : name] = attributes;
    });

    return renamed;
  }

}

export default SourceErddapBuoys;
