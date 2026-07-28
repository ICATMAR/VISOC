class DPDrifters {

  constructor() {
    this.sources = [
      new SourceErddap({ fetchManager: this.fetchManager, src: 'https://erddap.icatmar.cat/erddap/index.html', dataset: 'socat_data_drifters_ICATMAR' }),
      new SourceFile({ fetchManager: this.fetchManager, path: './Data/drifters_deriva1.csv', timeColumn: 'time' }),
    ];
  }

}

export default DPDrifters;