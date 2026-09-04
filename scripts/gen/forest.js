/* HOUSE 17 — forest generator.
   Reads an AI-generated 2D forest silhouette PNG, decodes every pixel,
   downsamples to a coarse grid, quantizes each cell to a small night palette
   (approximated), splits the canopy into individual trees (each becomes an
   object with a base pivot so the game can wave it), and writes js/forest-data.js.

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
  let plte = null, trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
      if (data[12] !== 0) throw new Error("interlaced PNG unsupported");
    } else if (type === "PLTE") plte = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error("only 8-bit PNGs supported, got " + bitDepth);
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
      let r, g, bl, al = 255;
      if (colorType === 0) r = g = bl = cur[x];
      else if (colorType === 2) { r = cur[x * 3]; g = cur[x * 3 + 1]; bl = cur[x * 3 + 2]; }
      else if (colorType === 3) { const i = cur[x]; r = plte[i * 3]; g = plte[i * 3 + 1]; bl = plte[i * 3 + 2]; if (trns && i < trns.length) al = trns[i]; }
      else if (colorType === 4) { r = g = bl = cur[x * 2]; al = cur[x * 2 + 1]; }
      else { r = cur[x * 4]; g = cur[x * 4 + 1]; bl = cur[x * 4 + 2]; al = cur[x * 4 + 3]; }
      const o = (y * w + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = bl; out[o + 3] = al;
    }
    prev = cur;
  }
  return { w, h, data: out };
}

/* ---------------- downsample + quantize ---------------- */
function lumOf(img, x, y) {
  const o = (y * img.w + x) * 4;
  return (img.data[o] * 0.299 + img.data[o + 1] * 0.587 + img.data[o + 2] * 0.114);
}
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = ((h ^ (h >> 13)) * 1274126177) | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }

const SKY_LUM = 120; // anything lighter than this is sky / fog (transparent)

function build(img, CELL, GW) {
  const GH = Math.round(img.h / CELL);
  const cells = new Uint8Array(GW * GH); // 0 sky, 1..3 shades
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const sx0 = Math.floor(gx * img.w / GW), sx1 = Math.max(sx0 + 1, Math.floor((gx + 1) * img.w / GW));
      const sy0 = Math.floor(gy * img.h / GH), sy1 = Math.max(sy0 + 1, Math.floor((gy + 1) * img.h / GH));
      let sum = 0, n = 0;
      for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) { sum += lumOf(img, x, y); n++; }
      const lum = sum / n;
      if (lum >= SKY_LUM) continue; // sky / fog gap
      let c = 1;
      if (lum < 45) c = 3;
      else if (lum < 80) c = 2;
      else c = 1;
      // clustered black patches (low-frequency blobs) + a little fine speckle
      if (hash2(Math.floor(gx / 6), Math.floor(gy / 6)) < 0.22) c = 3;
      else if (hash2(gx, gy) < 0.05) c = 3;
      cells[gy * GW + gx] = c;
    }
  }
  return { GW, GH, cells };
}

