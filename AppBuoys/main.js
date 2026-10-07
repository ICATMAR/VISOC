// ICATMAR Buoys app.
//
// Three views over the buoys of the Catalan coast, all built from VISOC's own
// data products (see Assets/Scripts/data/products/Catalogue.js):
//
//   LIST  one row per buoy, grouped by stretch of coast, north to south, with
//         its latest wave, wind, water temperature and current readings
//   BUOY  one buoy, one row per 1 or 3 hours, 24 h back and 72 h ahead:
//         measurements where there are any, forecasts everywhere else
//   INFO  where the buoy is, what it looks like, who runs it and where every
//         number in the BUOY view comes from
//
// Measurements come from DPAggregatedBuoys (DPBuoys plus the virtual buoys
// built on it, like BCNS), forecasts from DPWindForecast, DPWaveForecast and
// DPSeaSurfaceForecast. Everything is kept in standard units (see
// data/variables.js) and only converted when drawn, through GUIManager's unit
// selection - so a unit change re-renders, it never re-fetches.
//
// No framework: the views are plain HTML strings re-rendered whenever new data
// lands, which at a few hundred cells is cheap enough not to bother diffing.

import FetchManager from '../Assets/Scripts/data/FetchManager.js';
import Catalogue from '../Assets/Scripts/data/products/Catalogue.js';
import GUIManager from '../Assets/Scripts/GUIManager.js';
import { UNIT_GROUPS } from '../Assets/Scripts/data/variables.js';
import LANGUAGES from './lang.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const HOURS_BEFORE = 24;          // the buoy view starts this far back...
const HOURS_AFTER = 72;           // ...and reaches this far ahead
const LATEST_WINDOW_HOURS = 24;   // how far back the list looks for a latest reading
// A reading older than this is no longer "now": the list shows the forecast
// for the current hour instead, marked as such.
const STALE_HOURS = 3;
// Same thresholds as VISOC's buoy platform detail (DTAPBuoysPlatformDetail)
const ACTIVE_HOURS = 3;
const DELAYED_HOURS = 24;
const REFRESH_INTERVAL = 5 * MINUTE;
const LOADING_TIMEOUT = 8000;     // ms the loading screen waits for the sources at most

const SETTINGS_KEY = 'icatmarBuoysApp.settings';
// Used when none of the browser's languages is one the app has (see lang.js)
const DEFAULT_LANGUAGE = 'ca';

// Stretches of coast, north to south. Each buoy is placed by id; one not
// listed here (a new buoy) falls back to its latitude (see groupOf).
const GROUPS = [
  { id: 'costaBrava', name: 'Costa Brava', minLatitude: 41.8,
    buoys: ['NORD_CAP_DE_CREUS', 'CDCR', 'SUD_CAP_DE_CREUS', 'MONTGO', 'MEDES', 'BEGU'] },
  { id: 'barcelones', name: 'Barcelonès', minLatitude: 41.2,
    buoys: ['TORD', 'BCNS', 'SOMO', 'PBCN'] },
  { id: 'tarragonaEbre', name: 'Tarragona / Ebre', minLatitude: -90,
    buoys: ['TARR', 'PTARR', 'TORT', 'MTARR'] },
];

// Real buoys shown only through a virtual one (BCNS is made of both, see the
// catalogue's 'Aggregated buoys'). They are still loaded - BCNS needs them.
const HIDDEN_BUOYS = ['SOMO', 'PBCN'];

// The four data columns (titled t('column.<id>')). `code` is the magnitude shown and coloured by the
// legend (styles/colorLegends.js), `directionCode` drawn as an arrow.
// `fromDirection` marks a direction reported as where it comes FROM (wind,
// waves), which the arrow turns around to show where it goes.
// `forecast` is the catalogue's name of the product that fills it in where
// there are no measurements.
const COLUMNS = [
  {
    id: 'waves', icon: 'fa-solid fa-water',
    code: 'VHM0', directionCode: 'VMDR', fromDirection: true, periodCode: 'VTM02',
    // The biggest wave of the interval. CF has four spellings of "maximum
    // wave height" (see GUIManager.buoyDetailVariables) - whichever turns up.
    // No buoy publishes the maximum wave's own period, so the peak period
    // stands in, as in VISOC's platform detail.
    maxCodes: ['VZMX', 'VCMX', 'VHMH', 'VEMH'], maxPeriodCode: 'VTPK',
    forecast: 'Wave forecast',
  },
  {
    id: 'wind', icon: 'fa-solid fa-wind',
    code: 'WSPD', directionCode: 'WDIR', fromDirection: true, gustCode: 'GSPD',
    forecast: 'Wind forecast',
  },
  {
    id: 'temperature', icon: 'fa-solid fa-temperature-half',
    code: 'TEMP',
    forecast: 'Sea surface forecast',
  },
  {
    // HCDT is where the water is GOING, so no half turn
    id: 'currents', icon: 'fa-solid fa-arrows-turn-right',
    code: 'HCSP', directionCode: 'HCDT',
    forecast: 'Sea surface forecast',
  },
];

const columnCodes = column => [column.code, column.directionCode, column.periodCode,
  ...(column.maxCodes ?? []), column.maxPeriodCode, column.gustCode].filter(Boolean);
const OBSERVATION_CODES = [...new Set(COLUMNS.flatMap(columnCodes))];

// Unit pickers in the menu, one per quantity (see UNIT_GROUPS)
// (titled t('unit.<group>'))
const UNIT_PICKERS = [
  { group: 'waveHeight', icon: 'fa-solid fa-water' },
  { group: 'windSpeed', icon: 'fa-solid fa-wind' },
  { group: 'temperature', icon: 'fa-solid fa-temperature-half' },
  { group: 'waterSpeed', icon: 'fa-solid fa-arrows-turn-right' },
];

// What each forecast product is called in the institutions' roles
const PRODUCT_KEYS = {
  'Wave forecast': 'product.waves',
  'Wind forecast': 'product.wind',
  'Sea surface forecast': 'product.seaSurface',
};

const PHOTOS_PATH = '../Assets/Images/platforms/Buoys/';
// Smallest margin (map units, ~9 km on the ground here) around the buoy(s) in
// the info view's map - the closest it ever zooms in (see renderMap)
const MAP_MIN_MARGIN = 12000;
const BASEMAP_URL ='https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png';


// --------------------------------------------------------------- PRODUCTS

// Same as VISOC's DataService: products are found in the catalogue by name
function createProduct(name, ...args) {
  const entry = Catalogue.find(product => product.name === name);
  if (!entry) throw new Error(`No '${name}' in the catalogue`);
  return new entry.Class(entry, FetchManager, ...args);
}

const buoysProduct = createProduct('Buoys');
const allBuoysProduct = createProduct('Aggregated buoys', buoysProduct);
const forecastProducts = new Map([...new Set(COLUMNS.map(column => column.forecast))]
  .map(name => [name, createProduct(name)]));


// ------------------------------------------------------------------ STATE

const settings = loadSettings();

// The language the app is shown in: the one picked in the menu, or else the
// first of the browser's languages the app has, or else DEFAULT_LANGUAGE
let language = LANGUAGES[settings.language] ? settings.language : detectLanguage();

function detectLanguage() {
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    const code = String(tag ?? '').slice(0, 2).toLowerCase();
    if (LANGUAGES[code]) return code;
  }
  return DEFAULT_LANGUAGE;
}

// A text in the current language, with its {placeholders} filled in. Falls
// back to English, and to the key itself (see lang.js).
function t(key, params = {}) {
  const text = LANGUAGES[language].texts[key] ?? LANGUAGES.en.texts[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => params[name] ?? match);
}

// The locale dates are written in, e.g. 'ca-ES'
const locale = () => LANGUAGES[language].locale;

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

// Unit selection, colour legends and the time zone toggle - VISOC's own
// helpers, used outside Vue as a plain object.
const gui = new GUIManager();
gui.selectedUnits = settings.units;
gui.timelineUseLocalTime = settings.useLocalTime;

const state = {
  buoysById: new Map(),   // every buoy, real and virtual, hidden ones included
  buoys: [],              // the ones listed, north to south
  latest: new Map(),      // buoyId -> { loading, columns: { <id>: { values, date, forecast } }, lastUpdate }
  listUpdatedAt: undefined, // when the last refresh finished
  nextUpdateAt: undefined,  // when the next one is due (see scheduleRefresh)
  refreshing: false,
  // The buoy open in the BUOY/INFO views:
  // { buoyId, observations, forecasts: { <column id>: result }, followNow }
  detail: undefined,
  route: { view: 'list' },
};

// Forecast promises, by product, point and window (see getForecast)
const forecastCache = new Map();

const el = id => document.getElementById(id);


// --------------------------------------------------------------- SETTINGS

function loadSettings() {
  // Knots by default for the wind - what sailors and fishermen read - and
  // 3-hour rows, which fit the 4 days of the buoy view on a phone screen
  const defaults = { units: { windSpeed: 'kn' }, useLocalTime: true, intervalHours: 3 };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch (error) {
    return defaults;
  }
}

function saveSettings() {
  settings.units = gui.selectedUnits;
  settings.useLocalTime = gui.timelineUseLocalTime;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    // Private mode or blocked storage: the settings just don't persist
  }
}


// ------------------------------------------------------------- FORMATTING

function escapeHTML(text) {
  return String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

// A standard value in the unit the user picked: { text, unit }
function formatValue(code, value) {
  const { unit, decimals, toDisplay } = gui.unitFor(code);
  return { text: toDisplay(value).toFixed(decimals), unit: unit ?? '' };
}

// An arrow pointing where the wind/waves/water GO. Drawn pointing north and
// rotated, so 0 deg is north and angles run clockwise like a compass.
function arrowHTML(direction, fromDirection) {
  const angle = (direction + (fromDirection ? 180 : 0)) % 360;
  return `<svg class="arrow" viewBox="0 0 24 24" style="transform: rotate(${angle.toFixed(0)}deg)" aria-hidden="true">`
    + '<path d="M12 2 L19.5 21 L12 16.5 L4.5 21 Z"/></svg>';
}

const timeZone = () => gui.timelineUseLocalTime ? undefined : 'UTC';

function ordinal(day) {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  return day + ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th');
}

// 'Saturday 29th September', 'Dissabte, 29 de setembre', ...
function formatDay(date) {
  if (language === 'en') {
    const part = options => date.toLocaleString('en-GB', { ...options, timeZone: timeZone() });
    return `${part({ weekday: 'long' })} ${ordinal(Number(part({ day: 'numeric' })))} ${part({ month: 'long' })}`;
  }
  return capitalize(date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: timeZone() }));
}

