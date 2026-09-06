/* HOUSE 17 — window view generator.
   Reads the AI-painted night garden PNG (uploads/window-rain-night.png),
   decodes every pixel, crops the pane we actually show, tweaks the hue,
   approximates each coarse cell by the nearest colour of a small hand-picked
   night palette, dithers between the two nearest colours with a Bayer matrix
   (so the flat vector copy keeps a pixel grain, a semi-realism), sprinkles a
   few rain-glint specks, and writes js/window-data.js as run-length rows.

   The game never loads the photograph: it paints this data as plain SVG
   rects, cell by cell, in the house's own vector language. Copy of the
   style, not the file.

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
      let r, g, bl;
      if (colorType === 0) r = g = bl = cur[x];
      else if (colorType === 2) { r = cur[x * 3]; g = cur[x * 3 + 1]; bl = cur[x * 3 + 2]; }
      else if (colorType === 3) { const i = cur[x]; r = plte[i * 3]; g = plte[i * 3 + 1]; bl = plte[i * 3 + 2]; }
      else if (colorType === 4) r = g = bl = cur[x * 2];
      else { r = cur[x * 4]; g = cur[x * 4 + 1]; bl = cur[x * 4 + 2]; }
      const o = (y * w + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = 255;
    }
    prev = cur;
  }
  return { w, h, data: out };
}

/* ---------------- colour helpers ---------------- */
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let hh = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) hh = ((g - b) / d + (g < b ? 6 : 0));
    else if (mx === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh /= 6;
  }
  return [hh, s, l];
}
function hsl2rgb(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
const hex = (r, g, b) => "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

/* the hue tweak: nudge everything a few degrees cooler (toward teal-blue),
   take a little saturation out, and lift the deepest blacks so the vector
   copy sits at the room's brightness instead of the photograph's. */
function tweak(r, g, b) {
  let [h, s, l] = rgb2hsl(r, g, b);
  h = (h + 0.012) % 1;              // cooler
  s = s * 0.95;                     // a touch greyer
  l = Math.min(0.94, l * 1.16 + 0.045);  // lifted: the vector copy must read at night
  return hsl2rgb(h, s, l);
}

/* ---------------- the palette the vector copy is allowed to use ---------------- */
const PALETTE = [
  "#0b0f15", // 0 deepest night
  "#131c28", // 1 cloud shadow blue
  "#1e2c3c", // 2 cloud mid blue
  "#2b3d50", // 3 cloud lit blue
  "#405468", // 4 cloud rim, moonlit
  "#66788a", // 5 moon glow / rain glint
  "#0c1517", // 6 hedge black-green
  "#16261f", // 7 hedge dark green
  "#22392c", // 8 hedge green
  "#31503c", // 9 leaf, moonlit
  "#101a22", // 10 wet ground dark
  "#24343f", // 11 wet ground mid
  "#37505e", // 12 path water sheen
];
const PAL = PALETTE.map(hexRgb);
/* one step brighter (or darker, d = -1) inside the cell's own family:
   0-5 sky and cloud, 6-9 leaf and hedge, 10-12 ground and water */
function stepShade(i, d) {
  const fam = i <= 5 ? [0, 1, 2, 3, 4, 5] : i <= 9 ? [6, 7, 8, 9] : [10, 11, 12];
  const at = fam.indexOf(i);
  return fam[Math.max(0, Math.min(fam.length - 1, at + d))];
}

function nearest2(r, g, b) {
  let b1 = 0, b2 = 0, d1 = 1e9, d2 = 1e9;
  for (let i = 0; i < PAL.length; i++) {
    const dr = r - PAL[i][0], dg = g - PAL[i][1], db = b - PAL[i][2];
    const d = dr * dr + dg * dg + db * db;
    if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = i; }
    else if (d < d2) { d2 = d; b2 = i; }
  }
  return [b1, b2, d1, d2];
}

/* Bayer 4x4 ordered dithering threshold */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = ((h ^ (h >> 13)) * 1274126177) | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }

/* ---------------- build ---------------- */
const SRC = path.join(__dirname, "..", "..", "uploads", "window-rain-night.png");
const OUT = path.join(__dirname, "..", "..", "js", "window-data.js");
const img = decodePNG(fs.readFileSync(SRC));

/* crop: the big right pane of the painted window (the part we show) */
const CX0 = 520, CY0 = 8, CX1 = 1450, CY1 = 810;
const GW = 64, GH = 54;

/* pass 1: approximate every cell. The cell's average colour (hue tweaked)
   is classified into one of three families the painting is built from —
   sky and cloud, hedge and leaf, wet ground and water — and then banded by
   lightness inside that family. Approximation, not tracing: the shapes come
   out of the photograph's own light. */
