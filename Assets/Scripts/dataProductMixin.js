// Vue mixin factory: calls a component method whenever a data product says
// its data changed (DataProduct.changed - new hours found by its refresh),
// with the change's detail. The product does the looking, once for every
// view; a view only says what to do about it - reload what it shows, keeping
// what the user picked.
//
// Usage (a global, like pollMixin - see main.js):
//   export default {
//     mixins: [dataProductMixin({ hfrtotals: 'onTotalsChanged' })],
//     methods: { onTotalsChanged(detail) { ... } },
//   }
// Keys are DataService's product names ($dataService.hfrtotals...).
export default function dataProductMixin(handlers) {
  return {
    mounted() {
      this._productListeners = Object.entries(handlers).map(([name, method]) => {
        const product = this.$dataService[name];
        const listener = event => this[method](event.detail);
        product?.changes?.addEventListener('change', listener);
        return { product, listener };
      });
    },
    beforeUnmount() {
      (this._productListeners ?? []).forEach(({ product, listener }) => product?.changes?.removeEventListener('change', listener));
    },
  };
}
