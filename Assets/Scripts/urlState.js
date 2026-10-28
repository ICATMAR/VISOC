// What the user is looking at, in the URL - so it can be shared:
//
//   #/<dashboard>?<key>=<value>&...
//
//   src   the HF radar source (HFR dashboard)              src=EU          (ICATMAR left out)
//   prod  what the HFR map shows                           prod=radials    (currents left out)
//   view  HFR: the bottom view; All platforms: its view    view=point, view=compare, view=buoys
//   st    the selected platform: an HF radar station as
//         <network>:<code>, a buoy or drifter as
//         buoy:<id> / drifter:<id>                         st=Galicia:FIST, st=buoy:SOMO
//   pt    the place Point / Compare is about               pt=41.8516,3.4647
//   bin   a radial Point's station (pt is its bin)         bin=ICATMAR:CREU
//   t     the selected hour, UTC - only when it isn't the
//         one the dashboard put the time handle on itself  t=2026-10-26T05
//
// A key is only written when it says something: defaults are left out, so a
// plain dashboard stays #/hfr.
//
// History: only a change of DASHBOARD is a new entry - Back / Forward go from
// dashboard to dashboard, each as it was left. Everything else (source,
// platform, view, place, hour) only updates the current entry, so using a
// dashboard doesn't fill the history (user, 2026-10-26).
//
// The map's frame is not in the URL (user): a link opens centred on what it
// selects - the station, the buoy, the point - wherever the sender's map was.
//
// Applying a URL (at start, Back / Forward, a link pasted) goes through the
// app's own entry points - selectPlatform, openHFRPoint, openHFRDataPoint -
// so it does exactly what the clicks do. Whatever can't be found (a station
// that is gone, a point without data) is skipped; the rest applies.

const HOUR = 3600000;
const WRITE_DELAY_MS = 300;

const roundToHour = time => new Date(Math.floor((new Date(time).getTime() + HOUR / 2) / HOUR) * HOUR);
const shortNetwork = code => String(code ?? 'HFR-ICATMAR').replace(/^HFR-/, '');
const coords = (lon, lat) => `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;

// The URL's parts: { dashboard, params: { key: value } }
function parse(hash, gui) {
  const [path, query = ''] = String(hash ?? '').replace(/^#/, '').split('?');
  const dashboard = gui.dashboardFromHash(`#${path}`);
  const params = Object.fromEntries(new URLSearchParams(query));
  return { dashboard, params };
}

// The hour a dashboard puts the time handle on by itself: HFR's newest map
// (GUIManager.hfrDefaultHour, as MapLayerHFRCurrents.goToLatest found it);
// for the others, the hour the app opened on
function defaultHour(gui, openedHour) {
  if (gui.selectedDashboard === 'hfr' && gui.hfrDefaultHour != undefined) return gui.hfrDefaultHour;
  return openedHour;
}

// What the app shows, as the URL's keys (defaults left out)
function stateOf(gui, openedHour) {
  const params = {};
  const dashboard = gui.selectedDashboard;
  // A selection - a platform, Point's or Compare's place - only counts while
  // its detail is open, as the timelines mark it: closing the detail or the
  // timeline takes it out of the URL (one made on another dashboard is still
  // remembered, but not shown here either)
  const shown = gui.isPlatformDetailOpen;
  const selected = shown ? gui.selectedPlatform : null;
  const station = () => selected?.stationId && !selected.kind ? `${shortNetwork(selected.network)}:${selected.stationId}` : undefined;
  if (dashboard === 'hfr') {
    if (gui.hfrSource !== 'ICATMAR') params.src = gui.hfrSource;
    if (gui.hfrProduct !== 'currents') params.prod = gui.hfrProduct;
    if (gui.isDataTimelineOpen && gui.hfrTab !== 'Network') params.view = gui.hfrTab.toLowerCase();
    if (!shown) {
      // nothing selected
    } else if (gui.hfrTab === 'Compare' && gui.hfrPoint) {
      if (gui.hfrPoint.kind === 'buoy' || gui.hfrPoint.kind === 'drifter') params.st = `${gui.hfrPoint.kind}:${gui.hfrPoint.id}`;
      else params.pt = coords(gui.hfrPoint.lon, gui.hfrPoint.lat);
    } else if (gui.hfrTab === 'Point' && gui.hfrDataPoint) {
      params.pt = coords(gui.hfrDataPoint.lon, gui.hfrDataPoint.lat);
      if (gui.hfrDataPoint.kind === 'radial') params.bin = `${shortNetwork(gui.hfrDataPoint.network)}:${gui.hfrDataPoint.station}`;
    } else if (gui.hfrTab === 'Network') {
      params.st = station();
    }
  } else if (dashboard === 'platforms') {
    const view = gui.timelineDashboardId;
    if (view && view !== 'hfr') params.view = view;
    if (selected?.stationId) params.st = !view || view === 'hfr' ? station() : `${view === 'drifters' ? 'drifter' : 'buoy'}:${selected.stationId}`;
  } else if (selected?.stationId) {
    params.st = `${dashboard === 'drifters' ? 'drifter' : 'buoy'}:${selected.stationId}`;
  }
  const hour = roundToHour(gui.selectedTime).getTime();
  if (Math.abs(hour - defaultHour(gui, openedHour)) >= HOUR) params.t = new Date(hour).toISOString().substring(0, 13);
  Object.keys(params).forEach(key => params[key] == undefined && delete params[key]);
  return { dashboard, params };
}

