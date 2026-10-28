// https://github.com/FranckFreiburger/vue3-sfc-loader
// https://github.com/FranckFreiburger/vue3-sfc-loader/blob/main/docs/examples.md#use-sfc-custom-blocks-for-i18n
import ca from './lang/ca.js';
import en from './lang/en.js';
import es from './lang/es.js';
import fr from './lang/fr.js';

// Declare event emitter
// https://github.com/developit/mitt
window.eventBus = window.mitt();



// Load scripts
import GUIManager from './Assets/Scripts/GUIManager.js';
import RequestsManager from './Assets/Scripts/RequestsManager.js';
import FetchManager from './Assets/Scripts/data/FetchManager.js';
import ServiceStatus from './Assets/Scripts/data/ServiceStatus.js';
import DataService from './Assets/Scripts/data/DataService.js';
// Vue mixin to poll for data and update the GUI, common for several .vue components
import pollMixin from './Assets/Scripts/pollMixin.js';
window.pollMixin = pollMixin;
// The app's one clock for everything periodic (refreshes, the "now" line):
// due times on the real clock, so a hidden tab catches up on return
import scheduler from './Assets/Scripts/scheduler.js';
window.scheduler = scheduler;
// Vue mixin: a component reacts to a data product's new data (see DataProduct.changed)
import dataProductMixin from './Assets/Scripts/dataProductMixin.js';
window.dataProductMixin = dataProductMixin;
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

// How the HFR dashboard describes a data source in the info panel
import * as hfrSourceInfo from './Assets/Scripts/hfrSourceInfo.js';
window.hfrSourceInfo = hfrSourceInfo;
// Spherical-earth helpers - a radial bin's range and bearing from its antenna
import { radialRangeBearing } from './Assets/Scripts/data/geo.js';
window.radialRangeBearing = radialRangeBearing;

import RadialParticles from './Assets/Scripts/RadialParticles.js';
import { scrollFade } from './Assets/Scripts/scrollFade.js';
import { dragScroll } from './Assets/Scripts/dragScroll.js';
// What is shown, in the URL (shareable, Back / Forward)
import { startUrlState } from './Assets/Scripts/urlState.js';
window.RadialParticles = RadialParticles;

// Globals
window.MEDBBOX = {minLat: 30, minLon: -11, maxLat: 46, maxLon: 37}
window.NWMEDBBOX = {minLat: 38.5, minLon: -0.4, maxLat: 44, maxLon: 6.2}
window.WESTMEDBBOX = {minLat: 34.6, minLon: -5.8, maxLat: 44.6, maxLon: 16.5}

window.GUIManager = Vue.reactive(new GUIManager());
window.RequestsManager = new RequestsManager(); // Probably will delete, for now no use
window.DataService = new DataService(FetchManager);

// The first dashboard comes from the URL, before anything mounts; the rest of
// the URL (the selection, the view, the hour, the map - see urlState.js) is
// applied once the app is mounted, and kept in step from then on
window.GUIManager._selectedDashboard = window.GUIManager.dashboardFromHash(window.location.hash);


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
      // Encoded: an SVG with a '#' (fill="#003399") is cut there otherwise -
      // a URL's fragment starts at '#'
      case '.svg': return 'data:image/svg+xml,' + encodeURIComponent(await getContentData(false));
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
app.directive('drag-scroll', dragScroll);

// Global properties
app.config.globalProperties.$gui = window.GUIManager;
app.config.globalProperties.$requests = window.RequestsManager;
app.config.globalProperties.$dataService = window.DataService;
// The loading screen (index.html) is in the body the app is mounted on, which
// the mount replaces: held aside and put back on top
const loadingScreen = document.getElementById('loading-screen');
loadingScreen?.remove();
app.mount(document.body);
if (loadingScreen) document.body.appendChild(loadingScreen);
startUrlState(window.GUIManager, window.DataService);

// Faded out once the map has drawn its first frame, but never before
// LOADING_SCREEN_MIN_MS from the page's start - and after LOADING_SCREEN_MAX_MS
// whatever happens, so a slow tile server never keeps the app hidden
{
  const LOADING_SCREEN_MIN_MS = 2000;
  const LOADING_SCREEN_MAX_MS = 15000;
  let hidden = false;
  const hide = () => {
    if (hidden || !loadingScreen) return;
    // performance.now() counts from the page's start
    const wait = LOADING_SCREEN_MIN_MS - performance.now();
    if (wait > 0) { setTimeout(hide, wait); return; }
    hidden = true;
    loadingScreen.classList.add('is-hidden');
    loadingScreen.addEventListener('transitionend', () => loadingScreen.remove(), { once: true });
  };
  setTimeout(hide, LOADING_SCREEN_MAX_MS);
  const waitForMap = () => {
    if (hidden) return;
    const map = window.GUIManager.olMap;
    if (map) map.once('rendercomplete', hide);
    else setTimeout(waitForMap, 100);
  };
  waitForMap();
}
