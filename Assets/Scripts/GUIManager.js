import COLOR_LEGENDS, { VARIABLE_RANGES } from '../../styles/colorLegends.js';
import { VARIABLES, UNIT_GROUPS } from './data/variables.js';

class GUIManager {

  isMenuOpen = false;
  isDataTimelineOpen = false;
  isPlatformDetailOpen = false;
  selectedPlatform = null; // { stationId, value }

  selectedTime = new Date();

  selectedLanguage = 'en';
  languages = [
    { name: 'Català', id: 'ca' },
    { name: 'Español', id: 'es' },
    { name: 'Français', id: 'fr' },
    { name: 'English', id: 'en' },
  ]


  // The dashboard is mirrored in the URL as #/<dashboard> (see main.js for the
  // other direction). Pushed, not replaced, so Back returns to the previous
  // dashboard.
  _selectedDashboard = 'platforms';
  get selectedDashboard() { return this._selectedDashboard; }
  set selectedDashboard(id) {
    this._selectedDashboard = id;
    this.isDataTimelineOpen = false;
    this.isPlatformDetailOpen = false;
    const hash = '#/' + id;
    if (window.location.hash !== hash) window.location.hash = hash;
  }
  // The dashboard a hash like #/<dashboard>[/<platformId>] points to, or
  // 'platforms' when it names nothing that can be shown. The platform part is
  // accepted but not acted on yet.
  dashboardFromHash(hash) {
    const id = /^#\/([^/?&]+)/.exec(hash)?.[1];
    const dashboard = this.dashboards.find(d => d.id === id && d.isAvailable);
    return dashboard ? dashboard.id : 'platforms';
  }
  dashboards = [
    { name: 'All platforms', id: 'platforms', icon: './Assets/Icons/allPlatforms.png', image: './Assets/Images/dashboardIcons/allPlatforms.png', isAvailable: true },

    { name: 'HFR currents', type: 'platform', id: 'hfr', icon: './Assets/Icons/radar.svg', image: './Assets/Images/dashboardIcons/hfrCurrents.png', isAvailable: true, latestDaysRange: 4 },
    { name: 'Buoys', type: 'platform', id: 'buoys', icon: './Assets/Icons/buoy.svg', image: './Assets/Images/dashboardIcons/buoys.png', isAvailable: true, latestDaysRange: 7 },
    { name: 'Drifters', type: 'platform', id: 'drifters', icon: './Assets/Icons/drifter.svg', image: './Assets/Images/dashboardIcons/drifters.png', isAvailable: true, latestDaysRange: 15 },
    { name: 'Argos', type: 'platform', id: 'argos', icon: './Assets/Icons/argo.svg', image: './Assets/Images/dashboardIcons/example.jpg', isAvailable: false, latestDaysRange: 30 },
    { name: 'Remote sensing', type: 'platform', id: 'remoteSensing', icon: './Assets/Icons/smos.svg', image: './Assets/Images/dashboardIcons/example.jpg', isAvailable: false },

    { name: 'Sea state', type: 'variable', id: 'seaState', image: './Assets/Images/dashboardIcons/example.jpg', isAvailable: false },
    { name: 'Sea surface temperature', type: 'variable', id: 'seaSurfaceTemperature', image: './Assets/Images/dashboardIcons/example.jpg', isAvailable: false },
    { name: 'Sea surface velocity', type: 'variable', id: 'seaSurfaceVelocity', image: './Assets/Images/dashboardIcons/example.jpg', isAvailable: false },

    { name: 'Search And Rescue', type: 'application', id: 'sar', image: './Assets/Images/dashboardIcons/example.jpg', isAvailable: false },
    { name: 'Offshore fishing', type: 'application', id: 'offshoreFishing', image: './Assets/Images/dashboardIcons/example.jpg', isAvailable: false },

    { name: 'Temperature, salinity and currents forecast', type: 'model', id: 'seaSurface', image: './Assets/Images/dashboardIcons/example.jpg', isAvailable: false },
    { name: 'Wave forecast', type: 'model', id: 'waveForecast', image: './Assets/Images/dashboardIcons/example.jpg', isAvailable: false },
    { name: 'Coastal wave forecast', type: 'model', id: 'coastalWaveForecast', image: './Assets/Images/dashboardIcons/example.jpg', isAvailable: false },


  ];

