import DP from './DataProduct.js';

class DPHFRNetwork extends DP {

  // Combines DPHFRStations' per-station promises with DPHFRTotals' one
  // promise for the network Total, into a single array - one promise per
  // entity (each of the network's stations, plus 'TOTALS'), each resolving
  // independently as its own data arrives. stationsProduct/totalsProduct are
  // DPHFRStations/DPHFRTotals instances - passed in rather than looked up
  // here, since a DataProduct only knows its own sources, not its siblings'
  // (DataService is what already holds references to all of them).
  async getNumberOfValidPointsPerNetwork(stationsProduct, totalsProduct, startDate, endDate) {
    const stationPromises = await stationsProduct.getNumberOfValidPointsPerStations(undefined, startDate, endDate);

    const totalsPromise = totalsProduct.getNumberOfValidPoints(startDate, endDate).catch(error => {
      console.error('Error loading number of valid points for TOTALS:', error);
      return { id: 'TOTALS', points: {} };
    });

    return [...stationPromises, totalsPromise];
  }

}

export default DPHFRNetwork;
