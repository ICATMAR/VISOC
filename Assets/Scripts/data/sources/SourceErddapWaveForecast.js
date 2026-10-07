import SourceErddapGriddap from './SourceErddapGriddap.js';

// ICATMAR's WAVEWATCH III wave forecasts on erddap.icatmar.cat - one dataset
// per run configuration, each holding only the LATEST run (from 00Z of the run
// day, hourly):
//
//   WAVE_FC_CAT_WW3ARO_2p6km   Catalan Sea, 2.6 km, forced by AROME   (~55 h)
//   WAVE_FC_CAT_WW3ECM_2p6km   Catalan Sea, 2.6 km, forced by ECMWF   (~76 h)
//   WAVE_FC_MED_WW3ECM_0p125   Mediterranean, 0.125 deg, forced by ECMWF (~76 h)
//
// One source per dataset, like any other SourceErddap: which one is preferred
// where they overlap is the catalogue's order, applied by DPWaveForecast.
//
// The datasets share their variable names, so one default list serves all
// three. Raw names - turning hs into VHM0 is the catalogue's mapping.

// hs: significant height, dir: mean direction (from), t02: mean period Tm02,
// the same three a buoy's wave cell shows (VHM0, VMDR, VTM02).
const VARIABLES = ['hs', 'dir', 't02'];

class SourceErddapWaveForecast extends SourceErddapGriddap {

  defaultVariables() { return VARIABLES; }

  // Significant height is masked over land like everything else, and is the
  // one variable every configuration is sure to carry.
  probeVariable() { return 'hs'; }

}

export default SourceErddapWaveForecast;
