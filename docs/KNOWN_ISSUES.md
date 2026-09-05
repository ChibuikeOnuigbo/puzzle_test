# KNOWN ISSUES

Honest list, ranked by impact. None are blockers; all have workarounds.

1. **Portrait phones show a "rotate device" overlay** instead of adapting the layout.
   The 1280×720 logical stage scales to ~0.3× in portrait, which is unreadable, so we ask
   for landscape. Landscape phones work (popups render unscaled and stay readable).
2. **Parallax uses SVG group transforms** on pointermove; on very low-end devices this can
   cost a few ms per frame. Mitigation: disable "Parallax depth" or enable "Reduced motion"
   in Settings.
3. **Dialogue queue can lag behind a fast player** — lines queue and each shows ~2s.
   Clicking the dialogue box skips/advances, which QA confirms works, but a speed-runner
   will see narration for a room they already left. Cosmetic.
4. **Audio requires a user gesture** (browser policy). The first click unlocks the
   AudioContext; anything "played" before that is silently dropped. By design.
5. **Photograph clocks in the study scene are decorative at scene scale** — the readable
   times/symbols live in the close-up popups (the designed path). A player who expects to
   read them off the wall art will need one extra click.
6. **The QA harnesses are timing-sensitive** — `break.js` section 2 clicks randomly, so
   two runs are not byte-identical (this is intentional fuzzing).
7. **No mid-dialogue save granularity** — a refresh during a fade transition restores the
   destination room but drops any unspoken narration lines. State is never lost.

## Update: atmosphere and systems pass (Sep 2026)
Added and verified this pass:
- Boot loading screen (the house "wakes up" before the menu appears).
- FX layer (js/fx.js): every room's light is now a blurred, breathing cone + slanted floor pool + drifting dust motes. No oval light shapes. Hallway/study lamps and basement power respect their toggles. Real falling rain in the child room (the window gained an honest crack). Smart flies gather to light, blood, and the mirror; they avoid the cursor and only appear in some rooms, sometimes. Cobwebs and small spiders in the linen closet, attic, and basement.
- Linen closet opens and closes on click; if left open, the living house quietly shuts it after a while.
- Dialogue: Enter (rebindable) skips/advances, with a gamified keycap. Larger font and box. All speech and events are logged (State.speechLog, State.chronicle, State.monologue), and the protagonist now and then catches himself monologuing.
- Controls settings page: every action (skip, left, right, hints, pause, room labels) can be rebound to any key; the full keyboard is enumerated in KEYBOARD_KEYS.
- Room labels ("a small room", "the study", etc.) are hidden by default and toggleable via a surveyor's lens hidden on the study desk (also the L key once found).
- Checkpoints after major tasks, with a mission-notes viewer in the HUD.
- Mirror arc (js/mirror.js): whole → cracked → shattered → healed (needs 5 hits) → ... with a 150 entry reaction dictionary; after repeated breaks the mirror moves, the wall bleeds STOP, and past the ninth break a hand reaches out of the glass. No torch: you die and return to your last checkpoint. With the torch: the hidden room, footsteps, a short escape, and a gift with house lore.
- Navigation: the landing's phantom "down" stairway and the basement's stair planks are gone (the basement hatch now falls light from above). Left/right arrows only appear for valid side exits; the landing's left arrow is disabled because two doors face the player there.

Deferred (tracked, not started): 3D section, 2D platformer memory, time of day system, room multi states, camera anomaly system, additional rooms, extended doc set.

