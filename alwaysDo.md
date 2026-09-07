# alwaysDo.md — standing rules for every creation in HOUSE 17

**Read this before adding or changing ANY scene, room, window, object or
ambient effect.** Each rule is a promise the game already keeps everywhere; a
new creation that breaks one is a bug. Rules are written as
`Action / when / how / where it lives / how to check`.

---

## 1. Show birds moving — for every window created

| | |
|---|---|
| **Action** | Birds must be seen flying past behind the glass. |
| **When** | Every time a window (or any glass that looks OUT of the house: a pane, a round porthole, a glass wall, a far window seen through a doorway) is created or redrawn. |
| **How** | Call `windowBirds(id, glass, opt)` from `js/rooms.js` **inside the glass clip and BEFORE the mullions/frame** so the bars pass in front of the birds. `glass` is `{x,y,w,h}` or `{cx,cy,r}` for a round window. Use `count` 2–5, `flock:true` on at least one bigger window per floor, `band` to keep them in the sky part of the view, `color` to fit the sky (pale for a daylight sky). Birds flap (wings foreshorten + sweep, then glide), ride a curved path, and wait off-glass between passes. |
| **Where it lives** | `js/rooms.js → windowBirds()`; registry id `windowBirds` ("Birds at windows") in `js/anim-registry.js`. |
| **Check** | Render the room (`node scripts/qa/render_still.mjs <room> out.png`) — the stats line must list the window id with a bird count, e.g. `{"wb":["kwin:3"]}`. With motion off (`AnimReg.set('windowBirds', false)`) exactly ONE still bird hangs in the pane, off the centre mullion. |

Windows currently covered: `cwin` (child room), `dwin` (dining dawn),
`gwin` (gallery), `kwin` (kitchen), `hkwin` (kitchen window seen from the
hallway doorway), `lwin` (landing daylight), `awin` (attic porthole), `swin`
(study), `bwin` (bathroom sea), `cons` (conservatory glass walls).
The porch's outside windows (`v_win1/v_win2`) are looked INTO, not out of —
no birds there; the porch has the full canvas bird engine instead.

## 2. Wet glass gets real drops — when the weather touches a window

| | |
|---|---|
| **Action** | Water that is touching the pane must be drawn ON the glass, over everything behind it. |
| **When** | Any window in rain, or any glass described as wet/sweating/condensing. |
| **How** | `glassDrops(id, {x,y,w,h})` from `js/rooms.js`, placed AFTER the frame/mullions (it sits on the inside face of the glass). Beaded lens droplets (dark foot, transparent centre, pale rim, pin highlight) + heavier drops that swell, run with a side wobble, leave a wet trail, fade. No blur filters. Falling rain (in the air, behind the glass) stays in the FX layer (`js/fx.js buildRain`). |
| **Where it lives** | `js/rooms.js → glassDrops()`; registry id `drips` ("Condensation"). |
| **Check** | Render stats must show `drops:["cwin:48/6"]` (beads/runners; 30/4 on medium, 16/2 on low). |

## 3. The view changes with the graphics tier — for every window view

| | |
|---|---|
| **Action** | What is seen THROUGH a window must respond to Settings → Graphics quality (high / medium / low), not just lose its blur. |
| **When** | Every window view and every ambient garden/sky scene. |
| **How** | Read `quality()` in `rooms.js`. HIGH = full scene (layered leaf lobes, gust, loose leaves, soft far edges, ground mist). MEDIUM = flat leaf discs, no gust, no soft edges. LOW = paper-cut silhouettes on a plain sky, fewer birds and drops. Reference implementation: `bedroomGarden()`. |
| **Check** | Render the room with `"Settings.set('quality','low')"` as the pre-script and compare to high; they must be visibly different scenes, not just sharper/blurrier. |

## 4. Wind is real — trees and foliage seen through glass move

| | |
|---|---|
| **Action** | Every tree/plant visible through a window sways; near planes move more than far planes; the whole view gusts now and then. |
| **How** | Grow real limbs with `TreePerches.growTree` (the same grower as the porch trees) and paint them as tapered quadratic paths; nest `animateTransform rotate` about each limb's root pivot; far treeline ±0.35° / 13 s, middle rank ±0.7–1.2° / 7–10 s, near limbs per-branch. One gust every ~11 s (skewX + translate) on high. Honour registry id `trees`. |
| **Check** | `AnimReg.on('trees')` false ⇒ no `animateTransform` in the view. |

## 5. No mist, fog or blur used as a "shadow"

