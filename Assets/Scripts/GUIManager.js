import COLOR_LEGENDS from '../../styles/colorLegends.js';
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
      return `Local time (UTC${sign}${str})`;
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
    { label: 'Wind',        code: 'WSPD', directionCode: 'WDIR', fromDirection: true, range: [0, 20] },
    { label: 'Waves',       code: 'VHM0', directionCode: 'VMDR', fromDirection: true, range: [0, 4]  },
    { label: 'Water temp.', code: 'TEMP', range: [10, 28] },
    { label: 'Air temp.',   code: 'DRYT', range: [0, 35]  },
  ];
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
}

export default GUIManager;