import Source from './Source.js';
import SourceErddap from './SourceErddap.js';

class SourceErddapBuoys extends Source {

  constructor({ fetchManager, src, datasets }) {
    super({ fetchManager });
    this.src = src;
    this.baseUrl = src.replace(/\/index\.html$/, '');
    this.datasets = datasets;

    // Per-buoy results, keyed by platform_name, then by dataset (one per sensor).
    this.buoys = {};

    this.loadingPromise = this.load();
  }

  async load() {
    await Promise.all(this.datasets.map(async dataset => {
      const infoUrl = `${this.baseUrl}/info/${dataset}/index.jsonlKVP`;
      const infoText = await this.fetchManager.fetch(SourceErddap.proxied(infoUrl)).then(res => res.text());
      const { variables, metadata } = this.parseERDDAPMetadata(infoText);

      // Each dataset covers one sensor on one buoy - platform_name (NC_GLOBAL)
      // is the buoy's identity, since a buoy can have several sensor datasets.
      const platform = metadata['platform_name'] ?? dataset;
      if (!this.buoys[platform]) this.buoys[platform] = {};
      this.buoys[platform][dataset] = {
        variables,
        metadata,
        startDate: metadata['time_coverage_start'] ? new Date(metadata['time_coverage_start']) : undefined,
        endDate: metadata['time_coverage_end'] ? new Date(metadata['time_coverage_end']) : undefined,
      };
    }));

    const { startDate, endDate } = this.dateRange();
    this.startDate = startDate;
    this.endDate = endDate;
  }

  // Earliest start and latest end across every buoy/sensor - each may have
  // started/stopped reporting at a different time.
  dateRange() {
    const entries = Object.values(this.buoys).flatMap(sensors => Object.values(sensors));
    const startDates = entries.map(s => s.startDate).filter(Boolean);
    const endDates = entries.map(s => s.endDate).filter(Boolean);
    return {
      startDate: startDates.length ? new Date(Math.min(...startDates)) : undefined,
      endDate: endDates.length ? new Date(Math.max(...endDates)) : undefined,
    };
  }

}

export default SourceErddapBuoys;
