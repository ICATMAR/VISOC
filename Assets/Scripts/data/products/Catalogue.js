

// Data products
const dataProducts = [
// Drifters
  {
    name: 'Drifters',
    type: 'DPDrifters',
    description: 'Drifters data of SVPs, CODEs and other types of drifters',
    sources: [
      {
        type: 'SourceErddap',
        src: 'https://erddap.icatmar.cat/erddap/index.html',
        dataset: 'socat_data_drifters_ICATMAR',
        mapping: {
          temperature: {code: 'TEMP'},
        },
      },
      {
        type: 'SourceFileDrifters',
        path: './Data/drifters/drifters_deriva1.csv',
        pathTimeless: './Data/drifters/drifters_deriva1_timeless.jsonl',
        pathMetadata: './Data/drifters/drifters_metadata.jsonl',
        mapping: {
          temperature: {code: 'TEMP'},
        },
      }
    ]
  },


  // High-frequency radar network
  {
    name: 'High-frequency radar network',
    type: 'DPHFRNetwork',
    description: 'Surface currents from the Catalan Sea high-frequency radar network',
    sources: [
      // Recent
      {
        type: 'SourceErddap',
        src: 'https://erddap.icatmar.cat/erddap/index.html',  
        dataset: 'HF_radar_L3B_recent',
        mapping: {
          u: {code: 'EWCT'},
          v: {code: 'NSCT'},
        }
      },
      // Historical
      {
        type: 'SourceErddap',
        src: 'https://erddap.icatmar.cat/erddap/index.html',  
        dataset: 'HF_Radar_L3B_Historic',
        mapping: {
          u: {code: 'EWCT'},
          v: {code: 'NSCT'},
        }
      },
      // EU HFR Node
      {
        type: 'SourceErddap',
        src: 'https://erddap.hfrnode.eu/erddap/index.html',
        dataset: 'EUHFR_NRTcurrent_HFR-ICATMAR-Total_v3'
      },
      // Static file
      {
        type: 'SourceFileHFRNetwork',
        path: './Data/hfr/totals/'
      }
    ]
  },


  // High-frequency radar stations
  {
    name: 'High-frequency radar stations',
    type: 'DPHFRStations',
    description: 'Surface currents from the Catalan Sea high-frequency radar stations',
    sources: [
      {
        type: 'SourceErddapHFRStations',
        src: 'https://erddap.hfrnode.eu/erddap/index.html',
        datasets: [
          'EUHFR_NRTcurrent_HFR-ICATMAR-CNET_v3_table',
          'EUHFR_NRTcurrent_HFR-ICATMAR-CREU_v3_table',
          'EUHFR_NRTcurrent_HFR-ICATMAR-BEGU_v3_table',
          'EUHFR_NRTcurrent_HFR-ICATMAR-TOSS_v3_table',
          'EUHFR_NRTcurrent_HFR-ICATMAR-AREN_v3_table',
          'EUHFR_NRTcurrent_HFR-ICATMAR-PBCN_v3_table',
          'EUHFR_NRTcurrent_HFR-ICATMAR-GNST_v3_table',
        ],
      }
    ],
  },


  // Dynamic generation via EU HFR Node ERDDAP for networks and stations.

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


const KelvinToCelsius = (value) => {
  if (value === undefined || value === null) return value;
  return value - 273.15;
}

const MEDBBOX = {minLat: 30, minLon: -11, maxLat: 46, maxLon: 37}
const NWMEDBBOX = {minLat: 38.5, minLon: -0.4, maxLat: 44, maxLon: 6.2}
const WESTMEDBBOX = {minLat: 34.6, minLon: -5.8, maxLat: 44.6, maxLon: 16.5}