const dayKey = date => date.toLocaleDateString('en-CA', { timeZone: timeZone() });

function formatHour(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timeZone() });
}

// '14h' - a row's label in the buoy view, where every row starts on the hour
function formatHourShort(date) {
  return `${Number(date.toLocaleString('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: timeZone() }))}h`;
}

function formatDateTime(date) {
  if (!date) return '';
  return `${date.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: timeZone() })} ${formatHour(date)}`;
}

function formatAgo(date) {
  if (!date) return t('ago.none');
  const minutes = Math.round((Date.now() - date.getTime()) / MINUTE);
  if (minutes < 1) return t('ago.now');
  if (minutes < 60) return t('ago.minutes', { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t('ago.hours', { n: hours });
  return t('ago.days', { n: Math.round(hours / 24) });
}

function statusOf(lastUpdate) {
  if (!lastUpdate) return 'inactive';
  const hours = (Date.now() - lastUpdate.getTime()) / HOUR;
  if (hours < ACTIVE_HOURS) return 'active';
  if (hours <= DELAYED_HOURS) return 'delayed';
  return 'inactive';
}

function statusHTML(buoyId) {
  const latest = state.latest.get(buoyId);
  if (!latest || latest.loading) return `<div class="status"><span class="status-dot"></span>${t('status.loading')}</div>`;
  const status = statusOf(latest.lastUpdate);
  const label = t(`status.${status}`);
  return `<div class="status" title="${label}"><span class="status-dot ${status}"></span>${formatAgo(latest.lastUpdate)}</div>`;
}


// ------------------------------------------------------------------ BUOYS

const staticIds = new Set(buoysProduct.getBuoys().map(buoy => buoy.id));

// The buoys listed: the curated ones (a server may publish test moorings the
// static catalogue doesn't know) plus the virtual ones, minus the ones only
// shown through a virtual buoy, north to south.
function listedBuoys() {
  return [...state.buoysById.values()]
    .filter(buoy => !HIDDEN_BUOYS.includes(buoy.id) && (buoy.aggregated || staticIds.has(buoy.id)))
    .sort((a, b) => (b.latitude ?? 0) - (a.latitude ?? 0));
}

function setBuoys(buoys) {
  state.buoysById = new Map(buoys.map(buoy => [buoy.id, buoy]));
  state.buoys = listedBuoys();
}

function groupOf(buoy) {
  return GROUPS.find(group => group.buoys.includes(buoy.id))
    ?? GROUPS.find(group => (buoy.latitude ?? 0) >= group.minLatitude)
    ?? GROUPS[GROUPS.length - 1];
}


// ------------------------------------------------------------------- DATA

// QUICK FIX (SOMO clock) ---------------------------------------------------
// SOMO's logger writes its timestamps in local time (Europe/Madrid) but
// labels them UTC, so every SOMO reading - on ERDDAP and on GitHub alike -
// arrives one or two hours in the future (two in summer; see also the note in
// SourceGithubSOMO.parseTimestamp). Until that is fixed at the logger, the
// readings of the buoys listed here are moved back by the Madrid offset.
//
// Only applied while one of the buoy's readings is still ahead of now - the
// sign that its clock is wrong - so this switches itself off once the logger
// writes real UTC. Remove this block, CLOCK_FIX_MARGIN and the two fixClock()
// calls (loadLatest, loadDetail) when that has happened.
const CLOCK_FIX_BUOYS = ['SOMO'];
const CLOCK_FIX_TIMEZONE = 'Europe/Madrid';
// Measurements are asked for up to this far ahead of now, or the readings
// stamped in the "future" would not be fetched at all
const CLOCK_FIX_MARGIN = 3 * HOUR;

// UTC offset of CLOCK_FIX_TIMEZONE at a moment, in ms ('GMT+02:00' -> 2 h)
function clockFixOffset(date) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: CLOCK_FIX_TIMEZONE, timeZoneName: 'longOffset' })
    .formatToParts(date).find(part => part.type === 'timeZoneName')?.value ?? '';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) * MINUTE;
}

// Observations as getBuoyDetailData returns them, with the readings of a
// CLOCK_FIX_BUOYS buoy moved to their real instant. A virtual buoy's points
// say which real buoy they come from (point.buoy). Anything still in the
// future afterwards is dropped.
function fixClock(buoyId, observations) {
  const now = Date.now();
  const buoyOf = point => point.buoy ?? buoyId;

  const ahead = new Set();
  Object.entries(observations.data ?? {}).forEach(([timestamp, byCode]) => {
    if (Date.parse(timestamp) <= now) return;
    Object.values(byCode).forEach(point => {
      if (CLOCK_FIX_BUOYS.includes(buoyOf(point))) ahead.add(buoyOf(point));
    });
  });

  const data = {};
  Object.entries(observations.data ?? {}).forEach(([timestamp, byCode]) => {
    Object.entries(byCode).forEach(([code, point]) => {
      let time = Date.parse(timestamp);
      if (ahead.has(buoyOf(point))) time -= clockFixOffset(new Date(time));
      if (time > now) return;
      const fixed = new Date(time).toISOString();
      if (data[fixed] == undefined) data[fixed] = {};
      data[fixed][code] = point;
    });
  });
  return { ...observations, data };
}
// END QUICK FIX ------------------------------------------------------------


// The latest value of each of a column's codes - the newest timestamp that has
// the column's magnitude, and its companions (direction, period, ...) from
// within an hour of it: a direction can arrive a few minutes apart from its
// speed, and on a virtual buoy from a different clock altogether.
function latestValues(data, column) {
  const timestamps = Object.keys(data).sort();
  const main = [...timestamps].reverse().find(timestamp => data[timestamp][column.code] != undefined);
  if (!main) return undefined;

  const mainTime = Date.parse(main);
  const values = {};
  columnCodes(column).forEach(code => {
    for (let i = timestamps.length - 1; i >= 0; i--) {
      const time = Date.parse(timestamps[i]);
      if (time > mainTime + HOUR) continue;
      if (time < mainTime - HOUR) break;
      const value = data[timestamps[i]][code]?.value;
      if (value != undefined) { values[code] = value; break; }
    }
  });
  return { values, date: new Date(mainTime) };
}

// The forecast window, snapped to the hour: the same for every request made
// within an hour, so the forecast URLs repeat and FetchManager answers the
// list view and the buoy view from one download.
function forecastWindow() {
  const hour = Math.floor(Date.now() / HOUR) * HOUR;
  return {
    start: new Date(hour - (HOURS_BEFORE + 3) * HOUR),
    end: new Date(hour + (HOURS_AFTER + 6) * HOUR),
  };
}

// The forecast a column needs for a buoy. Asked at the real buoy the column's
// measurements come from - a virtual buoy's waves are forecast where its wave
// buoy is - and shared between the columns that read the same product at the
// same point (temperature and currents).
function getForecast(buoyId, column) {
  const product = forecastProducts.get(column.forecast);
  const point = state.buoysById.get(allBuoysProduct.componentBuoyId(buoyId, column.code));
  if (!product || point?.latitude == undefined) return Promise.resolve({ data: {}, series: [], errors: [] });

  const { start, end } = forecastWindow();
  const key = `${column.forecast}|${point.id}|${start.toISOString()}`;
  if (!forecastCache.has(key)) {
    const promise = product.getPointForecast({ id: point.id, latitude: point.latitude, longitude: point.longitude }, start, end)
      .catch(error => {
        forecastCache.delete(key); // retry on the next call
        console.error(`Forecast '${column.forecast}' for ${point.id} failed:`, error);
        return { data: {}, series: [], errors: [String(error)] };
      });
    forecastCache.set(key, promise);
  }
  return forecastCache.get(key);
}

// A column's forecast values at the hour nearest a moment (within 90 min)
function forecastAt(data, date, column) {
  let best;
  Object.keys(data).forEach(timestamp => {
    const distance = Math.abs(Date.parse(timestamp) - date.getTime());
    if (distance <= 1.5 * HOUR && data[timestamp][column.code] != undefined && (!best || distance < best.distance)) {
      best = { timestamp, distance };
    }
  });
  if (!best) return undefined;
  const values = {};
  columnCodes(column).forEach(code => {
    const value = data[best.timestamp][code]?.value;
    if (value != undefined) values[code] = value;
  });
  return {
    values, date: new Date(best.timestamp), model: data[best.timestamp][column.code].model,
    // The whole record, for the message a tap on the cell shows (forecastInfo)
    record: { ...data[best.timestamp], [RECORD_TIME]: best.timestamp },
  };
}