## Update: fog, conservatory, flies, torch and inventory pass (Sep 2026)
Added and verified this pass:
- A new room: the conservatory (a glasshouse full of mist), reached from the dining room. Its gramophone is a hidden discovery.
- A >2000 line fog engine (js/fog.js): seeded value-noise drift, gusts, timed swell events, mouse-velocity clearing with a spatial clarity field that heals, and seventeen subsystems (banks, streamers, shafts, draughts, drips, vortices, wisps, bands, panes, ribbons, motes, curls, breaths, weather). Outside clears hard, interiors keep only a ceiling mist, the basement keeps floor fog, the conservatory keeps the most. Every room's fog is hand-choreographed.
- Flies are now persistent per room (built once, kept across light toggles and re-renders). The dining room carries over 300 small flies attracted to the garbage and spoilt food; they still avoid the cursor.
- The attic torch is manual: full dark until the player uses it. Tools are used by selecting one and pressing E (or double-clicking its icon); I opens the full satchel inventory.
- Inventory rebuilt: five pockets bottom centre plus an in-hand slot, a full modal with the satchel on the left and every tool's collected-time and purpose written out, and no icon clutter in the top-right corner.
- The hint button glows when the player is confused (wasted time and aimless clicking raise a confusion score; progress settles it).
- Larger top-left buttons (pause, hints, notes).

Deferred (tracked, not started): 3D section, 2D platformer memory, time of day system, room multi states, camera anomaly system, additional rooms, extended doc set.

## Update: interaction pass (Sep 2026)
Fixed in this pass:
- Dialogue no longer buffers spam clicks. say() replaces the queue; one advance per pointer event. Regression test: scripts/qa/break.js section 10.
- Repeated clicking now earns self aware protagonist lines (no condition jokes, per spec).
- Click ripple is a soft three ring wave, enabled on touch as well.
- Hint and Menu buttons enlarged to 54px targets.
- user select disabled across game UI; images cannot be dragged.
- Player facing text no longer uses hyphens or dashes.
- Kitchen: constructed table and chairs (legs, thickness, contact shadows), stove with a real flame state, tap with running water state, fridge with true open and closed states (milk countable only while open), hallway lamp toggles.

Deferred (tracked, not started): 3D section, 2D platformer memory, time of day system, room multi states, camera anomaly system, additional rooms, extended doc set.

## Update: the living house expansion (Sep 2026)
Added and verified this pass:
- Three new rooms: upstairs corridor, child room, attic (9 rooms total). Attic is dark and requires the torch hidden in the corridor closet; the torch beam follows the pointer.
- Timed attic sequence: the torch begins failing at 55 seconds and the house ejects you at 80 if you have not opened the trunk. Fully retryable, no soft lock.
- House awareness stat (State.aware). Ambient horror scheduler: creaks, distant knocks, footsteps from the wrong floor, and a rare 12 second riser drone that starts near silence and climbs, all scaled by awareness. Subtitled when sound description is on.
- Tiredness system (act 2 onward, toggle in settings): vision narrows and softens in four stages; interacting, changing rooms and running the tap keep you awake; full sleep relocates you, raises awareness, and the house writes "You missed something."
- Basement entrance is now a floor hatch (hinges, thickness, ring, contact shadow), rotated flat per request.
- Grandfather clock pendulum now swings while the hands stay at 8:17 (disabled under reduced motion); dialogue updated to match.
- Kitchen: chairs draw behind the table (correct depth), tap can overflow after 38 seconds and flood the floor after 68; the wet floor persists and carries a subtle reflection anomaly in act 2.
- Fridge anomaly: after act 2 with the lockbox solved, one milk bottle is missing (never before, so counting puzzles stay fair).
- Seventeen escalation: blocks, tally marks, skirting scratch, closet label; at the 7th deliberate seventeen the house says "You keep looking for seventeen", at the 12th "You taught me to count."
- Child room arc ends in the scripted realization: "There are signs of someone living here everywhere, and no evidence that person ever existed."
- Ending coda: the street has houses fifteen, sixteen, eighteen; no seventeen; "Which version did you leave?"

Still deferred (unchanged): true 3D mode, 2D platformer, day cycle clock, in world camera device, notebook writing, zoom, extra endings, the 31 room plan.

