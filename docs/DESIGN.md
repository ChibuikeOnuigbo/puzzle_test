# HOUSE 17 — Design Document

## Identity
- **Title:** HOUSE 17
- **Hook:** Retrieve one notebook from a house that has been rehearsing the same evening for eleven years.
- **Core mechanic:** The environment is the interface — every code, symbol and rhythm the player needs is diegetic (counted, read, or heard inside the world).
- **Visual identity:** hand-authored flat-vector illustration; restrained palette (warm umber interiors, cold blue night, single amber accent); motivated lighting (porch lamp, desk lamp, CRT glow).
- **Tone:** quiet dread through curiosity, dry first-person narration, zero jump scares. "Make the player curious before trying to make them scared."

## The loop
Explore → notice something wrong → read/count/listen → connect → unlock → the house changes → new question.

## Structure (4 acts)
1. **The Delivery (porch → hallway):** trivial goal (get in), taught by the note ("where the light doesn't reach" → the pot in shadow). First rule: light = information.
2. **The Routine (kitchen → study):** the shopping list is the lockbox code (count milk 3, bread 1, apples 4, batteries 2 → 3142). The photographs' clocks order the notebook's symbol dials (8:17 ☀, 8:23 ★, 8:31 ☾). The tape teaches the knock rhythm (●●━).
3. **The Evening (act 2):** opening the notebook changes the house — a fifth figure joins the photograph, the mirror writes backwards, a keyhole grows under the stairs. The basement monitors show ONE evening at four times (6:52, 7:46, 8:17, 9:03). Keypad: "when did the house stop?" → 817. Door: the tape's knock.
4. **The Fifth Room:** the hidden child's bedroom. The reveal: the player IS the fifth figure — the visitor of Nov 14, eleven years ago. Final choice: ERASE or REMEMBER (two endings). All 5 discoveries → secret epilogue (CAM 05 shows tomorrow).

## Fairness contract
Every answer appears at least twice in the world before it is needed:
- 3142 — list order + four countable object groups
- symbol order — three photos each pair a time with a symbol; engraving says "as the evening passed"
- 817 — grandfather clock, kitchen clock, tape label, CAM 03, broken watch, boiler gauge
- knock — heard on tape (with subtitle transcription) + described in failure dialogue

No pixel hunting: interaction bounds are larger than visuals, and smaller hotspots always take
priority over overlapping larger ones. Wrong answers always produce a nudging line, never silence.

## Optional discoveries (5)
drawing under doormat · clock engraving · warm teacup · dated photo of the protagonist · CAM 05.
Each is pure foreshadowing of the reveal; all five unlock the epilogue.

## Systems
- **State:** flags-only, deterministic, serialized to localStorage on every change. Restart/continue restore exactly.
- **Popups:** central stack manager, strict z = 1000 + depth×10, click-outside/Esc close topmost only.
- **Cursor:** OS cursor hidden, custom ring cursor with default/hover/down states + contextual label; concentric click ripple tinted per-room; disabled on touch devices.
- **Dialogue:** typewriter with skip, queue, and per-hotspot response pools that cycle (no immediate repeats).
- **Hints:** 3 tiers per objective (nudge → direction → near-solution), gated in order, free.
- **Audio:** 100% synthesized WebAudio (drone+air ambient bed, UI blips, knocks, unlock chimes, dread swells). Master/SFX/ambient sliders.
- **Accessibility:** reduced motion (kills parallax/ripples/typewriter), 3 text sizes, sound-clue transcriptions always in text, no color-only information.

## Deliberately out of scope
Multiplayer (Vercel cannot host websockets; design keeps gameplay decoupled so a NetworkAdapter
could be added), character sprites with skeletal animation, procedural daily puzzles.