// Latest readings of one buoy for the list. Any column without a recent
// measurement is filled in with the forecast for the current hour, marked as
// such - a buoy that is down still says something useful about its spot.
async function loadLatest(buoy) {
  const now = new Date();
  const previous = state.latest.get(buoy.id);
  if (!previous) state.latest.set(buoy.id, { loading: true, columns: {} });

  const observations = fixClock(buoy.id, await allBuoysProduct.getBuoyDetailData(buoy.id, OBSERVATION_CODES,
    new Date(now.getTime() - LATEST_WINDOW_HOURS * HOUR), new Date(now.getTime() + CLOCK_FIX_MARGIN)).catch(error => {
    console.error(`Could not load the latest data of ${buoy.id}:`, error);
    return { data: {} };
  }));

  const entry = { loading: false, columns: {}, lastUpdate: undefined };
  COLUMNS.forEach(column => {
    const latest = latestValues(observations.data, column);
    if (!latest) return;
    entry.columns[column.id] = latest;
    if (!entry.lastUpdate || latest.date > entry.lastUpdate) entry.lastUpdate = latest.date;
  });
  // A buoy can report only variables none of the columns show
  if (!entry.lastUpdate) {
    const timestamps = Object.keys(observations.data).sort();
    if (timestamps.length) entry.lastUpdate = new Date(timestamps[timestamps.length - 1]);
  }
  state.latest.set(buoy.id, entry);
  renderList();

  const stale = COLUMNS.filter(column => {
    const latest = entry.columns[column.id];
    return !latest || now - latest.date > STALE_HOURS * HOUR;
  });
  await Promise.all(stale.map(async column => {
    const forecast = await getForecast(buoy.id, column);
    const values = forecastAt(forecast.data, now, column);
    if (values) entry.columns[column.id] = { ...values, forecast: true, result: forecast };
  }));
  if (stale.length) renderList();
}

async function refreshList() {
  state.refreshing = true;
  renderUpdateStatus();
  await Promise.all(state.buoys.map(buoy => loadLatest(buoy)));
  state.refreshing = false;
  state.listUpdatedAt = new Date();
  renderList();
  restyleBuoysMap();
  renderUpdateStatus();
}

// Average of a column over the readings that fall in one interval. Speeds,
// heights and temperatures are plain means; a direction is averaged as a
// vector weighted by its magnitude (so north-east and north-west make north,
// not south); maximum height and gusts keep the interval's maximum, and the
// period that goes with the maximum wave is the one recorded alongside it.
function aggregateColumn(records, column) {
  const valuesOf = code => records.map(record => record[code]?.value).filter(value => value != undefined);
  const mean = code => {
    const values = valuesOf(code);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
  };

  const values = {};
  const magnitude = mean(column.code);
  if (magnitude == undefined) return undefined;
  values[column.code] = magnitude;

  if (column.directionCode) {
    let x = 0, y = 0, n = 0;
    records.forEach(record => {
      const direction = record[column.directionCode]?.value;
      if (direction == undefined) return;
      const weight = record[column.code]?.value ?? 1;
      x += weight * Math.sin(direction * Math.PI / 180);
      y += weight * Math.cos(direction * Math.PI / 180);
      n++;
    });
    if (n) values[column.directionCode] = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
  }

  if (column.periodCode) {
    const period = mean(column.periodCode);
    if (period != undefined) values[column.periodCode] = period;
  }

  if (column.maxCodes) {
    let max;
    records.forEach(record => {
      const code = column.maxCodes.find(c => record[c]?.value != undefined);
      if (!code) return;
      if (!max || record[code].value > max.height) max = { height: record[code].value, period: record[column.maxPeriodCode]?.value };
    });
    if (max) {
      values[column.maxCodes[0]] = max.height;
      if (max.period != undefined) values[column.maxPeriodCode] = max.period;
    } else {
      const period = mean(column.maxPeriodCode);
      if (period != undefined) values[column.maxPeriodCode] = period;
    }
  }

  if (column.gustCode) {
    const gusts = valuesOf(column.gustCode);
    if (gusts.length) values[column.gustCode] = Math.max(...gusts);
  }

  return values;
}

// Readings grouped into consecutive intervals of `size` ms, each CENTRED on
// its row's time: the 14h row averages 13:30-14:30, a 3-hour 15h row
// 13:30-16:30. `first` is the first row's time, so a reading goes to the row
// whose time it is nearest to.
// Each record keeps its own timestamp under RECORD_TIME - a symbol, so it
// can't be mistaken for one of the codes the record is keyed by.
const RECORD_TIME = Symbol('time');

function binRecords(data, first, size, count) {
  const bins = Array.from({ length: count }, () => []);
  Object.entries(data ?? {}).forEach(([timestamp, byCode]) => {
    const index = Math.floor((Date.parse(timestamp) - first + size / 2) / size);
    if (index >= 0 && index < count) bins[index].push({ ...byCode, [RECORD_TIME]: timestamp });
  });
  return bins;
}

// What a tap on a measured cell says about it: where the value comes from
// (buoy, sensor, server) and how it was made (how many readings were averaged,
// over which minutes). From the points DPAggregatedBuoys/DPBuoys return, each
// of which carries its sensor, instrument, source and raw variable name.
function observationInfo(records, column, start, size) {
  const withValue = records.filter(record => record[column.code]?.value != undefined);
  if (!withValue.length) return '';
  const points = withValue.map(record => record[column.code]);
  const times = withValue.map(record => new Date(record[RECORD_TIME])).sort((a, b) => a - b);
  const unique = list => [...new Set(list.filter(Boolean))];

  // The interval is centred on the row's time (see binRecords)
  const from = new Date(start.getTime() - size / 2);
  const to = new Date(start.getTime() + size / 2);
  const lines = [t('info.measurementAt', { hour: formatHourShort(start), from: formatHour(from), to: formatHour(to) })];

  unique(points.map(point => point.buoy)).forEach(buoyId => {
    const buoy = state.buoysById.get(buoyId);
    lines.push(t('info.buoy', { name: buoy?.name ?? buoyId, id: buoyId }));
  });

  const sensors = unique(points.map(point => point.instrument ? `${point.instrument} (${point.sensor})` : point.sensor));
  if (sensors.length) lines.push(t('info.sensor', { sensors: sensors.join(', ') }));

  const variables = unique(points.map(point => point.rawName && point.rawName !== column.code
    ? t('info.publishedAs', { code: column.code, raw: point.rawName }) : column.code));
  lines.push(t('info.variable', { variables: `${variables.join('; ')} - ${variableName(column.code)}`.replace(/ - $/, '') }));

  const sources = unique(points.map(point => {
    const source = buoysProduct.sources.find(s => s.src === point.source);
    return source ? `${source.institution} (${hostOf(source.src)})` : hostOf(point.source);
  }));
  if (sources.length) lines.push(t('info.source', { sources: sources.join(', ') }));

  const zone = gui.timelineUseLocalTime ? '' : ' UTC';
  lines.push(withValue.length === 1
    ? t('info.oneReading', { time: formatHour(times[0]) + zone })
    : t('info.readings', { n: withValue.length, from: formatHour(times[0]), to: formatHour(times[times.length - 1]) + zone }));

  return lines.join('\n');
}

// What a tap on a forecast cell says about it - the model and who runs it,
// how old the run is, where it is served from and read at, and how the value
// was made. `records` are the forecast's hourly records that went into the
// cell (see binRecords); `start`/`size` the buoy view row they were averaged
// over, absent for the list's single value. `result` is what
// DPForecast.getPointForecast answered, whose `series` describe each model.
function forecastInfo({ records, column, result, buoyId, start, size }) {
  const withValue = records.filter(record => record[column.code]?.value != undefined);
  if (!withValue.length) return '';
  const points = withValue.map(record => record[column.code]);
  const times = withValue.map(record => new Date(record[RECORD_TIME])).sort((a, b) => a - b);
  const unique = list => [...new Set(list.filter(Boolean))];
  const zone = gui.timelineUseLocalTime ? '' : ' UTC';

  const lines = [];
  if (start) {
    const from = new Date(start.getTime() - size / 2);
    const to = new Date(start.getTime() + size / 2);
    lines.push(t('info.forecastAt', { hour: formatHourShort(start), from: formatHour(from), to: formatHour(to) }));
  } else {
    lines.push(t('info.forecastFor', { time: formatHour(times[0]) + zone, hours: STALE_HOURS }));
  }

  // A virtual buoy's forecast is read where the real buoy behind that column is
  const pointId = allBuoysProduct.componentBuoyId(buoyId, column.code);
  if (pointId !== buoyId) lines.push(t('info.at', { name: state.buoysById.get(pointId)?.name ?? pointId, id: pointId }));

  unique(points.map(point => point.model)).forEach(modelId => {
    const series = result?.series?.find(s => s.model === modelId);
    if (!series) { lines.push(t('info.model', { model: modelId })); return; }

    lines.push(t('info.model', { model: `${modelName(series.model, series.label)}${series.resolution ? `, ${series.resolution}` : ''}` }));
    const by = [series.institution, series.forcing
      ? t('info.windsBy', { model: series.forcing.model, institution: series.forcing.institution }) : undefined];
    lines.push(t('info.by', { who: by.filter(Boolean).join(', ') }));

    // Runs are named in UTC ('the 00Z run') whatever the display time zone
    const run = series.run;
    if (run?.referenceTime) {
      const date = run.referenceTime.toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });
      lines.push(run.publishedAt
        ? t('info.runPublished', { date, ago: formatAgo(run.referenceTime), published: formatAgo(run.publishedAt) })
        : t('info.run', { date, ago: formatAgo(run.referenceTime) }));
    } else if (run?.note) {
      lines.push(t('info.runNote', { note: run.note }));
    }
    const cadence = [
      run?.updateIntervalHours ? t('info.newRunEvery', { n: run.updateIntervalHours }) : undefined,
      run?.timeStepHours > 1 ? t('info.timeStep', { n: run.timeStepHours }) : undefined,
    ].filter(Boolean).join(', ');
    if (cadence) lines.push(capitalize(cadence));

    lines.push(series.api
      ? t('info.sourceApi', { api: series.api, provider: series.provider, host: hostOf(series.source) })
      : t('info.sourceErddap', { provider: series.provider, host: hostOf(series.source), dataset: series.dataset }));
    if (series.cell) {
      const { latitude, longitude, distanceKm } = series.cell;
      lines.push(t('info.gridPoint', { lat: latitude.toFixed(3), lon: longitude.toFixed(3), km: distanceKm.toFixed(1) }));
    }
  });

  const variables = unique(points.map(point => {
    if (point.rawName && point.rawName !== column.code) return t('info.publishedAs', { code: column.code, raw: point.rawName });
    if (point.derivedFrom?.length) return t('info.computedFrom', { code: column.code, raw: point.derivedFrom.join(t('join.and')) });
    return column.code;
  }));
  lines.push(t('info.variable', { variables: `${variables.join('; ')} - ${variableName(column.code)}`.replace(/ - $/, '') }));

  lines.push(withValue.length === 1
    ? t('info.oneForecast', { time: formatHour(times[0]) + zone })
    : t('info.forecastValues', { n: withValue.length, from: formatHour(times[0]), to: formatHour(times[times.length - 1]) + zone }));

  return lines.join('\n');
}

