# DOORWAY CONTINUITY — the visible world must agree with the navigable world

A house that lies through its own doorways is broken. HOUSE 17 keeps a single
source of truth for what is where, and every aperture renders the *real*
destination.

## The rules

1. **Graph truth** — `HOUSE_GRAPH` (js/config.js) lists every navigable
   connection. `EXIT_DESCRIPTORS` describes each screen-edge exit
   (destination, side, hotspot id, tooltip). `NAV_ARROWS` is *derived* from the
   descriptors, so arrow visibility, tooltip text and the graph edge cannot
   drift apart. `scripts/qa/nav_audit.js` re-derives the expected arrows by
   hand and fails on any mismatch.

2. **Doorway truth** — an opening with no closed door shows the destination
   room rendered by the destination's own builder. `js/previews.js`
   (`Previews.register(room, builder)` + `Previews.through(room, aperture,
   opt)`) clips the real room renderer into the aperture rectangle with a
   light perspective grade and depth shading. Registered previews:
   - `kitchen` — seen through the hallway's open doorway (honours the act-2
     `falseKitchen` overlay across the whole aperture, because the *lie* is
     what the player sees);
   - `sittingroom` — no longer glimpsed through a dining doorway (that door
     sits on the left wall, out of the player's facing; the exit is the left
     edge arrow `gositting`). The preview stays registered for future
     apertures and for the room's own render.

3. **No hand-painted fakes** — the old masked, hand-drawn "kitchen glimpse" in
   the hallway was removed; it could disagree with the kitchen. Anything seen
   through an aperture must come from `Previews.through`.

4. **Edge discipline** — major doors live inside `DOOR_SAFE`
   (x 140–1140, y 90–660 on 1280×720). Destinations beyond the frame use the
   glowing edge arrows (`css/style.css .nav-arrow` idle pulse + hover glow)
   whose `data-tip` is the descriptor's tooltip. The hallway's left arrow is
   "Step back outside" and raises the leaving-house dialogue; it never routes
   to the kitchen.

5. **Reversibility** — doorways with doors keep both states; see
   `alwaysDo.md` rule 10 and `scripts/qa/open_close.js`.

## Where continuity is exercised

| Aperture | Room | Shows | Notes |
|---|---|---|---|
| left doorway | hallway | kitchen | fridge/counter/window match `svgKitchen`; act-2 overlay optional |
| left edge arrow | diningroom | sittingroom | the sitting-room door is on the left WALL, not facing the player: no door drawn, arrow `gositting`, descriptor `diningroom_to_sittingroom` |
| right edge arrow | sittingroom | diningroom | `sitback`, tooltip "Back to the dining room" |
| left edge arrow | hallway | porch | `leave`, leaving-house dialogue |
| left edge arrow | kitchen | diningroom | `godining` |

## Checking

- `node scripts/qa/nav_audit.js` — arrows/tooltips/graph per room.
- `node scripts/qa/render_still.mjs hallway|diningroom out.png` — look at the
  aperture; the glimpse must read as the destination room.
- `node scripts/qa/jsdom_check2.js` — dining's exit graph row stays
  `kitchen,sittingroom`; the sitting-room exit is the left edge arrow, no
  door visual drawn.
