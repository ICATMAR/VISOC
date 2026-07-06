import { generateDrifterTrajectory, resampleDrifterHourly } from './DriftersMockData.js';

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
    { id: 'CCRE', name: 'Cap de Creus',    lon: 3.3495, lat: 42.3212, depth: 100, distanceCoast: 1.24, institution: 'ICATMAR', manufacturer: 'MSM',      installed: '2025-12-01', lastCalibration: 'unknown' },
    { id: 'TORD', name: 'Tordera',         lon: 2.7698, lat: 41.5997, depth:  86, distanceCoast: 2.74, institution: 'ICATMAR', manufacturer: 'MSM',      installed: '2025-12-01', lastCalibration: 'unknown' },
    { id: 'ODAS', name: 'Somorrostro',     lon: 2.2162, lat: 41.3757, depth:  40, distanceCoast: 1.90, institution: 'ICATMAR', manufacturer: 'ICM/CSIC', installed: '2026-06-18', lastCalibration: 'unknown' },
    { id: 'TARG', name: 'Tarragona',       lon: 1.3469, lat: 41.0763, depth:  70, distanceCoast: 3.06, institution: 'ICATMAR', manufacturer: 'MSM',      installed: '2025-12-01', lastCalibration: 'unknown' },
    { id: 'TORT', name: 'Cap de Tortosa',  lon: 0.9852, lat: 40.7149, depth:  66, distanceCoast: 6.09, institution: 'ICATMAR', manufacturer: 'MSM',      installed: '2025-12-01', lastCalibration: 'unknown' },
  ];

  // DRIFTERS (DERIVA-1 exercise) — 4 CODE, 4 SVP, 4 Stokes.
  // type: CODE (1 m) / SVP (15 m) / Stokes (surface). depth in metres.
  // startLon/startLat: deployment location. lastHoursAgo drives both the
  // trailing data gap (status/last-update) and the trajectory end.
  drifterStations = [
    { id: 'CODE1', deploymentId: 1,  type: 'CODE',   depth: 1,  project: 'ICATMAR', exercise: 'DERIVA-1', institution: 'ICATMAR', piName: 'ICATMAR', deployDate: '2025-09-14', startLon: 3.2200, startLat: 42.2900, seed: 101, lastHoursAgo: 1  },
    { id: 'CODE2', deploymentId: 2,  type: 'CODE',   depth: 1,  project: 'ICATMAR', exercise: 'DERIVA-1', institution: 'ICATMAR', piName: 'ICATMAR', deployDate: '2025-09-16', startLon: 2.9000, startLat: 41.7500, seed: 102, lastHoursAgo: 1  },
    { id: 'CODE3', deploymentId: 3,  type: 'CODE',   depth: 1,  project: 'ICATMAR', exercise: 'DERIVA-1', institution: 'ICATMAR', piName: 'ICATMAR', deployDate: '2025-09-18', startLon: 2.4000, startLat: 41.5000, seed: 103, lastHoursAgo: 8  },
    { id: 'CODE4', deploymentId: 4,  type: 'CODE',   depth: 1,  project: 'ICATMAR', exercise: 'DERIVA-1', institution: 'ICATMAR', piName: 'ICATMAR', deployDate: '2025-09-20', startLon: 1.9500, startLat: 41.2000, seed: 104, lastHoursAgo: 2  },
    { id: 'SVP1',  deploymentId: 5,  type: 'SVP',    depth: 15, project: 'ICATMAR', exercise: 'DERIVA-1', institution: 'ICATMAR', piName: 'ICATMAR', deployDate: '2025-09-14', startLon: 3.3000, startLat: 42.1500, seed: 201, lastHoursAgo: 1  },
    { id: 'SVP2',  deploymentId: 6,  type: 'SVP',    depth: 15, project: 'ICATMAR', exercise: 'DERIVA-1', institution: 'ICATMAR', piName: 'ICATMAR', deployDate: '2025-09-15', startLon: 2.7000, startLat: 41.6000, seed: 202, lastHoursAgo: 1  },
    { id: 'SVP3',  deploymentId: 7,  type: 'SVP',    depth: 15, project: 'ICATMAR', exercise: 'DERIVA-1', institution: 'ICATMAR', piName: 'ICATMAR', deployDate: '2025-09-17', startLon: 2.2000, startLat: 41.3500, seed: 203, lastHoursAgo: 40 },
    { id: 'SVP4',  deploymentId: 8,  type: 'SVP',    depth: 15, project: 'ICATMAR', exercise: 'DERIVA-1', institution: 'ICATMAR', piName: 'ICATMAR', deployDate: '2025-09-19', startLon: 1.3000, startLat: 41.0500, seed: 204, lastHoursAgo: 1  },
    { id: 'STK1',  deploymentId: 9,  type: 'Stokes', depth: 0,  project: 'ICATMAR', exercise: 'DERIVA-1', institution: 'ICATMAR', piName: 'ICATMAR', deployDate: '2025-09-14', startLon: 3.1000, startLat: 42.0500, seed: 301, lastHoursAgo: 1  },
    { id: 'STK2',  deploymentId: 10, type: 'Stokes', depth: 0,  project: 'ICATMAR', exercise: 'DERIVA-1', institution: 'ICATMAR', piName: 'ICATMAR', deployDate: '2025-09-16', startLon: 2.6000, startLat: 41.5500, seed: 302, lastHoursAgo: 6  },
    { id: 'STK3',  deploymentId: 11, type: 'Stokes', depth: 0,  project: 'ICATMAR', exercise: 'DERIVA-1', institution: 'ICATMAR', piName: 'ICATMAR', deployDate: '2025-09-18', startLon: 2.0500, startLat: 41.2500, seed: 303, lastHoursAgo: 1  },
    { id: 'STK4',  deploymentId: 12, type: 'Stokes', depth: 0,  project: 'ICATMAR', exercise: 'DERIVA-1', institution: 'ICATMAR', piName: 'ICATMAR', deployDate: '2025-09-20', startLon: 1.0500, startLat: 40.8000, seed: 304, lastHoursAgo: 1  },
  ];

  _buoyDataCache = {};
  _drifterTrajCache = {};   // id → native-cadence trajectory (for maps)
  _drifterHourlyCache = {}; // `id_totalHours` → hourly resample (for timeline)

  // Hours since last valid data point per HFR station (used for status + time-ago display).
  // active ≤ 3h, delayed 3–24h, inactive > 24h
  _mockLastUpdateHours = {
    CNET: 1,   CREU: 0.5, BEGU: 2,   TOSS: 8,
    AREN: 1.5, PBCN: 72,  GNST: 1,   SCAL: 2,
  };

  // Force a trailing gap (hours of null) at the end of generated buoy data to simulate inactivity.
  // active ≤ 2h, delayed 2–24h, inactive > 24h
  _buoyDataGaps = {
    ODAS: 48,
    TARG: 12,
  };

  getHFRStation(id) {
    return this.hfrStations.find(s => s.id === id);
  }

  getBuoyStation(id) {
    return this.buoyStations.find(s => s.id === id);
  }

  getDrifterStation(id) {
    return this.drifterStations.find(s => s.id === id);
  }

  // Time window drifter data is generated for. Anchored to the drifter
  // dashboard's own range (not whatever dashboard is active when first
  // requested), so a trajectory requested early (e.g. by the map overlay
  // while another dashboard is open) still covers the full drifter window.
  _drifterWindow() {
    const gui = typeof window !== 'undefined' ? window.GUIManager : null;
    const rangeDays = gui?.dashboards?.find(d => d.id === 'drifters')?.latestDaysRange ?? 15;
    const end = new Date();
    end.setMinutes(0, 0, 0);
    end.setHours(end.getHours() + 1);
    const start = new Date(end.getTime());
    start.setDate(start.getDate() - rangeDays);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  // Native-cadence trajectory for a drifter (used by the maps). Cached per id.
  // The window is always the full drifter range (see _drifterWindow).
  getDrifterTrajectory(id) {
    if (!this._drifterTrajCache[id]) {
      const d = this.getDrifterStation(id);
      if (!d) return [];
      const { start, end } = this._drifterWindow();
      this._drifterTrajCache[id] = generateDrifterTrajectory(d, start, end);
    }
    return this._drifterTrajCache[id];
  }

  // Hourly resample of a drifter trajectory (used by the DataTimeline).
  getDrifterHourly(id, startDate, totalHours) {
    const key = `${id}_${totalHours}`;
    if (!this._drifterHourlyCache[key]) {
      const traj = this.getDrifterTrajectory(id);
      this._drifterHourlyCache[key] = resampleDrifterHourly(traj, startDate, totalHours);
    }
    return this._drifterHourlyCache[key];
  }

  // Returns hours since last valid data point for a station.
  getLastUpdateHoursAgo(id, type) {
    if (type === 'drifter') {
      const d = this.getDrifterStation(id);
      return d?.lastHoursAgo ?? 1;
    }
    if (type === 'buoy') {
      const key = Object.keys(this._buoyDataCache).find(k => k.startsWith(id + '_'));
      if (key) {
        const vhm0 = this._buoyDataCache[key].VHM0;
        for (let i = vhm0.length - 1; i >= 0; i--) {
          if (vhm0[i] != null) return vhm0.length - 1 - i;
        }
        return vhm0.length;
      }
      return this._buoyDataGaps[id] ?? 1;
    }
    return this._mockLastUpdateHours[id] ?? 1;
  }

  // Returns 'active', 'delayed', or 'inactive' based on hours since last update.
  // Buoys:  active ≤ 2h, delayed 2–24h, inactive > 24h
  // HFR:    active ≤ 3h, delayed 3–24h, inactive > 24h
  getStationStatus(id, type) {
    const hours = this.getLastUpdateHoursAgo(id, type);
    const delayThreshold = type === 'buoy' ? 2 : 3;
    if (hours <= delayThreshold) return 'active';
    if (hours <= 24) return 'delayed';
    return 'inactive';
  }

  // Generates and caches hourly mockup data for all buoy variables.
  // WSPD/WDIR: wind km/h + °; VHM0/VMDR: wave m + °; HCSP/HCDT: current m/s + °; TEMP °C; PSAL PSU
  generateBuoyHourlyData(id, totalHours) {
    const key = `${id}_${totalHours}`;
    if (this._buoyDataCache[key]) return this._buoyDataCache[key];
    const out = { VHM0: [], VMDR: [], WSPD: [], WDIR: [], HCSP: [], HCDT: [], TEMP: [], PSAL: [] };
    const gapHours = this._buoyDataGaps[id] ?? 0;
    for (let i = 0; i < totalHours; i++) {
      const inGap = i >= totalHours - gapHours;
      const ok = !inGap && Math.random() > 0.15;
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
