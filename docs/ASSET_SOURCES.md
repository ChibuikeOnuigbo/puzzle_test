# ASSET SOURCES

**HOUSE 17 ships zero external assets and zero runtime images.** Everything
visible and audible on screen is authored inside this repository as inline
SVG/DOM/WebAudio. This table is the honest record of how every asset class is
produced, including the one place AI imagery touches the project — offline,
as reference only.

| Asset category | Source | License |
|---|---|---|
| All room scenes (porch, hallway, kitchen, dining, sitting room, study, basement, fifth room, etc.) | Hand-authored inline SVG in `js/rooms.js` | Original — same license as the project |
| Framed paintings (hallway oil, dining still life, sitting-room interior) | **Pipeline:** AI-generated reference PNGs in `art/generated/` → offline pixel/palette extraction (`scripts/gen/painting.js`, sharp + k-means) → shipped vector reconstruction `js/painting-data.js` + `Art.painting()` in `js/artlib.js`. The reference PNGs are **not shipped and never loaded at runtime**; only the extracted palettes/grids ship. | References: AI-generated, used offline as study material; shipped vectors are original transformations |
| Window views (night/dawn/day/sea, trees, clouds, moon, birds) | Programmatic generators `js/windows.js`, `js/forest-data.js`, `js/birds.js`, `js/tree-perches.js` | Original |
| UI icons, inventory items, menu house, favicon, rotate-device glyph | Hand-authored inline SVG (`js/main.js`, `index.html`) | Original |
| Puzzle close-ups (keypad, symbol dials, knocker) | Hand-authored DOM/SVG in `js/puzzles.js` | Original |
| All sound effects & ambience | Synthesized at runtime via WebAudio in `js/audio.js` — oscillators, filtered noise, envelopes. No recordings. | Original |
| Fonts | System fonts only (Georgia / system-ui). No webfonts loaded. | System |

Nothing was downloaded from itch.io, OpenGameArt, Kenney, CraftPix, or any
other source, so there are no attribution requirements and no license risk.
Research references (Forgotten Hill, There Is No Game, Game UI Database)
informed *structure and principles only* — no content, names, art, dialogue,
or puzzle solutions were reused.

**Honesty note on AI imagery:** `art/generated/painting-*.png` were produced
with a generative image model solely as *reference material* for the
extraction pipeline (per the project's graphics method: generate references,
extract pixels/contours in JS, ship the controlled vector reconstruction).
They are kept in `art/` for reproducibility, are listed in
`docs/GRAPHICS_PIPELINE.md`, and are never served to the player.

If you later replace any vector art with sourced assets, record here: asset · creator · source
URL · license · modified? · where used.