/* ---------------- structure analysis ---------------- */
function rowDensity(cells, GW, gy) {
  let n = 0;
  for (let x = 0; x < GW; x++) if (cells[gy * GW + x]) n++;
  return n / GW;
}
function runLen(cells, GW, gy) {
  const runs = [];
  let run = null;
  for (let gx = 0; gx < GW; gx++) {
    const c = cells[gy * GW + gx];
    if (!c) { run = null; continue; }
    if (run && run[2] === c) run[1]++;
    else { run = [gx, 1, c]; runs.push(run); }
  }
  return runs;
}
/* ---------------- emit ---------------- */
function emit(srcPath, outPath) {
  const img = decodePNG(fs.readFileSync(srcPath));
  const CELL = 2;
  const GW = Math.round(1280 / CELL); // 640 columns -> 2px cells fill 1280
  const { GH, cells } = build(img, CELL, GW);

  // first row with any tree
  let topRow = 0;
  for (let y = 0; y < GH; y++) { if (rowDensity(cells, GW, y) > 0) { topRow = y; break; } }

  // density profile
  const dens = new Float64Array(GH);
  for (let y = 0; y < GH; y++) dens[y] = rowDensity(cells, GW, y);

  // bottom ground = last solid row
  let nearGround = GH - 1;
  while (nearGround >= 0 && dens[nearGround] < 0.8) nearGround--;

  // fog gap = longest run of near-empty rows between the two forest layers
  let gapStart = -1, gapLen = 0, cur = -1;
  for (let y = topRow; y <= nearGround; y++) {
    if (dens[y] < 0.12) { if (cur < 0) cur = y; }
    else if (cur >= 0) { const len = y - cur; if (len > gapLen) { gapLen = len; gapStart = cur; } cur = -1; }
  }
  if (gapStart < 0) { gapStart = topRow; gapLen = 0; } // no fog gap: single layer fallback
  const farBottom = gapStart - 1;      // last dense row of the far forest (incl. its trunk band)
  const nearTop = gapStart + gapLen;   // first row of the near forest

  // far layer: rows [topRow, farBottom] inclusive
  const farRows = [];
  for (let gy = topRow; gy <= farBottom; gy++) { const r = runLen(cells, GW, gy); if (r.length) farRows.push({ gy, runs: r }); }

  const nearY0 = nearTop, nearY1 = nearGround;

  // solid bottom band (undergrowth / ground) — everything below it is background
  let groundBandTop = nearY1;
  while (groundBandTop - 1 >= nearY0 && rowDensity(cells, GW, groundBandTop - 1) > 0.8) groundBandTop--;

  // trunk columns in the band just above the ground
  const tb0 = Math.max(nearY0, groundBandTop - 20), tb1 = groundBandTop;
  const trunkCol = new Uint8Array(GW);
  for (let gx = 0; gx < GW; gx++) for (let gy = tb0; gy < tb1; gy++) if (cells[gy * GW + gx]) { trunkCol[gx] = 1; break; }

  // contiguous trunk groups -> individual trees
  const trunkGroups = [];
  { let cur = null;
    for (let gx = 0; gx < GW; gx++) {
      if (trunkCol[gx]) { if (!cur) cur = { x0: gx, w: 0 }; cur.w++; }
      else if (cur) { trunkGroups.push(cur); cur = null; }
    }
    if (cur) trunkGroups.push(cur);
  }
  const trunks = trunkGroups.filter(t => t.w >= 2);
  const centers = trunks.map(t => t.x0 + t.w / 2);

  // assign every column that has canopy cells to the nearest trunk (capped so stray specks stay background)
  const owner = new Int32Array(GW).fill(-1);
  for (let gx = 0; gx < GW; gx++) {
    let has = false;
    for (let gy = nearY0; gy < groundBandTop; gy++) if (cells[gy * GW + gx]) { has = true; break; }
    if (!has) continue;
    let best = -1, bestD = 1e9;
    for (let i = 0; i < centers.length; i++) { const d = Math.abs(gx - centers[i]); if (d < bestD) { bestD = d; best = i; } }
    if (bestD <= 36) owner[gx] = best;
  }

  // carve tapered, wobbling sky gaps between adjacent trees so crowns read as separate trees
  for (let i = 0; i < trunks.length - 1; i++) {
    const b = (centers[i] + centers[i + 1]) / 2;
    const depthFrac = 0.62 + 0.18 * (hash2(i, 7) - 0.5); // 0.53..0.71 of the layer height
    const yEnd = nearY0 + Math.round((groundBandTop - nearY0) * depthFrac);
    for (let gy = nearY0; gy < yEnd; gy++) {
      const c0 = Math.ceil(b) - 1 + Math.round((hash2(i, gy) - 0.5) * 2); // ±1 wobble
      if (c0 < 0 || c0 + 1 >= GW) continue;
      cells[gy * GW + c0] = 0; cells[gy * GW + c0 + 1] = 0;
    }
  }

  // split each row into per-tree runs and background runs, clipping wide runs at ownership boundaries
  function distributeRow(gy) {
    const treeRuns = trunks.map(() => []);
    const bg = [];
    let run = null;
    const flush = () => { if (!run) return; const r = [run.x0, run.len, run.c]; if (run.o >= 0) treeRuns[run.o].push(r); else bg.push(r); run = null; };
    for (let gx = 0; gx < GW; gx++) {
      const c = cells[gy * GW + gx];
      if (!c) { flush(); continue; }
      const o = owner[gx];
      if (run && run.o === o && run.c === c) run.len++;
      else { flush(); run = { o, x0: gx, len: 1, c }; }
    }
    flush();
    return { treeRuns, bg };
  }

  const nearRows = [];                       // near layer leftover (gaps, undergrowth, ground)
  const treeData = trunks.map(() => ({ rows: [] }));
  for (let gy = nearY0; gy < nearY1; gy++) {
    if (gy < groundBandTop) {
      const { treeRuns, bg } = distributeRow(gy);
      if (bg.length) nearRows.push({ gy, runs: bg });
      trunks.forEach((t, i) => { if (treeRuns[i].length) treeData[i].rows.push({ gy, runs: treeRuns[i] }); });
    } else {
      const runs = runLen(cells, GW, gy);
      if (runs.length) nearRows.push({ gy, runs });
    }
  }

  const finalTrees = treeData.map((t, i) => {
    let minX = 1e9, maxX = -1, top = 1e9;
    for (const r of t.rows) { for (const run of r.runs) { minX = Math.min(minX, run[0]); maxX = Math.max(maxX, run[0] + run[1]); } top = Math.min(top, r.gy); }
    return { x0: minX, w: maxX - minX, top, trunkCx: Math.round(centers[i]), groundGy: nearGround, rows: t.rows };
  }).filter(t => t.rows.length);

  const data = {
    cell: CELL,
    gw: GW,
    palette: { 1: "#0a0e15", 2: "#07090c", 3: "#05070a" },
    far: { baseY: 424, groundGy: farBottom, rows: farRows },
    near: { baseY: 536, groundGy: nearGround, rows: nearRows },
    trees: finalTrees,
  };

  const out = "/* generated by scripts/gen/forest.js from " + path.basename(srcPath) + " — do not hand edit */\n" +
    "const FOREST_DATA = " + JSON.stringify(data) + ";\n";
  fs.writeFileSync(outPath, out);

  const count = r => r.reduce((n, row) => n + row.runs.length, 0);
  console.log("image:", img.w + "x" + img.h, "grid:", GW + "x" + GH, "topRow", topRow, "farBottom", farBottom, "nearTop", nearTop, "nearGround", nearGround);
  console.log("trees:", finalTrees.length, finalTrees.map(t => `x${t.x0}w${t.w}`).join(" "));
  console.log("far rows/runs:", farRows.length + "/" + count(farRows), "near rows/runs:", nearRows.length + "/" + count(nearRows), "tree runs:", finalTrees.reduce((n,t)=>n+count(t.rows),0));
  console.log("output bytes:", out.length, "->", outPath);
}

emit(
  path.join(__dirname, "..", "..", "uploads", "forest-silhouette.png"),
  path.join(__dirname, "..", "..", "js", "forest-data.js")
);
