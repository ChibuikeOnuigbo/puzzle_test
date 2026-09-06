# HOUSE 17 — Room Graph & Purpose Matrix

This file is the canonical floor plan. Every travel action in the game
corresponds to an edge here. The runtime copy lives in `js/config.js`
as `HOUSE_GRAPH`. If a door exists in art, it exists in this graph, and
it leads where the graph says it leads.

## HOUSE_MAP_NORMAL

```
STREET
  |
PORCH ── front door ── HALLWAY ── side door ── KITCHEN ── doorway ── DINING ROOM
                          |  \
                          |   floor hatch (iron key) ── BASEMENT ── sealed door ── MEMORY ROOM
                          |
                       staircase
                          |
                       LANDING (upstairs corridor)
                  /   /   |    \        \
   corridor bend |  child door  study door   ceiling hatch
             |   |    /      |             \
       BACK LANDING | CHILD ROOM   STUDY          ATTIC
          /      \        \
  glass door   bathroom door
        /             \
 CONSERVATORY   THE SMALL BATHROOM
```

- Ground floor: porch, hallway, kitchen, dining room (through the kitchen).
- Upstairs: landing corridor, back landing, child room, study, attic (via ceiling hatch).
- The BACK LANDING is reached from the landing's left edge (the corridor
  bends). It holds the conservatory's glass door (the conservatory moved
  upstairs with it) and a plain door into THE SMALL BATHROOM. The dining
  room used to hang off this corridor by two impossible stone steps; the
  house removed that door and put a bathroom there instead, which is
  worse. The bathroom's high window looks out on a moonlit sea, twenty
  miles from any coast: the fifth wrong sky.
- Below: basement (via flat floor hatch in the hallway), memory room beyond the sealed door.
- The study door is UPSTAIRS, on the landing, between the picture frames
  and the linen closet. The key for it is found downstairs (kitchen lockbox),
  forcing the discover locked door, descend, solve, return, unlock loop.

## HOUSE_MAP_DISTORTED (act 2 divergences)

- The child room door on the landing can be DELETED: the door becomes
  wallpaper with a faint pressed outline of a frame. Restoring it is a
  puzzle (the knock rhythm learned from the tape and the basement door).
  The room interior state survives deletion untouched.
- A FALSE KITCHEN can be waiting behind the real kitchen doorway:
  wrong clock time, no moon in the window, a third chair. Roughly twelve
  seconds later the copy is struck like a stage set and the player is
  returned to the hallway. Leaving early is the correct play.
- Windows stop agreeing about the outside: porch night, kitchen night,
  hallway stair window sunset, landing window its own light, child room rain.

## Room purpose matrix