  // ALL PLATFORMS DASHBOARD
  // ICATMAR's platforms only (its HF radar network - other institutions'
  // stations it uses included - and the buoys it runs), or other
  // institutions' as well (bottom-right toggle)
  platformsShowExternal = false;
  // Whether All platforms shows a platform of these institutions (written
  // 'A / B' for joint ownership)
  isPlatformShown(institution) {
    return this.platformsShowExternal
      || String(institution ?? '').split('/').some(name => name.trim() === 'ICATMAR');
  }

  // HFR DASHBOARD
  // Which provider's HF radar data the HFR dashboard shows: 'ICATMAR' (only
  // ICATMAR's network) or 'EU' (every network on the EU HFR Node).
  hfrSource = 'ICATMAR';
  // Buoys can be overlaid on the HFR dashboard (bottom-right toggle), and
  // their currents are loading while this is true
  hfrShowBuoys = false;
  hfrBuoysLoading = false;
  // What the currents layer draws (bottom-right toggles): moving particles,
  // and/or the totals' grid points - where the measurements are
  hfrShowParticles = true;
  hfrShowGridPoints = false;
  // What the currents layer is showing, for the bottom-right panel to report:
  // { state: 'loading' | 'ok' | 'none', time, label }
  hfrFieldStatus = { state: 'loading' };
  // Which hours have maps, one row per network in view, for the bottom
  // timeline to draw: [{ network, hours: { '<ISO hour>': count } }]
  hfrAvailability = [];
  // The place the HFR dashboard's bottom section is about: a buoy or drifter
  // chip that was clicked, or a point on the map -
  // { lon, lat, kind: 'buoy' | 'drifter' | 'point', id, name }
  hfrPoint = null;
  // Which view of it the bottom section shows: 'Currents' | 'Radials' | 'Compare'
  hfrTab = 'Compare';
  // What the Compare view has at the selected time, for the circle arrows on
  // the map (MapOverlayPoint): [{ name, code, speed, direction, tag }]
  hfrPointArrows = [];
  // Whether the circle arrows are up at hfrPoint (MapOverlayPoint) - the
  // clicked platform's own chip gives way to them, the circle saying all it
  // did and more
  get isHFRPointCircleShown() {
    return this.selectedDashboard === 'hfr' && this.isDataTimelineOpen && this.hfrTab === 'Compare'
      && this.hfrPoint != null && this.hfrPointArrows.length > 0;
  }
  isHFRPointChip(kind, id) {
    return this.isHFRPointCircleShown && this.hfrPoint.kind === kind && this.hfrPoint.id === id;
  }
  // The buoy reading behind the selected cell, for the platform detail:
  // { sensor, instrument, depth, time }
  hfrPointReading = null;
  // A data source picked in the Compare view's names column, described in the
  // info panel instead of the platform: { key, title, subtitle, icon, rows:
  // [{ label, value, url, long }], loading } - null for the platform itself
  hfrSourceInfo = null;
  // Set by "Switch to dashboard" from the HFR buoy detail: which view the
  // buoys timeline should open on ({ mode: 'variable', group: 'currents' })
  buoysView = null;

  // Opens the HFR bottom section on a buoy or drifter chip: Compare, on the
  // hour of the reading that was clicked, with its detail panel
  openHFRPoint(point, time) {
    this.hfrPoint = point;
    this.hfrTab = 'Compare';
    if (time) this.selectedTime = new Date(Math.floor((time.getTime() + 1800000) / 3600000) * 3600000);
    this.selectedPlatform = { stationId: point.id, kind: point.kind, date: time };
    this.isDataTimelineOpen = true;
    this.isPlatformDetailOpen = true;
    this.isMenuOpen = false;
  }

