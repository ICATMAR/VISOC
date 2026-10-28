// How a buoy's readings become timeline cells - shared by every view that
// draws them (All platforms' buoys, the Buoys dashboard's views, the map's
// value chips), so one reading lands in the same cell with the same average,
// colour and arrow wherever it is shown.

// A value this many times past the top of a variable's range is discarded as a
// fault rather than averaged in (see binVariable).
export const OUT_OF_RANGE_FACTOR = 3;

// { '<ISO>': { code: point } } -> { code: { '<ISO>': point } }, which is the
// shape binVariable walks. The WHOLE point is kept, not just its value: each
// one carries the sensor, instrument and server it came from, and a cell
// lists whatever contributed to it.
export function byCode(data) {
  const result = {};
  Object.entries(data ?? {}).forEach(([timestamp, codes]) => {
    Object.entries(codes).forEach(([code, point]) => {
      if (result[code] == undefined) result[code] = {};
      result[code][timestamp] = point;
    });
  });
  return result;
}

// One variable's cells for one buoy: the mean of the magnitudes that fell
// in each, and the mean DIRECTION as a vector rather than a number -
// averaging 350º and 10º arithmetically gives 180º, which points exactly
// the wrong way. Weighted by the magnitude measured at the same moment,
// so a heading recorded in a flat calm doesn't drag the arrow around.
//
// `variable`: { code, directionCode?, range? }; `range` falls back to
// `fallbackRange` (the code's colour range, GUIManager.rangeFor) - a code
// with neither filters nothing. Cells: [Date], each `stepMs` long from
// `startTime`. Returns, per cell: { value, direction, from: [{ sensor,
// source, instrument }], raw: { code: published name } }.
export function binVariable(byCodeData, variable, cells, startTime, stepMs, fallbackRange) {
  // `raw` is what each code was PUBLISHED as by whoever served it (see
  // DPBuoys' rawName) - VHM0 arriving as Puertos' 'Hm0'. Kept per code, so
  // a magnitude and its direction can name their own spellings.
  const bins = cells.map(() => ({ count: 0, total: 0, x: 0, y: 0, directions: 0, from: new Map(), raw: {} }));
  const binOf = timestamp => {
    const index = Math.floor((new Date(timestamp).getTime() - startTime) / stepMs);
    return index >= 0 && index < bins.length ? bins[index] : undefined;
  };
  // Who contributed to a cell. A cell is an average over hours, so it can
  // mix sensors and servers - keyed by both so the same instrument served
  // by two servers is listed once per server, which is the distinction
  // that matters when a number looks wrong.
  const credit = (bin, point) => {
    if (point?.sensor == undefined && point?.source == undefined) return;
    bin.from.set(`${point.source}|${point.sensor}`, {
      sensor: point.sensor, source: point.source, instrument: point.instrument,
    });
  };

  // A reading far past the top of the legend's range is an instrument
  // fault, not weather - the SOMO logger writes 1000 m/s for a failed
  // anemometer (see SourceGithubSOMO), and one of those in a cell would
  // drag its average somewhere meaningless. Generous rather than tight:
  // three times the range still lets a genuinely extreme storm through.
  const range = variable.range ?? fallbackRange;
  const ceiling = range ? range[1] * OUT_OF_RANGE_FACTOR : Infinity;
  const magnitudes = {};
  const rejected = new Set();
  Object.entries(byCodeData?.[variable.code] ?? {}).forEach(([timestamp, point]) => {
    if (!isFinite(point?.value) || point.value > ceiling) { rejected.add(timestamp); return; }
    magnitudes[timestamp] = point;
  });

  Object.entries(magnitudes).forEach(([timestamp, point]) => {
    const bin = binOf(timestamp);
    if (!bin) return;
    bin.count++;
    bin.total += point.value;
    if (point.rawName) bin.raw[variable.code] = point.rawName;
    credit(bin, point);
  });

  if (variable.directionCode) {
    Object.entries(byCodeData?.[variable.directionCode] ?? {}).forEach(([timestamp, point]) => {
      const bin = binOf(timestamp);
      const degrees = point?.value;
      if (!bin || !isFinite(degrees)) return;
      // A heading recorded alongside a rejected magnitude goes with it:
      // the logger writes a perfectly plausible direction next to its
      // 1000 m/s fault marker, which is why SourceGithubSOMO drops the
      // whole wind block rather than just the speed.
      if (rejected.has(timestamp)) return;
      // Unweighted only where there is no magnitude to weight BY - not
      // where there was one and it was thrown away.
      const weight = isFinite(magnitudes[timestamp]?.value) ? magnitudes[timestamp].value : 1;
      const radians = degrees * Math.PI / 180;
      bin.x += Math.cos(radians) * weight;
      bin.y += Math.sin(radians) * weight;
      bin.directions++;
      if (point.rawName) bin.raw[variable.directionCode] = point.rawName;
      credit(bin, point);
    });
  }

  return bins.map(bin => ({
    value: bin.count ? bin.total / bin.count : undefined,
    direction: bin.directions && (bin.x || bin.y)
      ? ((Math.atan2(bin.y, bin.x) * 180 / Math.PI) + 360) % 360
      : undefined,
    from: [...bin.from.values()],
    raw: bin.raw,
  }));
}

// The compass bearing an arrow shows: where the wind/swell/water is GOING.
// WDIR and VMDR are reported as where it comes FROM (`fromDirection`), so
// they are turned around - a wind of 200º comes from the SSW and blows
// towards 20º. Draw it rotated by this minus 45 (fa-location-arrow points NE).
export function arrowBearing(direction, fromDirection) {
  if (direction == undefined) return undefined;
  return ((fromDirection ? direction + 180 : direction) % 360 + 360) % 360;
}

// The cells of [startDate, endDate) every `stepMs` - the columns
// DTTimelineGrid lays out from the same $gui values
export function cellsOf(startDate, endDate, stepMs) {
  const cells = [];
  for (let time = startDate.getTime(); time < endDate.getTime(); time += stepMs) cells.push(new Date(time));
  return cells;
}
