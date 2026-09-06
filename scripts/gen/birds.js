/* HOUSE 17 — bird pose generator.
   Reads the two AI silhouette sheets (uploads/birds-fly.png: eight flight
   poses; uploads/birds-perch.png: six perched poses), finds every silhouette
   by connected-component flood on the ink mask, and grids each one into
   run-length rows with two tones: a solid core and a soft edge cell band, so
   the game can paint birds as pixel paths at any scale without shipping the
   pictures. js/birds.js then flocks, perches and flings them around.

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
const PAL = ["#161c25", "#3a434e"];          // moonlit slate core, lighter edge
const CORE_T = 0.55, EDGE_T = 0.22;         // cell ink coverage bands

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

/* grid one component into two-tone run-length rows */
function gridPose(img, comp, cell) {
  const { x0, y0, x1, y1 } = comp;
  const gw = Math.max(4, Math.round((x1 - x0 + 1) / cell));
  const gh = Math.max(4, Math.round((y1 - y0 + 1) / cell));
  const rows = [];
  for (let gy = 0; gy < gh; gy++) {
    const runs = [];
    let cur = -1, cs = 0;
    for (let gx = 0; gx <= gw; gx++) {
      let v = -1;
      if (gx < gw) {
        const px0 = x0 + Math.floor(gx * (x1 - x0 + 1) / gw);
        const px1 = x0 + Math.floor((gx + 1) * (x1 - x0 + 1) / gw);
        const py0 = y0 + Math.floor(gy * (y1 - y0 + 1) / gh);
        const py1 = y0 + Math.floor((gy + 1) * (y1 - y0 + 1) / gh);
        let ink = 0, tot = 0;
        for (let y = py0; y < py1; y++) for (let x = px0; x < px1; x++) { tot++; if (comp.lab[y * img.w + x] === comp.id) ink++; }
        const f = tot ? ink / tot : 0;
        v = f >= CORE_T ? 0 : f >= EDGE_T ? 1 : -1;
      }
      if (v !== cur) { if (cur >= 0 && gx > cs) runs.push([cs, gx - cs, cur]); cur = v; cs = gx; }
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

const fly = readSheet("birds-fly.png", { n: 8, rows: 2 }, 9);
const perch = readSheet("birds-perch.png", { n: 6, rows: 1 }, 8);

const out = `/* generated by scripts/gen/birds.js from uploads/birds-fly.png + birds-perch.png — do not hand edit */
const BIRD_DATA = ${JSON.stringify({ palette: PAL, fly, perch })};
`;
fs.writeFileSync(OUT, out);
console.log("bird-data.js", (out.length / 1024).toFixed(1) + "KB",
  "fly poses", fly.map(p => p.gw + "x" + p.gh).join(" "),
  "| perch poses", perch.map(p => p.gw + "x" + p.gh).join(" "));