  // What is under the cursor on the HFR map: { lon, lat, speed, direction,
  // network } (speed and direction undefined where there is no data), or null
  hfrCursor = null;
  // Drifters can be overlaid on the HFR dashboard (bottom-right toggle)
  hfrShowDrifters = false;

  // Opening a platform, from its map marker or the menu's platform list.
  // Inside the platform's own dashboard (hfr, buoys) it stays there and opens
  // that dashboard's timeline; from anywhere else it goes to All platforms,
  // on that platform's view.
  selectPlatform(dashboardId, stationId) {
    if (this.selectedDashboard !== dashboardId) {
      // timelineDashboardId BEFORE selectedDashboard, so DTAllPlatforms can
      // read it in created()
      this.timelineDashboardId = dashboardId;
      this.selectedPlatform = { stationId };
      this.selectedDashboard = 'platforms';
    } else {
      this.selectedPlatform = { stationId };
    }
    this.isDataTimelineOpen = true;
    this.isPlatformDetailOpen = true;
    this.isMenuOpen = false;
  }
  // Whether a platform of dashboard `dashboardId` is the one selected: in its
  // own dashboard, or in All platforms on its view.
  isPlatformSelected(dashboardId, stationId) {
    // A buoy or drifter chip selected on the HFR dashboard (openHFRPoint) is
    // not a radar station, whatever its code (BEGU is both)
    if (dashboardId === 'hfr' && this.selectedPlatform?.kind) return false;
    const inView = this.selectedDashboard === dashboardId
      || (this.selectedDashboard === 'platforms' && this.timelineDashboardId === dashboardId);
    return inView && this.selectedPlatform?.stationId === stationId;
  }

  // SHORT SCREENS
  // Below this window height the platform detail stops floating above the
  // timeline as a 180px card and becomes a slim strip: no mini map (the main
  // map zooms to the platform instead), info and readings in one row. The one
  // number to tune; main.js keeps isShortScreen in step with it.
  SHORT_SCREEN_MAX_HEIGHT = 820;
  isShortScreen = false;

  // How many pixels at the bottom of the main map the timeline and the
  // platform detail cover - read off the panes themselves, at the moment it is
  // asked, so it is right whichever layout (card or strip) is showing.
  // offsetHeight rather than a bounding box: the panes slide in with a
  // transform, which a bounding box would include.
  bottomCoveredPx() {
    const timeline = document.getElementById('dataTimelinePane');
    const detail = document.getElementById('platformDetailPane');
    return (timeline?.offsetHeight ?? 0) + (this.isPlatformDetailOpen ? detail?.offsetHeight ?? 0 : 0);
  }

  // Centres the main map on a point, two thirds of the way down the part of
  // the map the bottom panes leave visible. Keeps the current zoom unless the
  // map is zoomed far out.
  centerMainMapOn(longitude, latitude, zoom) {
    const map = this.olMap;
    if (!map) return;
    const view = map.getView();
    const coords = ol.proj.fromLonLat([longitude, latitude]);
    const targetZoom = zoom ?? (view.getZoom() < 7 ? 10 : view.getZoom());
    const mapSize = map.getSize();
    const visibleHeight = mapSize[1] - this.bottomCoveredPx();
    const targetY = Math.max(50, visibleHeight * 0.66);
    const resolution = view.getResolutionForZoom(targetZoom);
    const centerY = coords[1] + (targetY - mapSize[1] / 2) * resolution;
    view.animate({ center: [coords[0], centerY], zoom: targetZoom, duration: 600 });
  }

  // Fits the main map to an extent (map projection) within the part of it the
  // bottom panes leave visible.
  fitMainMapTo(extent, maxZoom) {
    this.olMap?.getView().fit(extent, { padding: [40, 60, this.bottomCoveredPx() + 40, 60], maxZoom, duration: 600 });
  }

  defaultTimelineDays = 4;

