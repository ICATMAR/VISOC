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

  getHFRStation(id) {
    return this.hfrStations.find(s => s.id === id);
  }
}

export default RequestsManager;
