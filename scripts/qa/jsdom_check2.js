const fs = require("fs"), path = require("path");
const { JSDOM } = require(path.join(__dirname, "..", "..", "node_modules", "jsdom"));
const root = path.join(__dirname, "..", "..");

let html = fs.readFileSync(path.join(root,"index.html"), "utf8");
const css = fs.readFileSync(path.join(root,"css/style.css"), "utf8");
html = html.replace("</head>", "<style>" + css.replace(/<\/style>/gi, "<\\/style>") + "</style></head>");
const boot = `<script>
window.matchMedia = window.matchMedia || (q => ({ matches:false, media:q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }));
window.HTMLCanvasElement.prototype.getContext = window.HTMLCanvasElement.prototype.getContext || (() => null);
// time-scaled clock: run every delay 20x faster so the flood timeline is testable
(function(){
  var o = window.setTimeout.bind(window);
  window.setTimeout = function(fn, d){ return o(fn, (d||0)/20); };
})();
</script>`;
const files = ["js/config.js","js/audio.js","js/core.js","js/rooms.js","js/puzzles.js","js/fx.js","js/mirror.js","js/main.js"];
for (const f of files) {
  const code = fs.readFileSync(path.join(root,f), "utf8").replace(/<\/script>/gi, "<\\/script>");
  html = html.replace(`<script src="${f}"></script>`, `<script>${code}</script>`);
}
html = html.replace("<body>", "<body>" + boot);
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
const w = dom.window, wait = ms => new Promise(r=>setTimeout(r,ms)), ev = c => w.eval(c);

