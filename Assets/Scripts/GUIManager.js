class GUIManager {

  isMenuOpen = false;

  // CONSTRUCTOR
  constructor() {

  }

  toggleMenu(){
    this.isMenuOpen = !this.isMenuOpen;
  }
}

export default GUIManager;