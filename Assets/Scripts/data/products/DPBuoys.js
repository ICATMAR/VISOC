import DP from './DataProduct.js';
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
    
  }
}



export default DPBuoys;