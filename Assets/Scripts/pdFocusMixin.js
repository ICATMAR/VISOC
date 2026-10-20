// Platform details on short screens: the mini map is hidden there (see
// .pd-compact in styles/platformDetails.css), so the MAIN map goes to the
// platform instead - when the panel opens, when another platform is selected,
// and when the window becomes short with the panel already open.
//
// A component using it provides:
// - centerMainMap(): what "going to the platform" means for it (a point, a
//   network's extent, a trajectory)
// - a `mainMapFocusKey` computed: anything that changes when a different
//   platform is selected, null while there is none.
// It may also have a `map` (its mini map), which is resized when the layout
// switches, since it was laid out at zero size while hidden.
export default {
  computed: {
    compactFocusKey() {
      if (!this.$gui.isShortScreen || !this.$gui.isPlatformDetailOpen) return null;
      return this.mainMapFocusKey ?? null;
    },
  },
  watch: {
    compactFocusKey: {
      immediate: true,
      handler(key) {
        if (key != null) this.$nextTick(() => this.centerMainMap());
      },
    },
    '$gui.isShortScreen'() {
      this.$nextTick(() => this.map?.updateSize());
    },
  },
};
