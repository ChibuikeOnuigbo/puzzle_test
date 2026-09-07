/* HOUSE 17 — PAINTING PIPELINE (docs/GRAPHICS_PIPELINE.md §ai-reference)
   ============================================================================
   STEP 1  references      art/references/ (visual research, not shipped)
   STEP 2  generation      art/generated/*.png — AI concept used as SOURCE,
                           never shipped as a runtime image
   STEP 3  extraction      this script: sharp reads the pixels and we pull
                           out the large color regions (k-means quantised
                           palette), the luminance structure, dominant masses
                           and the run structure of every row
   STEP 4  reconstruction  js/painting-data.js — RLE rows of palette indices
                           that Art.painting() repaints as vector cells in
                           three quality tiers (high: full rows + varnish +
                           impasto strokes, medium: rows, low: block masses)

   Usage:  node scripts/gen/painting.js
============================================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const sharp = require(path.join(__dirname, "..", "..", "node_modules", "sharp"));

const ROOT = path.join(__dirname, "..", "..");
const JOBS = [
  { kind: "hall",    file: "painting-hall.png",    gw: 44, gh: 56, k: 7 },
  { kind: "dining",  file: "painting-dining.png",  gw: 52, gh: 42, k: 7 },
  { kind: "sitting", file: "painting-sitting.png", gw: 52, gh: 42, k: 7 },
];

function kmeans(pixels, k, iters = 10) {
  /* deterministic init: spread seeds across the luminance range */
  const lum = p => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
  const sorted = pixels.slice().sort((a, b) => lum(a) - lum(b));
  let seeds = [];
  for (let i = 0; i < k; i++) seeds.push(sorted[Math.floor((i + 0.5) * sorted.length / k)].slice());
  let assign = new Array(pixels.length).fill(0);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i];
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const s = seeds[c];
        const d = (p[0] - s[0]) ** 2 + (p[1] - s[1]) ** 2 + (p[2] - s[2]) ** 2;
        if (d < bd) { bd = d; best = c; }
      }
      assign[i] = best;
    }
    const sum = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i++) {
      const s = sum[assign[i]];
      s[0] += pixels[i][0]; s[1] += pixels[i][1]; s[2] += pixels[i][2]; s[3]++;
    }
    for (let c = 0; c < k; c++) if (sum[c][3]) {
      seeds[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
    }
  }
  return { seeds: seeds.map(s => s.map(Math.round)), assign };
}

(async () => {
  const out = {};
  for (const job of JOBS) {
    const src = path.join(ROOT, "art", "generated", job.file);
    if (!fs.existsSync(src)) { console.warn("skip (missing):", job.file); continue; }
    /* downsample to the target grid: one averaged colour per cell */
    const { data, info } = await sharp(src)
      .resize(job.gw, job.gh, { fit: "fill" })
      .raw().toBuffer({ resolveWithObject: true });
    const pixels = [];
    for (let i = 0; i < info.width * info.height; i++) {
      pixels.push([data[i * info.channels], data[i * info.channels + 1], data[i * info.channels + 2]]);
    }
    const { seeds, assign } = kmeans(pixels, job.k);
    /* order the palette dark → light so low-tier blocks read as shading */
    const lum = p => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    const order = seeds.map((s, i) => [lum(s), i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const remap = {}; order.forEach((old, neu) => remap[old] = neu);
    const palette = order.map(i => "#" + seeds[i].map(v => v.toString(16).padStart(2, "0")).join(""));

    /* STEP 3 analysis: luminance structure + region sizes (written out so
       the extraction is inspectable, not a black box) */
    const counts = new Array(job.k).fill(0);
    let lsum = 0, lmin = 255, lmax = 0;
    assign.forEach(a => counts[a]++);
    pixels.forEach(p => { const l = lum(p); lsum += l; lmin = Math.min(lmin, l); lmax = Math.max(lmax, l); });
    const analysis = {
      source: "art/generated/" + job.file,
      grid: [job.gw, job.gh],
      meanLuminance: +(lsum / pixels.length).toFixed(1),
      luminanceRange: [Math.round(lmin), Math.round(lmax)],
      regionShare: counts.map((c, i) => ({ palette: remap[i], share: +(c / pixels.length).toFixed(3) })),
      palette,
    };
    fs.writeFileSync(path.join(ROOT, "art", "extracted", job.kind + ".json"), JSON.stringify(analysis, null, 2));
    fs.writeFileSync(path.join(ROOT, "art", "palettes", job.kind + ".json"), JSON.stringify(palette, null, 2));

    /* STEP 4: one base36 palette index per cell, per row — the exact shape
       Art.painting() consumes (identical to WINDOW_VIEW / windowView) */
    const rows = [];
    for (let y = 0; y < job.gh; y++) {
      let line = "";
      for (let x = 0; x < job.gw; x++) line += remap[assign[y * job.gw + x]].toString(36);
      rows.push(line);
    }
    out[job.kind] = { gw: job.gw, gh: job.gh, palette, rows };
    console.log("extracted", job.kind, `${job.gw}x${job.gh}`, "palette", palette.length);
  }

  const body = "/* generated by scripts/gen/painting.js from art/generated/*.png — do not hand edit.\n" +
    "   AI concepts are the SOURCE; the shipped game renders these run-length\n" +
    "   palettes as vector cells (Art.painting in js/artlib.js). */\n" +
    "const PAINTING_DATA = " + JSON.stringify(out) + ";\n" +
    "(typeof window !== \"undefined\") && (window.PAINTING_DATA = PAINTING_DATA);\n" +
    "if (typeof module !== \"undefined\") module.exports = { PAINTING_DATA };\n";
  fs.writeFileSync(path.join(ROOT, "js", "painting-data.js"), body);
  console.log("wrote js/painting-data.js", body.length, "bytes");
})().catch(e => { console.error(e); process.exit(1); });
