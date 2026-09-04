const fs = require("fs"), path = require("path");
const { JSDOM } = require(path.join(__dirname, "..", "..", "node_modules", "jsdom"));
const root = path.join(__dirname, "..", "..");

let html = fs.readFileSync(path.join(root,"index.html"), "utf8");
const css = fs.readFileSync(path.join(root,"css/style.css"), "utf8");
html = html.replace("</head>", "<style>" + css.replace(/<\/style>/gi, "<\\/style>") + "</style></head>");
const boot = `<script>
window.matchMedia = window.matchMedia || (q => ({ matches:false, media:q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }));
window.HTMLCanvasElement.prototype.getContext = window.HTMLCanvasElement.prototype.getContext || (() => null);
</script>`;
const files = ["js/config.js","js/audio.js","js/core.js","js/forest-data.js","js/rooms.js","js/puzzles.js","js/fx.js","js/mirror.js","js/main.js"];
for (const f of files) {
  const code = fs.readFileSync(path.join(root,f), "utf8").replace(/<\/script>/gi, "<\\/script>");
  html = html.replace(`<script src="${f}"></script>`, `<script>${code}</script>`);
}
html = html.replace("<body>", "<body>" + boot);
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
const w = dom.window, wait = ms => new Promise(r => setTimeout(r, ms)), ev = c => w.eval(c);
(async () => {
  await wait(200);
  const fail = []; const check = (n,c) => { console.log((c?"PASS":"FAIL")+"  "+n); if(!c) fail.push(n); };
  check("boot: menu visible", !w.document.getElementById("menu").classList.contains("hidden"));
  ev("Game.newGame()"); await wait(250);
  check("newGame on porch", ev("State.get().room") === "porch");
  const porch = ev(`(() => { const s = document.querySelector('#scene-holder svg'); return { fx: !!s.querySelector('#fx-root'), lights: s.querySelectorAll('#fx-lights .fx-light').length, forest: !!s.querySelector('#v_forest'), trees: s.querySelectorAll('#v_forest-trees > g').length }; })()`);
  check("porch FX + generated forest", porch.fx && porch.lights === 1 && porch.forest && porch.trees === 14);
  ev("State.setRoom('landing'); Rooms.render()"); await wait(60);
  check("landing left off / right on", ev("document.getElementById('nav-left').hidden === true && document.getElementById('nav-right').hidden === false"));
  ev("State.setRoom('hallway'); State.setFlag('act2',true); Rooms.render()");
  ev("Mirror.tap(); Mirror.tap(); Mirror.tap();"); await wait(30);
  check("mirror cracks on 3rd look", ev("State.flag('mirrorCracked') === true"));
  check("mirror dict 150", ev("Mirror.dict.length") === 150);
  ev("State.setRoom('kitchen'); Rooms.render()"); await wait(60);
  check("kitchen labels hidden", ev(`[...document.querySelectorAll('#scene-holder text[data-roomlabel]')].every(t => getComputedStyle(t).display === 'none')`));
  console.log(fail.length ? "FAILURES: "+fail.join(" | ") : "ALL CHECKS PASSED");
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error("ERR", e && e.stack || e); process.exit(1); });
