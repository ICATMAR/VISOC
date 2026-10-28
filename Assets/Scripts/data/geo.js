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

// Great-circle distance between two points, km
export function distanceKm(lat1, lon1, lat2, lon2) {
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// Where a radial bin is from its antenna: { range (km), bearing (degrees
// true), computed, rangeCell }. `rangeCell` is the bin's range cell (SPRC),
// when its source numbered it (see MapLayerHFRRadials). A polar dataset (RNGE/BEAR axes) says so itself; one
// gridded in latitude/longitude doesn't, and the range and bearing are then
// worked out from the station's position (`computed`). Undefined if neither
// is known.
export function radialRangeBearing(point) {
  if (point?.axisNames?.[0] === 'RNGE' && isFinite(point.a) && isFinite(point.b))
    return { range: point.a, bearing: point.b, computed: false, rangeCell: point.rangeCell };
  const site = point?.site;
  if (!site || !isFinite(site.lat) || !isFinite(site.lon) || !isFinite(point.lat) || !isFinite(point.lon)) return undefined;
  return {
    range: distanceKm(site.lat, site.lon, point.lat, point.lon),
    bearing: bearingBetween(site.lat, site.lon, point.lat, point.lon),
    computed: true,
    rangeCell: point.rangeCell,
  };
}
