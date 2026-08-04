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

// Globals
window.MEDBBOX = {minLat: 30, minLon: -11, maxLat: 46, maxLon: 37}
window.NWMEDBBOX = {minLat: 38.5, minLon: -0.4, maxLat: 44, maxLon: 6.2}
window.WESTMEDBBOX = {minLat: 34.6, minLon: -5.8, maxLat: 44.6, maxLon: 16.5}

window.GUIManager = Vue.reactive(new GUIManager());
window.RequestsManager = new RequestsManager(); // Probably will delete, for now no use
window.DataService = new DataService(FetchManager);


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

// Global properties
app.config.globalProperties.$gui = window.GUIManager;
app.config.globalProperties.$requests = window.RequestsManager;
app.config.globalProperties.$dataService = window.DataService;
app.mount(document.body);