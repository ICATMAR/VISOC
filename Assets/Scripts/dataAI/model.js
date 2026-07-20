// ============================================================================
// data/model.js
//
// The shared "shapes" of our data, named after the OGC SensorThings API (STA)
// so a future move from ERDDAP to an STA server is mostly a naming match.
//
// This file has NO logic. It contains:
//   - runtime ENUMS  (real frozen objects you can import and compare against)
//   - JSDoc TYPEDEFS (documentation-only "types" — they give editor autocomplete
//                     and hints, but disappear at runtime since this is plain JS)
//
// Everything here is plain, JSON-serializable data (no class instances, no
// methods). That matters: the exact same objects can later be sent over HTTP
// from a Node service to the browser without any conversion.
//
// Datastream vs FieldTile is chosen PER VARIABLE, by its spatial dimensionality
// — NOT per Thing. A single (gridded) dataset/Thing commonly exposes BOTH at
// once: 2-D FieldTiles (e.g. HFR u/v current) AND 1-D Datastreams (e.g.
// diagnostics like number-of-contributing-stations or number-of-valid-points).
// ============================================================================


// ---- Runtime enums -------------------------------------------------------
// Object.freeze makes them read-only, so nobody can accidentally reassign a
// value at runtime. Import as: import { ThingKind } from './model.js'

/** Kind of Thing (a platform). */
export const ThingKind = Object.freeze({
  HFR_STATION: 'hfr-station',
  HFR_NETWORK: 'hfr-network',   // virtual/aggregate Thing: combined total current field
  BUOY:        'buoy',
  DRIFTER:     'drifter',
  ARGO:        'argo',
  MODEL:       'model',
});

/** Where a result came from: measured vs. modeled. */
export const Provenance = Object.freeze({
  OBSERVATION: 'observation',
  FORECAST:    'forecast',
  ANALYSIS:    'analysis',
  CLIMATOLOGY: 'climatology',
});

/** Availability of a Thing (the map status dot). */
export const StatusState = Object.freeze({
  ACTIVE:   'active',
  DELAYED:  'delayed',
  INACTIVE: 'inactive',
});


// ---- Documentation types (JSDoc @typedef) --------------------------------
// These describe the object shapes. They are erased at runtime — purely for
// editor help and to document the contracts between layers.
//
// Note on Date: in the browser we use real Date objects (ergonomic). When the
// data layer later moves behind an HTTP/Node boundary, that boundary will
// (de)serialize Date <-> ISO string. Inside the app we always work with Date.

/**
 * A half-open time interval [start, end).
 * @typedef {Object} TimeRange
 * @property {Date} start
 * @property {Date} end
 */

/**
 * ObservedProperty — the phenomenon being measured (STA: ObservedProperty),
 * taken from our standard parameter list. `code` is the stable short code
 * (e.g. 'TEMP', 'WSPD'); `definition` is a URI into the standard vocabulary.
 * @typedef {Object} ObservedProperty
 * @property {string} code
 * @property {string} name
 * @property {string} unit
 * @property {string} [definition]
 */

/**
 * Sensor — the instrument that produced a Datastream (STA: Sensor).
 *
 * A Sensor is usually a plain instrument, but it can also be a *reference to
 * another Thing acting as a sensor* for an aggregate. Example: an HFR NETWORK
 * Thing whose sensors are the HFR STATION Things — there `thingId` points at
 * the station Thing, which keeps its own identity, metadata and radial product.
 * @typedef {Object} Sensor
 * @property {string} id
 * @property {string} name
 * @property {string} [type]
 * @property {string} [thingId]   set when the "sensor" is itself a Thing
 */

/**
 * Observation — a single measurement (STA: Observation).
 * @typedef {Object} Observation
 * @property {Date} phenomenonTime     the instant the value is about
 * @property {number|null} result      the value (null means a gap / missing)
 * @property {Date} [resultTime]       when it was produced (e.g. a model run)
 */

/**
 * Datastream — ONE time-series: the Observations of a single ObservedProperty,
 * from a single Sensor, at a single depth (STA: Datastream). This is the unit
 * the views actually consume.
 * @typedef {Object} Datastream
 * @property {string} id
 * @property {string} thingId
 * @property {string} observedProperty   the ObservedProperty code, e.g. 'TEMP'
 * @property {string} unit               standard unit (products convert to this)
 * @property {string} [sensorId]
 * @property {number|null} [depth]       metres below surface, null if N/A
 * @property {string} provenance         one of Provenance.*
 * @property {Date} [referenceTime]      model run time (forecasts only)
 * @property {Observation[]} observations
 */

/**
 * HistoricalLocation — a Thing's position at a time (STA: HistoricalLocation).
 * A drifter's trajectory is an array of these; a fixed platform has just one.
 * @typedef {Object} HistoricalLocation
 * @property {Date} time
 * @property {number} lon
 * @property {number} lat
 */

/**
 * Thing — a platform: buoy, HFR station, drifter, model point (STA: Thing).
 * Identity + config only. The volatile parts live in Datastreams / Status.
 * @typedef {Object} Thing
 * @property {string} id
 * @property {string} kind                             one of ThingKind.*
 * @property {string} name
 * @property {HistoricalLocation[]} [locations]        position(s) / trajectory
 * @property {Sensor[]} [sensors]
 * @property {Object.<string,string>} [defaultDatastreams]  paramCode -> datastreamId
 *   (the app-level "which sensor/depth do the simple views use" choice)
 * @property {Object} [properties]                     owner, install date, etc.
 */

/**
 * Status — availability/freshness of a Thing (derived, or from an endpoint).
 * @typedef {Object} Status
 * @property {string} thingId
 * @property {string} state               one of StatusState.*
 * @property {Date} [lastUpdate]
 * @property {number} [hoursAgo]
 */

/**
 * FieldTile — a gridded result over space + time (NOT an STA entity). Used for
 * HFR STATION radials, HFR NETWORK total fields, and forecast model grids.
 * @typedef {Object} FieldTile
 * @property {string} productId
 * @property {string} [observedProperty]   e.g. radial velocity, current u/v, speed…
 * @property {('regular'|'radial'|'curvilinear')} [gridType]
 *   'radial' = a station's polar grid; 'regular' = the network's lat/lon grid
 * @property {[number,number,number,number]} bbox   [west, south, east, north]
 * @property {Date} time
 * @property {Date} [referenceTime]
 * @property {string} provenance
 * @property {*} data      payload (grid array, image URL, GeoJSON…): product-defined
 */

// Nothing to export besides the enums above — the typedefs are compile-time only.