## V4 — Connected world pass (2026-09-02)

Shipped this pass:
- Study door moved UPSTAIRS onto the landing (locked door discovered before the key exists; the key trip crosses three rooms). Hallway got a sunset stair window instead: third conflicting sky.
- HOUSE_GRAPH in config.js + docs/ROOM_GRAPH.md room purpose matrix. Every travel action corresponds to a graph edge; no teleport links.
- Centralized z layer system: :root CSS variables (--z-world through --z-rotate), order contractual, #stage isolated. No hardcoded z values remain.
- Per run randomization: kitchen counts (milk 2 to 5, bread 1 to 3, apples 3 to 6, batteries 2 to 4) generated in State.fresh(), lockbox code derived from them, kitchen ART drawn from the counts (bottle spacing, loaf size, apple radius all adapt). Old saves without counts are healed on load.
- Tap lifecycle: on, thins at 20s, surges to overflow at 38s, floor leak at 68s, and at 95s THE HOUSE turns it off itself (scared commentary in room, or evidence found later if elsewhere).
- HouseTricks: on room entry the house may tamper (tap self on, fridge open, closet open, lamp out, music box note). Player counts occurrences out loud; special line at seventeen. Probability scales with awareness; act 2 only.
- Room deletion: child room door becomes wallpaper after an environmental warning (new crayon drawing with a room scratched out). Interior state fully preserved. Restoration puzzle: the knock rhythm on the wall.
- False kitchen: wrong clock (7:14), no moon, extra chair, hue wash; ~12s and the copy is struck, player ejected to hallway. Leaving early is rewarded. Cooldown 180s.
- window.__QA__ hook disables all house randomness for the deterministic QA harnesses.

Verified: shoot.js 0 errors (twice), break.js 0 errors, states.js 0 errors incl. forced deleted door + false kitchen renders.

Still deferred honestly: physical camera item + photo system, bag/pen/notebook inventory, mirror reflection arc, full five appearing rooms (one deletable + one false room shipped), top landing four door junction, map puzzle, house loop route, 2.5 to 4h length, perspective rebuilds of stairs/bedroom/attic.

## V5 — Dining room, archive replacement, edge arrows (2026-09-02)

- NEW ROOM: dining room off the kitchen. Lore: five settings four plates, small cushioned chair, cake gaining seventeen candles in act 2, height marks with a scratched fifth mark, portrait hung facing the wall (blank when flipped), sideboard drawer with the mother's unsent letter after the attic truth. Fourth conflicting sky (frozen dawn).
- ROOM REPLACEMENT: when the child room is deleted, the dining room is REPLACED by the archive: shelves of year labeled boxes, the child room's music box relocated onto them, chalk outline where the table stood. Restoring the child room reverts the dining room too.
- Edge arrows for fast travel: left/right screen arrows appear only when a real graph exit exists in that direction (they vanish with deleted doors since availability is checked against the rendered hotspot).
- Art fix: kitchen chair backs no longer read as ladders reaching into the counter/next room (shorter backs, finials, two rails); same treatment for the false kitchen's extra chair. Music box seated properly on the archive shelf.
- HouseTricks gained a dining tamper (the small chair moves to the head of the table).

Verified: shoot.js (39 shots incl. dining + arrow travel) 0 errors, break.js 0 errors, states.js 10 rooms + archive + dining forced renders 0 errors.

## V6 — The satchel: inventory with an appetite (2026-09-02)

