/* HOUSE 17 — roof texture generator.
   Reads the AI architectural close-up (uploads/roof-ref.png): real tile
   courses, light catching the edges, and sharp branch shadows dappling the
   slope. We decode every pixel, take a band of pure tile+shadow, and split
   it in two:

     • GRAIN  — per-cell luminance, monotonised into the house's own night
       palette (a six-step slate-brown ramp), so the vector roof keeps a
       semi-realistic pixel tooth without importing a photograph.
     • SHADOW — the low-frequency dark dapple (block-smoothed luminance far
       below the mean), kept as its own mask so the game can drift it slowly
       across the roof like branches moving in front of the moon.

   Green leaf pixels are detected and excluded from both. Output is
   js/roof-data.js as run-length rows; the game never loads the PNG.

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
      out[o] = r; out[o + 1] = g; out[o + 2] = b;
      out[o + 3] = ch === 4 || ch === 2 ? 255 : cur[x * ch + 1];
    }
    prev = cur;
  }
  return { w, h, data: out };
}

/* ---------------- config ---------------- */
const SRC = path.join(__dirname, "..", "..", "uploads", "roof-ref.png");
const OUT = path.join(__dirname, "..", "..", "js", "roof-data.js");
/* the band of slope that is tiles + dapple, with as little leaf as possible */
const CX0 = 0.30, CY0 = 0.55, CX1 = 0.66, CY1 = 0.88;
const CELL = 6;                       // source px per grid cell
/* the house's night ramp: slate-brown, moon-warm at the top step */
const PAL = ["#0f0c09", "#171310", "#201a14", "#2a231b", "#362d22", "#453a2b"];
const SHADOW_K = 0.42;                // how many std-devs below the mean = shadow

const img = decodePNG(fs.readFileSync(SRC));
const x0 = Math.floor(img.w * CX0), x1 = Math.floor(img.w * CX1);
const y0 = Math.floor(img.h * CY0), y1 = Math.floor(img.h * CY1);
const gw = Math.floor((x1 - x0) / CELL), gh = Math.floor((y1 - y0) / CELL);

/* per-cell mean luminance + green-leaf flag */
const lum = new Float64Array(gw * gh);
const green = new Uint8Array(gw * gh);
for (let gy = 0; gy < gh; gy++) {
  for (let gx = 0; gx < gw; gx++) {
    let s = 0, n = 0, gs = 0;
    for (let y = gy * CELL; y < (gy + 1) * CELL; y++) {
      for (let x = gx * CELL; x < (gx + 1) * CELL; x++) {
        const o = ((y0 + y) * img.w + (x0 + x)) * 4;
        const r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
        s += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (g > r + 12 && g > b + 12) gs++;
        n++;
      }
    }
    lum[gy * gw + gx] = s / n;
    green[gy * gw + gx] = gs > n * 0.35 ? 1 : 0;
  }
}
/* fill green cells from the nearest non-green neighbour to the left/above */
for (let gy = 0; gy < gh; gy++) {
  for (let gx = 0; gx < gw; gx++) {
    if (!green[gy * gw + gx]) continue;
    let v = 0;
    for (let d = 1; d <= gw; d++) {
      if (gx - d >= 0 && !green[gy * gw + gx - d]) { v = lum[gy * gw + gx - d]; break; }
      if (gy - d >= 0 && !green[(gy - d) * gw + gx]) { v = lum[(gy - d) * gw + gx]; break; }
    }
    lum[gy * gw + gx] = v;
  }
}
/* 3x3 block smoothing = the shadow dapple field */
const sm = new Float64Array(gw * gh);
for (let gy = 0; gy < gh; gy++) {
  for (let gx = 0; gx < gw; gx++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = gy + dy, xx = gx + dx;
      if (yy < 0 || xx < 0 || yy >= gh || xx >= gw) continue;
      s += lum[yy * gw + xx]; n++;
    }
    sm[gy * gw + gx] = s / n;
  }
}
let mean = 0, sd = 0;
for (let i = 0; i < sm.length; i++) mean += sm[i];
mean /= sm.length;
for (let i = 0; i < sm.length; i++) sd += (sm[i] - mean) ** 2;
sd = Math.sqrt(sd / sm.length);
const shadowT = mean - SHADOW_K * sd;

/* luminance percentiles for the monotone stretch */
const sorted = Float64Array.from(lum).sort();
const p10 = sorted[Math.floor(sorted.length * 0.10)];
const p90 = sorted[Math.floor(sorted.length * 0.90)];

/* hash grain so the quantisation never bands perfectly */
const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
};

const rows = [], shadows = [];
let grainCells = 0, shadowCells = 0;
for (let gy = 0; gy < gh; gy++) {
  let runs = [], shruns = [];
  let cur = -1, start = 0, shcur = -1, shstart = 0;
  const flush = (arr, v, s, e) => { if (v >= 0 && e > s) arr.push([s, e - s, v]); else if (v === 0 && e > s) arr.push([s, e - s]); };
  for (let gx = 0; gx <= gw; gx++) {
    /* grain index: monotone stretch into the night ramp */
    let idx = -1;
    if (gx < gw) {
      const t = Math.min(1, Math.max(0, (lum[gy * gw + gx] - p10) / Math.max(1e-6, p90 - p10)));
      /* compress into the dark end: night roof keeps only a tooth of the
         daylight contrast, so the grain reads as texture, not camo */
      idx = Math.min(PAL.length - 1, Math.floor((t * 0.62 + 0.10) * PAL.length + (hash(gx, gy) - 0.5) * 0.8));
      grainCells++;
    }
    if (idx !== cur) { flush(runs, cur, start, gx); cur = idx; start = gx; }
    /* shadow mask */
    let sh = 0;
    if (gx < gw) {
      sh = sm[gy * gw + gx] < shadowT && lum[gy * gw + gx] < mean ? 1 : 0;
      if (sh) shadowCells++;
      sh = sh ? 0 : -1;
    }
    if (sh !== shcur) { if (shcur === 0 && gx > shstart) shruns.push([shstart, gx - shstart]); shcur = sh; shstart = gx; }
  }
  if (runs.length) rows.push({ gy, runs });
  if (shruns.length) shadows.push({ gy, runs: shruns });
}

const out = `/* generated by scripts/gen/roof.js from uploads/roof-ref.png — do not hand edit */
const ROOF_DATA = ${JSON.stringify({ gw, gh, palette: PAL, rows, shadow: shadows })};
`;
fs.writeFileSync(OUT, out);
console.log("roof-data.js", (out.length / 1024).toFixed(1) + "KB",
  "grid", gw + "x" + gh, "grain cells", grainCells, "shadow cells", shadowCells,
  "mean", mean.toFixed(1), "sd", sd.toFixed(1));
