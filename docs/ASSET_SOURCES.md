# ASSET SOURCES

**HOUSE 17 uses zero external assets.** Per the project's asset policy (no AI-generated art,
no unknown-license downloads), everything visible and audible is authored inside this repository:

| Asset category | Source | License |
|---|---|---|
| All room scenes (porch, hallway, kitchen, study, basement, fifth room) | Hand-authored inline SVG in `js/rooms.js` | Original — same license as the project |
| UI icons, inventory items, menu house, favicon, rotate-device glyph | Hand-authored inline SVG (`js/main.js`, `index.html`) | Original |
| Puzzle close-ups (keypad, symbol dials, knocker) | Hand-authored DOM/SVG in `js/puzzles.js` | Original |
| All sound effects & ambience | Synthesized at runtime via WebAudio in `js/audio.js` — oscillators, filtered noise, envelopes. No recordings. | Original |
| Fonts | System fonts only (Georgia / system-ui). No webfonts loaded. | System |

Nothing was downloaded from itch.io, OpenGameArt, Kenney, CraftPix, or any other source, so
there are no attribution requirements and no license risk. Research references (Forgotten Hill,
There Is No Game, Game UI Database) informed *structure and principles only* — no content,
names, art, dialogue, or puzzle solutions were reused.

If you later replace any vector art with sourced assets, record here: asset · creator · source
URL · license · modified? · where used.
