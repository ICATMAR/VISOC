import SourceErddap from '../sources/SourceErddap.js';
import SourceFileHFRTotals from '../sources/SourceFileHFRTotals.js';

class DPHFRNetwork {

  constructor (fetchManager) {
    this.sources = [
      new SourceErddap({ fetchManager, src: 'https://erddap.icatmar.cat/erddap/index.html', dataset: 'HF_radar_L3B_recent'}),
      new SourceErddap({ fetchManager, src: 'https://erddap.icatmar.cat/erddap/index.html', dataset: 'HF_Radar_L3B_Historic'}),
      new SourceErddap({ fetchManager, src: 'https://erddap.hfrnode.eu/erddap/index.html', dataset: 'EUHFR_NRTcurrent_HFR-ICATMAR-Total_v3'}),
      new SourceFileHFRTotals({
        fetchManager, paths: [
          './Data/hfr/totals/TOTL_CATS_2026_07_15_0900.tuv',
          './Data/hfr/totals/TOTL_CATS_2026_07_15_1000.tuv',
          './Data/hfr/totals/TOTL_CATS_2026_07_15_1100.tuv',
          './Data/hfr/totals/TOTL_CATS_2026_07_15_1200.tuv'
        ]
      })
    ];

    console.log('DPFHRNetwork: sources loaded', this.sources);
  }
}

export default DPHFRNetwork;