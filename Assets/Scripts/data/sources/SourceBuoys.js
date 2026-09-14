import Source from './Source.js';

// Shared base for every source that discovers BUOYS rather than one dataset -
// the ERDDAP servers, the MSM API and the SOMO repository. What they have in
// common is `buoys`, an array of:
//
//   { id, name?, latitude?, longitude?, institution?, acknowledgement?,
//     license?, startDate?, endDate?, sensors: [...] }
//
// with each sensor:
//
//   { id, variables?, metadata?, startDate?, endDate? }
//
// That's the shape DPBuoys merges across sources: the same buoy is usually
// covered by several of them, each knowing a different part of it (one has the
// historical range, another only how fresh the data is, another the position).
// Every field except `id` and `sensors` is optional for that reason - a source
// only fills in what it actually knows, and leaves the rest undefined instead
// of guessing.
class SourceBuoys extends Source {

  constructor({ fetchManager }) {
    super({ fetchManager });

    // Array of buoys (see above). Filled in by each subclass' load().
    this.buoys = [];

    // Whether this source implements getBuoyData() - some only discover which
    // buoys exist and how fresh they are. Set to true by the ones that do, so
    // DPBuoys can tell them apart without calling and catching.
    this.servesData = false;

    // How long a coverage check (see getEndDate) is trusted before the server
    // is asked again. Subclasses override where their own check is cheaper or
    // dearer than this.
    this.coverageTTLMinutes = 5;
    // When the coverage dates last came from the server. Each subclass' load()
    // sets it, since loading is itself a coverage check.
    this.coverageCheckedAt = undefined;
  }

  // Earliest start and latest end among a list of entries (buoys or sensors -
  // both carry startDate/endDate). Either end can come back undefined: a
  // source may know when a buoy last reported without knowing when it started.
  static dateRangeOf(entries) {
    const startDates = entries.map(e => e.startDate).filter(Boolean);
    const endDates = entries.map(e => e.endDate).filter(Boolean);
    return {
      startDate: startDates.length ? new Date(Math.min(...startDates)) : undefined,
      endDate: endDates.length ? new Date(Math.max(...endDates)) : undefined,
    };
  }

  // Earliest start and latest end across every buoy this source covers - each
  // may have started/stopped reporting at a different time.
  dateRange() {
    return SourceBuoys.dateRangeOf(this.buoys);
  }

  getBuoy(id) {
    return this.buoys.find(buoy => buoy.id === id);
  }

  // The latest timestamp this source can currently serve, re-asking the server
  // when the last answer has gone stale (coverageTTLMinutes). Asked BEFORE the
  // data itself: which source is worth requesting a given period from is a
  // question about how far each one actually reaches right now, not an
  // assumption about which one is "the historical one" or "the live one" -
  // those roles change, and a source that has fallen behind should lose on the
  // measurement rather than on a hardcoded rule.
  //
  // Refreshing also updates the per-buoy and per-sensor dates, which is what
  // DPBuoys' planning actually reads.
  async getEndDate() {
    await this.loadingPromise?.catch(() => {}); // the initial load is itself a coverage check
    const fresh = this.coverageCheckedAt != undefined
      && Date.now() - this.coverageCheckedAt < this.coverageTTLMinutes * 60000;
    if (!fresh) {
      await this.refreshCoverage();
      this.coverageCheckedAt = Date.now();
    }
    return this.endDate;
  }

  // Re-reads how far this source reaches, as cheaply as it can (one request
  // that covers every buoy, where the server allows it). Subclasses that can
  // do this implement it; the default leaves whatever load() found in place.
  async refreshCoverage() {}

  // Subclasses that can serve measurements implement this: the rows for one
  // buoy within [startDate, endDate], keyed by timestamp and then by sensor -
  // { '<ISO timestamp>': { '<SENSOR>': { <variable>: value } } }. Values are
  // returned RAW, exactly as the source publishes them (no unit scaling, no
  // renaming to standard codes) - that's DataProduct's job, via the catalogue's
  // `mapping`.
  async getBuoyData(buoyId, startDate, endDate) { throw new Error('getBuoyData() not implemented'); }

}

export default SourceBuoys;
