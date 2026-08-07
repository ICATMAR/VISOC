import DP from './DataProduct.js';
import SourceErddapBuoys from '../sources/SourceErddapBuoys.js';
import buoys from '../../../../Data/buoys/buoys.js'

class DPBuoys extends DP {

  // Get buoys
  getBuoys() {
    // Return static buoy data
    return buoys;
  }

  // Get start-end dates per buoy
  // Maybe later will be updateBuoys?
  async loadBuoys() {
    // Iterate sources and wait until they are all loaded
    const sources = this.sources.filter(s => s instanceof SourceErddapBuoys);
    await Promise.all(sources.map(s => s.loadingPromise.catch(error => {
      console.error('Error loading buoys source:', error);
    })));

    // Then merge datasets into one - same buoy can have sensors split across
    // both ERDDAP servers, so combine their sensor entries under one id
    // instead of keeping one result per source.
    const buoysById = new Map();
    sources.forEach(source => {
      source.buoys.forEach(buoy => {
        if (!buoysById.has(buoy.id)) {
          buoysById.set(buoy.id, { ...buoy, sensors: [...buoy.sensors] });
          return;
        }
        const merged = buoysById.get(buoy.id);
        buoy.sensors.forEach(sensor => {
          if (!merged.sensors.some(s => s.id === sensor.id)) merged.sensors.push(sensor);
        });
      });
    });

    // Static file is only a fallback, for whatever a buoy the ERDDAP servers
    // didn't cover (including all of them, if both sources above failed) -
    // a buoy already merged from a live source is left untouched.
    buoys.forEach(buoy => {
      if (!buoysById.has(buoy.id)) buoysById.set(buoy.id, buoy);
    });

    return [...buoysById.values()];
  }
}



export default DPBuoys;