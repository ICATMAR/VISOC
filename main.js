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

window.GUIManager = Vue.reactive(new GUIManager());


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
app.mount(document.body);