  // TIMELINE RANGE (common to all DataTimeline views)
  // timelineDashboardId overrides selectedDashboard for the timeline (used by sub-views like All Platforms > HF radars)
  timelineDashboardId = null;
  get timelineRangeOfDays() {
    const id = this.timelineDashboardId || this.selectedDashboard;
    const dashboard = this.dashboards.find(d => d.id === id);
    if (dashboard == undefined || dashboard.latestDaysRange == undefined)
      return this.defaultTimelineDays;
    return dashboard.latestDaysRange;
  }

  // TIMELINE TIMEZONE
  timelineUseLocalTime = true;
  get timelineTimezoneLabel() {
    if (this.timelineUseLocalTime) {
      const offsetMinutes = -new Date().getTimezoneOffset();
      const sign = offsetMinutes >= 0 ? '+' : '-';
      const absH = Math.floor(Math.abs(offsetMinutes) / 60);
      const absM = Math.abs(offsetMinutes) % 60;
      const str = absM > 0 ? `${absH}:${String(absM).padStart(2, '0')}` : `${absH}`;
      return `UTC${sign}${str}`;
    }
    return 'UTC';
  }
  // Timezone-aware helpers used by all timeline grid components
  timelineHours(date) {
    return this.timelineUseLocalTime ? date.getHours() : date.getUTCHours();
  }
  timelineDate(date) {
    return this.timelineUseLocalTime ? date.getDate() : date.getUTCDate();
  }
  timelineFormatDay(date, locale) {
    const options = { weekday: 'long', day: 'numeric' };
    if (!this.timelineUseLocalTime) options.timeZone = 'UTC';
    return date.toLocaleString(locale, options);
  }

  // UNITS
  // Everything outside the view layer is in standard units (see
  // data/variables.js); this is the only place another unit exists, and it
  // only affects what is DRAWN. Nothing refetches when it changes - the block
  // cache holds standard values, so a unit switch is a re-render.
  //
  // Keyed by unit group, holding the chosen unit. A group with no entry uses
  // its first option, which is always the standard one.
  selectedUnits = {};

  // The unit a value should be shown in, and how to get there: { unit,
  // decimals, toDisplay }. Always answers, so no caller has to check - a code
  // whose quantity isn't switchable (a direction, a salinity) comes back with
  // its own standard unit and an identity conversion.
  unitFor(code) {
    const variable = VARIABLES[code];
    const options = UNIT_GROUPS[variable?.unitGroup];
    if (!options) return { unit: variable?.unit, decimals: 1, toDisplay: value => value };
    return options.find(option => option.unit === this.selectedUnits[variable.unitGroup]) ?? options[0];
  }

  // Whether a code's quantity has more than one unit to offer - what a picker
  // should check before making itself clickable.
  isUnitSwitchable(code) {
    return (UNIT_GROUPS[VARIABLES[code]?.unitGroup]?.length ?? 0) > 1;
  }

  // Steps a code's quantity to its next unit. By group, not by code, so
  // switching the wind on one row switches every wind reading in the app.
  cycleUnit(code) {
    const group = VARIABLES[code]?.unitGroup;
    const options = UNIT_GROUPS[group];
    if (!options || options.length < 2) return;
    const next = options[(options.indexOf(this.unitFor(code)) + 1) % options.length];
    this.selectedUnits = { ...this.selectedUnits, [group]: next.unit };
  }

  // What a code means - long name, CF standard name, standard unit
  variable(code) {
    return VARIABLES[code];
  }

