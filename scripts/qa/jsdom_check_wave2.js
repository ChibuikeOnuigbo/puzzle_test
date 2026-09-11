/* HOUSE 17 — wave-2 structural QA (jsdom): two-door fridge, kitchen bin,
   tap pour ramp + puddle growth, bathroom water/steam/towel, dining
   sitting-door removal. Run: node scripts/qa/jsdom_check_wave2.js */
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
const svgStr = () => ev(`(() => { const s = document.querySelector('#scene-holder svg'); return s ? s.outerHTML : ''; })()`);
(async () => {
  await wait(200);
  const fail = []; const check = (n, c) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fail.push(n); };
  ev("Game.newGame()"); await wait(150);

  /* ---------- dining: sitting-room door gone, left arrow carries it ---------- */
  ev("State.setRoom('diningroom'); Rooms.render()"); await wait(60);
  let s = svgStr();
  check("dining: no sitting-room door drawn", !s.includes('width="188" height="372"') && !s.includes('rotate(-2.5 460 460)'));
  check("dining: left arrow is the sitting-room exit", ev(`document.getElementById('nav-left').dataset.hs === 'gositting'`));
  check("dining: gositting hotspot hugs the left edge", ev(`(() => { const r = document.querySelector('.hotspot[data-hs="gositting"]'); return r && +r.getAttribute('x') === 0 && +r.getAttribute('width') <= 48; })()`));
  check("dining: sitting-room exit descriptor exists", ev(`EXIT_DESCRIPTORS.diningroom.some(d => d.id === 'diningroom_to_sittingroom')`));

  /* ---------- kitchen: two independent fridge doors ---------- */
  ev("State.setRoom('kitchen'); Rooms.render()"); await wait(60);
  s = svgStr();
  check("kitchen: freezer + fridge hotspots both present", s.includes('data-hs="freezer"') && s.includes('data-hs="fridge"'));
  check("kitchen: bin is interactive", s.includes('data-hs="bin"'));
  ev("State.setFlag('freezerOpen'); Rooms.render()"); await wait(40);
  s = svgStr();
  check("kitchen: freezer opens on its own hinge", s.includes("v_fridge") && ev(`typeof RoomActions.kitchen.freezer === 'function' && typeof RoomActions.kitchen.bin === 'function'`));
  ev("State.setFlag('freezerOpen', false); State.setFlag('fridgeOpen'); Rooms.render()"); await wait(40);
  s = svgStr();
  check("kitchen: milk visible when fridge leaf open", s.includes("v_milk"));
  check("kitchen: milk hotspot sits ABOVE door hotspots in paint order", ev(`(() => {
    const hs = [...document.querySelectorAll('.hotspot')];
    return hs.findIndex(e => e.dataset.hs === 'milk') > hs.findIndex(e => e.dataset.hs === 'fridge');
  })()`));
  ev("State.setFlag('fridgeOpen', false)");

  /* ---------- tap: pour ramps, puddle grows from droplets ---------- */
  ev("State.setFlag('tapOn'); Rooms.render()"); await wait(40);
  s = svgStr();
  const pour = s.slice(s.indexOf("x=\"642\" y=\"424\""));
  check("kitchen: tap stream has a width ramp (trickle -> pour)", /values="1\.6;7"/.test(pour));
  ev("State.setFlag('wetFloor'); Rooms.render()"); await wait(40);
  s = svgStr();
  check("kitchen: puddle grows from small (scale ramp)", /values="0\.18;1"/.test(s) && /type="scale"/.test(s));
  check("kitchen: floor droplets grow from r=0.4", /r="0\.4"/.test(s) && /values="0\.4;2\.6"/.test(s));
  ev("State.setFlag('wetFloor', false); State.setFlag('tapOn', false)");

  /* ---------- bathroom: water, steam, swinging towel ---------- */
  ev("State.setRoom('bathroom'); Rooms.render()"); await wait(60);
  s = svgStr();
  check("bathroom: tub water uses gradient fill", s.includes("url(#bwaterg)"));
  check("bathroom: waterline drawn BELOW the rim in z-order", s.indexOf("url(#bwaterg)") !== -1 && s.indexOf("url(#bwaterg)") < s.indexOf('fill="#7d848a"'));
  check("bathroom: water clipped to the basin shape", s.includes('clip-path="url(#bwater)"'));
  check("bathroom: glints live inside the water clip", /clip-path="url\(#bwater\)">[\s\S]*?bwater-glints|bwater[\s\S]{0,4000}opacity="0\.(?:1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9]|6[0-9])"/.test(s));
  check("bathroom: steam animates (rising wisps)", /<g opacity="0">\s*<animate attributeName="opacity" values="0;0\.22/.test(s));
  check("bathroom: towel carries its swing trigger", s.includes('id="towelsway"'));
  check("bathroom: towel is above the waterline visually", /id="towel-swing"/.test(s));

  /* ---------- moon: crescent has no visible occluder disc ---------- */
  check("moon: night side is translucent earthshine, not a solid disc", /opacity="0\.07"/.test(fs.readFileSync(path.join(root, "js/rooms.js"), "utf8")));

  console.log(fail.length ? `\n${fail.length} CHECK(S) FAILED` : "\nALL WAVE-2 CHECKS PASSED");
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
