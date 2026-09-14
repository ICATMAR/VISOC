const HOUR = 3600000;

// Time-range cache for observations, quantised into fixed blocks.
//
// The point of the blocks is not tidiness: asking for arbitrary ranges makes
// coverage impossible to keep straight. A timeline's end moves every second, so
// every poll would record a slightly different interval and the coverage list
// would shred into hundreds of near-identical slivers to merge, with a
// millisecond edge case at every boundary. Snapping every request to block
// boundaries turns "have I got this?" into a set lookup, and makes the request
// URLs stable, so FetchManager's own cache can collapse repeats for free.
//
// Two things are stored, and the difference matters: the POINTS, and which
// blocks have been COVERED. A block that was asked for and came back empty is
// covered - the buoy was simply out of the water - and without recording that
// separately it would be re-requested forever.
//
// Blocks are cut on the epoch, so they are UTC-aligned whatever the app is
// displaying (see GUIManager.timelineUseLocalTime) - the same instant must not
// land in two different blocks depending on a display toggle.
class BlockCache {

  // `rerequestHourWindowFromNow` is how far back the record is still allowed to
  // change: blocks ending inside it are never trusted and get re-asked, blocks
  // older than it are frozen and answered from memory with no request at all.
  // For buoys that window only has to cover the tip that is still filling; for
  // HF radar totals it has to cover the hours a late station's radials can take
  // to arrive and cause the totals to be regenerated.
  constructor({ blockHours = 24, rerequestHourWindowFromNow = 3 } = {}) {
    this.blockMs = blockHours * HOUR;
    this.rerequestHourWindowFromNow = rerequestHourWindowFromNow;

    // series key -> Map(block key -> { points: { '<ISO>': value }, fetchedAt })
    // An entry existing IS the coverage record; its points may be empty.
    this.series = new Map();
  }

  // The block a moment falls in, named by the block's own UTC start.
  blockKeyOf(date) {
    const time = date instanceof Date ? date.getTime() : new Date(date).getTime();
    return new Date(Math.floor(time / this.blockMs) * this.blockMs).toISOString();
  }

  blockEndOf(blockKey) {
    return new Date(new Date(blockKey).getTime() + this.blockMs);
  }

  // Every block touched by [startDate, endDate], in order.
  blocksInRange(startDate, endDate) {
    const keys = [];
    const last = new Date(endDate).getTime();
    for (let time = new Date(this.blockKeyOf(startDate)).getTime(); time <= last; time += this.blockMs) {
      keys.push(new Date(time).toISOString());
    }
    return keys;
  }

  // Whether a block can still change, and so may not be answered from memory.
  isHot(blockKey, now = Date.now()) {
    return this.blockEndOf(blockKey).getTime() > now - this.rerequestHourWindowFromNow * HOUR;
  }

  // Blocks of [startDate, endDate] that have to be requested: never covered, or
  // covered but still inside the re-request window.
  missingBlocks(series, startDate, endDate, now = Date.now()) {
    const blocks = this.series.get(series);
    return this.blocksInRange(startDate, endDate)
      .filter(key => !blocks?.has(key) || this.isHot(key, now));
  }

  // Consecutive blocks collapsed into the fewest spans that cover them, so a
  // gap at each end of an already-cached middle costs two requests rather than
  // one big one that re-fetches what is already held.
  static coalesce(blockKeys, blockMs) {
    const sorted = [...blockKeys].sort();
    const runs = [];
    sorted.forEach(key => {
      const run = runs[runs.length - 1];
      const startsHere = run && new Date(run.to).getTime() === new Date(key).getTime();
      if (startsHere) run.to = new Date(new Date(key).getTime() + blockMs).toISOString();
      else runs.push({ from: key, to: new Date(new Date(key).getTime() + blockMs).toISOString(), keys: [] });
      runs[runs.length - 1].keys.push(key);
    });
    return runs.map(run => ({ from: new Date(run.from), to: new Date(run.to), keys: run.keys }));
  }

  coalesceBlocks(blockKeys) {
    return BlockCache.coalesce(blockKeys, this.blockMs);
  }

  // Records points and marks their blocks covered. `blockKeys` is what was
  // ASKED for, so blocks that produced nothing are still marked - that is the
  // negative half of the cache, and the reason an empty period isn't requested
  // again forever.
  write(series, blockKeys, points) {
    if (!this.series.has(series)) this.series.set(series, new Map());
    const blocks = this.series.get(series);
    const fetchedAt = Date.now();

    blockKeys.forEach(key => blocks.set(key, { points: {}, fetchedAt }));
    Object.entries(points ?? {}).forEach(([timestamp, value]) => {
      const key = this.blockKeyOf(timestamp);
      if (!blocks.has(key)) blocks.set(key, { points: {}, fetchedAt });
      blocks.get(key).points[timestamp] = value;
    });
  }

  // Everything held for [startDate, endDate], across the blocks it spans.
  read(series, startDate, endDate) {
    const blocks = this.series.get(series);
    if (!blocks) return {};

    const from = new Date(startDate).getTime();
    const to = new Date(endDate).getTime();
    const points = {};
    this.blocksInRange(startDate, endDate).forEach(key => {
      Object.entries(blocks.get(key)?.points ?? {}).forEach(([timestamp, value]) => {
        const time = new Date(timestamp).getTime();
        if (time >= from && time <= to) points[timestamp] = value;
      });
    });
    return points;
  }

  clear() {
    this.series.clear();
  }

}

export default BlockCache;
