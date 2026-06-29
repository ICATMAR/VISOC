class RequestsManager {

  hfrStations = [
    { id: 'CNET', name: 'Canet del Rosselló',  lon: 3.03805, lat: 42.7019, range: 'R24', owner: 'CEFREM'  },
    { id: 'CREU', name: 'Cap de Creus',         lon: 3.3160,  lat: 42.3189, range: 'R22', owner: 'ICATMAR' },
    { id: 'BEGU', name: 'Begur',                lon: 3.2305,  lat: 41.9672, range: 'R22', owner: 'ICATMAR' },
    { id: 'TOSS', name: 'Tossa de Mar',         lon: 2.9345,  lat: 41.7155, range: 'R24', owner: 'ICATMAR' },
    { id: 'AREN', name: 'Arenys de Mar',        lon: 2.5575,  lat: 41.5775, range: 'R23', owner: 'ICATMAR' },
    { id: 'PBCN', name: 'Port de Barcelona',    lon: 2.1711,  lat: 41.3344, range: 'R23', owner: 'ICATMAR' },
    { id: 'GNST', name: 'Port Ginesta',         lon: 1.9221,  lat: 41.2560, range: 'R23', owner: 'ICATMAR' },
    { id: 'SCAL', name: 'Segur de Calafell',    lon: 1.6073,  lat: 41.1862, range: 'R24', owner: 'ICATMAR' },
  ];

  buoyStations = [
    { id: 'CCRE', name: 'Cap de Creus', lon: 3.3495, lat: 42.3212, depth: 100, owner: 'MSM'      },
    { id: 'TORD', name: 'Tordera',      lon: 2.7698, lat: 41.5997, depth:  86, owner: 'MSM'      },
    { id: 'TARG', name: 'Tarragona',    lon: 1.3469, lat: 41.0763, depth:  70, owner: 'MSM'      },
    { id: 'TORT', name: 'Cap de Tortosa', lon: 0.9852, lat: 40.7149, depth: 66, owner: 'MSM'     },
    { id: 'ODAS', name: 'Somorrostro',     lon: 2.2162, lat: 41.3757, depth:  40, owner: 'ICM/CSIC' },
  ];

  getHFRStation(id) {
    return this.hfrStations.find(s => s.id === id);
  }

  getBuoyStation(id) {
    return this.buoyStations.find(s => s.id === id);
  }
}

export default RequestsManager;
