// ============================================================================
// Mockup drifter data generator for the DERIVA-1 exercise.
//
// Follows the SOCAT drifters ERDDAP schema:
//   deployment_id, buoy_name, drifter_type, time, institution, project,
//   pi_name, exercise, latitude, longitude, temperature
//   (https://erddap.icatmar.cat/erddap/tabledap/socat_data_drifters_ICATMAR.html)
//
// Drifters are Lagrangian: they drift WITH the surface current, so the current
// velocity is taken directly from the (random-walk) velocity used to advance
// each position — trajectory and current stay physically consistent.
//
// Only the last `latestDaysRange` days are ever requested, so trajectories are
// generated for that window only. Native cadence: CODE every 15 min, others
// hourly. The DataTimeline consumes an hourly resample; the maps use the full
// native-cadence trajectory.
// ============================================================================

// Deterministic PRNG (LCG) so a drifter renders the same trajectory all session.
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Bearing (degrees, "to" direction) of a velocity vector (u = east, v = north).
function velocityBearing(u, v) {
  let deg = Math.atan2(u, v) * 180 / Math.PI; // atan2(east, north) → clockwise from N
  return (deg + 360) % 360;
}

const METERS_PER_DEG_LAT = 111320;

// Generate a native-cadence trajectory over [startDate, endDate - lastHoursAgo].
// Returns an array of points: { t: Date, lat, lon, temp, cspd (m/s), cdir (deg to) }.
export function generateDrifterTrajectory(drifter, startDate, endDate) {
  const rng = makeRng(drifter.seed);
  const stepMin = drifter.type === 'CODE' ? 15 : 60;
  const stepMs = stepMin * 60 * 1000;
  const dtSec = stepMin * 60;

  // Stop generating `lastHoursAgo` before the end (simulates delayed / lost drifters).
  const endMs = endDate.getTime() - (drifter.lastHoursAgo || 0) * 3600 * 1000;

  let lon = drifter.startLon;
  let lat = drifter.startLat;

  // Slowly varying surface velocity (m/s), mean-reverting random walk.
  let u = (rng() - 0.5) * 0.3;
  let v = (rng() - 0.5) * 0.3;

  // Temperature base: cooler for deeper drogues (SVP @15 m), seasonal-ish.
  const tempBase = 21 - (drifter.depth >= 15 ? 1.5 : 0);

  const points = [];
  for (let t = startDate.getTime(); t <= endMs; t += stepMs) {
    // Update velocity: mean-revert toward 0 with random forcing, clamp magnitude.
    u = u * 0.96 + (rng() - 0.5) * 0.12;
    v = v * 0.96 + (rng() - 0.5) * 0.12;
    const speed = Math.hypot(u, v);
    if (speed > 1.1) { u *= 1.1 / speed; v *= 1.1 / speed; }

    const cspd = Math.hypot(u, v);
    const cdir = velocityBearing(u, v);
    const temp = tempBase + Math.sin(t / (3600 * 1000 * 26)) * 1.2 + (rng() - 0.5) * 0.4;

    points.push({ t: new Date(t), lat, lon, temp, cspd, cdir });

    // Advance position by this velocity over one step.
    const dLat = (v * dtSec) / METERS_PER_DEG_LAT;
    const dLon = (u * dtSec) / (METERS_PER_DEG_LAT * Math.cos(lat * Math.PI / 180));
    lat += dLat;
    lon += dLon;
  }
  return points;
}

// Resample a native-cadence trajectory to an hourly series indexed from
// startDate (index i ↔ startDate + i hours). Missing hours are null.
export function resampleDrifterHourly(traj, startDate, totalHours) {
  const out = {
    lat: new Array(totalHours).fill(null),
    lon: new Array(totalHours).fill(null),
    TEMP: new Array(totalHours).fill(null),
    HCSP: new Array(totalHours).fill(null),
    HCDT: new Array(totalHours).fill(null),
  };
  const startMs = startDate.getTime();
  for (const p of traj) {
    const hi = Math.round((p.t.getTime() - startMs) / (3600 * 1000));
    if (hi < 0 || hi >= totalHours || out.lat[hi] != null) continue;
    out.lat[hi] = p.lat;
    out.lon[hi] = p.lon;
    out.TEMP[hi] = p.temp;
    out.HCSP[hi] = p.cspd;
    out.HCDT[hi] = p.cdir;
  }
  return out;
}
