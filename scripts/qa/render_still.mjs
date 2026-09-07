// like render.mjs but with a settings override before rendering
import fs from "node:fs"; import path from "node:path"; import { JSDOM } from "jsdom"; import { Resvg } from "@resvg/resvg-js";
const root = "/home/user/puzzle_test";
const [room, out, pre, waitArg] = process.argv.slice(2);
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");
html = html.replace("</head>", "<style>" + css.replace(/<\/style>/gi, "<\\/style>") + "</style></head>");
const boot = `<script>window.__QA__=true;window.matchMedia=window.matchMedia||(q=>({matches:false,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));window.HTMLCanvasElement.prototype.getContext=window.HTMLCanvasElement.prototype.getContext||(()=>null);</script>`;
const files = ["js/config.js","js/audio.js","js/core.js","js/forest-data.js","js/window-data.js","js/roof-data.js","js/moon-data.js","js/bird-data.js","js/tree-perches.js","js/birds.js","js/anim-registry.js","js/rooms.js","js/puzzles.js","js/fx.js","js/fog.js","js/mirror.js","js/main.js"];
for (const f of files) { const code = fs.readFileSync(path.join(root, f), "utf8").replace(/<\/script>/gi, "<\\/script>"); html = html.replace(`<script src="${f}"></script>`, `<script>${code}</script>`); }
html = html.replace("<body>", "<body>" + boot);
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
const w = dom.window; const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(250); w.eval("Game.newGame()"); await wait(150);
w.eval(pre || ""); w.eval(`State.setRoom(${JSON.stringify(room)}); Rooms.render();`); await wait(Number(waitArg) || 400);
w.eval(`(() => { const s = document.querySelector('#scene-holder svg'); const h = s.querySelector('#hotspots'); if (h) h.remove(); s.querySelectorAll('text[data-roomlabel]').forEach(t => t.remove()); })()`);
const svg = w.eval(`new XMLSerializer().serializeToString(document.querySelector('#scene-holder svg'))`);
const stats = w.eval(`(() => { const s = document.querySelector('#scene-holder svg'); return { wb: [...s.querySelectorAll('[data-window-birds]')].map(g => g.dataset.windowBirds + ':' + g.querySelectorAll('.wb-bird').length), drops: [...s.querySelectorAll('[data-glass-drops]')].map(g => g.dataset.glassDrops + ':' + g.dataset.beads + '/' + g.dataset.runners) }; })()`);
fs.writeFileSync(out, new Resvg(svg, { fitTo: { mode: "width", value: 1280 }, font: { loadSystemFonts: true }, background: "#000" }).render().asPng());
console.log("wrote", out, JSON.stringify(stats)); w.close(); process.exit(0);
