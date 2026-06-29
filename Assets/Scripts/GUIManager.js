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


  selectedDashboard = 'hfr';
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
      return `Local (UTC${sign}${str})`;
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
}

export default GUIManager;