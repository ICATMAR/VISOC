// Vue mixin factory: calls `methodName` on the component once immediately,
// then again every `intervalMinutes`, and stops the timer when the component
// unmounts. Mixins are how Options API shares this kind of behaviour across
// components (Composition API would use a composable instead) - Vue merges a
// mixin's lifecycle hooks alongside the component's own, running the mixin's
// first, rather than one replacing the other, so this doesn't interfere with
// whatever the component's own created()/beforeUnmount() already do.
//
// The actual network-level de-duplication (not re-fetching if the previous
// response is still fresh) is FetchManager's job, not this mixin's - it just
// re-asks on a schedule; whether that turns into a real request depends on
// the TTL the data source itself was fetched with.
//
// Usage:
//   import pollMixin from '.../Assets/Scripts/pollMixin.js';
//   export default {
//     mixins: [pollMixin('refreshData', 5)],
//     methods: { refreshData() { ... } },
//   }
export default function pollMixin(methodName, intervalMinutes) {
  return {
    created() {
      this[methodName]();
      this._pollTimer = setInterval(() => this[methodName](), intervalMinutes * 60000);
    },
    beforeUnmount() {
      clearInterval(this._pollTimer);
    },
  };
}
