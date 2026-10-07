import DPForecast from './DPForecast.js';

// ICATMAR's high-resolution sea surface forecast (ROMS, on ERDDAP - see
// SourceErddapSeaSurfaceForecast): temperature, salinity and currents of the
// Catalan Sea. Read as a time series at a point (getPointForecast) - TEMP,
// PSAL, HCSP, HCDT at a buoy. Ranking and merging (should more runs be added)
// is DPForecast's.
class DPSeaSurfaceForecast extends DPForecast {
}

export default DPSeaSurfaceForecast;
