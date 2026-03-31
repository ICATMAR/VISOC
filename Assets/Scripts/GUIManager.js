class GUIManager {

  isMenuOpen = false;
  isDataTimelineOpen = false;
  isPlatformDetailOpen = false;

  selectedLanguage = 'en';
  languages = [
    { name: 'Català', id: 'ca' },
    { name: 'Español', id: 'es' },
    { name: 'Français', id: 'fr' },
    { name: 'English', id: 'en' },
  ]


  selectedDashboard = 'hfr';
  dashboards = [
    { name: 'All platforms', id: 'platforms', icon: './Assets/Images/dashboardIcons/example.jpg' },
    { name: 'HFR currents', id: 'hfr', icon: './Assets/Icons/radar.svg' },
    { name: 'Buoys', id: 'buoys', icon: './Assets/Icons/buoy.svg' },
    { name: 'Drifters', id: 'drifters', icon: './Assets/Icons/drifter.svg' },
    { name: 'Argos', id: 'argos', icon: './Assets/Icons/argo.svg' },
    { name: 'Remote sensing', id: 'remoteSensing', icon: './Assets/Icons/smos.svg' },

  ]

  // CONSTRUCTOR
  constructor() {

  }

  toggleMenu(){
    this.isMenuOpen = !this.isMenuOpen;
    if (this.isMenuOpen) {
      this.isDataTimelineOpen = false;
    }
  }
}

export default GUIManager;