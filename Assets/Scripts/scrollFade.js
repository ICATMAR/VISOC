// v-scroll-fade: marks a horizontally scrolling row with `can-scroll-left` /
// `can-scroll-right` while there is more of it hidden on that side, so CSS
// can fade that edge (see .pd-values-scroll in styles/platformDetails.css).
// Kept up to date as it scrolls, resizes, or its contents change.

const EPSILON_PX = 1; // sub-pixel rounding is not "more to scroll"

function update(el) {
  const max = el.scrollWidth - el.clientWidth;
  el.classList.toggle('can-scroll-left', el.scrollLeft > EPSILON_PX);
  el.classList.toggle('can-scroll-right', el.scrollLeft < max - EPSILON_PX);
}

export const scrollFade = {
  mounted(el) {
    const onChange = () => update(el);
    el._scrollFade = {
      onChange,
      resize: new ResizeObserver(onChange),
      // Chips come and go (another cell, another platform)
      mutation: new MutationObserver(onChange),
    };
    el.addEventListener('scroll', onChange, { passive: true });
    el._scrollFade.resize.observe(el);
    el._scrollFade.mutation.observe(el, { childList: true, subtree: true, characterData: true });
    update(el);
  },
  updated(el) {
    update(el);
  },
  unmounted(el) {
    const state = el._scrollFade;
    if (!state) return;
    el.removeEventListener('scroll', state.onChange);
    state.resize.disconnect();
    state.mutation.disconnect();
  },
};