Shadows are dark, crisp and graded, with wavy/curved (never straight)
lower edges that differ left vs right and MORPH slowly. Mist is light and
additive; never use it to darken. See `eaveShadow()`.

## 6. Everything ambient is switchable

Every new ambient motion gets an id in `js/anim-registry.js` with a one-line
plain-language description, is gated by `animOn(id)` in the renderer, and
draws a sensible still frame when off. Gameplay motion is never registered.

## 7. Nothing is loaded — everything is drawn

No runtime images. Reference art may be used at generator time only (see
`scripts/gen/`), and the game ships the vector approximation.

## 8. Verify before you hand over

Run `node scripts/qa/jsdom_check.js` (must print `ALL CHECKS PASSED`) and
render every room you touched with `scripts/qa/render_still.mjs`, then look
at the picture. Note anything that couldn't be verified in
`docs/KNOWN_ISSUES.md`.

## 9. Graphics audit — every visible element, three real tiers

| | |
|---|---|
| **Action** | Every visible house element has a quality audit; HIGH / MEDIUM / LOW must be visibly different *scenes* (structure, counts, secondary shapes), never blur/opacity of the same scene. |
| **How** | Each renderer reads `quality()` and gates detail clusters: `QH` (high-only texture strokes, highlights, props), `QM` (kept on high+medium), the rest always. See `svgHallway`, `svgKitchen`, `svgSittingroom` for the pattern. |
| **Check** | `node scripts/qa/quality_matrix.js` must print `QUALITY MATRIX PASSED` (pixel-diff threshold per room pair). |

## 10. Anything that opens must close

Every openable object (fridge, drawers, cupboards, closet, sideboard, lockbox,
hatch) has a valid close state reachable by the same hotspot. `node
scripts/qa/open_close.js` walks the curated pairs, asserts the `*Open` flag
flips both ways and the object's own SVG group differs between states.

## 11. Nothing escapes the glass

No exterior object (grass, tree, bird, cloud, sun, moon) may render outside
its window aperture. `Windows.build()` returns `{defs, exterior}` where the
exterior is one `<g clip-path=...>`; the caller draws frame/mullions/sill
AFTER it. `node scripts/qa/jsdom_check2.js` asserts the dining window has no
unclipped glow ellipse and the frame renders after the clipped exterior. New
windows must use `Windows.build` or an explicit `clipPath` + frame-after.

## 12. Flies keep personal space and answer the dirt

Separation always beats cohesion; detector boxes with padding; the swarm may
never collapse to a dot, and ~45% flock loosely while the rest wander. Fly
attractors come from the `Condition` ledger (dirty state per element), so
tidying a room weakens the swarm. `node scripts/qa/fly_sim.js` runs 6000
ticks and asserts min pairwise distance, bounding-box spread, state variety
(WANDER/ATTRACTED/DART/PAUSE/LAND/REST) and attractor response.

## 13. Doorway truth — what you see is the room you get

An opening with no closed door must show the REAL destination room, rendered
from the same code as standing in it: `Previews.through(room, aperture, opt)`
(`js/previews.js`) reuses each room's registered builder (kitchen,
sittingroom). Never hand-paint a "fake" room behind a doorway. Act-2
distortions (false kitchen) pass through the same aperture as an overlay, so
the geometry still matches.

## 14. Doors never at the screen edge; arrows tell the truth

Major doorways stay inside `DOOR_SAFE` (config.js). Off-screen exits are the
softly glowing edge arrows; arrow visibility, hotspot and tooltip ALL derive
from `EXIT_DESCRIPTORS` via `NAV_ARROWS`/`exitDescriptor()`, so they can never
disagree. The hallway's LEFT arrow means "step back outside" (leaving-house
dialogue), never the kitchen — the kitchen is the open doorway you click.
`node scripts/qa/nav_audit.js` checks every room.

## 15. No inventory before the satchel

`Game.openInventory()` and the I key refuse until `hasBag` (the satchel found
in the study). The pocket bar stays hidden; the refusal is said plainly in
dialogue. Saves persist the unlock like any flag.

## 16. Water goes through states, never vanishes

drip → trickle → stream → sink fill → overflow → floor spread → drain →
residual → dry. Every transition is a visible intermediate; audio stays in
step (`js/audio.js` water synth). No abrupt disappearance.

## 17. Spiders and webs earn their place

Spiders have eight legs (body + cephalothorax + 4 visible pairs). Cobwebs only
in plausible neglect spots (corners, untouched closets, attic, basement) —
never on tidy surfaces.
