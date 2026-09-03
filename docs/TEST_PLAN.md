# TEST PLAN & RESULTS

All tests below were **actually executed** with Playwright (chromium, headless) against a
local server. Harnesses live in `scripts/qa/`. Screenshots in `artifacts/visual-qa/`.

## Automated: full playthrough (`shoot.js`) — PASSING, 0 console/page errors
- menu → settings (page 1, page 2) → new game
- porch: note popup, wrong pot, correct pot (key), doormat secret, enter house
- hallway: photo popup, clock secret, locked study feedback
- kitchen: list, all four counting objects, drawer open, teacup secret,
  lockbox wrong code (1111) then correct (3142), take study key
- study: unlock, all three photos, tape (with knock audio), dated-photo secret,
  notebook dial wrong→correct (☀★☾), act-2 transition
- hallway act 2 (changed photo, keyhole), basement dark → breaker → monitors,
  CAM 03/CAM 05, keypad 817, knock ●●━, fifth room, ending (REMEMBER)
- verified: 5/5 discoveries triggers the secret epilogue
- mobile viewport (390×844) menu renders

## Automated: bug hunter (`break.js`) — PASSING, 0 errors
1. rapid menu open/close spam
2. 12 random wild clicks mid-scene + Esc spam
3. same-hotspot spam (response variation, no crash, no duplicate pickups)
4. mid-game refresh → Continue restores exact room/state
5. 3-deep nested popups (pause→settings→erase-confirm): z-indexes strictly increasing
   (1000,1010,1020); 3×Esc unwinds cleanly to zero overlays
6. wrong keypad codes ×3 then correct; wrong knock patterns ×2 then correct
7. restart via nested confirm → clean porch state
8. resize 700×500→1600×1000 mid-game → hotspots still aligned (regression test for
   the interaction-priority fix)
9. localStorage setItem throwing → tolerated, no crash

## Bugs found & fixed during QA
- `window.RoomActions` undefined (top-level `const`) → every hotspot silently dead. Fixed.
- Large door hotspot swallowed the smaller note hotspot → generic fix: hotspots re-sorted
  so smaller areas always sit on top.
- Apple bowl showed 3-visually-countable apples for a "count 4" puzzle → art fixed.
- Objective text stale after unlocking study → fixed.
- Keypad input locked 600ms after a wrong code → immediate reset.
- "the study" label collided with HUD buttons → moved.

## Manual/visual review
Screens inspected as images: menu, porch, note, hallway (act 1 & 2), kitchen (before/after
fix), study, basement (dark/on), CAM 03, knock door, fifth room, choice, ending, mobile menu,
nested popups. Composition, palette, focal points and readability checked per screen.
