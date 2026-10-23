import DPForecast from './DPForecast.js';

// Sea surface forecast - temperature, salinity and currents (TEMP, PSAL,
// HCSP, HCDT) - read as a time series at a point (a buoy, or wherever the HF
// radar comparison is asked for). Sources, in the catalogue's order of
// preference:
//
//   - ICATMAR's high-resolution ROMS forecast of the Catalan Sea (~1 km, on
//     ERDDAP - see SourceErddapSeaSurfaceForecast)
//   - Copernicus Marine's Mediterranean physics (MedFS, 4.2 km - see
//     SourceCMEMS): the whole Mediterranean, ~10 days ahead and the past
//     two years, for whatever ROMS doesn't cover
//   - Copernicus Marine's Iberia-Biscay-Ireland physics (NEMO, 1/36° - also
//     SourceCMEMS): the Atlantic side and the western Mediterranean up to 5°E
//
// Ranking and merging is DPForecast's (getPointForecast); each source on its
// own is getPointSeriesBySource.
class DPSeaSurfaceForecast extends DPForecast {

  // ROMS publishes the current as speed and direction already, CMEMS only as
  // components (uo/vo, mapped to EWCT/NSCT in the catalogue). Turned into
  // speed and direction here, so a value says the same thing whichever source
  // it came from. HCDT is where the water is GOING - the components' own
  // direction, unlike the wind's (see DPWindForecast).
  //
  // The components themselves are dropped, as DPWindForecast does: kept, they
  // would count as this source contributing something at hours a better
  // source already covers.
  derive(record) {
    const { EWCT: u, NSCT: v, ...derived } = record;
    if (u == undefined || v == undefined) return record;
    if (derived.HCSP == undefined) derived.HCSP = Math.hypot(u, v);
    if (derived.HCDT == undefined) derived.HCDT = (Math.atan2(u, v) * 180 / Math.PI + 360) % 360;
    return derived;
  }

}

export default DPSeaSurfaceForecast;
