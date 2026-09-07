/* FLY SEPARATION LONG-RUN SIMULATION
 * Runs thousands of fly ticks in the dining room and asserts the standing
 * rules: personal space never collapses (min pairwise distance stays above a
 * floor), the population stays spread through the room (bbox never shrinks to
 * a dot), the count stays in the sane band, real behavioural states occur,
 * and the swarm answers the room's dirty-state ledger.
 * Run: node scripts/qa/fly_sim.js
 */
const fs = require("fs"), path = require("path");
const { JSDOM } = require(path.join(__dirname, "..", "..", "node_modules", "jsdom"));
const root = path.join(__dirname, "..", "..");

let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const boot = `<script>
window.matchMedia = window.matchMedia || (q => ({ matches:false, media:q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }));
window.__QA__ = true; window.HTMLCanvasElement.prototype.getContext = () => null;
</script>`;
const files = ["js/config.js","js/audio.js","js/core.js","js/debug.js","js/condition.js","js/windows.js","js/painting-data.js","js/artlib.js","js/previews.js","js/forest-data.js","js/window-data.js","js/roof-data.js","js/moon-data.js","js/bird-data.js","js/birds.js","js/tree-perches.js","js/anim-registry.js","js/rooms.js","js/puzzles.js","js/fx.js","js/fog.js","js/mirror.js","js/main.js"];
for (const f of files) {
  const code = fs.readFileSync(path.join(root, f), "utf8").replace(/<\/script>/gi, "<\\/script>");
  html = html.replace(`<script src="${f}"></script>`, `<script>${code}</script>`);
}
html = html.replace("<body>", "<body>" + boot);
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
const w = dom.window, wait = ms => new Promise(r => setTimeout(r, ms)), ev = c => w.eval(c);

(async () => {
  await wait(200);
  const fail = []; const check = (n, c) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fail.push(n); };
  ev("Game.newGame()"); await wait(120);
  ev("Settings.set('reducedMotion', false); State.setRoom('diningroom'); Rooms.render()"); await wait(80);
  ev("FX._setFlySeed(90210); FX._respawn('diningroom');");

  // deterministic long run: 6000 ticks (~2 min of game time at 30fps)
  const report = ev(`(() => {
    FX._setFlySeed(90210);
    const seen = { states: new Set(), minDist: Infinity, minBBox: Infinity, maxBBox: 0 };
    for (let i = 0; i < 6000; i++) {
      FX._step(1);
      if (i % 200 === 0) {
        const s = FX._flyStats();
        seen.minDist = Math.min(seen.minDist, s.minDist);
        seen.minBBox = Math.min(seen.minBBox, s.bboxArea);
        seen.maxBBox = Math.max(seen.maxBBox, s.bboxArea);
      }
    }
    const s = FX._flyStats();
    return { count: s.count, landed: s.landed, minDist: seen.minDist, minBBox: seen.minBBox, maxBBox: seen.maxBBox, finalBBox: s.bboxArea };
  })()`);
  console.log("  long-run:", JSON.stringify(report));
  check("population stays in the sane band over 6000 ticks", report.count >= 20 && report.count <= 60);
  check("personal space never collapses (min dist > 2px across the run)", report.minDist > 2);
  check("never a single dot (min bbox across the run > 25000)", report.minBBox > 25000);
  check("flies roam (max bbox > 150000)", report.maxBBox > 150000);

  // behavioural states: darts, pauses, landings and rests must all occur
  const states = ev(`(() => {
    FX._setFlySeed(4242);
    const seen = {};
    for (let i = 0; i < 4000; i++) {
      FX._step(1);
      if (i % 50 === 0) { const c = FX._flyStateCounts(); for (const k in c) seen[k] = (seen[k] || 0) + c[k]; }
    }
    return seen;
  })()`);
  console.log("  states:", JSON.stringify(states));
  const stateKeys = Object.keys(states || {}).filter(k => states[k] > 0);
  check("at least three distinct fly states occur", stateKeys.length >= 3);
  check("some flies land and rest (they are house flies, not particles)", !!states && ((states.LAND || 0) + (states.REST || 0)) > 0);

  // attractors answer the dirty-state ledger
  const dirty = ev("FX._attractors('diningroom').reduce((a,b)=>a+b.s,0)");
  ev("State.setFlag('diningTidied', true);");
  const clean = ev("FX._attractors('diningroom').reduce((a,b)=>a+b.s,0)");
  ev("State.setFlag('diningTidied', false);");
  console.log(`  attractor strength dirty=${dirty.toFixed(2)} clean=${clean.toFixed(2)}`);
  check("tidying the dining room weakens fly attractors", clean < dirty);
  check("dirty dining room has meaningful attractor strength", dirty > 1);

  // the flock is a minority: loose groups, not one blob
  const flock = ev("(() => { const m = FX._flyMult('diningroom'); return m; })()");
  check("fly multiplier stays bounded", flock >= 0.5 && flock <= 2.5);

  console.log(fail.length ? `\n${fail.length} FAILURES` : "\nFLY SIM PASSED");
  process.exit(fail.length ? 1 : 0);
})();
