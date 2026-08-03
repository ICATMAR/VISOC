import FetchManager from './FetchManager.js';
import ServiceStatus from './ServiceStatus.js';
import Catalogue from './products/Catalogue.js';

class DataService {

  constructor(FetchManager) {
    this.serviceStatus = new ServiceStatus(FetchManager);
    this.catalogue = Catalogue;

    const drifters = Catalogue.find(p => p.name === 'Drifters');
    this.drifters = new drifters.Class({ fetchManager: FetchManager, sources: drifters.sources });

    const hfrnetwork = Catalogue.find(p => p.name === 'High-frequency radar network');
    this.hfrnetwork = new hfrnetwork.Class({ fetchManager: FetchManager, sources: hfrnetwork.sources });

    const hfrstations = Catalogue.find(p => p.name === 'High-frequency radar stations');
    this.hfrstations = new hfrstations.Class({ fetchManager: FetchManager, sources: hfrstations.sources });

    const buoys = Catalogue.find(p => p.name === 'Buoys');
    this.buoys = new buoys.Class({ fetchManager: FetchManager, sources: buoys.sources });

    this.dataProducts = [
      { name: drifters.name, product: this.drifters },
      { name: hfrnetwork.name, product: this.hfrnetwork },
      { name: hfrstations.name, product: this.hfrstations },
      { name: buoys.name, product: this.buoys },
    ];
  }

}


export default DataService;
