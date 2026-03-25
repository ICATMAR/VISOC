class GUIManager {

  isMenuOpen = false;
  isDataTimelineOpen = false;
  isPlatformDetailOpen = false;

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