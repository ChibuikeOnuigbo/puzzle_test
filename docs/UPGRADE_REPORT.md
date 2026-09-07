# HOUSE 17 — house-wide visual & world-coherence upgrade report

Scope: full inventory of visible elements, graphics pipeline with
high/medium/low tiers, P0 fixes (window clipping, nav tooltips, fly collapse,
motivated lighting), furniture/appliance upgrades, a real sitting room with a
masonry fireplace, researched paintings, doorway truth, edge-door discipline,
inventory gating, and the QA surface to prove all of it. Puzzle answers,
story progression, endings, save semantics, room identities and the Act-1/2
distortions (false kitchen, deleted child room, archive swap, window
disagreement) are unchanged.

## Files added

| File | Purpose |
|---|---|
| `js/condition.js` | `Condition` ledger: per-element dirty state, severity, fly attractor strength; flag-driven overrides; persistent. |
| `js/windows.js` | `Windows.build()` clipped exterior scenes (night/dawn/day/sunset/sea): translucent clouds, tiered treelines, near trees, birds, glass tint/reflections — always clipped; frame drawn by caller above. |
| `js/previews.js` | `Previews.through()` doorway-truth renderer; registered `kitchen` (with act-2 `falseKitchen` aperture overlay) and `sittingroom`. |
| `js/artlib.js` | Shared `Art.*` primitives: paintings (pixel-reconstructed), fireplace + layered fire, fridge/milk/apples/safe/garbage bags, lamp/side table/armchair/sofa/rug. |
| `js/painting-data.js` | Shipped extraction artifact (grids + palettes) for the three paintings. |
| `js/debug.js` | Debug overlays (z-order, window clips, fly detectors/attractors, dirty state, water state, nav edges, hotspots). |
| `scripts/gen/painting.js` | Offline pipeline: sharp → deterministic k-means → per-pixel base36 rows; writes `js/painting-data.js`, `art/extracted/*`, `art/palettes/*`. |
| `scripts/qa/nav_audit.js` | Arrow/tooltip/graph audit per room; hallway-left = outside. |
| `scripts/qa/fly_sim.js` | 6000-tick separation/spread/state/attractor simulation. |
| `scripts/qa/open_close.js` | Reversibility audit for every curated openable. |
| `scripts/qa/quality_matrix.js` | high/medium/low stills + pixel-diff gate per room. |
| `docs/GRAPHICS_PIPELINE.md`, `docs/DOORWAY_CONTINUITY.md` | Standing documentation of the two core methods. |
| `art/` | Reference imagery + extraction traces (PNGs git-ignored; see ASSET_SOURCES). |

## Files changed

- `js/rooms.js` — kitchen rebuilt on `Windows.build` + `Art.*` appliances;
  dining: clipped dawn window, pencil marks removed, sitting doorway with
  live preview, still-life painting; hallway: real kitchen glimpse via
  preview, oil painting, left arrow = leave; NEW `svgSittingroom` (masonry
  fireplace, layered animated fire, mantel 8:17 clock, painting, armchair,
  sofa, lamp, log basket); landing window rebuilt clipped (day scene);
  child-room bed redesigned (turned posts, pillows, blanket folds); basement
  boiler redesigned (seams, gauge, sight glass, valve, wall pipes); batteries
  as labelled cells; hatch pull-cord pendulum; quality tiers (`QH`/`QM`)
  added to hallway, landing, childroom, basement, study, attic, gallery,
  bathroom, conservatory, porch.
- `js/config.js` — `sittingroom` in graph/floors; `EXIT_DESCRIPTORS`,
  derived `NAV_ARROWS`, `exitDescriptor()`, `DOOR_SAFE`.
- `js/puzzles.js` — `gositting` + full sittingroom action set; kitchen
  drawer and lockbox gained close states (reversibility); inventory-safe
  dialogue keys.
- `js/fx.js` — fly engine v2 (personal space, states, ~45% loose flock,
  Condition-driven attractors, QA hooks incl. `_flyStateCounts`); gated by
  `AnimReg flyWander`.
- `js/main.js` — `openInventory()` locked until `hasBag` with plain dialogue.
- `js/anim-registry.js` — new ids: `windowClouds`, `fireFlicker`, `ropeSway`, `flyWander`.
- `css/style.css` — arrow idle glow pulse + true-destination tooltips.
- `index.html` — script order for the new modules.
- QA harnesses (`jsdom_check`, `jsdom_check2`, `render`, `render_still`) —
  file lists completed; expectations updated to the new world (sane flies,
  clipped windows, sitting room graph).
- `alwaysDo.md` — rules 9–17 (tiers, open/close, glass clip, fly space,
  doorway truth, edge doors, inventory gate, water states, spiders/webs).
- `docs/ASSET_SOURCES.md`, `docs/TEST_PLAN.md`, `docs/KNOWN_ISSUES.md` —
  honesty + coverage updates. `.gitignore` — reference PNGs excluded.

## System status (this pass)

- `jsdom_check.js`, `jsdom_check2.js`: ALL CHECKS PASSED.
- `nav_audit.js`: NAV AUDIT PASSED (13 rooms).
- `fly_sim.js`: FLY SIM PASSED (min separation 2.4 px over 6000 ticks, bbox
  273k–506k px², six behaviour states, attractors 3.34 dirty → 0.88 tidied).
- `open_close.js`: OPEN/CLOSE AUDIT PASSED (5 pairs × 4 assertions).
- `quality_matrix.js`: QUALITY MATRIX PASSED on hallway, kitchen, dining,
  sitting room, landing, childroom, basement (stills in
  `artifacts/visual-qa/`).

## Remaining limitations

- No browser in sandbox: SMIL motion (fire, cord sway, clouds) verified via
  markup + resvg stills, not live playback.
- `windowView()` legacy pixel renderer remains defined but unused.
- Basement tier differences are structural but subtle in the dark (noted in
  KNOWN_ISSUES).
- Porch/memory not in the default matrix list; porch tiers ride the forest
  generator's own quality gates.
