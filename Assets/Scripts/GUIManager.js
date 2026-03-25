class GUIManager {

  isMenuOpen = false;
  isDataTimelineOpen = false;

  // CONSTRUCTOR
  constructor() {

  }

  toggleMenu(){
    this.isMenuOpen = !this.isMenuOpen;
  }
}

export default GUIManager;