- BAG/POUCH SHIPPED: a child's school satchel, physical object under the study desk (appears in act 2). Five pockets, capacity enforced. HUD bag icon opens the satchel view: five slots, TAKE OUT / PUT IN for carried items (torch, keys, pen, paper).
- THE RULE, taught by force: on pickup the character finds Entry 17 (a loose notebook page, the player reads it in full) and stores it in the satchel as part of the mission. Two room transitions later the page is GONE, replaced by an ink stain shaped like a paragraph. Objective changes to page_gone with three hint tiers.
- THE LONG CHAIN: pen is in the dining room sideboard drawer (appears only during the quest); blank paper is at the bottom of the child room drawing stack, pen required first; if the child room has been deleted, the paper is filed in the archive NOV box instead (no soft lock). With pen and paper, the satchel view offers REWRITE THE PAGE FROM MEMORY: consumes both, yields the rewritten page (kept in the coat, refused by the bag), restores the previous objective.
- Lore: the satchel is the boy's (letter: your boy left his coat). Paper stored in anything the house has held gets eaten. Entry 17 doubles as a second source for the knock rhythm.
- Bonus fix: torch now has an inventory icon (it previously had no ITEM_DEFS entry and never displayed).
- Old saves heal: bag array merges in on load.

Verified: shoot.js (44 shots incl. loose page, ink stain slot view, pen drawer, rewrite) 0 errors; break.js 0 errors; states.js 0 errors (study 13 hotspots with satchel). Dash audit clean.

## V7 — Staircase orthographic rebuild + the mirror opens (2026-09-02)

- STAIRS FIXED: the hallway staircase was a frontal "wedding cake" of stacked
  rectangles. Rebuilt as a proper side profile flight climbing right: solid
  under stair mass, twelve riser/tread steps converging on one slope, tread
  tops as shallow parallelograms (consistent three quarter depth), stringer
  skirt, newel post with cap, handrail on the same vanishing slope, balusters
  footed on treads, contact shadow, and a dark upstairs opening at the top.
  The floor hatch draws in front of the stair base (it sits before the flight).
  The sunset window moved from the top corner to over the mid flight.
- MIRROR LIFECYCLE (idea collected from uploads/stairs.html, reauthored as
  hand drawn SVG in the game's art direction): whole → cracked (spiderweb
  paths adapted from the asset's crack map, triggered on the third act 2
  look) → open (glass gone inward, dark hollow with two amber points at
  child height, animated smoke wisps, shards settled on the floor). One way
  ledger: the house never repairs it. Awareness rises at each stage.
- No canvas, no external code: the upload's JS was mined for its state
  machine and crack geometry only.

Verified: shoot.js (48 shots incl. 18b cracked / 18c open) 0 errors,
break.js 0 errors, states.js 0 errors.

## V7.1 — Stairs to the edge, window removed, basement door depth pass (2026-09-03)

- Hallway flight shifted +28px so the top step lands exactly on the frame
  edge (x=1280). The black upstairs void rectangle is gone; instead the
  handrail continues and eases toward level as it leaves the frame
  (M930,452 L1216,212 Q1258,177 1280,170), signifying the stairs go on
  past the edge. Balusters, under stair mass, newel and hotspots all moved
  with it (goup now 908,230,372,338).
- The hallway sunset window (v_hwin) is removed: art, hotspot, dialogue
  action and the QA click. Hallway is now 9 hotspots.
