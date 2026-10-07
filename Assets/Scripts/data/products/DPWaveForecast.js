import DPForecast from './DPForecast.js';

// Wave forecast at a buoy - significant height, mean direction and mean
// period (VHM0, VMDR, VTM02) - from ICATMAR's WAVEWATCH III runs on ERDDAP
// (see SourceErddapWaveForecast). One source per run configuration, listed in
// the catalogue in order of preference: forced by AROME first (higher
// resolution winds, but only ~2 days ahead), then forced by ECMWF (longer),
// then the coarser Mediterranean run for anything outside the Catalan grid.
// Ranking and merging is DPForecast's.
class DPWaveForecast extends DPForecast {
}

export default DPWaveForecast;
