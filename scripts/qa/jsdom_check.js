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
const files = ["js/config.js","js/audio.js","js/core.js","js/forest-data.js","js/window-data.js","js/roof-data.js","js/moon-data.js","js/bird-data.js","js/birds.js","js/rooms.js","js/puzzles.js","js/fx.js","js/fog.js","js/mirror.js","js/main.js"];
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
  const fog0 = ev(`(() => { const s = document.querySelector('#scene-holder svg'); return !!s.querySelector('#fog-root') && Fog._count() > 0 && Fog._room() === 'porch'; })()`);
  check("fog engine applied on the porch", fog0);
  check("fog subsystems render (shafts, ribbons, motes, curls)", ev("Fog._shafts() >= 1 && Fog._ribbons() >= 1 && Fog._motes() >= 5 && Fog._curls() >= 2"));
  check("fog shafts are polygons, never ovals", ev("document.querySelectorAll('#fog-root .fog-shaft ellipse').length") === 0);
  check("fog engine is a >2000 line complex system", fs.readFileSync(path.join(root, "js", "fog.js"), "utf8").split("\n").length > 2000);
  ev("State.setRoom('landing'); Rooms.render()"); await wait(60);
  check("landing left arrow now opens the back landing", ev("document.getElementById('nav-left').hidden === false && document.getElementById('nav-left').dataset.hs === 'gogallery'"));
  check("landing right still goes down", ev("document.getElementById('nav-right').dataset.hs === 'godown'"));
  ev("State.setRoom('hallway'); State.setFlag('act2',true); Rooms.render()");
  ev("Mirror.tap(); Mirror.tap(); Mirror.tap();"); await wait(30);
  check("mirror cracks on 3rd look", ev("State.flag('mirrorCracked') === true"));
  check("mirror dict 150", ev("Mirror.dict.length") === 150);
  ev("State.setRoom('kitchen'); Rooms.render()"); await wait(60);
  check("kitchen labels hidden", ev(`[...document.querySelectorAll('#scene-holder text[data-roomlabel]')].every(t => getComputedStyle(t).display === 'none')`));

  // --- conservatory: new room, fog-forward ---
  ev("State.setRoom('conservatory'); Rooms.render()"); await wait(60);
  check("conservatory renders gramophone + back hotspot", ev("!!document.querySelector('#v_gramophone') && !!document.querySelector('.hotspot[data-hs=cback]')"));
  check("conservatory left arrow visible", ev("document.getElementById('nav-left').hidden === false"));
  check("conservatory fog present but thinned", ev("Fog._count()") >= 40 && ev("Fog._count()") < 160);
  // --- the back landing: new room between the corridor, the glasshouse and the dining room ---
  ev("State.setRoom('gallery'); Rooms.render()"); await wait(60);
  check("gallery renders both wrong doors", ev("!!document.querySelector('#v_gcons') && !!document.querySelector('#v_gbath')"));
  check("gallery right arrow returns to the corridor", ev("document.getElementById('nav-right').dataset.hs === 'gback'"));
  check("gallery is in the house graph", ev("(HOUSE_GRAPH.gallery || []).join(',')") === "landing,conservatory,bathroom");
  check("bathroom hangs off the gallery only", ev("(HOUSE_GRAPH.bathroom || []).join(',')") === "gallery");
  check("dining no longer touches the gallery", ev("(HOUSE_GRAPH.diningroom || []).join(',')") === "kitchen");
  // --- outside fog must keep the middle of the frame clear ---
  ev("State.setRoom('porch'); Rooms.render()"); await wait(60);
  check("porch fog keeps mid screen clear", ev("Math.max(...Fog._blobs().filter(b => b.y > 330 && b.y < 520).map(b => b.o), 0)") <= 0.03);
  check("porch floor fog capped at 0.2", ev("Math.max(...Fog._blobs().filter(b => b.y > 560).map(b => b.o), 0)") <= 0.2001);

  // --- persistent flies: >300 in the dining room, surviving re-renders ---
  ev("State.setRoom('diningroom'); Rooms.render()"); await wait(80);
  const flyN = ev("document.querySelectorAll('#fx-flies .fx-fly').length");
  check("dining room keeps a big fly population", flyN >= 150);
  check("fly populations are rolled per room, some scarce some swarming", ev(`(() => { const rs = ["hallway","kitchen","study","attic","basement","childroom","porch","conservatory","gallery"]; const m = rs.map(r => FX._flyMult(r)); return Math.max(...m) / Math.min(...m) >= 2; })()`));
  ev("Rooms.render()"); await wait(30);
  check("flies persist across a re-render", ev("document.querySelectorAll('#fx-flies .fx-fly').length") === flyN);

  // --- torch is manual: never automatic ---
  ev("State.setFlag('torchOn', false); State.addItem('torch'); State.setRoom('attic'); Rooms.render()"); await wait(40);
  check("attic: torch off means full dark (no mask)", ev("document.querySelector('#scene-holder #layer-front rect').getAttribute('mask') === null"));
  ev("State.setFlag('torchOn', true); Rooms.render()"); await wait(40);
  check("attic: torch on cuts the beam out", ev("document.querySelector('#scene-holder #layer-front rect').getAttribute('mask') === 'url(#torchmask)'"));
  ev("State.setFlag('torchOn', false); State.setRoom('hallway'); Rooms.render()");

  // --- selected tool + the E key ---
  check("torch is the selected tool", ev("State.selected()") === "torch");
  ev("Game.useSelected()");
  check("E uses the selected tool", ev("State.flag('torchOn') === true"));
  ev("State.setFlag('torchOn', false)");

  // --- inventory: 5 pockets bottom centre + hand slot ---
  ev("State.setFlag('hasBag', true); State.bagPut('pen'); Game.refreshHUD()");
  check("pocket bar has exactly 5 slots", ev("document.querySelectorAll('#pocket-bar .pocket').length") === 5);
  check("hand slot shows the selected item", ev("document.getElementById('hand-slot').classList.contains('hidden') === false"));
  ev("Game.openInventory()"); await wait(30);
  check("full inventory opens (I)", ev("document.querySelectorAll('.popup-panel').length >= 1 && document.querySelectorAll('.inv-tool').length >= 1"));
  ev("Popups.closeAll()");

  // --- hint button glows when the player is stuck ---
  ev("for(let i=0;i<23;i++) Game.noteClick(); Game.refreshHUD();");
  check("hint button glows when confused", ev("document.getElementById('btn-hint').classList.contains('glow') === true"));
  ev("Game.openHints()");
  check("opening hints settles the confusion", ev("document.getElementById('btn-hint').classList.contains('glow') === false"));
  ev("Popups.closeAll()");

  console.log(fail.length ? "FAILURES: "+fail.join(" | ") : "ALL CHECKS PASSED");
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error("ERR", e && e.stack || e); process.exit(1); });
