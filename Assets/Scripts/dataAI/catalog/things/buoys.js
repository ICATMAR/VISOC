// ============================================================================
// data/catalog/things/buoys.js
//
// Bundled (static) Thing definitions for the moored buoys. Identity + config
// only — positions, sensors, metadata, and the app-level default-datastream
// choice. NO fetch/product wiring here (that's the DataManager factory's job in
// step 9). `time` is omitted from locations because these platforms are fixed.
// ============================================================================

import { ThingKind } from '../../model.js';

/** @type {import('../../model.js').Thing[]} */
export const buoyThings = [
  {
    id: 'CCRE', kind: ThingKind.BUOY, name: 'Cap de Creus',
    locations: [{ lon: 3.3495, lat: 42.3212 }],
    sensors: [{ id: 'ctd', name: 'CTD' }, { id: 'meteo', name: 'Meteo station' }, { id: 'adcp', name: 'ADCP' }],
    defaultDatastreams: { TEMP: 'TEMP', PSAL: 'PSAL', WSPD: 'WSPD', VHM0: 'VHM0', HCSP: 'HCSP' },
    properties: { owner: 'ICATMAR', manufacturer: 'MSM', depth: 100, distanceCoast: 1.24, installed: '2025-12-01' },
  },
  {
    id: 'TORD', kind: ThingKind.BUOY, name: 'Tordera',
    locations: [{ lon: 2.7698, lat: 41.5997 }],
    sensors: [{ id: 'ctd', name: 'CTD' }, { id: 'meteo', name: 'Meteo station' }],
    defaultDatastreams: { TEMP: 'TEMP', WSPD: 'WSPD', VHM0: 'VHM0' },
    properties: { owner: 'ICATMAR', manufacturer: 'MSM', depth: 86, distanceCoast: 2.74, installed: '2025-12-01' },
  },
  {
    id: 'ODAS', kind: ThingKind.BUOY, name: 'Somorrostro',
    locations: [{ lon: 2.2162, lat: 41.3757 }],
    sensors: [{ id: 'ctd', name: 'CTD' }, { id: 'meteo', name: 'Meteo station' }, { id: 'adcp', name: 'ADCP' }],
    defaultDatastreams: { TEMP: 'TEMP', PSAL: 'PSAL', WSPD: 'WSPD', VHM0: 'VHM0', HCSP: 'HCSP' },
    properties: { owner: 'ICATMAR', manufacturer: 'ICM-CSIC', depth: 40, distanceCoast: 1.90, installed: '2026-06-18' },
  },
  {
    id: 'TARG', kind: ThingKind.BUOY, name: 'Tarragona',
    locations: [{ lon: 1.3469, lat: 41.0763 }],
    sensors: [{ id: 'ctd', name: 'CTD' }, { id: 'meteo', name: 'Meteo station' }],
    defaultDatastreams: { TEMP: 'TEMP', WSPD: 'WSPD', VHM0: 'VHM0' },
    properties: { owner: 'ICATMAR', manufacturer: 'MSM', depth: 70, distanceCoast: 3.06, installed: '2025-12-01' },
  },
  {
    id: 'TORT', kind: ThingKind.BUOY, name: 'Cap de Tortosa',
    locations: [{ lon: 0.9852, lat: 40.7149 }],
    sensors: [{ id: 'ctd', name: 'CTD' }, { id: 'meteo', name: 'Meteo station' }],
    defaultDatastreams: { TEMP: 'TEMP', WSPD: 'WSPD', VHM0: 'VHM0' },
    properties: { owner: 'ICATMAR', manufacturer: 'MSM', depth: 66, distanceCoast: 6.09, installed: '2025-12-01' },
  },
];
