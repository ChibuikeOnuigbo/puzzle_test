/* HOUSE 17 — bird pose generator (v2).
   Reads the two AI silhouette sheets (uploads/birds-fly.png: eight flight
   poses; uploads/birds-perch.png: six perched poses), finds every silhouette
   by connected-component flood on the ink mask, and grids each one into a
   SINGLE-TONE run-length binary mask.

   v1 emitted a second "edge" tone (a light slate halo band) so the renderer
   could fake soft edges. That halo read as pale patches floating around the
   body and it feathered badly. v2 drops it entirely: every cell is either
   solid bird (filled) or sky (empty). The softness now comes from a fine grid
   and the canvas scaler, which anti-aliases on the way down — no painted halo.

   Thin legs, beaks and claw cells survive because a cell fills once ink covers
   FILL_T of it (0.34), not the old 0.55 core / 0.22 edge split.

   Output: js/bird-data.js — { fly:[mask...], perch:[mask...] }, each mask
   { gw, gh, rows:[{ gy, runs:[[x,len], ...] }] }. Runtime (js/bird-engine.js)
   decodes those runs back into a pixel array and deforms it into a dozen wing
   frames, exactly like roof-data.js feeds the roof painter.

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

const OUT = path.join(__dirname, "..", "..", "js", "bird-data.js");
const FILL_T = 0.34;   // a cell is solid bird once ink covers this fraction of it

/* ink mask + connected components (4-neighbour flood, iterative) */
function components(img, inkT) {
  const { w, h, data } = img;
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const l = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
    ink[i] = l < inkT ? 1 : 0;
  }
  const lab = new Int32Array(w * h).fill(-1);
  const comps = [];
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!ink[i] || lab[i] >= 0) continue;
    const id = comps.length;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
    stack.push(i); lab[i] = id;
    while (stack.length) {
      const p = stack.pop();
      const px = p % w, py = (p / w) | 0;
      n++;
      if (px < x0) x0 = px; if (px > x1) x1 = px;
      if (py < y0) y0 = py; if (py > y1) y1 = py;
      const nb = [p - 1, p + 1, p - w, p + w];
      for (const q of nb) {
        if (q < 0 || q >= w * h) continue;
        if (ink[q] && lab[q] < 0) { lab[q] = id; stack.push(q); }
      }
    }
    if (n > 400) comps.push({ id, x0, y0, x1, y1, n, lab });
  }
  return comps;
}

/* grid one component into a single-tone run-length binary mask.
   Only component-owned ink counts, so a cell that the neighbouring silhouette
   bleeds into never fills — the mask is a clean per-pose outline. */
function gridPose(img, comp, cell) {
  const { x0, y0, x1, y1 } = comp;
  const gw = Math.max(4, Math.round((x1 - x0 + 1) / cell));
  const gh = Math.max(4, Math.round((y1 - y0 + 1) / cell));
  const rows = [];
  for (let gy = 0; gy < gh; gy++) {
    const runs = [];
    let cur = 0, cs = 0;
    for (let gx = 0; gx <= gw; gx++) {
      let v = 0;
      if (gx < gw) {
        const px0 = x0 + Math.floor(gx * (x1 - x0 + 1) / gw);
        const px1 = x0 + Math.floor((gx + 1) * (x1 - x0 + 1) / gw);
        const py0 = y0 + Math.floor(gy * (y1 - y0 + 1) / gh);
        const py1 = y0 + Math.floor((gy + 1) * (y1 - y0 + 1) / gh);
        let ink = 0, tot = 0;
        for (let y = py0; y < py1; y++) for (let x = px0; x < px1; x++) { tot++; if (comp.lab[y * img.w + x] === comp.id) ink++; }
        v = (tot ? ink / tot : 0) >= FILL_T ? 1 : 0;
      }
      if (v !== cur) { if (cur === 1) runs.push([cs, gx - cs]); cur = v; cs = gx; }
    }
    if (runs.length) rows.push({ gy, runs });
  }
  return { gw, gh, rows };
}

function readSheet(file, expect, cell) {
  const img = decodePNG(fs.readFileSync(path.join(__dirname, "..", "..", "uploads", file)));
  const comps = components(img, 0.5);
  /* reading order: band by y, then x */
  comps.sort((a, b) => {
    const ba = Math.round((a.y0 + a.y1) / 2 / (img.h / expect.rows));
    const bb = Math.round((b.y0 + b.y1) / 2 / (img.h / expect.rows));
    return ba !== bb ? ba - bb : a.x0 - b.x0;
  });
  if (comps.length !== expect.n) throw new Error(file + ": expected " + expect.n + " poses, found " + comps.length);
  return comps.map(c => gridPose(img, c, cell));
}

/* finer cells than v1 (6px vs 8-9px): more pixels per bird, smoother outline,
   and the wing/leg detail the old grid swallowed. */
const fly = readSheet("birds-fly.png", { n: 8, rows: 2 }, 6);
const perch = readSheet("birds-perch.png", { n: 6, rows: 1 }, 6);

const out = `/* generated by scripts/gen/birds.js from uploads/birds-fly.png + birds-perch.png — do not hand edit.
   v2: single-tone binary masks (solid bird / empty sky), no edge halo, fine 6px grid. */
const BIRD_DATA = ${JSON.stringify({ fly, perch })};
`;
fs.writeFileSync(OUT, out);
console.log("bird-data.js", (out.length / 1024).toFixed(1) + "KB",
  "fly poses", fly.map(p => p.gw + "x" + p.gh).join(" "),
  "| perch poses", perch.map(p => p.gw + "x" + p.gh).join(" "));
