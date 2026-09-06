/* Offline visual QA: boot the real game in jsdom, force a room + flags,
   serialize the live scene SVG (including the runtime-built FX + fog layers)
   and rasterise it with resvg so shots can be eyeballed without a browser.

   usage: node scripts/qa/render.mjs <room> <out.png> [flagsJson] [waitMs] [width]
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { Resvg } from "@resvg/resvg-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const [room, out, flagsJson, waitArg, widthArg] = process.argv.slice(2);

let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");
html = html.replace("</head>", "<style>" + css.replace(/<\/style>/gi, "<\\/style>") + "</style></head>");
const boot = `<script>
window.__QA__ = true;
window.matchMedia = window.matchMedia || (q => ({ matches:false, media:q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }));
window.HTMLCanvasElement.prototype.getContext = window.HTMLCanvasElement.prototype.getContext || (() => null);
</script>`;
const files = ["js/config.js", "js/audio.js", "js/core.js", "js/forest-data.js", "js/window-data.js", "js/roof-data.js", "js/moon-data.js", "js/bird-data.js", "js/birds.js", "js/rooms.js", "js/puzzles.js", "js/fx.js", "js/fog.js", "js/mirror.js", "js/main.js"];
for (const f of files) {
  const code = fs.readFileSync(path.join(root, f), "utf8").replace(/<\/script>/gi, "<\\/script>");
  html = html.replace(`<script src="${f}"></script>`, `<script>${code}</script>`);
}
html = html.replace("<body>", "<body>" + boot);

const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
const w = dom.window;
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(250);
w.eval("Game.newGame()");
await wait(150);
const flags = flagsJson ? JSON.parse(flagsJson) : {};
const flagSrc = Object.entries(flags).map(([k, v]) => `State.setFlag(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join("");
w.eval(`State.setRoom(${JSON.stringify(room)}); ${flagSrc} Rooms.render();`);
await wait(Number(waitArg) || 400);

/* the page CSS is not part of the serialized svg: hotspot rects would
   rasterise as solid black and hidden room labels would show, so strip
   anything the stylesheet normally makes invisible. */
w.eval(`(() => { const s = document.querySelector('#scene-holder svg');
  const h = s.querySelector('#hotspots'); if (h) h.remove();
  s.querySelectorAll('text[data-roomlabel]').forEach(t => t.remove());
})()`);
const svg = w.eval(`(() => { const s = document.querySelector('#scene-holder svg'); return new XMLSerializer().serializeToString(s); })()`);
const errors = [];
w.addEventListener("error", e => errors.push(e.message));

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: Number(widthArg) || 1280 },
  font: { loadSystemFonts: true, defaultFontFamily: "DejaVu Serif" },
  background: "#000000",
});
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, resvg.render().asPng());
console.log("wrote", out, "blobs:", w.eval("Fog._count()"), "flies:", w.eval("document.querySelectorAll('#fx-flies .fx-fly').length"));
w.close();
process.exit(0);
