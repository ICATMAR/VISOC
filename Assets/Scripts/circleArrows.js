// What MapCircleArrows draws for a selected buoy reading - shared by the
// platform detail's mini map and, on short screens, the main map (see
// MapOverlayPlatformArrows.vue).
//
// `selection` is GUIManager.selectedPlatform as the buoys timeline fills it:
// standard values by code, plus `from` (sensor and server per code) and `raw`
// (the names the source published them under), which end up in the tooltips.
// No `?? 0` on the extra readings, unlike the directions: a bearing of 0 is due
// north and the arrow needs a number either way, but a gust or period of 0 is
// not a measurement, and the tooltip drops what is missing rather than
// printing it as zero.
export function buoyCircleArrows(selection) {
  const p = selection;
  return {
    wind:    p?.WSPD != null ? { speed: p.WSPD, dir: p.WDIR ?? 0, gust: p.GSPD, from: p.from?.WSPD, raw: p.raw } : null,
    waves:   p?.VHM0 != null ? { height: p.VHM0, dir: p.VMDR ?? 0, period: p.VTM02, from: p.from?.VHM0, raw: p.raw } : null,
    current: p?.HCSP != null ? { speed: p.HCSP, dir: p.HCDT ?? 0, from: p.from?.HCSP, raw: p.raw } : null,
  };
}
