# Wave 4 work plan (user request 2026-09-12)

1. ALL cabinets/cupboards/drawers/trunk: open AND close (audit).
2. Unified water sim (OOP Plumbing): every tap/shower/flush/ladle behaves like the
   kitchen tap (ramped open/close, no abrupt water), random longer run times;
   repeated abuse (3-5 toggles fast) -> house valve: water off entirely for a calm
   span, then restores. Flooding accumulates while running past drain capacity;
   evaporation over real simulated time; toilets/sinks can clog (no flood when clogged).
3. Fix switches disappearing on click (stay visible, show on/off rocker state).
4. Toilets flush with water logic; can clog.
5. Towels: bigger, click = smooth damped oscillation, no cut marks.
6. Sitting room: bigger sofa + armchair; smaller firewood place.
7. Cobwebs: generated natural webs (WebGen, seeded structure stored per room in
   arrays), glued to corners (follow parallax), varied sizes/structure.
8. Linen closet: two leaves, smooth animated swing (no sudden 90 deg snap).
9. White door / white suite / washroom: dim to ash shades; floors/walls less bright/shiny.
10. All sinks work like kitchen tap; washroom (green door) rebuilt: bigger sink/toilet,
    moved forward, better angle/structure.
11. Green + white doors: generate ref imagery, extract RGB via node PNG decoder,
    recolor door pixels/decor from extracted palette (+online refs).
12. Fireplace fire: OOP particle flame (pixi flame example + refs), random morphing
    shapes, luminous core; firewood smaller, natural logs (not 2D triangles).
13. Bed: fix disconnected/floating parts; iterate with rendered screenshots in repo.
14. Trees outside windows: delete everywhere except bedroom; bedroom tree connected;
    verify via rendered zoom screenshots.
15. Hallway lamp/bulb: rebuild properly (user screenshot shows floating shade + dot).
16. Bedroom: delete old music box; add drawers (chest) with improved music box on top.
17. All drawers: 3D pull-toward-user opening, contents visible, light/shadow/wood.

QA: gates green; render stills to artifacts/ and inspect; save screenshots in repo.
