# GRAPHICS PIPELINE — reference → extraction → runtime vector

HOUSE 17 ships **zero runtime images**. Hard assets that are difficult to
author blind (the framed paintings) follow a strict pipeline in which
AI-generated imagery is used *only as offline reference* and the game itself
always renders a controlled, deterministic vector reconstruction.

## Stages

1. **References** — ~5 visual references per hard asset are studied (art
   movements, composition, palette). For the three house paintings, composite
   reference images are generated into `art/generated/painting-{hall,dining,sitting}.png`
   (chiaroscuro hallway dusk; Dutch still life; firelit interior). These PNGs
   are *never* shipped, never loaded by `index.html`, never fetched at
   runtime.

2. **Extraction** — `scripts/gen/painting.js` (Node, offline) loads each
   reference with `sharp`, downsamples it to a small grid (hall 44×56,
   dining/sitting 52×42), runs a deterministic luminance-spread k-means to
   derive a 7-colour palette ordered dark→light, and writes:
   - `art/extracted/<kind>.json` — the analysis (grid, palette, luminance stats),
   - `art/palettes/<kind>.json` — the palette alone,
   - `js/painting-data.js` — the *only* artifact that ships:
     `PAINTING_DATA[kind] = { gw, gh, palette, rows }` where each row is one
     base36 character per cell (index into the palette), with runs detected at
     render time by `Art.painting()`.

3. **Reconstruction** — `js/artlib.js → Art.painting(kind, x, y, w, h, seed)`
   draws the painting as vector cells + frame + glass sheen, tiered by
   quality: HIGH full grid with per-run rects and sheen, MEDIUM same
   construction, LOW coarser row stepping. The result is hand-tunable,
   deterministic, and tiny.

4. **Manifests & audit** — every visible element is listed per room with its
   quality behaviour (see the per-renderer `QH`/`QM` gates in `js/rooms.js`).
   `scripts/qa/quality_matrix.js` renders each room at all three tiers and
   fails unless the pixel difference between adjacent tiers clears the
   visibility threshold — tiers must be *different scenes*, not blur/opacity
   of one scene.

## Honesty rules

- Generated/AI imagery is **reference only** (`art/generated/`,
  `art/references/`). `docs/ASSET_SOURCES.md` records this explicitly.
- The runtime never decodes an image: everything on screen is SVG/DOM/WebAudio
  authored in this repository (standing rule 7 in `alwaysDo.md`).
- Regenerating `js/painting-data.js` is always reproducible:
  `node scripts/gen/painting.js`.

## Extending the pipeline

A new hard asset gets: a reference set in `art/references/`, a generator in
`scripts/gen/` writing a `*-data.js` module, an `Art.*` renderer consuming it
with `quality()` tiers, a script tag in `index.html` **and** in the QA harness
file lists (`scripts/qa/{jsdom_check,jsdom_check2,render,render_still,nav_audit,fly_sim,open_close}`),
and a row in `ASSET_SOURCES.md`.