  // BUOY TIMELINE VARIABLES
  // What the buoy timeline can draw, one at a time (see DTAPBuoysVariableBar
  // for the picker and DTAPBuoys for the cells). `code` is the magnitude shown
  // as a number and coloured by the legend; `directionCode`, where there is
  // one, is drawn as an arrow instead of a second number.
  //
  // `range` is what the colour legend is normalized over, in STANDARD units
  // (see data/variables.js) - deliberately not per display unit. TEMP and DRYT
  // share a unit group but not a range, so a range can't belong to the unit;
  // and since the values being coloured are standard too, a cell keeps exactly
  // its colour when the unit changes. Only the legend's end labels convert.
  //
  // The unit and its decimals are no longer here: they follow the code's
  // quantity and whatever the user has picked for it (see unitFor).
  //
  // `fromDirection` marks the ones reported as where the wind/swell comes FROM,
  // which is the opposite of where the arrow should point.
  buoyVariables = [
    { label: 'Wind',        code: 'WSPD', directionCode: 'WDIR', fromDirection: true, range: VARIABLE_RANGES.WSPD },
    { label: 'Waves',       code: 'VHM0', directionCode: 'VMDR', fromDirection: true, range: VARIABLE_RANGES.VHM0 },
    // No fromDirection: HCDT is where the water is GOING (CF's
    // direction_of_sea_water_velocity), unlike the wind and the swell above,
    // which are reported as where they come from. So the arrow draws the
    // heading as recorded, with no half turn.
    { label: 'Currents',    code: 'HCSP', directionCode: 'HCDT', range: VARIABLE_RANGES.HCSP },
    { label: 'Water temperature', code: 'TEMP', range: VARIABLE_RANGES.TEMP },
    { label: 'Air temperature',   code: 'DRYT', range: VARIABLE_RANGES.DRYT },
  ];
  // What a CELL CLICK goes and fetches, on top of the codes above. Everything
  // the platform detail panel shows but the timeline never draws.
  //
  // Deliberately NOT part of buoyVariableCodes: those are requested for every
  // buoy over the whole timeline window on a five-minute poll, and adding ten
  // more columns to that would multiply what every ERDDAP query transfers for
  // data almost nobody looks at. These are asked for one buoy, over one cell,
  // only once someone actually opens the panel - and the block cache keeps the
  // answer, so clicking around the same day is free after the first click.
  //
  // `directionCode` pairs a magnitude with its heading so the two are averaged
  // together (a direction is vector-averaged weighted by its magnitude, which
  // needs both); a code with no direction just stands alone.
  buoyDetailVariables = [
    { code: 'PSAL' },                        // salinity
    // Two groups in the panel: the sea state (average height, mean direction,
    // average period) and the biggest wave of the interval (maximum height,
    // direction and period at the spectral peak).
    { code: 'VTM02' },                       // average period, shown with VHM0
    { code: 'VZMX', directionCode: 'VPED' }, // maximum height + peak direction
    // CF has four spellings of "maximum wave height" and datasets disagree on
    // which to use - the catalogue only renames Puertos' Hmax to VZMX, and the
    // ERDDAP/MSM waves come through as published. All four mean
    // sea_surface_wave_maximum_height, so the panel takes whichever turns up
    // (see maxWaveHeight) and colours it on VZMX's scale either way. Asking for
    // all four costs nothing: the planner only requests codes a sensor
    // actually publishes.
    { code: 'VCMX' }, { code: 'VHMH' }, { code: 'VEMH' },
    { code: 'VTPK' },                        // peak period, shown with VZMX
    { code: 'GSPD', directionCode: 'GDIR' }, // wind gust
    // HCSP/HCDT are NOT here: currents are a timeline variable now, so they
    // are already fetched and binned for every buoy, and buoyClicked copies
    // them onto the selection like any other. Listing them again would only
    // re-plan work already done.
  ];
  get buoyDetailCodes() {
    return [...new Set(this.buoyDetailVariables.flatMap(v => [v.code, v.directionCode].filter(Boolean)))];
  }

  selectedBuoyVariableCode = 'WSPD';
  get selectedBuoyVariable() {
    return this.buoyVariables.find(v => v.code === this.selectedBuoyVariableCode) ?? this.buoyVariables[0];
  }
  // Every code the buoy timeline needs, magnitudes and directions together.
  // Requested in one go so switching variable is instant - the block cache
  // already holds the others (see DPBuoys.getVariablesData).
  get buoyVariableCodes() {
    return [...new Set(this.buoyVariables.flatMap(v => [v.code, v.directionCode].filter(Boolean)))];
  }

