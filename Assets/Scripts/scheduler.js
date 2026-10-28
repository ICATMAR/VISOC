// One clock for everything the app does every so often - the data products'
// refresh, the timeline's "now" line, any polling.
//
// Not a setTimeout / setInterval per task: browsers hold those back while the
// tab is hidden (at most once a second, after ~5 minutes once a minute), don't
// run requestAnimationFrame at all, and stop everything while a page is frozen
// or the computer sleeps - a task's timer then fires late, or only once it is
// next woken, and nothing catches up on its own when the user comes back.
//
// Instead each task has a DUE TIME on the real clock (Date.now), and one loop,
// 5 times a second, runs every task that is due. Coming back to the tab (and
// on focus, pageshow, back online) the loop runs at once: every task that ran
// out while away runs then - once, not once per missed turn. A task can ask to
// be left alone while the tab is hidden (the default: nobody is looking, and
// it runs on return anyway).
//
//   const cancel = scheduler.every('buoys:refresh', 5 * 60000, () => ..., { runNow: false, whileHidden: false });
//   cancel();

const TICK_MS = 200;

class Scheduler {

  constructor() {
    this.tasks = new Map(); // id -> { interval, run, due, whileHidden }
    this.started = false;
  }

  // Runs `run` every `intervalMs`, from now (or at once, with runNow). An id
  // already in use replaces that task. Returns a function that cancels it.
  every(id, intervalMs, run, { runNow = false, whileHidden = false } = {}) {
    this.tasks.set(id, { interval: intervalMs, run, whileHidden, due: Date.now() + (runNow ? 0 : intervalMs) });
    this.start();
    if (runNow) this.tick();
    return () => this.cancel(id);
  }

  cancel(id) {
    this.tasks.delete(id);
  }

  // Every task that is due, once; the next turn counted from now
  tick() {
    const now = Date.now();
    const hidden = typeof document !== 'undefined' && document.hidden;
    this.tasks.forEach((task, id) => {
      if (now < task.due || (hidden && !task.whileHidden)) return;
      task.due = now + task.interval;
      try {
        const result = task.run();
        result?.catch?.(error => console.error(`Scheduled task '${id}' failed:`, error));
      } catch (error) {
        console.error(`Scheduled task '${id}' failed:`, error);
      }
    });
  }

  start() {
    if (this.started) return;
    this.started = true;
    setInterval(() => this.tick(), TICK_MS);
    // Back to the page: what ran out while away, now
    const wake = () => this.tick();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    window.addEventListener('online', wake);
  }
}

export default new Scheduler();
