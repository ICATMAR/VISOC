import SourceErddap from '../sources/SourceErddap.js';
import SourceFileDrifters from '../sources/SourceFileDrifters.js';
import SourceFileHFRTotals from '../sources/SourceFileHFRTotals.js';
import SourceFileHFRRadials from '../sources/SourceFileHFRRadials.js';
import SourceErddapEUHFRStations from '../sources/SourceErddapEUHFRStations.js';
import SourceErddapBuoys from '../sources/SourceErddapBuoys.js';

import DPDrifters from './DPDrifters.js';
import DPHFRNetwork from './DPHFRNetwork.js';
import DPHFRStations from './DPHFRStations.js';
import DPBuoys from './DPBuoys.js';


const MEDBBOX = {minLat: 30, minLon: -11, maxLat: 46, maxLon: 37}
const NWMEDBBOX = {minLat: 38.5, minLon: -0.4, maxLat: 44, maxLon: 6.2}
const WESTMEDBBOX = {minLat: 34.6, minLon: -5.8, maxLat: 44.6, maxLon: 16.5}


const KelvinToCelsius = (value) => {
  if (value === undefined || value === null) return value;
  return value - 273.15;
}


// Data products
const dataProducts = [
// Drifters
  {
    name: 'Drifters',
    Class: DPDrifters,
    description: 'Drifters data of SVPs, CODEs and other types of drifters',
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
      }
    ]
  },


  // High-frequency radar network
  {
    name: 'High-frequency radar network',
    Class: DPHFRNetwork,
    description: "Surface currents from the ICATMAR's high-frequency radar network",
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
        Class: SourceErddap,
        src: 'https://erddap.hfrnode.eu/erddap/index.html',
        dataset: 'EUHFR_NRTcurrent_HFR-ICATMAR-Total_v3',
        institution: 'EU HFR Node',
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
    ]
  },


  // High-frequency radar stations
  {
    name: 'High-frequency radar stations',
    Class: DPHFRStations,
    description: "Surface currents from the ICATMAR's high-frequency radar stations",
    sources: [
      {
        Class: SourceErddap,
        src: 'https://erddap.icatmar.cat/erddap/index.html',
        dataset: 'HF_Radar_L2B_Historic',
        institution: 'ICATMAR',
      },
      {
        Class: SourceErddapEUHFRStations,
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
    name: 'Moored buoys',
    Class: DPBuoys,
    description: 'Meteo-oceanographic moored buoys',
    sources: [
      {
        Class: SourceErddapBuoys,
        src: 'https://erddap.icatmar.cat/erddap/index.html',
        institution: 'ICATMAR',
        datasets: [
          'BUOY_SOMO_ADCP',
          'BUOY_SOMO_CTD',
          'BUOY_SOMO_METEO',
          'BUOY_SOMO_SAMI',
        ]
      },
    ]
  },


  // Dynamic generation via EU HFR Node ERDDAP for non-ICATMAR networks and stations
  // Most likely will be integrated inside DPHFRNetwork and DPHFRStations, but for now we keep them separate for clarity.

  // Argo floats from ifremer
  {
    name: 'Argo floats',
    type: 'DPArgo',
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

  // Sea surface forecast
  {
    name: 'Sea surface forecast',
    description: 'High-resolution short-term forecast of sea surface temperature and currents of the Catalan Sea',
    sources: [
      {
        type: 'SourceErddap',
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
  }

  // Dynamic generation of other forecast models (CMEMS)
  // Check HFRadar and VISAP codes
]







export default dataProducts;