  // TIMELINE INTERVAL
  timelineIntervalMinutes = null; // null = auto (derived from latestDaysRange)
  get timelineEffectiveIntervalMinutes() {
    if (this.timelineIntervalMinutes != null)
      return this.timelineIntervalMinutes;
    return this.timelineRangeOfDays > 7 ? 1440 : 180;
  }

  get timelineEndDate() {
    let date = new Date();
    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() + 1);
    return date;
  }
  get timelineStartDate() {
    let date = new Date(this.timelineEndDate.getTime());
    if (this.timelineUseLocalTime) {
      date.setDate(date.getDate() - this.timelineRangeOfDays);
      date.setHours(0, 0, 0, 0);
    } else {
      date.setUTCDate(date.getUTCDate() - this.timelineRangeOfDays);
      date.setUTCHours(0, 0, 0, 0);
    }
    return date;
  }
  get timelineStartTmst() {
    return this.timelineStartDate.toISOString();
  }
  get timelineEndTmst() {
    return this.timelineEndDate.toISOString();
  }

  // CONSTRUCTOR
  constructor() {
    // this.selectedTime = new Date(2024, 5, 15); // Example date: June 15, 2024
    this.selectedTime = new Date();
    this.selectedTime.setMinutes(0, 0, 0);
  }

  toggleMenu(){
    this.isMenuOpen = !this.isMenuOpen;
    if (this.isMenuOpen) {
      this.isDataTimelineOpen = false;
    }
  }

  // Timeline cell colour scale for a standard variable code (see
  // styles/colorLegends.js) - an array of [t, [r,g,b]] stops, t normalized
  // 0..1 over the variable's own range. Falls back to BLANK (a no-op white
  // scale) for a code with no dedicated palette, so a caller never has to
  // check for undefined first.
  colorLegend(code) {
    return COLOR_LEGENDS[code] ?? COLOR_LEGENDS.BLANK;
  }

  // Whether a code has a colour scale of its own - a palette AND a range to
  // spread it over (see styles/colorLegends.js). Not the same question as
  // colorLegend(), which always answers.
  hasColorLegend(code) {
    return COLOR_LEGENDS[code] != undefined && VARIABLE_RANGES[code] != undefined;
  }

  // The [min, max] a code's colour scale spans, in STANDARD units.
  rangeFor(code) {
    return VARIABLE_RANGES[code];
  }

  // The colour a value should be painted, as a CSS rgb() string - the single
  // place the timeline cells, the platform detail's value chips and the map's
  // circle arrows all get their background from, so one reading is the same
  // colour wherever it is drawn.
  //
  // `value` and `range` are both STANDARD (see data/variables.js), so this
  // needs no unit conversion: a value keeps its exact colour when the user
  // switches to knots, and nothing drifts on a converted range's rounding.
  //
  // Returns undefined - rather than a colour - when there is nothing to say:
  // no value, no palette, or no range. The caller then leaves its own default
  // background in place instead of painting over it with a guess.
  colorFor(code, value, range = this.rangeFor(code)) {
    if (value == undefined || range == undefined) return undefined;
    const stops = COLOR_LEGENDS[code];
    if (stops == undefined) return undefined;

    // Clamped: the range is where the interesting values are, not a bound on
    // what the variable can be, so anything beyond it takes the end colour.
    const t = Math.min(Math.max((value - range[0]) / (range[1] - range[0]), 0), 1);
    for (let i = 0; i < stops.length - 1; i++) {
      const [t0, from] = stops[i];
      const [t1, to] = stops[i + 1];
      if (t > t1) continue;
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      const channel = j => Math.round(from[j] + (to[j] - from[j]) * f);
      return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
    }
    const [, last] = stops[stops.length - 1];
    return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
  }
}

export default GUIManager;