| Room | Floor | Adjacent | Entry / exit | Key objects | Required puzzle | Optional | Story purpose | Anomaly potential | Revisit changes |
|---|---|---|---|---|---|---|---|---|---|
| porch | 0 | hallway | front door | doormat, pots, house key | find house key (under pot) | drawing secret under mat | threshold, establishes night | low | act 2 door text |
| hallway | 0 | porch, kitchen, landing, basement | front door, kitchen door, stairs, floor hatch | grandfather clock, family photo, coat rack, lamp, sunset stair window, floor hatch | reach study (via stairs); open hatch with iron key | clock engraving secret | hub; teaches geometry; 8:17 motif | lamp trick, photo gains a fifth figure | hatch keyhole appears in act 2 |
| kitchen | 0 | hallway | side door | shopping list, fridge/milk, bread board, apple bowl, battery drawer, lockbox, tap, clock, chairs, table | count items → lockbox code (per run) → study key | teacup secret, stove, tap lifecycle | most loved room; counting puzzle heart | tap self on, fridge opens, milk bottle vanishes, FALSE KITCHEN | flood stain, chair moves, counts change per run |
| landing | 1 | hallway, study, childroom, attic | stairs down, study door, child door, ceiling hatch | three frames, skirting scratch, linen closet (torch), corridor window | unlock study door with brass key | torch for attic; frames observation | upstairs corridor; the house's memory wall | closet opens itself, CHILD DOOR DELETION | middle frame empties in act 2 |
| study | 1 | landing | study door | desk, red notebook, dials puzzle, tape player | dial sequence (sun, star, moon) → notebook → iron key | photographs, drawers | the errand's destination; act 2 pivot | low (protected room) | warmth, tape reveals knock rhythm |
| childroom | 1 | landing | child door | bed, blocks, drawings, music box, books, rain window | none required | block letters, drawings, music box | the room that "never existed" | music box plays itself; the whole ROOM can be deleted and knocked back | state preserved across deletion |
| attic | 1.5 | landing | ceiling hatch | trunk, fifth chair, tally marks, boxes, small window | torch required; timed exploration (torch dies ~80s, retry allowed) | tallies, fifth chair truth | the hidden fifth place at the table | darkness itself | tallies grow |
| basement | -1 | hallway, memory | floor hatch, sealed steel door | monitors, tape machine, sealed door | knock pattern short short long | monitor observations | surveillance heart of the house | screens show the player | — |
| gallery | 1 | landing, conservatory, bathroom | corridor bend (left arrow), glass door, bathroom door | framed photograph of the house from the path, window over the porch roof, a chair facing the wall | none required | the photograph, the window, the chair | the room that proves the outside is a lie | mist seeps under the glass door, cold light under the bathroom door | the chair is warm |
| diningroom | 0 | kitchen | kitchen doorway, boarded fireplace (was the steps-up door) | five settings four plates, cake (17 candles in act 2), small cushioned chair, turned portrait, doorframe height marks, sideboard drawer, dawn window | none required | letter after attic truth; portrait flip | the family kept a fifth place; mother's unsent letter | small chair moves; BECOMES THE ARCHIVE when the child room is deleted (its contents get filed here: music box on the shelf, chalk outline where the table stood) | archive appears/reverts with deletion state |
| bathroom | 1 | gallery | bathroom door off the back landing | clawfoot bath full of still warm water, high window onto a moonlit sea, washstand with full jug, mirror cabinet ajar, damp grey towel, wrung bath mat | none required | the bath, the sea window, the towel | the fifth wrong sky; the room the house keeps ready for someone | steam hangs over the warm water | the water is warm before you touch it |
| memory | -1 | basement | sealed door | master reel, figure, small bed, camera | final choice: ERASE or REMEMBER | figure, drawings | the erased evening; both endings | is itself the anomaly | — |

## Cross room puzzle chains

1. Porch note → hallway → stairs → landing → LOCKED study door →
   kitchen list → count milk, bread, apples, batteries (counts are
   randomized per run, art matches the counts) → lockbox code →
   brass key → back up to the landing → study.
2. Study tape (knock rhythm) → basement sealed door AND the wall where
   the child door used to be (same rhythm restores the deleted room).
3. Attic torch: landing closet → torch → ceiling hatch → attic.
4. Clock motif: hallway 8:17 → kitchen 8:17 → false kitchen shows 7:14
   (the tell that a room is a copy).

## Deletion / restoration invariants

- `roomDeleted_child` only redraws the landing wall; no child room flags
  are ever cleared, so its interior state (open/closed, seen objects)
  survives restoration exactly.
- Deletion warnings are environmental (a new crayon drawing with one room
  scratched out), never a countdown UI.
- Failure never destroys saves; restoration is always possible via the
  knock rhythm the player has already been taught.

## Edge arrow navigation

`NAV_ARROWS` in config.js maps screen edges to travel hotspots. An arrow
renders only when its hotspot exists in the current scene, so locked,
deleted, or gated exits take their arrow with them automatically:
porch right→hallway; hallway left→kitchen, right→stairs; kitchen
left→dining, right→hall; dining right→kitchen (its left wall is now a
boarded fireplace, not an exit); landing left→back landing,
right→downstairs; gallery right→corridor (its two doors are clicked, not
arrowed); study left→landing; child room right→corridor; attic
right→climb down; conservatory left→back landing; bathroom left→back
landing; basement left→stairs up.

## Replacement chain (V5)

child room deleted (landing wall) → dining room REPLACED by the archive
(shelves, filed boxes, relocated music box, chalk outline) → knock the
wall rhythm upstairs → child room returns AND the dining room reverts.
Two rooms change shape from one deletion; restoration heals both.

## The satchel quest (V6 cross room chain)

study (satchel + Entry 17, forced storage) → any two transitions (the
house eats the page from its own satchel) → dining room sideboard (pen)
→ child room drawing stack (paper, pen required) OR archive NOV box if
the room is deleted → satchel view → rewrite from memory. Five rooms,
one lesson: never let the house hold your words.