// A variable's long name, translated where lang.js has it (variable.<code>),
// else as data/variables.js spells it
function variableName(code) {
  const key = `variable.${code}`;
  const text = t(key);
  return text === key ? (gui.variable(code)?.longName ?? '') : text;
}

// A forecast model's name, translated where lang.js has it (model.<id>), else
// the catalogue's label
function modelName(id, fallback) {
  const key = `model.${id}`;
  const text = t(key);
  return text === key ? (fallback ?? id) : text;
}

// Start of the interval a moment falls in, on the displayed clock (local or
// UTC), so 3-hour rows start at 00, 03, 06... wherever the user is reading them.
function intervalStart(date, hours) {
  const start = new Date(date);
  if (gui.timelineUseLocalTime) {
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() - start.getHours() % hours);
  } else {
    start.setUTCMinutes(0, 0, 0);
    start.setUTCHours(start.getUTCHours() - start.getUTCHours() % hours);
  }
  return start;
}


// -------------------------------------------------------------- RENDERING

// One data cell. `detailed` adds the second line the buoy view has room for
// (maximum wave, gusts); `list` is the main view's narrower layout, with the
// wave period and the gusts on a second line instead.
//
// A forecast cell carries the model it comes from (`model`, its id), for the
// message a tap on it shows (see showToast).
//
// `info` is what a tap on the cell says about it (observationInfo,
// forecastInfo), carried on the cell itself.
function cellHTML(column, values, { forecast = false, model, info, detailed = false, list = false } = {}) {
  const magnitude = values?.[column.code];
  if (magnitude == undefined) return '<div class="cell empty">–</div>';

  const background = gui.colorFor(column.code, magnitude);
  const value = formatValue(column.code, magnitude);

  let main = '';
  const direction = column.directionCode ? values[column.directionCode] : undefined;
  if (direction != undefined) main += arrowHTML(direction, column.fromDirection);
  main += `<span class="value">${value.text}</span><span class="unit">${escapeHTML(value.unit)}</span>`;
  let sub = '';
  if (column.periodCode && values[column.periodCode] != undefined) {
    const period = formatValue(column.periodCode, values[column.periodCode]);
    if (list) sub = `${period.text} ${escapeHTML(period.unit)}`;
    else main += `<span class="secondary">&nbsp;${period.text}${escapeHTML(period.unit)}</span>`;
  }

  if (detailed && column.maxCodes) {
    const height = column.maxCodes.map(code => values[code]).find(v => v != undefined);
    if (height != undefined) {
      const h = formatValue(column.maxCodes[0], height);
      const period = values[column.maxPeriodCode];
      const p = period != undefined ? formatValue(column.maxPeriodCode, period) : undefined;
      sub = escapeHTML(t('cell.maxValue', { value: `${h.text}${h.unit}${p ? `, ${p.text}${p.unit}` : ''}` }));
    }
  }
  if ((detailed || list) && column.gustCode && values[column.gustCode] != undefined) {
    const gust = formatValue(column.gustCode, values[column.gustCode]);
    sub = escapeHTML(t('cell.gustValue', { value: `${gust.text} ${gust.unit}` }));
  }

  let title = forecast ? ` title="${escapeHTML(t('cell.forecastTitle'))}" data-model="${escapeHTML(model ?? '')}"` : '';
  if (info && !forecast) title = ` title="${escapeHTML(t('cell.measurementTitle'))}"`;
  if (info) title += ` data-info="${escapeHTML(info)}"`;
  const style = background ? ` style="background-color: ${background}"` : '';
  return `<div class="cell${forecast ? ' forecast' : ''}${info ? ' has-info' : ''}"${style}${title}>`
    + `<div class="cell-main">${main}</div>${sub ? `<div class="cell-sub">${sub}</div>` : ''}</div>`;
}

const loadingCellHTML = () => '<div class="cell"><div class="spinner-small"></div></div>';

// Column titles. Tapping one offers its units (km/h, kn, ...) to choose
// from, same as the menu - see openUnitPopup.
function headerRowHTML(firstCell) {
  return `<div class="row header-row">${firstCell}${COLUMNS.map(column => {
    const switchable = gui.isUnitSwitchable(column.code);
    return `<button class="header-cell${switchable ? ' clickable' : ''}" data-unit-code="${switchable ? column.code : ''}"`
      + ` title="${switchable ? escapeHTML(t('header.changeUnit')) : ''}">`
      + `<i class="${column.icon}"></i><span>${escapeHTML(t(`column.${column.id}`))}</span><span class="unit">${escapeHTML(gui.unitFor(column.code).unit)}</span></button>`;
  }).join('')}</div>`;
}

function renderList() {
  if (state.route.view !== 'list') return;

  let html = headerRowHTML(`<div class="header-cell"><i class="fa-solid fa-life-ring"></i><span>${escapeHTML(t('header.buoy'))}</span><span class="unit">&nbsp;</span></div>`);
  GROUPS.forEach(group => {
    const buoys = state.buoys.filter(buoy => groupOf(buoy) === group);
    if (!buoys.length) return;
    html += `<div class="group"><div class="group-label group-${group.id}">${escapeHTML(group.name)}</div>`
      + `<div class="group-rows">${buoys.map(buoyRowHTML).join('')}</div></div>`;
  });
  el('list-table').innerHTML = html;

}

function buoyRowHTML(buoy) {
  const latest = state.latest.get(buoy.id);
  const cells = COLUMNS.map(column => {
    if (!latest || latest.loading) return loadingCellHTML();
    const entry = latest.columns[column.id];
    const info = entry?.forecast && entry.record
      ? forecastInfo({ records: [entry.record], column, result: entry.result, buoyId: buoy.id }) : undefined;
    return cellHTML(column, entry?.values, { forecast: entry?.forecast, model: entry?.model, info, list: true });
  }).join('');

  return `<div class="row buoy-row" data-buoy="${escapeHTML(buoy.id)}" role="button" tabindex="0">`
    // Long codes (NORD_CAP_DE_CREUS) may break after an underscore
    + `<div class="buoy-cell"><span class="buoy-code">${escapeHTML(buoy.id).replaceAll('_', '_<wbr>')}</span>`
    + `<span class="buoy-name">${escapeHTML(buoy.name ?? '')}</span>${statusHTML(buoy.id)}</div>${cells}</div>`;
}

function renderBuoyHeader(buoy) {
  el('buoy-name').textContent = buoy?.name ?? state.detail?.buoyId ?? '';
  el('buoy-id').textContent = buoy ? `(${buoy.id})` : '';
  el('interval-toggle').textContent = `${settings.intervalHours}h`;
}

// The last hour any forecast reaches for the open buoy - the latest endDate
// among the series that came back. Undefined until every column's forecast
// has answered, so the table doesn't shrink and grow again while loading.
function forecastEndDate(detail) {
  if (COLUMNS.some(column => detail.forecasts[column.id] == undefined)) return undefined;
  const endDates = COLUMNS.flatMap(column => detail.forecasts[column.id].series.map(series => series.endDate)).filter(Boolean);
  return endDates.length ? new Date(Math.max(...endDates)) : undefined;
}

// The buoy view's rows: 24 h back to 72 h ahead, one per interval, each cell
// the measurement where there is one and the forecast otherwise. A row with
// any measurement is a measurement row; the rest are predictions (and say so
// in their first cell).
function renderBuoyTable() {
  const detail = state.detail;
  if (!detail || state.route.view !== 'buoy') return;

  const hours = settings.intervalHours;
  const size = hours * HOUR;
  const now = new Date();
  const first = intervalStart(new Date(now.getTime() - HOURS_BEFORE * HOUR), hours).getTime();
  // Up to HOURS_AFTER ahead, or wherever the forecasts end if that is sooner
  // (each run reaches a different time - see forecastEndDate). Never short of
  // the row "now" is in.
  const end = Math.min(now.getTime() + HOURS_AFTER * HOUR, forecastEndDate(detail)?.getTime() ?? Infinity);
  const count = Math.max(Math.floor((end - first) / size) + 1, Math.floor((now - first + size / 2) / size) + 1);

  const observed = binRecords(detail.observations?.data, first, size, count);
  const forecastBins = Object.fromEntries(COLUMNS.map(column =>
    [column.id, binRecords(detail.forecasts[column.id]?.data, first, size, count)]));

  // Tapping the time column's title offers local time or UTC (see openTimezonePopup)
  let html = headerRowHTML(`<button class="header-cell clickable" data-toggle-timezone title="${escapeHTML(t('header.timeTitle'))}">`
    + `<i class="fa-regular fa-clock"></i><span>${escapeHTML(t('header.time'))}</span><span class="unit">${escapeHTML(gui.timelineTimezoneLabel)}</span></button>`);
  let previousDay;
  for (let i = 0; i < count; i++) {
    const start = new Date(first + i * size);
    const day = dayKey(start);
    if (day !== previousDay) {
      html += `<div class="day-row">${formatDay(start)}</div>`;
      previousDay = day;
    }

    let measured = false;
    const cells = COLUMNS.map(column => {
      const observation = aggregateColumn(observed[i], column);
      if (observation) {
        measured = true;
        const info = observationInfo(observed[i], column, start, size);
        return cellHTML(column, observation, { detailed: true, info });
      }
      const forecast = aggregateColumn(forecastBins[column.id][i], column);
      // The model of the interval's first hour - an interval only spans two
      // models at the hour one takes over from the other
      const model = forecastBins[column.id][i].find(record => record[column.code])?.[column.code].model;
      if (forecast) {
        const info = forecastInfo({ records: forecastBins[column.id][i], column, start, size,
          result: detail.forecasts[column.id], buoyId: detail.buoyId });
        return cellHTML(column, forecast, { detailed: true, forecast: true, model, info });
      }
      // Still waiting for one of them
      if (detail.observations == undefined || detail.forecasts[column.id] == undefined) return loadingCellHTML();
      return cellHTML(column, undefined);
    }).join('');

    let nowLine = '';
    // A row covers half an interval either side of its time (see binRecords)
    const rowStart = start.getTime() - size / 2;
    if (now >= rowStart && now < rowStart + size) {
      const top = ((now - rowStart) / size * 100).toFixed(1);
      nowLine = `<div class="now-line" id="now-line" style="top: ${top}%"><span>${formatHour(now)}</span></div>`;
    }

    html += `<div class="row data-row ${measured ? 'measurement' : 'prediction'}">`
      + `<div class="time-cell">${formatHourShort(start)}</div>${cells}${nowLine}</div>`;
  }

  html += `<div class="legend"><span><span class="forecast-sample"></span>${escapeHTML(t('legend.forecast'))}</span>`
    + `<span><i class="fa-solid fa-circle-info"></i> ${escapeHTML(t('legend.sources'))}</span></div>`;

  el('buoy-table').innerHTML = html;

  if (detail.followNow) scrollToNow();
}