const SKY = [0, 1, 2, 3, 4, 5], LEAF = [6, 7, 8, 9], GROUND = [10, 11, 12];
const SKY_T = [0.10, 0.16, 0.24, 0.34, 0.46];
const LEAF_T = [0.08, 0.14, 0.22];
const GROUND_T = [0.12, 0.22];
function band(l, ts) { for (let i = 0; i < ts.length; i++) if (l < ts[i]) return i; return ts.length; }
function edgeOf(l, ts) {
  let m = 1;
  for (const t of ts) m = Math.min(m, Math.abs(l - t));
  return m < 0.02;
}
const raw = new Uint8Array(GW * GH);
const grain = new Uint8Array(GW * GH);   // 1 = this cell sits on a band edge
for (let gy = 0; gy < GH; gy++) {
  for (let gx = 0; gx < GW; gx++) {
    const sx0 = CX0 + Math.floor(gx * (CX1 - CX0) / GW), sx1 = Math.max(sx0 + 1, CX0 + Math.floor((gx + 1) * (CX1 - CX0) / GW));
    const sy0 = CY0 + Math.floor(gy * (CY1 - CY0) / GH), sy1 = Math.max(sy0 + 1, CY0 + Math.floor((gy + 1) * (CY1 - CY0) / GH));
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = sy0; y < sy1; y += 2) for (let x = sx0; x < sx1; x += 2) {
      const o = (y * img.w + x) * 4;
      const t = tweak(img.data[o], img.data[o + 1], img.data[o + 2]);
      r += t[0]; g += t[1]; b += t[2]; n++;
    }
    const [h, sl, l] = rgb2hsl(r / n, g / n, b / n);
    const greenish = h > 0.14 && h < 0.55 && sl > 0.04;
    let fam, ts;
    if (greenish) { fam = LEAF; ts = LEAF_T; }
    else if (gy < GH * 0.52) { fam = SKY; ts = SKY_T; }
    else { fam = GROUND; ts = GROUND_T; }
    /* very dark cells are silhouette whatever their hue: the leaning tree,
       the fence, the hedge's heart */
    let idx;
    if (l < 0.075) idx = greenish ? 6 : (gy < GH * 0.52 ? 0 : 10);
    else idx = fam[band(l, ts)];
    /* vignette: the top of the glass and the foreground at the sill go dark,
       so the view sits inside the frame instead of glowing out of it */
    if (gy < 2) idx = Math.min(idx, 1);
    if (gy > GH - 5) idx = stepShade(idx, -1);
    raw[gy * GW + gx] = idx;
    grain[gy * GW + gx] = (l >= 0.075 && edgeOf(l, ts)) ? 1 : 0;
  }
}

/* pass 2: a 3x3 mode filter. The photograph's grain dies here and the big
   shapes (cloud bank, hedge line, wet path, the leaning tree) commit. */
const cells = new Uint8Array(GW * GH);
const tally = new Map();
for (let gy = 0; gy < GH; gy++) {
  for (let gx = 0; gx < GW; gx++) {
    tally.clear();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = gx + dx, y = gy + dy;
      if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
      const v = raw[y * GW + x];
      tally.set(v, (tally.get(v) || 0) + 1);
    }
    let best = raw[gy * GW + gx], bn = -1;
    for (const [v, c] of tally) if (c > bn) { bn = c; best = v; }
    cells[gy * GW + gx] = best;
  }
}

/* pass 3: put a little grain back, aperiodic so it reads as pixel
   semi-realism and never as a mesh: band edges dither between neighbours,
   and a sparse scatter of single-cell glints (rain catching the moon) and
   dark specks finishes it. */
const rows = [];
for (let gy = 0; gy < GH; gy++) {
  let line = "";
  for (let gx = 0; gx < GW; gx++) {
    const i = gy * GW + gx;
    let idx = cells[i];
    if (grain[i] && hash2(gx * 3 + 1, gy * 5 + 2) < 0.45) idx = stepShade(idx, hash2(gx, gy) < 0.5 ? 1 : -1);
    const rnd = hash2(gx * 7 + 3, gy * 11 + 5);
    if (rnd < 0.012 && gy < GH * 0.6) idx = 5;             // a rain glint
    else if (rnd > 0.994) idx = stepShade(idx, -1);        // a dark speck
    line += idx.toString(36);
  }
  rows.push(line);
}

const data = { gw: GW, gh: GH, palette: PALETTE, rows };
const js = "/* generated by scripts/gen/windowview.js from uploads/window-rain-night.png — do not hand edit.\n   A pixel approximation of the painted night garden, repainted as vector:\n   each character is one cell, one palette index, run-lengthed at render. */\nconst WINDOW_VIEW = " + JSON.stringify(data) + ";\n";
fs.writeFileSync(OUT, js);
console.log("wrote", OUT, (js.length / 1024).toFixed(1) + "KB", GW + "x" + GH, "cells");
