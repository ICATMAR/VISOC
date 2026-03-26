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


  selectedDashboard = 'platforms';
  dashboards = [
    { name: 'All platforms', id: 'platforms', icon: './Assets/Images/dashboardIcons/example.jpg'},
    { name: 'HFR currents', id: 'hfr', icon: './Assets/Images/dashboardIcons/example.jpg' },
    { name: 'HFR radials', id: 'hfr-radials', icon: './Assets/Images/dashboardIcons/example.jpg' },
    { name: 'Buoys', id: 'buoys', icon: './Assets/Images/dashboardIcons/example.jpg' },
    { name: 'Satellites', id: 'satellites', icon: './Assets/Images/dashboardIcons/example.jpg' },
    { name: 'Drifters', id: 'drifters', icon: './Assets/Images/dashboardIcons/example.jpg' },
    { name: 'Argos', id: 'argos', icon: './Assets/Images/dashboardIcons/example.jpg'  },
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