// Centres the "now" line on screen - until the user scrolls on their own.
function scrollToNow() {
  const line = el('now-line');
  if (!line) return;
  const top = line.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2;
  window.scrollTo({ top: Math.max(0, top) });
}


// -------------------------------------------------------------- INFO VIEW

// Who produced what is shown for a buoy: its operators, the servers its
// measurements came from, and the forecast providers - from the data products
// and their sources rather than a hardcoded list. { name: Set(roles) }
function institutionsFor(buoy) {
  const byName = new Map();
  const add = (name, role) => {
    if (!name) return;
    name.split(' / ').forEach(single => {
      if (!byName.has(single)) byName.set(single, new Set());
      byName.get(single).add(role);
    });
  };

  const buoys = buoy.aggregated ? buoy.components.map(c => c.buoy).filter(Boolean) : [buoy];
  buoys.forEach(b => add(b.institution, t('role.buoy', { name: b.name })));

  Object.values(state.detail?.observations?.used ?? {}).forEach(used => {
    const source = buoysProduct.sources.find(s => s.src === used.source);
    if (source) add(source.institution, t('role.measurements', { host: hostOf(source.src) }));
  });

  // Same as DPForecast.institutions(), in the app's language
  forecastProducts.forEach((product, name) => {
    const productLabel = t(PRODUCT_KEYS[name] ?? name);
    product.sources.forEach(source => {
      (source.models ?? []).forEach(model => add(model.institution, t('role.model', { model: modelName(model.id, model.label), product: productLabel })));
      if (source.api) add(source.api, t('role.api', { product: productLabel }));
      else add(source.institution, t('role.model', { model: modelName(source.model, source.label ?? source.dataset), product: productLabel }));
      if (source.forcing) add(source.forcing.institution, t('role.forcing', { model: source.forcing.model, product: productLabel }));
    });
  });

  return byName;
}

const hostOf = url => { try { return new URL(url).host; } catch (error) { return url; } };

function infoRow(label, value) {
  if (value == undefined || value === '') return '';
  return `<span class="label">${escapeHTML(label)}</span><span class="value">${value}</span>`;
}

function renderInfo() {
  const detail = state.detail;
  if (!detail || state.route.view !== 'info') return;
  const buoy = state.buoysById.get(detail.buoyId);
  if (!buoy) return;

  el('info-name').textContent = buoy.name ?? buoy.id;
  el('info-id').textContent = `(${buoy.id})`;
  el('info-status').innerHTML = statusHTML(buoy.id);

  const parts = buoy.aggregated ? buoy.components.map(c => c.buoy).filter(Boolean) : [buoy];
  let html = '<div class="info-map" id="info-map"><span class="attribution">Imagery © Esri</span></div>';

  html += `<div class="info-photos">${parts.map(part => `<figure><img src="${PHOTOS_PATH}${encodeURIComponent(part.id)}.jpg"`
    + ` alt="${escapeHTML(part.name)}" onerror="this.parentElement.hidden = true">`
    + `<figcaption>${escapeHTML(part.name)} (${escapeHTML(part.id)})</figcaption></figure>`).join('')}</div>`;

  if (buoy.aggregated) {
    // The catalogue's texts are English - lang.js has them per virtual buoy
    const translated = (key, fallback) => (t(key) === key ? fallback : t(key));
    html += `<div class="info-card"><h3>${escapeHTML(t('info.combined'))}</h3>`
      + `<p>${escapeHTML(translated(`aggregation.${buoy.id}.description`, buoy.description))}</p><ul>`
      + buoy.components.map(c => `<li><b>${escapeHTML(translated(`aggregation.${buoy.id}.${c.buoyId}`, c.label))}</b>: `
        + `${escapeHTML(c.buoy?.name ?? c.buoyId)} (${escapeHTML(c.buoyId)})</li>`).join('')
      + '</ul></div>';
  }

  parts.forEach(part => { html += metadataCardHTML(part, buoy.aggregated); });
  html += sourcesCardHTML(buoy);
  html += forecastsCardHTML();

  const institutions = institutionsFor(buoy);
  html += `<div class="info-card"><h3>${escapeHTML(t('info.institutions'))}</h3><ul>${[...institutions].map(([name, roles]) =>
    `<li><b>${escapeHTML(name)}</b>: ${escapeHTML([...roles].join(', '))}</li>`).join('')}</ul></div>`;

  el('info-content').innerHTML = html;
  renderMap(el('info-map'), parts);
}

// What VISOC's data timeline info section shows about a platform
function metadataCardHTML(buoy, isPart) {
  const position = buoy.latitude != undefined
    ? `${buoy.latitude.toFixed(4)}° N, ${buoy.longitude.toFixed(4)}° E` : undefined;
  const distance = buoy.distanceToCoast != undefined ? formatValue('DISTCOAST', buoy.distanceToCoast) : undefined;
  const instruments = [...new Set((buoy.sensors ?? []).map(sensor => sensor.instrument ?? sensor.id).filter(Boolean))];
  const latest = state.latest.get(buoy.id);

  return `<div class="info-card"><h3>${isPart ? `${escapeHTML(buoy.name)} (${escapeHTML(buoy.id)})` : escapeHTML(t('info.buoyCard'))}</h3><div class="info-rows">`
    + infoRow(t('info.institution'), escapeHTML(buoy.institution))
    + infoRow(t('info.position'), position)
    + infoRow(t('info.depth'), buoy.depth != undefined ? `${buoy.depth} m` : undefined)
    + infoRow(t('info.distance'), distance ? `${distance.text} ${escapeHTML(distance.unit)}` : undefined)
    + infoRow(t('info.installed'), buoy.installed ? new Date(buoy.installed).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) : undefined)
    + infoRow(t('info.lastMeasurement'), latest?.lastUpdate ? `${formatDateTime(latest.lastUpdate)} (${formatAgo(latest.lastUpdate)})` : undefined)
    + infoRow(t('info.sensors'), instruments.length ? escapeHTML(instruments.join(', ')) : undefined)
    + infoRow(t('info.license'), escapeHTML(buoy.license))
    + infoRow(t('info.acknowledgement'), escapeHTML(buoy.acknowledgement))
    + '</div></div>';
}

// Which buoy, sensor and server each column's measurements came from
function sourcesCardHTML(buoy) {
  const used = state.detail?.observations?.used;
  const title = escapeHTML(t('info.measurements'));
  if (!used) return `<div class="info-card"><h3>${title}</h3><p class="info-note">${escapeHTML(t('info.loading'))}</p></div>`;

  const items = COLUMNS.map(column => {
    const label = escapeHTML(t(`column.${column.id}`));
    const entry = used[column.code];
    if (!entry) return `<li><b>${label}</b>: ${escapeHTML(t('info.noMeasurements', { hours: HOURS_BEFORE }))}</li>`;
    const from = state.buoysById.get(entry.buoy ?? buoy.id);
    const source = buoysProduct.sources.find(s => s.src === entry.source);
    return `<li><b>${label}</b>: ${escapeHTML(from?.name ?? entry.buoy ?? buoy.id)}`
      + `${entry.sensor ? `, ${escapeHTML(t('info.sensorShort', { sensor: entry.sensor }))}` : ''}`
      + ` · ${escapeHTML(source?.institution ?? '')} (${escapeHTML(hostOf(entry.source))})</li>`;
  }).join('');
  return `<div class="info-card"><h3>${title}</h3><ul>${items}</ul></div>`;
}

// Which model is shown when, per forecast product, in order of preference
function forecastsCardHTML() {
  const products = [...new Set(COLUMNS.map(column => column.forecast))];
  const items = products.map(name => {
    const columns = COLUMNS.filter(column => column.forecast === name);
    const result = state.detail.forecasts[columns[0].id];
    const label = escapeHTML(columns.map(column => t(`column.${column.id}`)).join(t('join.and')));
    if (!result) return `<li><b>${label}</b>: ${escapeHTML(t('info.loadingShort'))}</li>`;
    // In the order they are shown, not in order of preference - a fallback
    // can cover the hours before the preferred model starts
    const series = result.series.filter(s => s.usedFrom).sort((a, b) => a.usedFrom - b.usedFrom);
    if (!series.length) return `<li><b>${label}</b>: ${escapeHTML(t('info.noForecast'))}</li>`;
    return `<li><b>${label}</b>: ${series.map(s => {
      const what = `${escapeHTML(modelName(s.model, s.label))}${s.resolution ? ` (${escapeHTML(s.resolution)})` : ''}`;
      const when = ` ${escapeHTML(t('info.fromTo', { from: formatDateTime(s.usedFrom), to: formatDateTime(s.usedTo) }))}`;
      const cell = s.cell?.distanceKm > 1 ? `, ${escapeHTML(t('info.nearestSea', { km: s.cell.distanceKm.toFixed(1) }))}` : '';
      return `${what}${when}${cell}`;
    }).join('; ')}</li>`;
  }).join('');

  return `<div class="info-card"><h3>${escapeHTML(t('info.forecasts'))}</h3>`
    + `<p>${escapeHTML(t('info.forecastsText'))}</p>`
    + `<ul>${items}</ul></div>`;
}

