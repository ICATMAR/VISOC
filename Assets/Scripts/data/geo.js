// Small spherical-earth helpers for HF radar geometry (radial bins).

const EARTH_RADIUS_KM = 6371;
const toRad = deg => deg * Math.PI / 180;
const toDeg = rad => rad * 180 / Math.PI;

// The point `km` away from `site` ({ lat, lon }) heading `bearing` (degrees
// true): [lat, lon]. What a polar grid's range and bearing come to.
export function destination(site, bearing, km) {
  const d = km / EARTH_RADIUS_KM, b = toRad(bearing), lat1 = toRad(site.lat), lon1 = toRad(site.lon);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lon2 = lon1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [toDeg(lat2), toDeg(lon2)];
}

// Initial bearing from one point to another, degrees true
export function bearingBetween(lat1, lon1, lat2, lon2) {
  const p1 = toRad(lat1), p2 = toRad(lat2), dl = toRad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// The bearing pointing away from `site` at (lat, lon): the way back to the
// site, turned round - what a radial's "away from the antenna" means there
export function bearingAwayFrom(site, lat, lon) {
  return (bearingBetween(lat, lon, site.lat, site.lon) + 180) % 360;
}
