/* debug still: like render_still but bakes animateMotion into static
   transforms so SMIL-less Resvg shows the window birds mid-path. */
import fs from "node:fs"; import path from "node:path"; import { JSDOM } from "jsdom"; import { Resvg } from "@resvg/resvg-js";
const root = "/home/user/puzzle_test";
const [room, out] = process.argv.slice(2);
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");
html = html.replace("</head>", "<style>" + css.replace(/<\/style>/gi, "<\\/style>") + "</style></head>");
const boot = `<script>window.__QA__=true;window.matchMedia=window.matchMedia||(q=>({matches:false,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));window.HTMLCanvasElement.prototype.getContext=window.HTMLCanvasElement.prototype.getContext||(()=>null);</script>`;
const files = ["js/config.js","js/audio.js","js/core.js","js/debug.js","js/condition.js","js/windows.js","js/painting-data.js","js/artlib.js","js/previews.js","js/forest-data.js","js/window-data.js","js/roof-data.js","js/moon-data.js","js/bird-data.js","js/tree-perches.js","js/birds.js","js/anim-registry.js","js/rooms.js","js/plumbing.js","js/fire.js","js/knock.js","js/puzzles.js","js/fx.js","js/fog.js","js/mirror.js","js/main.js"];
for (const f of files) { const code = fs.readFileSync(path.join(root, f), "utf8").replace(/<\/script>/gi, "<\\/script>"); html = html.replace(`<script src="${f}"></script>`, `<script>${code}</script>`); }
html = html.replace("<body>", "<body>" + boot);
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/" });
const w = dom.window;
await new Promise(r => setTimeout(r, 250));
w.eval("Game.newGame()"); await new Promise(r => setTimeout(r, 150));
w.eval(`State.setRoom('${room}'); Rooms.render()`); await new Promise(r => setTimeout(r, 300));
w.eval(`(() => {
  document.querySelectorAll('animateMotion').forEach(m => {
    const d = m.getAttribute('path') || '';
    const n = (d.match(/-?\\d+(?:\\.\\d+)?/g) || []).map(Number);
    if (n.length >= 8) {
      const P = [[n[0], n[1]], [n[2], n[3]], [n[4], n[5]], [n[6], n[7]]];
      const bez = t => { const u = 1 - t; return [
        u*u*u*P[0][0] + 3*u*u*t*P[1][0] + 3*u*t*t*P[2][0] + t*t*t*P[3][0],
        u*u*u*P[0][1] + 3*u*u*t*P[1][1] + 3*u*t*t*P[2][1] + t*t*t*P[3][1]]; };
      const mid = bez(0.5);
      const tan = [0.75*(P[1][0]-P[0][0]) + 1.5*(P[2][0]-P[1][0]) + 0.75*(P[3][0]-P[2][0]),
                   0.75*(P[1][1]-P[0][1]) + 1.5*(P[2][1]-P[1][1]) + 0.75*(P[3][1]-P[2][1])];
      const ang = Math.atan2(tan[1], tan[0]) * 180 / Math.PI;
      m.parentElement.setAttribute('transform',
        'translate(' + mid[0].toFixed(1) + ',' + mid[1].toFixed(1) + ') rotate(' + ang.toFixed(1) + ')');
    }
    m.remove();
  });
  const s = document.querySelector('#scene-holder svg');
  const h = s.querySelector('#hotspots'); if (h) h.remove();
})()`);
const svg = w.eval(`new XMLSerializer().serializeToString(document.querySelector('#scene-holder svg'))`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, new Resvg(svg, { fitTo: { mode: "width", value: 1280 }, font: { loadSystemFonts: true }, background: "#000" }).render().asPng());
console.log("wrote", out);
w.close(); process.exit(0);
