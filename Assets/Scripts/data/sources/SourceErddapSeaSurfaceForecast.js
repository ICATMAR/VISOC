import SourceErddapGriddap from './SourceErddapGriddap.js';

// ICATMAR's ROMS sea surface forecast on erddap.icatmar.cat
// (sea_surface_forecast): hourly temperature, salinity, currents and sea level
// over the Western Mediterranean at ~1 km, surface level only (a single depth
// of 0 m). Only the latest run is served.
//
// Temperatures are in Kelvin and currents come both as components (UO/VO)
// and already as speed/direction (HCSP/HCDT) - the latter are read here,
// since that is what a buoy's current cell shows. Unit conversion and renaming
// to standard codes is the catalogue's mapping.

// SST: sea surface temperature (K), SSS: sea surface salinity,
// HCSP/HCDT: current speed (m/s) and direction (to, degrees)
const VARIABLES = ['SST', 'SSS', 'HCSP', 'HCDT'];

class SourceErddapSeaSurfaceForecast extends SourceErddapGriddap {

  defaultVariables() { return VARIABLES; }

  // Masked over land - the coastal cells near Barcelona's harbour are NaN
  probeVariable() { return 'SST'; }

}

export default SourceErddapSeaSurfaceForecast;
