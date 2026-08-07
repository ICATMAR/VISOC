// ============================================================================
// data/products/config/buoyDataSources.js
//
// Per-buoy DATA-SOURCE DESCRIPTORS, consumed by the ProductFactory. Each entry
// is a LIST of sources (`sources: [...]`), and EACH source has its own `type`.
// So one Thing can combine several sources of DIFFERENT kinds:
//
//   - a static-file archive (immutable history)  +  live ERDDAP (recent tail)
//       -> tiered by TIME via each source's `coverage`; the factory lists them
//          highest-priority-first, so the archive is preferred where it exists.
//   - several ERDDAP datasets (ADCP / CTD / METEO)
//       -> routed by VARIABLE via provides().
//   - several baseUrls within one ERDDAP source
//       -> mirror FAILOVER.
//
// Keyed by thing id (matches catalog/things/buoys.js).
// ============================================================================

export const buoyDataSources = {
  CCRE: {
    sources: [
      // (optional) archived history from static files — preferred where present.
      // Needs a StaticFileSource (a factory case + class); shown here to make the
      // "multiple sources of different types on one Thing" shape concrete.
      // {
      //   type: 'static-file',
      //   baseUrl: './data/buoys/CCRE',
      //   manifest: 'manifest.json',
      //   coverage: { start: null, end: new Date('2026-01-01T00:00:00Z') },
      //   variables: [
      //     { code: 'TEMP', observedProperty: 'TEMP', unit: 'degC', sensorId: 'meteo', depth: 0 },
      //     { code: 'WSPD', observedProperty: 'WSPD', unit: 'm/s',  sensorId: 'meteo' },
      //   ],
      // },

      // live ERDDAP — covers everything; serves the recent tail the archive lacks.
      {
        type: 'erddap',
        baseUrls: ['https://erddap.icatmar.cat/erddap'],
        // proxy: 'https://api.icatmar.cat/proxy/',    // for real CORS-restricted ERDDAP
        // coverage: { start: new Date('2026-01-01T00:00:00Z'), end: null },  // if archive covers earlier
        datasets: [
          {
            dataset: 'buoy_CCRE_meteo',
            variables: [
              { code: 'TEMP', column: 'TEMP', observedProperty: 'TEMP', unit: 'degC', sensorId: 'meteo', depth: 0 },
              { code: 'WSPD', column: 'WSPD', observedProperty: 'WSPD', unit: 'm/s', sensorId: 'meteo' },
            ],
          },
        ],
      },
    ],
  },

  // Somorrostro: one ERDDAP source, several per-sensor datasets (routed by variable).
  // ODAS: {
  //   sources: [
  //     { type: 'erddap', baseUrls: ['https://erddap.icatmar.cat/erddap'], proxy: 'https://api.icatmar.cat/proxy/',
  //       datasets: [
  //         { dataset: 'BUOY_SOMORROSTRO_CTD',   variables: [ { code:'TEMP', column:'TEMP', observedProperty:'TEMP', unit:'degC', sensorId:'ctd', depth:1 },
  //                                                            { code:'PSAL', column:'PSAL', observedProperty:'PSAL', unit:'PSU', sensorId:'ctd', depth:1 } ] },
  //         { dataset: 'BUOY_SOMORROSTRO_METEO', variables: [ { code:'WSPD', column:'WSPD', observedProperty:'WSPD', unit:'m/s', sensorId:'meteo' } ] },
  //         { dataset: 'BUOY_SOMORROSTRO_ADCP',  variables: [ { code:'HCSP', column:'CurrentSpeed', observedProperty:'HCSP', unit:'m/s', sensorId:'adcp', scale:0.01 } ] },
  //       ] },
  //   ],
  // },

  // A buoy on a different API entirely (added when MsmApiSource exists):
  // TORD: { sources: [ { type: 'msm', baseUrls: ['https://api.icatmar.cat/MSM_fast_api'], variables: [ ... ] } ] },
};
