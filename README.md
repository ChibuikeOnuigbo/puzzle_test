# HOUSE 17
*A small mystery about a house that remembers.*

A complete, hand-crafted browser point-and-click mystery. You were paid to retrieve one red
notebook from a house that has been empty for eleven years. The house disagrees about the
"empty" part.

- **Playtime:** ~15–25 minutes
- **Endings:** 2 main endings + 1 secret epilogue (find all 5 optional discoveries)
- **Saves:** automatic (localStorage) — close the tab, come back, continue
- **Controls:** mouse / tap. `Esc` closes windows, `H` hints, `P` pause
- **No account, no downloads, no external assets**

## Run locally
Any static server works:
```bash
npx serve .        # then open http://localhost:3000
```

## Deploy to Vercel
This is a pure static site — no build step.
```bash
npm i -g vercel
vercel            # accept defaults; vercel.json is already configured
```
Or just import the repo in the Vercel dashboard (Framework preset: **Other**).

## Why single-player?
Vercel's serverless platform cannot host persistent Socket.IO/WebSocket servers, so a
multiplayer mode deployed there would break. The game was therefore designed to be excellent
single-player (the design docs cover how a co-op layer could be added later behind a
NetworkAdapter without touching gameplay code).

## Project layout
```
index.html          shell, menus, SEO metadata
css/style.css       design system (one palette, one visual language)
js/config.js        ALL tunables: puzzle answers, hints, objectives, room config
js/audio.js         AudioManager — every sound synthesized live via WebAudio
js/core.js          state/save, popup z-manager, custom cursor+ripple, dialogue, stage scaling
js/rooms.js         6 hand-authored SVG scenes + hotspot system (visual ≠ interaction bounds)
js/puzzles.js       close-up puzzles (keypad, dial lock, knock door) + all room actions
js/main.js          game controller: HUD, hints, settings, act transitions, endings
scripts/qa/         Playwright harnesses: shoot.js (full playthrough) & break.js (bug hunter)
docs/               design, asset sources, known issues, test plan
artifacts/visual-qa screenshots produced by the QA harnesses
```

## QA
```bash
npm i               # installs playwright-core (dev only)
npx playwright@1.49.0 install chromium
node scripts/qa/shoot.js   # plays the ENTIRE game start→ending, screenshots every screen
node scripts/qa/break.js   # spam clicks, refresh/continue, nested popups, wrong answers, restart
```
Both exit non-zero if any console/page error occurs.
