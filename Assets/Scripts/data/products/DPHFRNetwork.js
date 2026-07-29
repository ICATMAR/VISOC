import SourceErddap from '../sources/SourceErddap.js';
//import SourceFileHFRNetwork from '../sources/SourceFileHFRNetwork.js';

class DPHFRNetwork {

  constructor (fetchManager) {
    this.sources = [
      new SourceErddap({ fetchManager, src: 'https://erddap.icatmar.cat/erddap/index.html', dataset: 'HF_radar_L3B_recent'}),
      new SourceErddap({ fetchManager, src: 'https://erddap.icatmar.cat/erddap/index.html', dataset: 'HF_Radar_L3B_Historic'}),
      new SourceErddap({ fetchManager, src: 'https://erddap.hfrnode.eu/erddap/index.html', dataset: 'EUHFR_NRTcurrent_HFR-ICATMAR-Total_v3'}),
      //new SourceFileHFRNetwork({ fetchManager, path: './Data/hfr/totals/'})
    ];

    console.log('DPFHRNetwork: sources loaded', this.sources);
  }
}

export default DPHFRNetwork;