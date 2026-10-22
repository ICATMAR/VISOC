// v-drag-scroll: a horizontally scrolling row can be dragged with the mouse,
// as the platform details' value rows are. A click that ends a drag is
// swallowed, so letting go over a clickable value (a unit) doesn't act on it.

const DRAG_THRESHOLD_PX = 3;

export const dragScroll = {
  mounted(el) {
    const state = { dragging: false, moved: false, startX: 0, startScroll: 0 };
    state.onDown = event => {
      if (event.button !== 0) return;
      state.dragging = true;
      state.moved = false;
      state.startX = event.pageX;
      state.startScroll = el.scrollLeft;
      el.classList.add('is-dragging');
      event.preventDefault();
    };
    state.onMove = event => {
      if (!state.dragging) return;
      const dx = event.pageX - state.startX;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) state.moved = true;
      el.scrollLeft = state.startScroll - dx;
    };
    state.onUp = () => {
      if (!state.dragging) return;
      state.dragging = false;
      el.classList.remove('is-dragging');
    };
    state.onClick = event => {
      if (!state.moved) return;
      state.moved = false;
      event.stopPropagation();
      event.preventDefault();
    };
    el.addEventListener('mousedown', state.onDown);
    el.addEventListener('click', state.onClick, true);
    document.addEventListener('mousemove', state.onMove);
    document.addEventListener('mouseup', state.onUp);
    el._dragScroll = state;
  },
  unmounted(el) {
    const state = el._dragScroll;
    if (!state) return;
    el.removeEventListener('mousedown', state.onDown);
    el.removeEventListener('click', state.onClick, true);
    document.removeEventListener('mousemove', state.onMove);
    document.removeEventListener('mouseup', state.onUp);
  },
};