(async () => {
  await wait(300);
  const fail = []; const check = (n,c) => { console.log((c?"PASS":"FAIL")+"  "+n); if(!c) fail.push(n); };
  const q = sel => ev(`document.querySelector('${sel}') !== null`);

  // --- dialogue: no "press enter" text, big key present, Enter skips ---
  check("no 'press Enter' hint", ev(`document.getElementById('dialogue').textContent.includes('press')`) === false);
  check("big key present", q("#dialogue-key"));
  ev("Settings.set('reducedMotion', true)");
  ev("Game.newGame()"); await wait(120);
  ev("Dialogue.say(['one','two','three'])");
  check("first line shows", ev("document.getElementById('dialogue-text').textContent") === "one");
  ev("window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
  check("Enter skips to line two", ev("document.getElementById('dialogue-text').textContent") === "two");
  ev("window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
  check("Enter skips to line three", ev("document.getElementById('dialogue-text').textContent") === "three");
  ev("window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
  check("Enter closes on last line", ev("document.getElementById('dialogue').classList.contains('hidden')"));

  // --- edge doors removed, hotspots + arrows intact ---
  ev("State.setRoom('kitchen'); Rooms.render()"); await wait(60);
  check("kitchen: no edge door visuals", ev("document.querySelectorAll('#v_ddoor,#v_back').length") === 0);
  check("kitchen: nav hotspots remain", q(".hotspot[data-hs=godining]") && q(".hotspot[data-hs=goback]"));
  check("kitchen: both arrows visible", ev("document.getElementById('nav-left').hidden===false && document.getElementById('nav-right').hidden===false"));
  ev("State.setRoom('hallway'); Rooms.render()"); await wait(60);
  check("hallway: kitchen doorway gone, front door kept", ev("document.querySelectorAll('#v_kdoor').length===0 && !!document.querySelector('#v_fdoor')"));
  check("hallway: gokitchen hotspot remains", q(".hotspot[data-hs=gokitchen]"));
  ev("State.setRoom('diningroom'); Rooms.render()"); await wait(60);
  check("dining: no edge door visual", ev("document.querySelectorAll('#v_dback').length") === 0);
  check("dining: feast + spoilt + garbage rendered", q("#v_feast") && q("#v_spoilt") && q("#v_garbage"));
  check("dining: no oval window glow", ev("document.querySelectorAll('#v_dwin ellipse').length") === 0);
  ev("State.setRoom('study'); Rooms.render()"); await wait(60);
  check("study: no edge door visual, hotspot remains", ev("document.querySelectorAll('#v_sback').length===0 && !!document.querySelector('.hotspot[data-hs=sback]')"));

  // --- kitchen tap flood timeline (scaled) ---
  ev("State.setRoom('kitchen'); State.setFlag('tapOn',false); Rooms.render()");
  ev("RoomActions.kitchen.tap()"); await wait(40);
  check("tap on: full stream", ev("document.querySelector('#v_tap').innerHTML.includes('dasharray')"));
  await wait(140); // ~2.5s scaled -> tapOverflow
  check("2.5s: sink overflows", ev("State.flag('tapOverflow')===true"));
  check("overflow: falling drops rendered", ev("document.querySelectorAll('#v_tap animate[attributeName=cy]').length>=3"));
  await wait(240); // ~7s -> house off
  check("7s: house turned tap off", ev("State.flag('tapHouseOff')===true && State.flag('tapOn')===false"));
  check("7s: floor water fast", ev("State.flag('wetFloor')===true && State.flag('tapFloodFast')===true"));
  ev("Rooms.render()");
  check("7s: no tap stream after off", ev("document.querySelector('#v_tap').innerHTML.includes('dasharray')") === false);
  check("7s: fast ripples on floor", ev("document.querySelectorAll('#v_puddle ellipse').length>=2"));
  await wait(160); // ~10s -> slow
  check("10s: spread settles", ev("State.flag('tapFloodFast')===false"));
  await wait(520); // ~20s -> drained
  check("20s: sink drained", ev("State.flag('tapDrained')===true && State.flag('tapOverflow')===false"));
  ev("Rooms.render()");
  check("20s: drips gone, water stays", ev("document.querySelectorAll('#v_tap animate[attributeName=cy]').length===0 && State.flag('wetFloor')===true"));
  await wait(1820); // ~56s -> evaporate
  check("56s: evaporated, moisture left", ev("State.flag('wetFloor')===false && State.flag('tapMoist')===true"));
  ev("Rooms.render()");
  check("moisture patch rendered", q("#v_moist"));
  await wait(520); // ~66s -> moisture gone
  check("66s: moisture gone", ev("State.flag('tapMoist')===false"));
  ev("Rooms.render()");
  check("no moisture after", ev("document.querySelectorAll('#v_moist').length===0"));

  // --- stove auto-off ---
  ev("State.setFlag('stoveOn',false); RoomActions.kitchen.stove()"); await wait(40);
  check("stove on", ev("State.flag('stoveOn')===true"));
  await wait(2020); // ~40s
  check("40s: house put stove out", ev("State.flag('stoveOn')===false && State.flag('stoveHouseOff')===true"));

  // --- dining tidy ---
  ev("State.setFlag('diningTidied',false); Rooms.goto('diningroom', null)"); await wait(40);
  check("dining mess present pre-tidy", q("#v_spoilt") && q("#v_garbage"));
  await wait(950); // ~18s
  check("18s: house removed mess", ev("State.flag('diningTidied')===true"));
  ev("Rooms.render()");
  check("spoilt + garbage removed from scene", ev("document.querySelectorAll('#v_spoilt,#v_garbage').length===0"));
  check("feast still present", q("#v_feast"));

  // --- no oval light glows remain anywhere ---
  ev(`["porch","hallway","kitchen","diningroom","landing","study","childroom","attic","basement","memory"].forEach(r => { State.setRoom(r); Rooms.render(); })`);
  const ovals = ev(`["porch","hallway","kitchen","diningroom","landing","study","childroom","attic","basement","memory"].reduce((n,r)=>{ State.setRoom(r); Rooms.render(); return n + document.querySelectorAll('#scene-holder ellipse[fill="url(#lampglow)"], #scene-holder ellipse[fill="url(#coldglow)"]').length; }, 0)`);
  check("no oval glow ellipses in any room", ovals === 0);

  console.log(fail.length ? "FAILURES: " + fail.join(" | ") : "ALL CHECKS PASSED");
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error("ERR", e && e.stack || e); process.exit(1); });