// OpenLayers is only needed by the info view, so it is only loaded once that
// is first opened.
let openLayersPromise;
function loadOpenLayers() {
  if (!openLayersPromise) {
    openLayersPromise = new Promise((resolve, reject) => {
      const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '../lib/openlayers/ol.css' });
      const script = Object.assign(document.createElement('script'), { src: '../lib/openlayers/ol.js' });
      script.onload = () => resolve(window.ol);
      script.onerror = () => { openLayersPromise = undefined; reject(new Error('Could not load OpenLayers')); };
      document.head.append(link, script);
    });
  }
  return openLayersPromise;
}

// A still map of where the buoy (or each buoy of a combined one) is. No
// interactions and no controls: a picture to place it, not a map to explore.
async function renderMap(container, buoys) {
  const points = buoys.filter(buoy => buoy.latitude != undefined && buoy.longitude != undefined);
  if (!container || !points.length) return;

  const ol = await loadOpenLayers().catch(error => { console.error(error); });
  if (!ol || !container.isConnected) return;

  const features = points.map(buoy => new ol.Feature({
    geometry: new ol.geom.Point(ol.proj.fromLonLat([buoy.longitude, buoy.latitude])),
    name: buoy.id,
  }));
  const source = new ol.source.Vector({ features });
  const style = feature => new ol.style.Style({
    image: new ol.style.Circle({
      radius: 7,
      fill: new ol.style.Fill({ color: 'rgb(255, 115, 105)' }),
      stroke: new ol.style.Stroke({ color: 'white', width: 2 }),
    }),
    text: new ol.style.Text({
      text: feature.get('name'),
      offsetY: -16,
      font: '600 12px Poppins, sans-serif',
      fill: new ol.style.Fill({ color: 'white' }),
      stroke: new ol.style.Stroke({ color: 'rgba(0, 0, 0, 0.7)', width: 3 }),
    }),
  });

  const map = new ol.Map({
    target: container,
    controls: [],
    interactions: [],
    layers: [
      new ol.layer.Tile({ source: new ol.source.XYZ({ url: BASEMAP_URL, maxZoom: 17 }) }),
      new ol.layer.Vector({ source, style }),
    ],
    view: new ol.View({ center: ol.proj.fromLonLat([points[0].longitude, points[0].latitude]), zoom: 10 }),
  });
  // Wide enough around the buoy(s) to show the coastline: a margin of at
  // least the buoy's own distance to the coast (plus some room, so the coast
  // isn't right at the edge), never zoomed in further than MAP_MIN_MARGIN -
  // which is what suits the buoys a few km off the beach. Offshore ones (BEGU,
  // 34 km out; MTARR, 51 km) zoom out until their coast is in the picture.
  // Web Mercator stretches distances by 1/cos(latitude), so km on the ground
  // are scaled into map units.
  const farthestKm = Math.max(0, ...points.map(buoy => buoy.distanceToCoast ?? 0));
  const groundToMap = 1 / Math.cos(points[0].latitude * Math.PI / 180);
  const margin = Math.max(MAP_MIN_MARGIN, (farthestKm * 1.2 + 4) * 1000 * groundToMap);
  map.getView().fit(ol.extent.buffer(source.getExtent(), margin), { maxZoom: 12 });
}


// The map of every listed buoy, created the first time it is opened and kept
// afterwards (re-sized and re-styled on every visit). Tapping a buoy opens its
// data view, like a row of the list does.
let buoysMap;

const STATUS_COLORS = { active: '#4caf50', delayed: '#ffc107', inactive: '#757575' };

function buoyMarkerStyle(ol, feature) {
  const latest = state.latest.get(feature.get('buoyId'));
  const color = latest && !latest.loading ? STATUS_COLORS[statusOf(latest.lastUpdate)] : 'white';
  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: 8,
      fill: new ol.style.Fill({ color }),
      stroke: new ol.style.Stroke({ color: 'white', width: 2 }),
    }),
  });
}

// Labels live on a layer of their own, decluttered: buoys a few km apart (the
// Cap de Creus ones, TARR and PTARR) would otherwise print over each other.
// A label that doesn't fit is hidden until the map is zoomed in, while every
// marker stays.
function buoyLabelStyle(ol, feature) {
  return new ol.style.Style({
    text: new ol.style.Text({
      text: feature.get('buoyId'),
      offsetY: -18,
      font: '600 12px Poppins, sans-serif',
      fill: new ol.style.Fill({ color: 'white' }),
      stroke: new ol.style.Stroke({ color: 'rgba(0, 0, 0, 0.75)', width: 3 }),
    }),
  });
}

async function renderBuoysMap() {
  const ol = await loadOpenLayers().catch(error => { console.error(error); });
  if (!ol || state.route.view !== 'map') return;

  const features = state.buoys
    .filter(buoy => buoy.latitude != undefined && buoy.longitude != undefined)
    .map(buoy => new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([buoy.longitude, buoy.latitude])),
      buoyId: buoy.id,
    }));

  if (!buoysMap) {
    const source = new ol.source.Vector();
    const layer = new ol.layer.Vector({ source, style: feature => buoyMarkerStyle(ol, feature) });
    const labels = new ol.layer.Vector({ source, style: feature => buoyLabelStyle(ol, feature), declutter: true });
    const map = new ol.Map({
      target: el('buoys-map'),
      layers: [new ol.layer.Tile({ source: new ol.source.XYZ({ url: BASEMAP_URL, maxZoom: 17 }) }), layer, labels],
      view: new ol.View({ center: ol.proj.fromLonLat([2.2, 41.5]), zoom: 8 }),
    });

    map.on('click', event => {
      const feature = map.forEachFeatureAtPixel(event.pixel, f => f, { hitTolerance: 10, layerFilter: l => l === layer });
      if (!feature) return;
      const buoyId = feature.get('buoyId');
      wa('buoy_click', { buoy: buoyId, name: state.buoysById.get(buoyId)?.name, from: 'map', lang: language });
      navigate(`#/buoy/${encodeURIComponent(buoyId)}`);
    });
    map.on('pointermove', event => {
      const hit = map.hasFeatureAtPixel(event.pixel, { hitTolerance: 10, layerFilter: l => l === layer });
      map.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });

    buoysMap = { map, source, layer, fitted: false };
  }

  buoysMap.source.clear();
  buoysMap.source.addFeatures(features);
  // The view was hidden until now, so the map has to measure itself again
  buoysMap.map.updateSize();
  if (!buoysMap.fitted && features.length) {
    buoysMap.map.getView().fit(buoysMap.source.getExtent(), { padding: [40, 40, 40, 40], maxZoom: 11 });
    buoysMap.fitted = true;
  }
}

// Status colours follow the list as new readings land
function restyleBuoysMap() {
  buoysMap?.layer.changed();
}


// ---------------------------------------------------------------- ROUTING

// #/                 list
// #/map              map of every buoy
// #/buoy/<id>        buoy view
// #/buoy/<id>/info   info view
function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'map') return { view: 'map' };
  if (parts[0] === 'buoy' && parts[1]) {
    return { view: parts[2] === 'info' ? 'info' : 'buoy', buoyId: decodeURIComponent(parts[1]) };
  }
  return { view: 'list' };
}

// Hashes the app navigated FROM, so its own back buttons can step back in the
// browser's history (and the phone's back gesture keeps working) instead of
// piling new entries on top.
const navigationStack = [];

function navigate(hash) {
  navigationStack.push(location.hash || '#/');
  location.hash = hash;
}

// Back to wherever the app came from (list -> map -> buoy steps back to the
// map, then to the list), or to `fallback` when the view was opened directly
// from a link and there is nothing in the app to go back to.
function goBack(fallback) {
  if (navigationStack.length) history.back();
  else location.replace(fallback);
}

function route() {
  const next = parseRoute();
  state.route = next;
  if (navigationStack[navigationStack.length - 1] === (location.hash || '#/')) navigationStack.pop();

  el('view-list').hidden = next.view !== 'list';
  el('view-buoy').hidden = next.view !== 'buoy';
  el('view-info').hidden = next.view !== 'info';
  el('view-map').hidden = next.view !== 'map';

  if (next.view === 'list') {
    state.detail = undefined;
    renderList();
    window.scrollTo({ top: 0 });
    return;
  }

  if (next.view === 'map') {
    state.detail = undefined;
    window.scrollTo({ top: 0 });
    renderBuoysMap();
    return;
  }

  if (!state.detail || state.detail.buoyId !== next.buoyId) openBuoy(next.buoyId);

  if (next.view === 'buoy') {
    renderBuoyHeader(state.buoysById.get(next.buoyId));
    // Coming back from the info view: start again from now
    state.detail.followNow = true;
    renderBuoyTable();
  } else {
    window.scrollTo({ top: 0 });
    renderInfo();
  }
}

// Starts loading everything the buoy and info views need for one buoy
function openBuoy(buoyId) {
  const detail = { buoyId, observations: undefined, forecasts: {}, followNow: true };
  state.detail = detail;
  loadDetail(detail);
}