function urlOf({ dashboard, params }) {
  const query = new URLSearchParams(params).toString().replace(/%3A/g, ':').replace(/%2C/g, ',');
  return `#/${dashboard}${query ? `?${query}` : ''}`;
}

const waitFor = async (test, timeoutMs = 15000) => {
  const until = Date.now() + timeoutMs;
  while (!test() && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 100));
  return test();
};

// Where an HF radar station is: { lon, lat } from the networks as the app
// knows them, or undefined
async function stationPlace(dataService, network, code) {
  try {
    const networks = await dataService.hfrnetwork.getAllNetworks(dataService.hfrstations);
    const station = networks.flatMap(n => n.stations).find(s => s.id === code && (s.metadata?.network ?? 'HFR-ICATMAR') === network)
      ?? dataService.hfrnetwork.getIcatmarNetwork().stations.find(s => s.id === code);
    return station ? { lon: station.longitude, lat: station.latitude } : undefined;
  } catch {
    return undefined;
  }
}

// Puts the app in the state a URL describes - all of it: what the URL doesn't
// name (no platform, no hour) goes back to its default, or a dashboard left
// with a selection would keep it. `boot`: the first URL, before the dashboard
// has put its time handle anywhere. The map is centred on what is selected.
async function apply(gui, dataService, hash, { boot = false, openedHour } = {}) {
  const { dashboard, params } = parse(hash, gui);
  if (gui.selectedDashboard !== dashboard) gui.selectedDashboard = dashboard;
  // Nothing selected until the URL says what is
  gui.selectedPlatform = null;
  gui.hfrPoint = null;
  gui.hfrDataPoint = null;
  gui.isPlatformDetailOpen = false;
  gui.isDataTimelineOpen = false;
  gui.hfrTab = 'Network';

  if (dashboard === 'hfr') {
    gui.hfrSource = params.src === 'EU' ? 'EU' : 'ICATMAR';
    gui.hfrProduct = params.prod === 'radials' ? 'radials' : 'currents';
  }
  // The hour - kept, not replaced by the newest map (see MapLayerHFRCurrents.goToLatest)
  const hour = params.t && !isNaN(new Date(`${params.t}:00:00Z`)) ? new Date(`${params.t}:00:00Z`) : undefined;
  if (hour) { gui.timeFromUrl = true; gui.selectedTime = hour; }
  // No hour: the dashboard's own (Back to a dashboard left without one)
  else if (!boot) gui.selectedTime = new Date(defaultHour(gui, openedHour));
  // The hour a place is looked up at: the link's, or the dashboard's newest
  // map - the time handle isn't moved for it
  const lookupHour = async () => roundToHour(hour
    ?? (dashboard === 'hfr' ? gui.hfrDefaultHour ?? await dataService.hfrtotals.getLatestTime(gui.hfrSource).catch(() => undefined) : undefined)
    ?? gui.selectedTime);

  const [lat, lon] = (params.pt ?? '').split(',').map(Number);
  const point = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  const [kindOrNetwork, code] = (params.st ?? '').includes(':') ? params.st.split(':') : [undefined, params.st];
  const name = point && `${Math.abs(point.lat).toFixed(3)}º${point.lat >= 0 ? 'N' : 'S'} ${Math.abs(point.lon).toFixed(3)}º${point.lon >= 0 ? 'E' : 'W'}`;
  const view = params.view;
  // From the static catalogue, which is there at once - the live list waits
  // for every buoy source, a server that is down included
  const buoyPlace = async id => {
    const buoy = dataService.buoys.getBuoys().find(b => b.id === id)
      ?? (await dataService.buoys.loadBuoys().catch(() => [])).find(b => b.id === id);
    return buoy && { lon: buoy.longitude, lat: buoy.latitude, buoy };
  };
  // Another institution's platform is only on the map and in the timeline
  // with External platforms on
  const showExternal = institution => {
    if (!gui.isPlatformShown(institution)) gui.platformsShowExternal = true;
  };
  let place; // where to centre the map

  try {
    if (dashboard === 'hfr' && view === 'compare') {
      if (kindOrNetwork === 'buoy' && code) {
        place = await buoyPlace(code);
        if (place) gui.openHFRPoint({ lon: place.lon, lat: place.lat, kind: 'buoy', id: place.buoy.id, name: place.buoy.name ?? place.buoy.id }, hour);
      } else if (point) {
        place = point;
        gui.openHFRPoint({ ...point, kind: 'point', id: 'point', name }, hour);
      } else {
        gui.hfrTab = 'Compare';
        gui.isDataTimelineOpen = true;
      }
    } else if (dashboard === 'hfr' && view === 'point') {
      const comparePoint = point && { ...point, kind: 'point', id: 'point', name };
      let dataPoint = null;
      if (point && params.bin?.includes(':')) {
        const [network, station] = params.bin.split(':');
        dataPoint = await dataService.hfrstations.nearestRadialBin(`HFR-${network}`, station, await lookupHour(), point.lon, point.lat);
      } else if (point) {
        const cell = await dataService.hfrtotals.nearestGridPoint(await lookupHour(), gui.hfrSource, point.lon, point.lat);
        if (cell) dataPoint = { kind: 'total', provider: gui.hfrSource, network: cell.network, lon: cell.lon, lat: cell.lat };
      }
      place = dataPoint ?? point;
      if (dataPoint) gui.openHFRDataPoint(dataPoint, hour, comparePoint);
      else { gui.hfrTab = 'Point'; gui.isDataTimelineOpen = true; }
    } else if (dashboard === 'platforms' && view && view !== 'hfr') {
      if (code) {
        if (view === 'buoys') place = await buoyPlace(code);
        if (place) showExternal(place.buoy.institution);
        gui.selectPlatform(view, code);
      } else {
        gui.timelineDashboardId = view;
        gui.isDataTimelineOpen = true;
      }
    } else if ((dashboard === 'hfr' || dashboard === 'platforms') && kindOrNetwork && code) {
      // Another network's station is external on All platforms
      if (dashboard === 'platforms' && kindOrNetwork !== 'ICATMAR') gui.platformsShowExternal = true;
      gui.selectPlatform('hfr', code, { network: `HFR-${kindOrNetwork}` });
      place = await stationPlace(dataService, `HFR-${kindOrNetwork}`, code);
    } else if ((dashboard === 'buoys' || dashboard === 'drifters') && code) {
      if (dashboard === 'buoys') place = await buoyPlace(code);
      if (place) showExternal(place.buoy.institution);
      gui.selectPlatform(dashboard, code);
    }
  } catch (error) {
    console.error('Could not apply the URL:', error);
  }

  // Centred on what is selected - once the map is there and the bottom
  // section has opened (centerMainMapOn keeps the place clear of it)
  if (place && Number.isFinite(place.lon) && Number.isFinite(place.lat) && await waitFor(() => gui.olMap)) {
    await new Promise(resolve => setTimeout(resolve, 600));
    gui.centerMainMapOn(place.lon, place.lat);
  }
}