- Basement metal door refit: it used to run 30px below the wall/floor line.
  Now framed in a beveled steel jamb seated exactly on y=500 with a
  threshold plate and contact shadow. Depth pass: dark reveal behind a
  recessed leaf, directional falloff from the single bulb (local
  #doorlight gradient), AO inside the center panel, lit bolts, shadowed
  handle and knocker. Keypad got a drop shadow, bevel, keycap depth and a
  conduit stub into the frame.
- New QA tool scripts/qa/itemshot.js: custom itemShot(page, {room, id,
  name, flags, pad}) boots the game in QA mode, forces room + flags,
  renders, and saves a padded close-up crop of one SVG group to
  artifacts/visual-qa/items/. Used for the door 3D review
  (before 2/10 -> after ~8.5/10).

Verified: itemshot.js 0 errors, shoot.js 0 errors, break.js 0 errors,
states.js 0 errors (hallway 9 hotspots expected).

## V7.2 — Stairs further right, hatch lowered, separation verified (2026-09-03)

- Hallway flight pushed another +30px right (base x=908 -> 938) so its
  foot clears the basement hatch. The whole mass now runs past the frame
  edge (top vertex x=1310, clipped by the viewBox) with the rail continuing
  off frame (M960,452 L1246,212 Q1288,177 1310,170). Newel to x=948,
  balusters bx=974+i*34, goup hotspot 938,230,342,338.
- Basement hatch lowered 28px and nudged 16px left (top edge y=584,
  bottom 654, shadow to 677) so it sits on the floor in front of the
  staircase instead of tucking against its base. udoor hotspot now
  824,574,250,100.
- Stair ground shadow tightened (cy 572 ry 9 -> cy 566 ry 7) so even the
  soft shadow clears the hatch.
- itemshot.js now runs a separation assertion on SVG geometry (getBBox):
  stairs bbox y 170-573, hatch y 579-677, overlapY 0, 6px floor gap.
  (Previous boundingBox() based check was dropped: it read inconsistently
  against the CSS scaled stage.)

Verified: itemshot.js 0 errors (separation gapY 6), shoot.js 0 errors,
break.js 0 errors, states.js 0 errors (hallway 9 hotspots expected).

## V7.3 — Kitchen seen through the door, ceiling fog, mirror overhaul + 17 second return (2026-09-03)

- Kitchen doorway is now open: the hallway shows the kitchen through the
  opening, masked by a clipPath shaped like the doorway, so only what the
  eye could physically see is visible. Inside: receding floor with
  converging boards, far wall with the window over the sink and wall
  cabinets, the counter run with sink hint, the stove at the far end, the
  fridge close on the right in shadow, a breathing lamp glow, two darkness
  gradients (peekdark vertical + peekdeep horizontal) and a warm spill of
  hallway lamplight over the threshold. The false kitchen tints the window
  purple when active. The old "kitchen" text label is gone.
- Ceiling fog: three blurred wisps (v_fog, pointer events none) drift
  along the ceiling on 86/104/128 second loops with slow opacity breathing,
  all gated behind the reduced motion setting.
- Mirror overhaul, ideas harvested from the uploaded canvas demo
  (hand authored SVG, no canvas):
  - Bigger: rx 52/ry 70 -> rx 64/ry 88 glass, frame now 132x180 with a
    blurred outer shadow, dark body ring, warm mid ring and lit inner rim.
  - Glass is now a dark blue black gradient with one cold diagonal streak
    and a vignette rim, so the reflection reads black.
  - Cracked state keeps the spiderweb but scaled to the new size and gets
    a dark secondary crack pass for depth.
  - Shattered state now holds a blurred shadow figure (body, neck, head,
    shoulders from the demo's figure idea) behind the glass with two sharp
    amber eyes, blurred smoke drifting up, and a fifth floor shard.
  - New dialogue: the protagonist comments on the black reflection (act 1
    and act 2), exclaims when the glass cracks and when it shatters.
- Mirror return: after the shatter, every 17 seconds the house checks
  whether the player has left the hallway. The moment they are elsewhere,
  the mirror comes back cracked (flags: mirrorReturned, mirrorReturnSeen)
  with a quiet whisper tone. On the next hallway entry the protagonist is
  surprised out loud. One return only; shattering the repaired mirror gets
  its own variant lines. Module: MirrorReturn in js/core.js with
  start/stop/attempt and cadence 17000.
- QA: shoot.js gained a mirror return regression block (cadence check,
  no return while in hallway, return while away, flag assertions, shot
  18d-mirror-returned). itemshot.js gained item-kdoor-peek and four mirror
  crops (normal, act 2, cracked, open).

Verified: itemshot.js 0 errors (separation gapY 6), shoot.js 0 errors,
break.js 0 errors, states.js 0 errors (hallway 9 hotspots expected).
