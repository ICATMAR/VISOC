import DP from './DataProduct.js';
import SourceErddapEUHFR from '../sources/SourceErddapEUHFR.js';

class DPHFRTotals extends DP {

  // Per-hour count of valid grid points for the ICATMAR network's Total,
  // within [startDate, endDate] (endDate defaults to now). Same shape as
  // DPHFRStations.getNumberOfValidPointsPerStations()'s individual results
  // ({ id: 'TOTALS', points }), so DPHFRNetwork can combine them uniformly.
  //
  // GitHub isn't used as a fallback here yet, even though this product has a
  // SourceGithubHFR configured for it - SourceGithubHFR only estimates
  // per-station radial point counts from file sizes so far, not the Total.
  async getNumberOfValidPoints(startDate, endDate) {
    const euHFRSource = this.sources.find(s => s instanceof SourceErddapEUHFR);
    if (!euHFRSource) return { id: 'TOTALS', points: {} };

    try {
      return await euHFRSource.getNumberOfValidPointsForTotal(startDate, endDate);
    } catch (error) {
      console.error('Error loading EU HFR Node totals data:', error);
      return { id: 'TOTALS', points: {} };
    }
  }

}

export default DPHFRTotals;
