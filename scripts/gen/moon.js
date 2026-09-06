/* HOUSE 17 — moon phase generator.
   Reads the AI phase sheet (uploads/moon-phases.png): five moons in a row on
   pure black — full, gibbous, half, thick crescent, thin crescent. We find
   each disc by its column luminance profile, grid it, and quantise every
   cell into a five-step cool-grey night ramp (unlit cells stay empty, so a
   crescent stays a crescent). The game then clones these phases anywhere a
   moon is needed and cycles them on a timer; the photograph itself never
   ships.

   Pure Node: no image libraries, just zlib + a minimal PNG decoder. */
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/* ---------------- minimal PNG decode (8-bit, non-interlaced) ---------------- */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.toString("latin1", 4, 8) !== "\r\n\x1a\n") throw new Error("not a PNG");
  let pos = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  let plte = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
      if (data[12] !== 0) throw new Error("interlaced PNG unsupported");
    } else if (type === "PLTE") plte = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error("only 8-bit PNGs supported");
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (ch == null) throw new Error("unsupported colorType " + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  let idx = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[idx++];
    const line = raw.slice(idx, idx + stride); idx += stride;
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v;
      if (ft === 0) v = line[x];
      else if (ft === 1) v = line[x] + a;
      else if (ft === 2) v = line[x] + b;
      else if (ft === 3) v = line[x] + ((a + b) >> 1);
      else { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      cur[x] = v & 0xff;
    }
    for (let x = 0; x < w; x++) {
      let r, g, b;
      if (colorType === 3) { const p = cur[x] * 3; r = plte[p]; g = plte[p + 1]; b = plte[p + 2]; }
      else { r = cur[x * ch]; g = ch >= 3 ? cur[x * ch + 1] : r; b = ch >= 3 ? cur[x * ch + 2] : r; }
      const o = (y * w + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
    }
    prev = cur;
  }
  return { w, h, data: out };
}

const SRC = path.join(__dirname, "..", "..", "uploads", "moon-phases.png");
const OUT = path.join(__dirname, "..", "..", "js", "moon-data.js");
const G = 44;                                  // grid cells across each disc
/* cool night-grey ramp: the house never shows a white paper moon */
const PAL = ["#2a3138", "#434c55", "#66707a", "#98a2ac", "#cfd5da"];
const LIT_T = 0.055;                           // below this luminance = unlit

const img = decodePNG(fs.readFileSync(SRC));
const lumAt = (x, y) => {
  const o = (y * img.w + x) * 4;
  return (0.2126 * img.data[o] + 0.7152 * img.data[o + 1] + 0.0722 * img.data[o + 2]) / 255;
};

/* column profile -> contiguous lit bands = the five discs */
const colMax = new Float64Array(img.w);
for (let x = 0; x < img.w; x++) {
  let m = 0;
  for (let y = 0; y < img.h; y += 2) m = Math.max(m, lumAt(x, y));
  colMax[x] = m;
}
const bands = [];
let start = -1;
for (let x = 0; x <= img.w; x++) {
  const lit = x < img.w && colMax[x] > 0.12;
  if (lit && start < 0) start = x;
  if (!lit && start >= 0) { if (x - start > 40) bands.push([start, x]); start = -1; }
}
if (bands.length !== 5) throw new Error("expected 5 moon discs, found " + bands.length);

const phases = bands.map(([bx0, bx1]) => {
  /* row bounds inside the band */
  let ry0 = img.h, ry1 = 0;
  for (let y = 0; y < img.h; y++) {
    for (let x = bx0; x < bx1; x += 2) {
      if (lumAt(x, y) > 0.12) { if (y < ry0) ry0 = y; if (y > ry1) ry1 = y; break; }
    }
  }
  const bw = bx1 - bx0, bh = ry1 - ry0 + 1;
  const rows = [];
  for (let gy = 0; gy < G; gy++) {
    const runs = [];
    let cur = -1, cs = 0;
    for (let gx = 0; gx <= G; gx++) {
      let v = -1;
      if (gx < G) {
        /* mean luminance of the cell */
        let s = 0, n = 0;
        const x0 = bx0 + Math.floor(gx * bw / G), x1 = bx0 + Math.floor((gx + 1) * bw / G);
        const y0 = ry0 + Math.floor(gy * bh / G), y1 = ry0 + Math.floor((gy + 1) * bh / G);
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += lumAt(x, y); n++; }
        const t = n ? s / n : 0;
        v = t < LIT_T ? -1 : Math.min(PAL.length - 1, Math.floor(Math.pow(t, 0.85) * PAL.length));
      }
      if (v !== cur) { if (cur >= 0 && gx > cs) runs.push([cs, gx - cs, cur]); cur = v; cs = gx; }
    }
    if (runs.length) rows.push({ gy, runs });
  }
  return { rows };
});

const out = `/* generated by scripts/gen/moon.js from uploads/moon-phases.png — do not hand edit */
const MOON_DATA = ${JSON.stringify({ g: G, palette: PAL, phases })};
`;
fs.writeFileSync(OUT, out);
const cells = phases.reduce((a, p) => a + p.rows.reduce((b, r) => b + r.runs.length, 0), 0);
console.log("moon-data.js", (out.length / 1024).toFixed(1) + "KB", "phases", phases.length, "runs", cells);
