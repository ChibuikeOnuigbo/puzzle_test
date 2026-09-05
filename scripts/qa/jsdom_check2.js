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
const files = ["js/config.js","js/audio.js","js/core.js","js/forest-data.js","js/rooms.js","js/puzzles.js","js/fx.js","js/fog.js","js/mirror.js","js/main.js"];
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
  // --- generated forest on the porch ---
  check("porch: forest bg + far fog + near layer", q("#v_forest-far") && q("#v_forest-fog") && q("#v_forest-near"));
  check("porch: 14 generated trees", ev("document.querySelectorAll('#v_forest-trees > g').length") === 14);
  check("porch: reduced motion yields static trees", ev("document.querySelectorAll('#v_forest-trees animateTransform').length") === 0);
  ev("Settings.set('reducedMotion', false); Rooms.render()");
  check("porch: tree crown groups are pivotable", ev("document.querySelectorAll('#v_forest-trees animateTransform').length") >= 28);
  ev("Settings.set('reducedMotion', true); Rooms.render()");
  check("porch: roof shingles inside clip", ev("document.querySelectorAll('#v_roof [clip-path] line').length >= 20"));
  check("porch: eave shadow softened", ev("document.querySelector('#eaveshadow stop').getAttribute('stop-opacity') === '0.5'"));
  ev("Dialogue.say(['one','two','three'])");
  check("first line shows", ev("document.getElementById('dialogue-text').textContent") === "one");
  ev("window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
  check("Enter skips to line two", ev("document.getElementById('dialogue-text').textContent") === "two");
  ev("window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
  check("Enter skips to line three", ev("document.getElementById('dialogue-text').textContent") === "three");
  ev("window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
  check("Enter closes on last line", ev("document.getElementById('dialogue').classList.contains('hidden')"));

  // --- unrecorded mini-missions: transient, never saved ---
  check("mission helper defined", ev("typeof mission === 'function'"));
  ev("MiniMissions.onRoom('hallway')"); await wait(20);
  check("hallway mini-mission: turn on the light", ev("document.querySelectorAll('.mission-toast').length === 1"));
  ev("document.querySelectorAll('.mission-toast').forEach(t => t.remove())");
  ev("MiniMissions.lampOn()"); await wait(20);
  check("hallway mini-mission: check the clock", ev("document.querySelectorAll('.mission-toast').length === 1"));
  ev("document.querySelectorAll('.mission-toast').forEach(t => t.remove())");
  ev("MiniMissions.onRoom('hallway')"); await wait(20);
  check("mini-missions fire once per session", ev("document.querySelectorAll('.mission-toast').length === 0"));

  // --- edge doors removed, hotspots + arrows intact ---
  ev("State.setRoom('kitchen'); Rooms.render()"); await wait(60);
  check("kitchen: no edge door visuals", ev("document.querySelectorAll('#v_ddoor,#v_back').length") === 0);
  check("kitchen: nav hotspots remain", q(".hotspot[data-hs=godining]") && q(".hotspot[data-hs=goback]"));
  check("kitchen: both arrows visible", ev("document.getElementById('nav-left').hidden===false && document.getElementById('nav-right').hidden===false"));
  ev("State.setRoom('hallway'); Rooms.render()"); await wait(60);
  check("hallway: kitchen doorway re-added, front door removed", ev("!!document.querySelector('#v_kdoor') && document.querySelectorAll('#v_fdoor').length===0"));
  check("hallway: kitchen doorway shows objects through the opening", ev("document.querySelectorAll('#v_kdoor [clip-path]').length >= 1 && document.querySelectorAll('#v_kdoor rect').length >= 8"));
  check("hallway: gokitchen hotspot targets the doorway", q(".hotspot[data-hs=gokitchen][data-target=v_kdoor]"));
  check("hallway: way-out hotspot still present (nav keeps exit)", q(".hotspot[data-hs=leave]"));
  check("hallway lamp defaults off", ev("State.flag('hallLampOn') !== true"));
  check("hallway: mirror shadow small and strong", ev(`(() => { const s = document.querySelector('#v_mirror ellipse'); return s && parseFloat(s.getAttribute('rx')) <= 40 && parseFloat(s.getAttribute('opacity')) >= 0.4; })()`));
  check("hallway: lit mirror is clearer (lit glass gradient)", ev(`(() => { State.setFlag('hallLampOn', true); Rooms.render(); return document.querySelector('#v_mirror').innerHTML.includes('mirrorglass-lit'); })()`));
  ev("State.setFlag('hallLampOn', false); Rooms.render()");
  ev("State.setRoom('diningroom'); Rooms.render()"); await wait(60);
  check("dining: no edge door visual", ev("document.querySelectorAll('#v_dback').length") === 0);
  check("dining: feast + spoilt + garbage rendered", q("#v_feast") && q("#v_spoilt") && q("#v_garbage"));
  check("dining: no oval window glow", ev("document.querySelectorAll('#v_dwin ellipse').length") === 0);
  ev("State.setRoom('study'); Rooms.render()"); await wait(60);
  check("study: no edge door visual, hotspot remains", ev("document.querySelectorAll('#v_sback').length===0 && !!document.querySelector('.hotspot[data-hs=sback]')"));

  // --- kitchen tap flood timeline (scaled 20x): slow drips, slow-then-fast
  // spread, draining sink with a hold-then-sink delay, silent evaporation ---
  ev("State.setRoom('kitchen'); State.setFlag('tapOn',false); Rooms.render()");
  ev("RoomActions.kitchen.tap()"); await wait(40);
  check("tap on: full stream", ev("document.querySelector('#v_tap').innerHTML.includes('dasharray')"));
  await wait(420); // ~8s scaled -> tapOverflow (slow drips)
  check("8s: sink overflows", ev("State.flag('tapOverflow')===true"));
  check("overflow: slow falling drops rendered", ev("document.querySelectorAll('#v_tap animate[attributeName=cy]').length>=3"));
  check("overflow: drips ease in as they fall", ev("document.querySelector('#v_tap').innerHTML.includes('keySplines')"));
  await wait(520); // ~18s -> house off, spread starts SLOW
  check("18s: house turned tap off", ev("State.flag('tapHouseOff')===true && State.flag('tapOn')===false"));
  check("18s: floor water slow first", ev("State.flag('wetFloor')===true && State.flag('tapFloodFast')===false"));
  ev("Rooms.render()");
  check("18s: no tap stream after off", ev("document.querySelector('#v_tap').innerHTML.includes('dasharray')") === false);
  check("18s: slow ripple on floor", ev("document.querySelectorAll('#v_puddle ellipse').length===1"));
  await wait(300); // ~23s -> spread turns FAST
  check("23s: spread turns fast", ev("State.flag('tapFloodFast')===true"));
  ev("Rooms.render()");
  check("23s: fast ripples on floor", ev("document.querySelectorAll('#v_puddle ellipse').length>=2"));
  await wait(350); // ~29s -> settle
  check("29s: spread settles", ev("State.flag('tapFloodFast')===false"));
  // ~34s -> sink starts draining (holds, then sinks). The draining window is
  // narrow, and render overhead makes fixed waits flaky, so poll for it.
  let drainingSaw = false;
  for (let i = 0; i < 30 && !drainingSaw; i++) {
    await wait(20);
    drainingSaw = ev("State.flag('tapDrained')===true && State.flag('tapOverflow')===true");
  }
  check("34s: sink draining, drips still falling", drainingSaw);
  ev("Rooms.render()");
  check("34s: final drips rendered while draining", ev("document.querySelectorAll('#v_tap animate[attributeName=cy]').length>=2"));
  check("34s: basin holds then sinks", ev("document.querySelector('#v_tap').innerHTML.includes('0;0.35;1')"));
  let drainDone = false; // ~37.5s -> drips stop, floor keeps water
  for (let i = 0; i < 30 && !drainDone; i++) {
    await wait(20);
    drainDone = ev("State.flag('tapOverflow')===false");
  }
  check("37.5s: drips stopped", drainDone);
  ev("Rooms.render()");
  check("37.5s: drips gone, water stays", ev("document.querySelectorAll('#v_tap animate[attributeName=cy]').length===0 && State.flag('wetFloor')===true"));
  let evapSaw = false; // ~75s -> evaporate
  for (let i = 0; i < 150 && !evapSaw; i++) {
    await wait(20);
    evapSaw = ev("State.flag('wetFloor')===false && State.flag('tapMoist')===true");
  }
  check("75s: evaporated, moisture left", evapSaw);
  ev("Rooms.render()");
  check("moisture patch rendered", q("#v_moist"));
  let goneSaw = false; // ~85s -> moisture gone
  for (let i = 0; i < 50 && !goneSaw; i++) {
    await wait(20);
    goneSaw = ev("State.flag('tapMoist')===false");
  }
  check("85s: moisture gone", goneSaw);
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

  // --- conservatory: new room + persistent flies + manual torch ---
  ev("State.setRoom('conservatory'); Rooms.render()"); await wait(60);
  check("conservatory: gramophone secret hotspot", ev("!!document.querySelector('#v_gramophone') && !!document.querySelector('.hotspot[data-hs=gramophone]')"));
  check("conservatory: back arrow works", ev("document.getElementById('nav-left').hidden === false && document.getElementById('nav-left').dataset.hs === 'cback'"));
  check("conservatory: fog applied and dense", ev("Fog._count()") >= 60 && ev("document.querySelector('#fog-root') !== null"));
  ev("Settings.set('reducedMotion', false)");   // flies rest under reduced motion
  ev("State.setRoom('diningroom'); Rooms.render()"); await wait(80);
  const fliesN = ev("document.querySelectorAll('#fx-flies .fx-fly').length");
  check("dining: more than 300 flies", fliesN >= 300);
  ev("State.setFlag('hallLampOn', !State.flag('hallLampOn')); Rooms.render()"); await wait(40);
  check("dining: flies persist through a re-render", ev("document.querySelectorAll('#fx-flies .fx-fly').length") === fliesN);
  ev("State.addItem('torch'); State.setFlag('torchOn', false); State.setRoom('attic'); Rooms.render()"); await wait(40);
  check("attic: torch never automatic", ev("document.querySelector('#scene-holder #layer-front rect').getAttribute('mask') === null"));
  ev("Game.useSelected()");
  check("attic: E switches the torch on", ev("State.flag('torchOn') === true"));
  ev("State.setFlag('torchOn', false); State.setRoom('hallway'); State.setFlag('hasBag', true); State.bagPut('shard'); Game.refreshHUD()");
  check("inventory: five pockets bottom centre", ev("document.querySelectorAll('#pocket-bar .pocket').length") === 5);
  check("inventory: no top-left or top-right icon clutter", ev("document.getElementById('hud-right') === null && document.getElementById('inventory') === null"));

  // --- no oval light glows remain anywhere ---
  const ROOMS_ALL = ["porch","hallway","kitchen","diningroom","conservatory","landing","study","childroom","attic","basement","memory"];
  ev(`(${JSON.stringify(ROOMS_ALL)}).forEach(r => { State.setRoom(r); Rooms.render(); })`);
  const ovals = ev(`(${JSON.stringify(ROOMS_ALL)}).reduce((n,r)=>{ State.setRoom(r); Rooms.render(); return n + document.querySelectorAll('#scene-holder ellipse[fill="url(#lampglow)"], #scene-holder ellipse[fill="url(#coldglow)"]').length; }, 0)`);
  check("no oval glow ellipses in any room", ovals === 0);

  console.log(fail.length ? "FAILURES: " + fail.join(" | ") : "ALL CHECKS PASSED");
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error("ERR", e && e.stack || e); process.exit(1); });
