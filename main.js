// https://github.com/FranckFreiburger/vue3-sfc-loader
// https://github.com/FranckFreiburger/vue3-sfc-loader/blob/main/docs/examples.md#use-sfc-custom-blocks-for-i18n
import ca from './lang/ca.js';
import en from './lang/en.js';
import es from './lang/es.js';
import fr from './lang/fr.js';

// Declare event emitter
// https://github.com/developit/mitt
window.eventBus = window.mitt();


// Utils for hash and routing
import {setHashValue, getHashValue, removeHash} from './Assets/Scripts/utils.js';
window.location.setHashValue = setHashValue;
window.location.getHashValue = getHashValue;
window.location.removeHash = removeHash;

// Load scripts
import GUIManager from './Assets/Scripts/GUIManager.js';
import RequestsManager from './Assets/Scripts/RequestsManager.js';
import FetchManager from './Assets/Scripts/data/FetchManager.js';
import ServiceStatus from './Assets/Scripts/data/ServiceStatus.js';
import DataService from './Assets/Scripts/data/DataService.js';
// Vue mixin to poll for data and update the GUI, common for several .vue components
import pollMixin from './Assets/Scripts/pollMixin.js';
window.pollMixin = pollMixin;
// Vue mixin for the platform details: short screens move the map focus to the main map
import pdFocusMixin from './Assets/Scripts/pdFocusMixin.js';
window.pdFocusMixin = pdFocusMixin;
// What MapCircleArrows draws for a selected buoy reading
import { buoyCircleArrows } from './Assets/Scripts/circleArrows.js';
window.buoyCircleArrows = buoyCircleArrows;
// Base map and zoom helper for the platform-detail mini maps
import { createDetailMapLayers, zoomToShowCoast } from './Assets/Scripts/mapLayers.js';
window.createDetailMapLayers = createDetailMapLayers;
window.zoomToShowCoast = zoomToShowCoast;

import RadialParticles from './Assets/Scripts/RadialParticles.js';
import { scrollFade } from './Assets/Scripts/scrollFade.js';
window.RadialParticles = RadialParticles;

// Globals
window.MEDBBOX = {minLat: 30, minLon: -11, maxLat: 46, maxLon: 37}
window.NWMEDBBOX = {minLat: 38.5, minLon: -0.4, maxLat: 44, maxLon: 6.2}
window.WESTMEDBBOX = {minLat: 34.6, minLon: -5.8, maxLat: 44.6, maxLon: 16.5}

window.GUIManager = Vue.reactive(new GUIManager());
window.RequestsManager = new RequestsManager(); // Probably will delete, for now no use
window.DataService = new DataService(FetchManager);

// Routing: #/<dashboard>. The first dashboard comes from the URL, written back
// with replaceState so an invalid or empty hash doesn't leave a history entry.
// After that, Back/Forward (hashchange) drive the dashboard, and the
// selectedDashboard setter drives the hash. The check against the current
// dashboard matters: the setter's own hash write fires hashchange too, and
// setting the same dashboard again would close a timeline opened just after.
{
  const initial = window.GUIManager.dashboardFromHash(window.location.hash);
  window.GUIManager._selectedDashboard = initial;
  if (!window.location.hash.startsWith('#/' + initial)) history.replaceState(null, '', '#/' + initial);
  window.addEventListener('hashchange', () => {
    const id = window.GUIManager.dashboardFromHash(window.location.hash);
    if (id !== window.GUIManager.selectedDashboard) window.GUIManager.selectedDashboard = id;
    // Same dashboard but a hash that didn't name it (#/foo): tidy the URL
    else if (!window.location.hash.startsWith('#/' + id)) history.replaceState(null, '', '#/' + id);
  });
}


// Short screens (see GUIManager.SHORT_SCREEN_MAX_HEIGHT). Set here rather than
// in GUIManager's constructor so the listener writes through the reactive proxy.
{
  const query = window.matchMedia(`(max-height: ${window.GUIManager.SHORT_SCREEN_MAX_HEIGHT}px)`);
  window.GUIManager.isShortScreen = query.matches;
  query.addEventListener('change', e => { window.GUIManager.isShortScreen = e.matches; });
}


// Declare translations
const i18n = VueI18n.createI18n({
  // https://vue-i18n.intlify.dev/guide/essentials/fallback.html#explicit-fallback-with-one-locale
  silentTranslationWarn: true, 
  silentFallbackWarn: true,
  missingWarn: false,
  fallbackWarn: false,
});


const options = {
  moduleCache: { vue: Vue },
  async getFile(url) {
    const res = await fetch(url);
    if (!res.ok)
      throw Object.assign(new Error(res.statusText + ' ' + url), { res });
    return {
      getContentData: asBinary => asBinary ? res.arrayBuffer() : res.text(),
    }
  },
  addStyle: (textContent) => {
    const style = Object.assign(document.createElement('style'), { textContent });
    const ref = document.head.getElementsByTagName('style')[0] || null;
    document.head.insertBefore(style, ref);
  },
  customBlockHandler(block, filename, options) {
    if (block.type !== 'i18n')
      return
    const messages = JSON.parse(block.content);
    for (let locale in messages)
      i18n.global.mergeLocaleMessage(locale, messages[locale]);
  }, // https://github.com/FranckFreiburger/vue3-sfc-loader/discussions/88
  handleModule: async (type, getContentData, path, options) => {
    switch (type) {
      case '.svg': return 'data:image/svg+xml,' + await getContentData(false);
      case '.webp':
      case '.png': {
        const data = await getContentData(true); // Assuming this returns a Uint8Array or Buffer
        // Convert binary buffer to a string that btoa can understand
        const binaryString = Array.from(new Uint8Array(data))
          .map(byte => String.fromCharCode(byte))
          .join('');
        return 'data:image/webp;base64,' + btoa(binaryString);
      };
    }
  }
}

const { loadModule } = window['vue3-sfc-loader'];

const app = Vue.createApp({
  components: {
    'app': Vue.defineAsyncComponent(() => loadModule('./Components/App.vue', options)),
  },
  template: '<app></app>'
});

// Translations
i18n.global.mergeLocaleMessage('ca', ca);
i18n.global.mergeLocaleMessage('en', en);
i18n.global.mergeLocaleMessage('es', es);
i18n.global.mergeLocaleMessage('fr', fr);
app.use(i18n);
app.directive('scroll-fade', scrollFade);

// Global properties
app.config.globalProperties.$gui = window.GUIManager;
app.config.globalProperties.$requests = window.RequestsManager;
app.config.globalProperties.$dataService = window.DataService;
app.mount(document.body);