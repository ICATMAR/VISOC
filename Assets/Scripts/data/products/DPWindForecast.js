import DPForecast from './DPForecast.js';

// Wind forecast at a buoy - speed, direction and gusts (WSPD, WDIR, GSPD).
// Sources, in the catalogue's order of preference:
//
//   - ICATMAR's Open-Meteo wrapper (see SourceOpenMeteo): AROME-HD
//     (Météo-France, ~1.3 km) for as far as it reaches, then ECMWF IFS
//     (0.25 deg)
//   - the winds the WAVEWATCH III wave forecasts were run with, from the wave
//     datasets on ERDDAP (see SourceErddapWaveForecast), AROME and then ECMWF:
//     a fallback for whatever the API doesn't cover - a buoy it doesn't know
//     yet, or the hours before its 00Z start
//
// Ranking and merging is DPForecast's.
class DPWindForecast extends DPForecast {

  // The ERDDAP datasets publish the wind as components (WSPE/WSPN, see the
  // catalogue's mapping) rather than as speed and direction, which is what
  // every other wind in the app is. Turned into those here, so a value says
  // the same thing whichever source it came from. WDIR is where the wind
  // comes FROM, hence the components' signs flipped.
  //
  // The components themselves are dropped: kept, they would count as this
  // source contributing something at hours a better source already covers,
  // and the info panel would list it as in use there.
  derive(record) {
    const { WSPE: u, WSPN: v, ...derived } = record;
    if (u == undefined || v == undefined) return record;
    if (derived.WSPD == undefined) derived.WSPD = Math.hypot(u, v);
    if (derived.WDIR == undefined) derived.WDIR = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
    return derived;
  }

}

export default DPWindForecast;
