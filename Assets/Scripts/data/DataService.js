import FetchManager from './FetchManager.js';
import ServiceStatus from './ServiceStatus.js';
import DPDrifters from './products/DPDrifters.js';

class DataService {

  constructor(FetchManager) {
    this.serviceStatus = new ServiceStatus(FetchManager);
    this.drifters = new DPDrifters(FetchManager);
  }

}


export default DataService;
