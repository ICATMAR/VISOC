class RequestsManager {

  hfrStations = [
    { id: 'CNET', name: 'Canet del Rosselló',  lon: 3.03805, lat: 42.7019, range: 'R24', owner: 'CEFREM',  installed: '2026-06-11', lastCalibration: '2025-12-05' },
    { id: 'CREU', name: 'Cap de Creus',         lon: 3.3160,  lat: 42.3189, range: 'R22', owner: 'ICATMAR', installed: '2023-02-17', lastCalibration: '2025-06-11' },
    { id: 'BEGU', name: 'Begur',                lon: 3.2305,  lat: 41.9672, range: 'R22', owner: 'ICATMAR', installed: '2023-04-04', lastCalibration: '2025-06-10' },
    { id: 'TOSS', name: 'Tossa de Mar',         lon: 2.9345,  lat: 41.7155, range: 'R24', owner: 'ICATMAR', installed: '2026-06-11', lastCalibration: '2025-06-03' },
    { id: 'AREN', name: 'Arenys de Mar',        lon: 2.5575,  lat: 41.5775, range: 'R23', owner: 'ICATMAR', installed: '2023-11-29', lastCalibration: '2024-02-29' },
    { id: 'PBCN', name: 'Port de Barcelona',    lon: 2.1711,  lat: 41.3344, range: 'R23', owner: 'ICATMAR', installed: '2023-12-05', lastCalibration: '2024-02-29' },
    { id: 'GNST', name: 'Port Ginesta',         lon: 1.9221,  lat: 41.2560, range: 'R23', owner: 'ICATMAR', installed: '2023-11-16', lastCalibration: '2024-03-01' },
    { id: 'SCAL', name: 'Segur de Calafell',    lon: 1.6073,  lat: 41.1862, range: 'R24', owner: 'ICATMAR', installed: 'unknown',    lastCalibration: 'unknown'    },
  ];

  hfrOwners = {
    ICATMAR: { name: 'ICATMAR', url: 'https://icatmar.cat' },
    CEFREM:  { name: 'CEFREM',  url: 'https://cefrem.univ-perp.fr/' },
  };

  hfrNetwork = {
    manufacturer: 'CODAR SeaSonde',
    frequency: '13.5 MHz',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    licenseLabel: 'CC BY 4.0',
  };

  buoyStations = [
    { id: 'CCRE', name: 'Cap de Creus', lon: 3.3495, lat: 42.3212, depth: 100, owner: 'MSM'      },
    { id: 'TORD', name: 'Tordera',      lon: 2.7698, lat: 41.5997, depth:  86, owner: 'MSM'      },
    { id: 'ODAS', name: 'Somorrostro',     lon: 2.2162, lat: 41.3757, depth:  40, owner: 'ICM/CSIC' },
    { id: 'TARG', name: 'Tarragona',    lon: 1.3469, lat: 41.0763, depth:  70, owner: 'MSM'      },
    { id: 'TORT', name: 'Cap de Tortosa', lon: 0.9852, lat: 40.7149, depth: 66, owner: 'MSM'     },
  ];

  _buoyDataCache = {};

  getHFRStation(id) {
    return this.hfrStations.find(s => s.id === id);
  }

  getBuoyStation(id) {
    return this.buoyStations.find(s => s.id === id);
  }

  _mockStatus = {
    CNET: 'active', CREU: 'active',   BEGU: 'active',   TOSS: 'delayed',
    AREN: 'active', PBCN: 'inactive', GNST: 'active',   SCAL: 'active',
    CCRE: 'active', TORD: 'active',   TARG: 'delayed',  TORT: 'active',  ODAS: 'inactive',
  };

  // Returns 'active', 'delayed', or 'inactive' status for any station.
  // Buoys: derived from the most recent generated VHM0 values.
  // HFR: hardcoded mockup (data lives in the DT component).
  getStationStatus(id, type) {
    if (type === 'buoy') return this._getBuoyStatus(id);
    return this._mockStatus[id] ?? 'active';
  }

  _getBuoyStatus(id) {
    const key = Object.keys(this._buoyDataCache).find(k => k.startsWith(id + '_'));
    if (!key) return this._mockStatus[id] ?? 'active';
    const vhm0 = this._buoyDataCache[key].VHM0;
    const n = vhm0.length;
    for (let i = n - 1; i >= Math.max(0, n - 3); i--)
      if (vhm0[i] != null) return 'active';
    for (let i = Math.max(0, n - 4); i >= Math.max(0, n - 24); i--)
      if (vhm0[i] != null) return 'delayed';
    return 'inactive';
  }

  // Generates and caches hourly mockup data for all buoy variables.
  // WSPD/WDIR: wind km/h + °; VHM0/VMDR: wave m + °; HCSP/HCDT: current m/s + °; TEMP °C; PSAL PSU
  generateBuoyHourlyData(id, totalHours) {
    const key = `${id}_${totalHours}`;
    if (this._buoyDataCache[key]) return this._buoyDataCache[key];
    const out = { VHM0: [], VMDR: [], WSPD: [], WDIR: [], HCSP: [], HCDT: [], TEMP: [], PSAL: [] };
    for (let i = 0; i < totalHours; i++) {
      const ok = Math.random() > 0.15;
      out.VHM0.push(ok ? Math.random() * 4 : null);
      out.VMDR.push(ok ? Math.random() * 360 : null);
      out.WSPD.push(ok ? Math.random() * 70 : null);
      out.WDIR.push(ok ? Math.random() * 360 : null);
      out.HCSP.push(ok ? Math.random() * 1.5 : null);
      out.HCDT.push(ok ? Math.random() * 360 : null);
      out.TEMP.push(ok ? 15 + Math.random() * 10 : null);
      out.PSAL.push(ok ? 36 + Math.random() * 3 : null);
    }
    this._buoyDataCache[key] = out;
    return out;
  }
}

export default RequestsManager;
