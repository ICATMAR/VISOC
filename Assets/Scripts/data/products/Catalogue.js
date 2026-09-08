import SourceErddap from '../sources/SourceErddap.js';
import SourceFileDrifters from '../sources/SourceFileDrifters.js';
import SourceFileHFRTotals from '../sources/SourceFileHFRTotals.js';
import SourceFileHFRRadials from '../sources/SourceFileHFRRadials.js';
import SourceErddapEUHFR from '../sources/SourceErddapEUHFR.js';
import SourceGithubHFR from '../sources/SourceGithubHFR.js';
import SourceErddapBuoys from '../sources/SourceErddapBuoys.js';
import SourceMSMAPI from '../sources/SourceMSMAPI.js';
import SourceGithubSOMO from '../sources/SourceGithubSOMO.js';

import DPDrifters from './DPDrifters.js';
import DPHFRNetwork from './DPHFRNetwork.js';
import DPHFRStations from './DPHFRStations.js';
import DPHFRTotals from './DPHFRTotals.js';
import DPBuoys from './DPBuoys.js';
import DPSSForecast from './DPSSForecast.js';


const MEDBBOX = {minLat: 30, minLon: -11, maxLat: 46, maxLon: 37}
const NWMEDBBOX = {minLat: 38.5, minLon: -0.4, maxLat: 44, maxLon: 6.2}
const WESTMEDBBOX = {minLat: 34.6, minLon: -5.8, maxLat: 44.6, maxLon: 16.5}


const KelvinToCelsius = (value) => {
  if (value === undefined || value === null) return value;
  return value - 273.15;
}

// Several buoy parameters travel as scaled integers (the loggers transmit them
// that way to keep the messages short), so they need a factor to become the
// unit their standard code is defined in.
const scaledBy = (factor) => (value) => {
  if (value === undefined || value === null) return value;
  return value * factor;
}


