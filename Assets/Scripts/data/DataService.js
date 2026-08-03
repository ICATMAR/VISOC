import FetchManager from './FetchManager.js';
import ServiceStatus from './ServiceStatus.js';
import Catalogue from './products/Catalogue.js';
import DPDrifters from './products/DPDrifters.js';
import DPHFRNetwork from './products/DPHFRNetwork.js';

class DataService {

  constructor(FetchManager) {
    this.serviceStatus = new ServiceStatus(FetchManager);

    const drifters = Catalogue.find(p => p.type === 'DPDrifters');
    this.drifters = new DPDrifters({ fetchManager: FetchManager, sources: drifters.sources });

    const hfrnetwork = Catalogue.find(p => p.type === 'DPHFRNetwork');
    this.hfrnetwork = new DPHFRNetwork({ fetchManager: FetchManager, sources: hfrnetwork.sources });
  }

}


export default DataService;