// Keeps the URL and the app in step - call once, after the app is mounted
export function startUrlState(gui, dataService) {
  // The hour the app opened on: the default hour of the dashboards without
  // one of their own
  const openedHour = roundToHour(gui.selectedTime).getTime();
  let applying = false;
  let lastDashboard = gui.selectedDashboard;
  let timer;

  const write = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (applying) return;
      const state = stateOf(gui, openedHour);
      const url = urlOf(state);
      if (url === window.location.hash) return;
      // Only another dashboard is a new entry in the history
      if (state.dashboard !== lastDashboard) history.pushState(null, '', url);
      else history.replaceState(null, '', url);
      lastDashboard = state.dashboard;
    }, WRITE_DELAY_MS);
  };

  const run = async (hash, boot = false) => {
    applying = true;
    try {
      await apply(gui, dataService, hash, { boot, openedHour });
    } finally {
      applying = false;
      lastDashboard = gui.selectedDashboard;
      write();
    }
  };

  // What the URL is written from - one string, so a change anywhere in it is
  // one write
  Vue.watch(() => JSON.stringify(stateOf(gui, openedHour)), write);
  // Back / Forward (to another dashboard, as it was left), an edited or
  // pasted URL
  window.addEventListener('popstate', () => run(window.location.hash));

  run(window.location.hash, true);
}