async function loadDetail(detail) {
  const now = new Date();
  const start = new Date(now.getTime() - (HOURS_BEFORE + 3) * HOUR);
  const isCurrent = () => state.detail === detail;

  COLUMNS.forEach(column => {
    getForecast(detail.buoyId, column).then(result => {
      if (!isCurrent()) return;
      detail.forecasts[column.id] = result;
      renderDetail();
    });
  });

  const end = new Date(now.getTime() + CLOCK_FIX_MARGIN);
  const observations = await allBuoysProduct.getBuoyDetailData(detail.buoyId, OBSERVATION_CODES, start, end)
    .catch(error => {
      console.error(`Could not load the data of ${detail.buoyId}:`, error);
      return { data: {}, used: {}, missing: OBSERVATION_CODES, errors: [String(error)] };
    });
  if (!isCurrent()) return;
  detail.observations = fixClock(detail.buoyId, observations);
  renderDetail();
}

function renderDetail() {
  if (state.route.view === 'buoy') renderBuoyTable();
  else if (state.route.view === 'info') renderInfo();
}


// ------------------------------------------------------------------- MENU

function renderMenu() {
  el('unit-pickers').innerHTML = UNIT_PICKERS.map(picker => {
    const options = UNIT_GROUPS[picker.group] ?? [];
    const selected = settings.units[picker.group] ?? options[0]?.unit;
    return `<div class="picker"><span class="picker-label"><i class="${picker.icon}"></i>${escapeHTML(t(`unit.${picker.group}`))}</span>`
      + `<div class="segmented">${options.map(option => `<button data-unit-group="${picker.group}" data-unit="${escapeHTML(option.unit)}"`
      + ` class="${option.unit === selected ? 'selected' : ''}">${escapeHTML(option.unit)}</button>`).join('')}</div></div>`;
  }).join('');

  el('timezone-picker').querySelectorAll('button').forEach(button => {
    button.classList.toggle('selected', (button.dataset.value === 'local') === gui.timelineUseLocalTime);
  });

  // The row names the current language in itself ('Català'), under the
  // section's own title ('Idioma')
  el('language-name').textContent = LANGUAGES[language].name;
  el('language-picker').innerHTML = Object.entries(LANGUAGES).map(([code, { name }]) =>
    `<button data-language="${code}" title="${escapeHTML(name)}" class="${code === language ? 'selected' : ''}">${code.toUpperCase()}</button>`).join('');
}

// Every static text of index.html in the current language (see lang.js for
// the data-i18n attributes), then everything drawn by this file again
function applyLanguage() {
  document.documentElement.lang = language;
  document.title = t('app.title');
  const params = { hours: STALE_HOURS };
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n, params); });
  document.querySelectorAll('[data-i18n-title]').forEach(node => { node.title = t(node.dataset.i18nTitle, params); });
  document.querySelectorAll('[data-i18n-aria]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.i18nAria, params)); });
  // Texts that hold links: their {placeholders} are filled with markup
  // rather than text (the address is assembled by setupEmails)
  const links = {
    email: '<a class="email" data-user="gerard.llorach" data-host="csic.es"></a>',
    link: '<a href="https://github.com/ICATMAR/VISOC/tree/main/AppBuoys" target="_blank" rel="noopener">github.com/ICATMAR/VISOC</a>',
  };
  document.querySelectorAll('[data-i18n-html]').forEach(node => {
    node.innerHTML = escapeHTML(t(node.dataset.i18nHtml, params)).replace(/\{(\w+)\}/g, (match, name) => links[name] ?? match);
  });
  setupEmails();
}

function setLanguage(code) {
  if (!LANGUAGES[code] || code === language) return;
  language = code;
  settings.language = code;
  wa('language_change', { lang: code });
  applyLanguage();
  settingsChanged();
  renderUpdateStatus();
  if (state.route.view === 'buoy') renderBuoyHeader(state.buoysById.get(state.detail?.buoyId));
}

function setMenuOpen(open) {
  el('menu').hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) renderMenu();
}

// Anything that changes how values are drawn - units, time zone, interval
function settingsChanged() {
  saveSettings();
  renderMenu();
  renderList();
  if (state.detail) {
    renderBuoyHeader(state.buoysById.get(state.detail.buoyId));
    renderDetail();
  }
}

// The address is put together here rather than written in the page, so a
// scraper reading the source finds neither a mailto: nor the address itself.
function setupEmails() {
  document.querySelectorAll('a.email').forEach(link => {
    const address = `${link.dataset.user}@${link.dataset.host}`;
    link.href = `mailto:${address}`;
    link.textContent = address;
  });
}


// ----------------------------------------------------------------- EVENTS

function setupEvents() {
  window.addEventListener('hashchange', route);

  el('list-table').addEventListener('click', event => {
    if (unitHeaderFrom(event)) return;
    // A forecast value explains itself instead of opening the buoy
    if (infoCellFrom(event) || forecastCellFrom(event)) return;
    const row = event.target.closest('[data-buoy]');
    if (!row) return;
    const buoyId = row.dataset.buoy;
    // Which buoys get opened, and how often, is what the analytics are for
    wa('buoy_click', { buoy: buoyId, name: state.buoysById.get(buoyId)?.name, lang: language });
    navigate(`#/buoy/${encodeURIComponent(buoyId)}`);
  });
  el('list-table').addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.dataset.buoy) event.target.click();
  });

  el('buoy-table').addEventListener('click', event => {
    if (unitHeaderFrom(event)) return;
    infoCellFrom(event) || forecastCellFrom(event);
  });

  el('buoy-back').addEventListener('click', () => goBack('#/'));
  el('toast').addEventListener('click', () => fadeOut(el('toast')));
  el('update-status').addEventListener('click', forceRefresh);
  el('map-back').addEventListener('click', () => goBack('#/'));
  el('map-button').addEventListener('click', () => {
    wa('map_open');
    navigate('#/map');
  });
  el('info-back').addEventListener('click', () => goBack(`#/buoy/${encodeURIComponent(state.detail?.buoyId ?? '')}`));
  el('buoy-info').addEventListener('click', () => {
    if (!state.detail) return;
    wa('buoy_info', { buoy: state.detail.buoyId });
    navigate(`#/buoy/${encodeURIComponent(state.detail.buoyId)}/info`);
  });

  el('interval-toggle').addEventListener('click', () => {
    settings.intervalHours = settings.intervalHours === 1 ? 3 : 1;
    if (state.detail) state.detail.followNow = true;
    settingsChanged();
  });

  // Once the user scrolls the buoy view themselves, stop pulling it back to now
  ['wheel', 'touchmove', 'keydown'].forEach(type => window.addEventListener(type, () => {
    if (state.detail) state.detail.followNow = false;
  }, { passive: true }));

  el('menu-button').addEventListener('click', () => setMenuOpen(true));
  el('menu-close').addEventListener('click', () => setMenuOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    setMenuOpen(false);
    closeUnitPopup();
  });

  // A unit applies it; a tap anywhere else on the popup just closes it
  el('unit-popup').addEventListener('click', event => {
    const button = event.target.closest('[data-unit-group]');
    if (button) {
      gui.selectedUnits = { ...gui.selectedUnits, [button.dataset.unitGroup]: button.dataset.unit };
      settingsChanged();
    }
    const timezone = event.target.closest('[data-timezone]');
    if (timezone) {
      gui.timelineUseLocalTime = timezone.dataset.timezone === 'local';
      if (state.detail) state.detail.followNow = true;
      settingsChanged();
    }
    closeUnitPopup();
  });
  // Anywhere else closes it - except the column title that opened it, whose
  // own click is still on its way up here
  document.addEventListener('click', event => {
    if (el('unit-popup').hidden) return;
    if (event.target.closest('#unit-popup, [data-unit-code], [data-toggle-timezone]')) return;
    closeUnitPopup();
  });

  el('unit-pickers').addEventListener('click', event => {
    const button = event.target.closest('[data-unit-group]');
    if (!button) return;
    gui.selectedUnits = { ...gui.selectedUnits, [button.dataset.unitGroup]: button.dataset.unit };
    settingsChanged();
  });
  el('language-picker').addEventListener('click', event => {
    const button = event.target.closest('[data-language]');
    if (button) setLanguage(button.dataset.language);
  });
  el('timezone-picker').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    gui.timelineUseLocalTime = button.dataset.value === 'local';
    settingsChanged();
  });

  // Coming back to the app after a while: refresh right away instead of
  // waiting for the next tick
  document.addEventListener('visibilitychange', () => {
    // (a phone throttles timers in the background, so the scheduled one may be late)
    if (document.visibilityState === 'visible' && Date.now() >= (state.nextUpdateAt ?? 0)) refresh();
  });
}

// A tap on a column title switches its unit
// A tap on a column title offers the units of its quantity - nothing changes
// until one is picked
//
// The same title again closes it, like a toggle; another column's title
// switches it to that column's units.
//
// The buoy view's Time title opens the same popup with the time zones.
function unitHeaderFrom(event) {
  const header = event.target.closest('[data-unit-code], [data-toggle-timezone]');
  if (!header) return false;
  const code = 'toggleTimezone' in header.dataset ? 'timezone' : header.dataset.unitCode;
  if (!code) return false; // a column whose quantity has one unit only
  const popup = el('unit-popup');
  const isOpen = !popup.hidden && !popup.classList.contains('fading');
  if (isOpen && popup.dataset.code === code) closeUnitPopup();
  else if (code === 'timezone') openTimezonePopup();
  else openUnitPopup(code);
  return true;
}

// Local time or UTC, offered when the Time title is tapped - same popup, same
// behaviour as the units'
function openTimezonePopup() {
  const popup = el('unit-popup');
  popup.dataset.code = 'timezone';
  const option = (value, label) => `<button data-timezone="${value}"`
    + ` class="${(value === 'local') === gui.timelineUseLocalTime ? 'selected' : ''}">${escapeHTML(label)}</button>`;
  // Local is labelled with its offset ('UTC+2', as GUIManager writes it), so
  // the choice says what it means
  const minutes = -new Date().getTimezoneOffset();
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  const localOffset = `UTC${minutes >= 0 ? '+' : '-'}${hours}${rest ? `:${String(rest).padStart(2, '0')}` : ''}`;
  popup.innerHTML = `<div class="unit-popup-title"><i class="fa-regular fa-clock"></i>${escapeHTML(t('menu.timezone'))}</div>`
    + `<div class="segmented">${option('local', `${t('menu.local')} (${localOffset})`)}${option('utc', t('menu.utc'))}</div>`
    + `<div class="unit-popup-note">${escapeHTML(t('timePopup.note'))}</div>`;
  el('toast').hidden = true;
  showFading(popup);
}

