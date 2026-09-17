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


  _selectedDashboard = 'hfr';
  get selectedDashboard() { return this._selectedDashboard; }
  set selectedDashboard(id) {
    this._selectedDashboard = id;
    this.isDataTimelineOpen = false;
    this.isPlatformDetailOpen = false;
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
      return `(UTC${sign}${str})`;
    }
    return '(UTC)';
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
    { code: 'HCSP', directionCode: 'HCDT' }, // current, shallowest bin only
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