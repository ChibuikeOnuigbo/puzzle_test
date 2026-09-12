/* NAV / TOOLTIP AUDIT
 * For every room, verifies that the rendered edge arrows and their hover
 * tooltips agree with EXIT_DESCRIPTORS (the single source of truth), and that
 * the hallway's left arrow means "go OUTSIDE", never "kitchen".
 * Run: node scripts/qa/nav_audit.js
 */
const fs = require("fs"), path = require("path");
const { JSDOM } = require(path.join(__dirname, "..", "..", "node_modules", "jsdom"));
const root = path.join(__dirname, "..", "..");

let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
html = html.replace("</head>", "<style>" + css.replace(/<\/style>/gi, "<\\/style>") + "</style></head>");
const boot = `<script>
window.matchMedia = window.matchMedia || (q => ({ matches:false, media:q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }));
window.HTMLCanvasElement.prototype.getContext = window.HTMLCanvasElement.prototype.getContext || (() => null);
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

  // expectations for the DEFAULT fresh-game state, derived by hand from the
  // design doc (NOT from config, so config drift would be caught here too).
  const EXPECT = {
    porch: {},
    hallway: { left: "leave", right: "goup" },
    kitchen: { left: "godining", right: "goback" },
    diningroom: { left: "gositting", right: "dback" },
    sittingroom: { right: "sitback" },
    landing: { left: "gogallery", right: "godown" },
    gallery: { right: "gback" },
    bathroom: { left: "bback" },
    suite: { left: "suback" },
    washroom: { left: "wback" },
    steamroom: { left: "stback" },
    lavatory: { left: "lvback" },
    study: { left: "sback" },
    childroom: { right: "cback" },
    attic: { right: "aback" },
    basement: { left: "goup" },
    conservatory: { left: "cback" },
    memory: {},
  };

  for (const room of Object.keys(EXPECT)) {
    ev(`State.setRoom('${room}'); Rooms.render()`); await wait(40);
    const got = ev(`(() => {
      const out = {};
      for (const side of ["left", "right"]) {
        const el = document.getElementById("nav-" + side);
        if (!el || el.hidden) continue;
        out[side] = { hs: el.dataset.hs, tip: el.dataset.tip || "" };
      }
      return out;
    })()`);
    const want = EXPECT[room];
    const sides = new Set([...Object.keys(want), ...Object.keys(got)]);
    for (const side of sides) {
      const whs = want[side], g = got[side];
      if (!whs) { check(`${room}: no ${side} arrow`, !g); continue; }
      check(`${room}: ${side} arrow = ${whs}`, !!g && g.hs === whs);
      const tip = ev(`(() => { const d = exitDescriptor('${room}','${side}'); return d ? d.tooltip : ""; })()`);
      check(`${room}: ${side} tooltip matches descriptor ("${tip}")`, !!g && g.tip === tip && tip.length > 0);
    }
  }

  // the critical regression: hallway left must route OUTSIDE
  ev("State.setRoom('hallway'); Rooms.render()"); await wait(40);
  check("hallway left arrow leaves the house (not kitchen)", ev("document.getElementById('nav-left').dataset.hs") === "leave");
  ev("document.getElementById('nav-left').dispatchEvent(new MouseEvent('click', {bubbles:true}))"); await wait(1400);
  // clicking the exit arrow raises the leaving-the-house dialogue: the arrow
  // means OUTSIDE, and the house acknowledges it (story keeps the player).
  check("hallway left arrow raises the leaving-house dialogue", ev("(() => { const t = document.getElementById('dialogue-text'); return t && /leave|front door|notebook|outside/i.test(t.textContent); })()"));

  // no arrow may ever be placed at the extreme screen edge over a doorway:
  // arrows are the only edge UI, doors stay inside DOOR_SAFE margins.
  check("DOOR_SAFE keeps doors off the 1280x720 edges", ev("DOOR_SAFE.minX >= 120 && DOOR_SAFE.maxX <= 1160 && DOOR_SAFE.minY >= 60 && DOOR_SAFE.maxY <= 680"));

  console.log(fail.length ? `\n${fail.length} FAILURES` : "\nNAV AUDIT PASSED");
  process.exit(fail.length ? 1 : 0);
})();
