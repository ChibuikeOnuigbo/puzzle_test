/* OPEN/CLOSE REVERSIBILITY AUDIT
 * Standing rule: ANY object that can open must have a valid close state.
 * Each entry below clicks the real hotspot, asserts the open flag + a visibly
 * different scene, clicks again and asserts the flag returns and the scene
 * matches the closed rendering again.
 * Run: node scripts/qa/open_close.js
 */
const fs = require("fs"), path = require("path");
const { JSDOM } = require(path.join(__dirname, "..", "..", "node_modules", "jsdom"));
const root = path.join(__dirname, "..", "..");

let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const boot = `<script>
window.matchMedia = window.matchMedia || (q => ({ matches:false, media:q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }));
window.HTMLCanvasElement.prototype.getContext = () => null;
</script>`;
const files = ["js/config.js","js/audio.js","js/core.js","js/debug.js","js/condition.js","js/windows.js","js/painting-data.js","js/artlib.js","js/previews.js","js/forest-data.js","js/window-data.js","js/roof-data.js","js/moon-data.js","js/bird-data.js","js/birds.js","js/tree-perches.js","js/anim-registry.js","js/rooms.js","js/puzzles.js","js/fx.js","js/fog.js","js/mirror.js","js/main.js"];
for (const f of files) {
  const code = fs.readFileSync(path.join(root, f), "utf8").replace(/<\/script>/gi, "<\\/script>");
  html = html.replace(`<script src="${f}"></script>`, `<script>${code}</script>`);
}
html = html.replace("<body>", "<body>" + boot);
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
const w = dom.window, wait = ms => new Promise(r => setTimeout(r, ms)), ev = c => w.eval(c);
const sig = (group) => ev(`(() => { const el = document.getElementById('${group}') || document.querySelector('#scene-holder svg'); const s = el.outerHTML; let h=0; for (let i=0;i<s.length;i+=7) h=(h*31+s.charCodeAt(i))|0; return h+':'+s.length; })()`.replace('${group}', group));

const CASES = [
  { room: "landing",  hs: "closet",    flag: "closetOpen", group: "v_closet" },
  { room: "kitchen",  hs: "fridge",    flag: "fridgeOpen", group: "v_fridge" },
  { room: "kitchen",  hs: "drawer",    flag: "drawerOpen", group: "v_drawer" },
  { room: "kitchen",  hs: "lockbox",   flag: "lockboxOpen", group: "v_lockbox", pre: "State.setFlag('tookStudyKey', true); State.setFlag('lockboxOpen', true);" },
  { room: "diningroom", hs: "sideboard", flag: "sbOpen", group: "v_sideboard" },
];

(async () => {
  await wait(200);
  const fail = []; const check = (n, c) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fail.push(n); };
  ev("Game.newGame()"); await wait(120);
  ev("Settings.set('reducedMotion', true)");

  for (const c of CASES) {
    ev(`State.setRoom('${c.room}'); Rooms.render()`); await wait(50);
    if (c.pre) { ev(c.pre); ev("Rooms.render()"); await wait(30); }
    const closedSig = sig(c.group);
    const closedFlag = ev(`!!State.flag('${c.flag}')`);
    ev(`document.querySelector('.hotspot[data-hs="${c.hs}"]').dispatchEvent(new MouseEvent('click', {bubbles:true}))`);
    await wait(60);
    const openFlag = ev(`!!State.flag('${c.flag}')`);
    const openSig = sig(c.group);
    check(`${c.room}/${c.hs}: first click flips ${c.flag} (${closedFlag} -> ${openFlag})`, openFlag === !closedFlag);
    check(`${c.room}/${c.hs}: open ${c.group} differs from closed`, openSig !== closedSig);
    ev(`document.querySelector('.hotspot[data-hs="${c.hs}"]').dispatchEvent(new MouseEvent('click', {bubbles:true}))`);
    await wait(60);
    const backFlag = ev(`!!State.flag('${c.flag}')`);
    const backSig = sig(c.group);
    check(`${c.room}/${c.hs}: second click closes again`, backFlag === closedFlag);
    check(`${c.room}/${c.hs}: closed ${c.group} restored exactly`, backSig === closedSig);
  }

  console.log(fail.length ? `\n${fail.length} FAILURES` : "\nOPEN/CLOSE AUDIT PASSED");
  process.exit(fail.length ? 1 : 0);
})();