// Data products
const dataProducts = [
// Drifters
  {
    name: 'Drifters',
    Class: DPDrifters,
    description: 'Drifters data of SVPs, CODEs and other types of drifters',
    type: 'real-time',
    sources: [
      {
        Class: SourceErddap,
        src: 'https://erddap.icatmar.cat/erddap/index.html',
        dataset: 'socat_data_drifters_ICATMAR',
        institution: 'ICATMAR',
        mapping: {
          temperature: {code: 'TEMP'},
        },
      },
      {
        Class: SourceFileDrifters,
        path: './Data/drifters/drifters_deriva1.csv',
        pathTimeless: './Data/drifters/drifters_deriva1_timeless.jsonl',
        pathMetadata: './Data/drifters/drifters_metadata.jsonl',
        institution: 'ICATMAR',
        mapping: {
          temperature: {code: 'TEMP'},
        },
      },
      {
        Class: SourceErddap,
        src: 'https://erddap.aoml.noaa.gov/gdp/erddap/index.html',
        dataset: 'OSMC_RealTime',
        institution: 'NOAA-AOML',
        mapping: {
          sst: {code: 'TEMP'},
          ztmp: {code: 'THETAO'},
          sss: {code: 'PSAL'},
          zsal: {code: 'PSAL'}, 
          atmp: {code: 'DRYT'},
          windspd: {code: 'WSPD'},
          winddir: {code: 'WDIR'},
          uo: {code: 'EWCT'},
          vo: {code: 'NSCT'},
          wo: {code: 'VCSP'},
          wvht: {code: 'VHM0'},
          sea_water_pressure: {code: 'PRES'},
          sea_water_elec_conductivity: {code: 'CNDC'},
          slp: {code: 'ATMS'},
          dewpoint: {code: 'DEWT'},
          observation_depth: {code: 'DEPTH'},
          hur: {code: 'RELH'},
        },
        bbox: MEDBBOX,
      }
    ]
  },


  // High-frequency radar network
  {
    name: 'High-frequency radar network',
    Class: DPHFRNetwork,
    description: "Surface currents from the ICATMAR's high-frequency radar network",
    type: 'near-real-time',
    sources: [
      // Its sources are DPHFRTotals and DPHFRStations! TODO
    ]
  },

  // High-frequency radar totals (the network's combined product, as opposed
  // to its individual stations) - own product so DPHFRNetwork can compose it
  // with DPHFRStations without either owning the other's sources.
  {
    name: 'High-frequency radar totals',
    Class: DPHFRTotals,
    description: "Surface currents from the ICATMAR's high-frequency radar network (combined stations)",
    type: 'near-real-time',
    sources: [
      // Recent
      {
        Class: SourceErddap,
        src: 'https://erddap.icatmar.cat/erddap/index.html',
        dataset: 'HF_radar_L3B_recent',
        institution: 'ICATMAR',
        mapping: {
          u: {code: 'EWCT'},
          v: {code: 'NSCT'},
        }
      },
      // Historical
      {
        Class: SourceErddap,
        src: 'https://erddap.icatmar.cat/erddap/index.html',
        dataset: 'HF_Radar_L3B_Historic',
        institution: 'ICATMAR',
        mapping: {
          u: {code: 'EWCT'},
          v: {code: 'NSCT'},
        }
      },
      // EU HFR Node
      {
        Class: SourceErddapEUHFR,
        src: 'https://erddap.hfrnode.eu/erddap/index.html',
        institution: 'EU HFR Node',
        datasets: [
          'EUHFR_NRTcurrent_HFR-ICATMAR-Total_v3_table',
        ],
      },
      // Github
      {
        Class: SourceGithubHFR,
        institution: 'ICATMAR',
        src: 'https://github.com/ICATMAR/data/'
      },
      // Static file
      {
        Class: SourceFileHFRTotals,
        paths: [
          './Data/hfr/totals/TOTL_CATS_2026_07_25_0900.tuv',
          './Data/hfr/totals/TOTL_CATS_2026_07_25_1000.tuv',
          './Data/hfr/totals/TOTL_CATS_2026_07_25_1100.tuv',
          './Data/hfr/totals/TOTL_CATS_2026_07_25_1200.tuv'
        ],
        institution: 'ICATMAR',
        mapping: {
          LOND: {code: 'longitude'},
          LATD: {code: 'latitude'},
          VELU: {code: 'EWCT'},
          VELV: {code: 'NSCT'},
          VELO: {code: 'HCSP'},
          HEAD: {code: 'HCDT'}
        }
      }
    ],
  },


  // High-frequency radar stations
  {
    name: 'High-frequency radar stations',
    Class: DPHFRStations,
    description: "Surface currents from the ICATMAR's high-frequency radar stations",
    type: 'near-real-time',
    sources: [
      {
        Class: SourceErddap,
        src: 'https://erddap.icatmar.cat/erddap/index.html',
        dataset: 'HF_Radar_L2B_Historic',
        institution: 'ICATMAR',
      },
      {
        Class: SourceErddapEUHFR,
        src: 'https://erddap.hfrnode.eu/erddap/index.html',
        institution: 'EU HFR Node',
        datasets: [
          'EUHFR_NRTcurrent_HFR-ICATMAR-CNET_v3_table',
          'EUHFR_NRTcurrent_HFR-ICATMAR-CREU_v3_table',
          'EUHFR_NRTcurrent_HFR-ICATMAR-BEGU_v3_table',
          'EUHFR_NRTcurrent_HFR-ICATMAR-TOSS_v3_table',
          'EUHFR_NRTcurrent_HFR-ICATMAR-AREN_v3_table',
          'EUHFR_NRTcurrent_HFR-ICATMAR-PBCN_v3_table',
          'EUHFR_NRTcurrent_HFR-ICATMAR-GNST_v3_table',
        ],
      },
      {
        Class: SourceGithubHFR,
        institution: 'ICATMAR',
        src: 'https://github.com/ICATMAR/data/'
      },
      {
        Class: SourceFileHFRRadials,
        path: './Data/hfr/radials/',
        institution: 'ICATMAR',
        stations: [
          'CNET',
          'CREU',
          'BEGU',
          'AREN',
          'TOSS',
          'PBCN',
          'GNST',
          'SCAL'
        ],
        fileStart: '2026-07-25T09',
        fileEnd: '2026-07-25T12',
        institution: 'ICATMAR',
        mapping: {
          LOND: {code: 'longitude'},
          LATD: {code: 'latitude'},
          VELU: {code: 'EWCT'},
          VELV: {code: 'NSCT'},
          VELO: {code: 'HCSP'},
          HEAD: {code: 'HCDT'}
        },

      }
    ],
  },


  // Buoys
  {
    name: 'Buoys',
    Class: DPBuoys,
    description: 'Meteo-oceanographic moored buoys',
    type: 'real-time',
    sources: [
      {
        Class: SourceErddapBuoys,
        src: 'https://erddap.icatmar.cat/erddap/index.html',
        institution: 'ICATMAR',
        datasetCommonKey: 'BUOY_',
      },
      {
        Class: SourceErddapBuoys,
        src: 'https://hebe.icm.csic.es/erddap/index.html',
        institution: 'ICATMAR',
        datasetCommonKey: 'BUOY_',
      },
      {
        Class: SourceMSMAPI,
        src: 'https://api.icatmar.cat/MSM_fast_api/',
        institution: 'ICATMAR',
        // The API already names most parameters by their standard code, so
        // what this mapping is really for is the scaling: they arrive as
        // integers (37.9871 psu as 379871), with the factors below the ones
        // the HFRadar viewer reads them by.
        // Waves (VGHS, VMDR, VTPK, VPED, ...) come through untouched - they
        // are already standard codes in their own units.
        // The buoys carry two wind sensors and they do NOT agree on units:
        // the Gill anemometer reports cm/s (150-550 for an ordinary breeze,
        // and the HFRadar viewer skips it for that reason) while the other
        // reports m/s, which is why the wind lives in sensorMapping below
        // rather than here.
        mapping: {
          TEMP: {unitTransform: scaledBy(0.0001)},
          PSAL: {unitTransform: scaledBy(0.0001)},
          DRYT: {unitTransform: scaledBy(0.1)},
          DEWT: {unitTransform: scaledBy(0.1)}, // same magnitude as DRYT, same sensor
          ATMS: {unitTransform: scaledBy(0.1)},
          RELH: {unitTransform: scaledBy(0.1)},
          // The highest/lowest of the interval, in the same scale as the
          // parameter they belong to. No standard code of their own, so they
          // keep their names and only get the factor.
          DRYTM: {unitTransform: scaledBy(0.1)},
          DRYTL: {unitTransform: scaledBy(0.1)},
          RELHM: {unitTransform: scaledBy(0.1)},
          RELHL: {unitTransform: scaledBy(0.1)},
        },
        // Sensors that disagree with the mapping above, or with each other:
        // both the CTD and the ADCP report a 'temperature', the CTD's scaled
        // and the ADCP's already in °C.
        sensorMapping: {
          // cm/s -> m/s. Directions are degrees on both sensors, so only the
          // speeds need a factor.
          GILL: {
            WSPD: {unitTransform: scaledBy(0.01)},
            GSPD: {unitTransform: scaledBy(0.01)},
          },
          CTD: {
            temperature: {code: 'TEMP', unitTransform: scaledBy(0.0001)},
            pressure: {code: 'PRES'}, // dbar
          },
          ADCP: {
            temperature: {code: 'TEMP'},
          },
          GPS: {
            LAT: {code: 'latitude'},
            LON: {code: 'longitude'},
          },
        },
      },
      {
        Class: SourceGithubSOMO,
        src: 'https://github.com/ICATMAR/data/',
        institution: 'ICATMAR',
        // Raw CR1000X logger columns. No unit transforms: the logger writes
        // physical units already (°C, hPa, m/s, S/m, dbar, PSU).
        // Left alone, and so kept under their own names: the relative wind
        // (Rel_WindDir/Rel_WS - uncorrected for the buoy's heading, unlike the
        // Corr_ pair), WindDir_True, air density (AD), wet bulb temperature
        // (WBT), height above sea level (HASL), the logger's RECORD counter
        // and the CTD's own serial/date/time strings.
        mapping: {
          // Meteo
          Latitude: {code: 'latitude'},
          Longitude: {code: 'longitude'},
          WindDir_True: {code: 'WDIR'},
          Corr_WindS: {code: 'WSPD'},
          BP: {code: 'ATMS'},    // hPa = mbar, ATMS' own unit
          RH: {code: 'RELH'},
          AirTemp: {code: 'DRYT'},
          DP: {code: 'DEWT'},
          Rel_WindDir: {code: 'WRDR'},
          Corr_WindDir: {code: 'WCDR'},
          Rel_WS: {code: 'WRSP'},
          HASL: {code: 'HEIGHT'},

          // SBE37 CTD
          SBE37Temp: {code: 'TEMP'},
          SBE37Cond: {code: 'CNDC'},
          SBE37Pres: {code: 'PRES'},
          SBE37Sal: {code: 'PSAL'},
          SBE37OXY: {code: 'DOX1'}, // ml/L, which is DOX1's unit (DOX2 is µmol/kg)
        },
      }
    ]
  },


  // Sea surface forecast
  {
    name: 'Sea surface forecast',
    Class: DPSSForecast,
    description: 'High-resolution short-term forecast of sea surface temperature and currents of the Catalan Sea',
    type: 'forecast',
    sources: [
      {
        Class: SourceErddap,
        src: 'https://erddap.icatmar.cat/erddap/index.html',
        institution: 'ICATMAR',
        dataset: 'sea_surface_forecast',
        mapping: {
          UO: {code: 'EWCT'},
          VO: {code: 'NSCT'},
          THETAO: {unitTransform: KelvinToCelsius},
          SST: {unitTransform: KelvinToCelsius}
        }
      }
    ]
  },


  // Dynamic generation via EU HFR Node ERDDAP for non-ICATMAR networks and stations
  // Most likely will be integrated inside DPHFRNetwork and DPHFRStations, but for now we keep them separate for clarity.

  // Argo floats from ifremer
  {
    name: 'Argo floats',
    //Class: DPArgoFloats,
    type: 'near-real-time',
    description: 'Argo floats data from the Catalan Sea and surrounding areas',
    sources: [
      {
        type: 'SourceErddap',
        src: 'https://erddap.ifremer.fr/erddap/index.html',
        dataset: 'ArgoFloats',
        bbox: MEDBBOX,
      }
    ]
  },

  // Drifters from Observing System Monitoring Center (OSMC)
  {
    name: 'Drifters (OSMC)',
    type: 'DPDriftersOSMC',
    description: 'Drifters data from the Observing System Monitoring Center (OSMC)',
    sources: [
      {
        type: 'SourceErddap',
        src: 'https://erddap.osmc.fr/erddap/index.html',
        dataset: 'OSMC_RealTime',
        bbox: MEDBBOX,
      }
    ]
  },

  

  // Dynamic generation of other forecast models (CMEMS)
  // Check HFRadar and VISAP codes
]







export default dataProducts;