// The units a code's quantity can be shown in, as a row of buttons at the
// bottom of the screen. Picking one applies it everywhere (and saves it, like
// the menu does); tapping anywhere else closes it unchanged.
function openUnitPopup(code) {
  const group = gui.variable(code)?.unitGroup;
  const options = UNIT_GROUPS[group];
  if (!options || options.length < 2) return;
  el('unit-popup').dataset.code = code; // which column opened it (see unitHeaderFrom)

  const picker = UNIT_PICKERS.find(p => p.group === group);
  const selected = gui.unitFor(code).unit;
  el('unit-popup').innerHTML = `<div class="unit-popup-title">${picker ? `<i class="${picker.icon}"></i>${escapeHTML(t(`unit.${picker.group}`))}` : escapeHTML(t('unitPopup.unit'))}</div>`
    + `<div class="segmented">${options.map(option => `<button data-unit-group="${group}" data-unit="${escapeHTML(option.unit)}"`
    + ` class="${option.unit === selected ? 'selected' : ''}">${escapeHTML(option.unit)}</button>`).join('')}</div>`
    + `<div class="unit-popup-note">${escapeHTML(t('unitPopup.note'))}</div>`;
  el('toast').hidden = true; // replaced at once - the popup takes its place
  showFading(el('unit-popup'));
}

function closeUnitPopup() {
  fadeOut(el('unit-popup'));
}

// A tap on a forecast value says it comes from a model, and which one
// A tap on a cell that carries its own description (data-info - every
// measured or forecast cell of the buoy view, and the list's forecasts) shows
// it: where the value comes from and how it was made
function infoCellFrom(event) {
  const cell = event.target.closest('.cell[data-info]');
  if (!cell) return false;
  showToast(cell.dataset.info, 10000);
  return true;
}

function forecastCellFrom(event) {
  const cell = event.target.closest('.cell.forecast');
  if (!cell) return false;
  const label = modelLabel(cell.dataset.model);
  showToast(label ? t('toast.forecastModel', { model: label }) : t('toast.forecast'));
  return true;
}

// A model id as the catalogue labels it - 'AROME-HD', 'WAVEWATCH III forced
// by AROME (2.6 km)', ... - looked up in the forecast products' sources
function modelLabel(id) {
  if (!id) return undefined;
  for (const product of forecastProducts.values()) {
    for (const source of product.sources) {
      const model = source.models?.find(m => m.id === id);
      if (model) return `${modelName(model.id, model.label)}${model.resolution ? `, ${model.resolution}` : ''}`;
      if (source.model === id) return `${modelName(id, source.label)}${source.resolution ? `, ${source.resolution}` : ''}`;
    }
  }
  return id;
}

// Messages and the unit popup fade out rather than vanish, however they are
// closed - on their own after a while, by a tap on them, or by a tap elsewhere.
// FADE_MS matches the opacity transition in styles.css.
const FADE_MS = 300;

function showFading(element) {
  clearTimeout(element.fadeTimeout);
  element.classList.remove('fading');
  element.hidden = false;
}

function fadeOut(element) {
  if (element.hidden || element.classList.contains('fading')) return;
  element.classList.add('fading');
  clearTimeout(element.fadeTimeout);
  element.fadeTimeout = setTimeout(() => {
    element.hidden = true;
    element.classList.remove('fading');
  }, FADE_MS);
}

let toastTimeout;
function showToast(text, duration = 3500) {
  const toast = el('toast');
  closeUnitPopup();
  toast.textContent = text;
  showFading(toast);
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => fadeOut(toast), duration);
}

function refresh() {
  refreshList();
  // The old values stay on screen until the new ones land
  if (state.detail) loadDetail(state.detail);
  scheduleRefresh();
}

// Every REFRESH_INTERVAL from the last refresh - a timeout rather than an
// interval, so refreshing early (coming back to the app) restarts the count.
let refreshTimeout;
function scheduleRefresh() {
  clearTimeout(refreshTimeout);
  state.nextUpdateAt = new Date(Date.now() + REFRESH_INTERVAL);
  refreshTimeout = setTimeout(refresh, REFRESH_INTERVAL);
  renderUpdateStatus();
}

// 'Next update' / 'in X min', top left of the top bar - or what is being done
// instead while the data loads
function renderUpdateStatus() {
  let label = t('update.nextLabel');
  let time = '';
  if (state.refreshing || !state.listUpdatedAt) {
    label = state.listUpdatedAt ? t('update.updating') : t('update.loading');
  } else if (state.nextUpdateAt) {
    const left = Math.ceil((state.nextUpdateAt - Date.now()) / MINUTE);
    time = left <= 1 ? t('update.inSoon') : t('update.in', { n: left });
  }
  el('update-label').textContent = label;
  el('update-time').textContent = time;
}

// A tap on the top bar's countdown: everything again from the servers, now.
// FetchManager would otherwise answer from what it fetched in the last few
// minutes (each source's own TTL), and the forecasts are held for the hour -
// both are dropped, so 'now' really means asking again.
function forceRefresh() {
  if (state.refreshing) return;
  wa('manual_refresh');
  FetchManager.requests.clear();
  forecastCache.clear();
  refresh();
}


// ------------------------------------------------------------------ START

// What the loading screen lists: every source the app reads, as it is checked
// - the buoys' servers (DPBuoys loads them all up front) and the forecasts'
// (one line per dataset or API, however many products share it). Each entry:
// { group, label, promise, status: 'pending' | 'ok' | 'failed', detail() }
let loadingChecks = [];

function sourceLabel(source) {
  if (source.repo) return `GitHub ${source.repo}`;
  if (source.api === 'MSM') return 'MSM API';
  if (source.api) return source.api;
  return `ERDDAP ${hostOf(source.src)}${source.dataset ? ` · ${source.dataset}` : ''}`;
}

function startLoadingChecks() {
  const buoyDetail = source => () => {
    if (source.repo) {
      // The repository is only HEAD-checked at load: how fresh its files are
      const dates = (source.buoys ?? []).flatMap(buoy => buoy.sensors.map(sensor => sensor.lastModified)).filter(Boolean);
      return dates.length ? t('loading.updatedAgo', { ago: formatAgo(new Date(Math.max(...dates))) }) : '';
    }
    return source.buoys?.length ? t('loading.buoysFound', { n: source.buoys.length }) : '';
  };
  loadingChecks = buoysProduct.sources.map(source => ({
    group: 'buoys', label: sourceLabel(source), promise: source.loadingPromise, detail: buoyDetail(source),
  }));

  const seen = new Set();
  forecastProducts.forEach(product => product.sources.forEach(source => {
    const key = source.dataset ?? source.src;
    if (seen.has(key)) return;
    seen.add(key);
    // Open-Meteo has nothing to load up front, so it is asked for one buoy's
    // forecast - the same request (and FetchManager cache entry) as BCNS'
    // wind forecast will use
    const promise = source.api
      ? FetchManager.fetch(`${source.src}?buoy=SOMO`, 30, 30).then(res => res.json())
      : source.loadingPromise;
    // Named by model rather than by dataset id - shorter, and what it is
    const label = source.api ? source.api : modelName(source.model, source.label);
    const detail = () => source.api
      ? (source.models ?? []).map(model => modelName(model.id, model.label)).join(', ')
      : (source.endDate ? t('loading.until', { date: formatDateTime(source.endDate) }) : '');
    loadingChecks.push({ group: 'forecasts', label, promise, detail });
  }));

  loadingChecks.forEach(check => {
    check.status = 'pending';
    check.promise
      .then(() => { check.status = 'ok'; })
      .catch(() => { check.status = 'failed'; })
      .finally(renderLoading);
  });
  renderLoading();
}

function renderLoading() {
  const buoysPending = loadingChecks.some(check => check.group === 'buoys' && check.status === 'pending');
  el('loading-message').textContent = buoysPending ? t('loading.checking') : t('loading.ready');

  const marks = {
    pending: '<span class="spinner-small"></span>',
    ok: '<i class="fa-solid fa-check"></i>',
    failed: '<i class="fa-solid fa-xmark"></i>',
  };
  const groupHTML = group => `<h3>${escapeHTML(t(`loading.${group}`))}</h3><ul>${loadingChecks
    .filter(check => check.group === group)
    .map(check => {
      const detail = check.status === 'ok' ? check.detail() : check.status === 'failed' ? t('loading.unavailable') : '';
      return `<li class="${check.status}"><span class="mark">${marks[check.status]}</span>`
        + `<span>${escapeHTML(check.label)}${detail ? ` <span class="detail">· ${escapeHTML(detail)}</span>` : ''}</span></li>`;
    }).join('')}</ul>`;
  el('loading-sources').innerHTML = groupHTML('buoys') + groupHTML('forecasts');
}

function hideLoading() {
  el('loading').classList.add('done');
}

async function start() {
  applyLanguage();
  setupEvents();
  startLoadingChecks();

  // First paint from the static catalogue, before any server has answered
  setBuoys(allBuoysProduct.getBuoys());
  route();
  refreshList();
  scheduleRefresh();

  // Then the merged, live view of every buoy (positions, sensors, coverage)
  const loading = allBuoysProduct.loadBuoys().then(buoys => {
    setBuoys(buoys);
    renderList();
    renderDetail();
  }).catch(error => console.error('Could not load the buoys:', error));

  await Promise.race([loading, new Promise(resolve => setTimeout(resolve, LOADING_TIMEOUT))]);
  // A moment to see the last source tick before the screen goes
  setTimeout(hideLoading, 600);

  // Keeps the minutes in the top bar current between refreshes
  setInterval(renderUpdateStatus, 15 * 1000);
}

start();
