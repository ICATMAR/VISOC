import FetchManager from './FetchManager.js';
import ServiceStatus from './ServiceStatus.js';
import DPDrifters from './products/DPDrifters.js';
import DPHFRNetwork from './products/DPHFRNetwork.js';

class DataService {

  constructor(FetchManager) {
    this.serviceStatus = new ServiceStatus(FetchManager);
    this.drifters = new DPDrifters(FetchManager);
    this.hfrnetwork = new DPHFRNetwork(FetchManager);
  }

}


export default DataService;
