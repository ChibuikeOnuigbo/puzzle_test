/* HOUSE 17 — central configuration. Everything tunable lives here. */
"use strict";

const GAME_CONFIG = {
  version: "1.0.0",
  saveKey: "house17_save_v1",
  settingsKey: "house17_settings_v1",
  stage: { w: 1280, h: 720 },
  parallax: { enabled: true, back: 4, mid: 8, front: 14 },
  typewriterMs: 16,
  hintCooldown: 0,
};

/* Per-room presentation config: ripple accent + ambient tint */
const ROOM_CONFIG = {
  porch:    { ripple: "#8ea4b8", name: "The Porch" },
  hallway:  { ripple: "#c9a35f", name: "The Hallway" },
  diningroom: { ripple: "#b8a888", name: "The Dining Room" },
  sittingroom: { ripple: "#c98f5f", name: "The Sitting Room" },
  kitchen:  { ripple: "#b8c98f", name: "The Kitchen" },
  conservatory: { ripple: "#a8c9b8", name: "The Conservatory" },
  bathroom: { ripple: "#7fa8b8", name: "The Small Bathroom" },
  suite:    { ripple: "#b8c9d8", name: "The White Suite" },
  washroom: { ripple: "#a8c9a8", name: "The Tiled Washroom" },
  steamroom:{ ripple: "#c9a87f", name: "The Steam Room" },
  lavatory: { ripple: "#8fa8a0", name: "The Stone Lavatory" },
  gallery:    { ripple: "#9a8f7a", name: "The Back Landing" },
  study:    { ripple: "#c98f6a", name: "The Study" },
  basement: { ripple: "#7fa89a", name: "The Basement" },
  memory:   { ripple: "#d8c9a8", name: "The Fifth Room" },
  landing:  { ripple: "#a89a7f", name: "The Upstairs Corridor" },
  childroom:{ ripple: "#c9b8d8", name: "The Small Room" },
  attic:    { ripple: "#8f8778", name: "The Attic" },
  guestroom:{ ripple: "#b8a8c9", name: "The Guest Room" },
};

/* Puzzle answers & data — one source of truth */
const PUZZLE_CONFIG = {
  lockbox: {},                                   // code is per run: State.get().counts.code (milk, bread, apples, batteries)
  notebook: { order: ["sun", "star", "moon"] },  // 8:17 sun, 8:23 star, 8:31 moon
  keypad817: { code: "817" },
  knock: { pattern: ["short", "short", "long"] },
  potIndex: 2, // the pot outside the porch light's reach (0-based, rightmost)
  guestbox: { order: ["wave", "leaf", "bell"] }, // dials on the guest-room desk; symbols scratched/pressed around the house
};

/* Secrets — 5 optional discoveries. All found = secret ending. */
const SECRETS = {
  drawing:  "A child's drawing under the doormat",
  gclock:   "The grandfather clock's engraving",
  teacup:   "A cup of tea that is still warm",
  oldphoto: "A photograph dated eleven years ago",
  cam05:    "The unplugged fifth camera",
  gramophone: "A song the house refuses to let end",
};

/* Default settings */
const DEFAULT_SETTINGS = {
  master: 0.8, sfx: 0.9, ambient: 0.6,
  reducedMotion: false, textSize: 1, parallax: true,
  subtitles: true, tiredness: true,
  fog: true, fogDensity: 0.7,
  quality: "high",   // "high" | "medium" | "low" — realism vs. flat 2D
  shadows: true,     // soft shadows / ambient occlusion under objects
  // per-animation toggles for reduced-motion customization (null = use defaults).
  // Non-gameplay ambiance only; gameplay-critical motion is never listed.
  animToggles: null,
  labelsOn: false,   // room label text, toggled by the surveyor's lens
  keys: {},          // player key overrides (see Controls)
};

/* The full gamified keyboard, for the Controls page to render and validate. */
const KEYBOARD_KEYS = (() => {
  const letters = "abcdefghijklmnopqrstuvwxyz".split("").map(k => ({ key: k, glyph: k.toUpperCase() }));
  const digits = "0123456789".split("").map(k => ({ key: k, glyph: k }));
  const special = [
    { key: "Enter", glyph: "Enter" }, { key: "Space", glyph: "Space" },
    { key: "Escape", glyph: "Esc" }, { key: "Tab", glyph: "Tab" },
    { key: "Backspace", glyph: "Backspace" }, { key: "Delete", glyph: "Del" },
    { key: "Shift", glyph: "Shift" }, { key: "Control", glyph: "Ctrl" }, { key: "Alt", glyph: "Alt" },
    { key: "ArrowUp", glyph: "↑" }, { key: "ArrowDown", glyph: "↓" },
    { key: "ArrowLeft", glyph: "←" }, { key: "ArrowRight", glyph: "→" },
    { key: "Home", glyph: "Home" }, { key: "End", glyph: "End" },
    { key: "PageUp", glyph: "PgUp" }, { key: "PageDown", glyph: "PgDn" },
    { key: "`", glyph: "`" }, { key: "-", glyph: "-" }, { key: "=", glyph: "=" },
    { key: "[", glyph: "[" }, { key: "]", glyph: "]" }, { key: "\\", glyph: "\\" },
    { key: ";", glyph: ";" }, { key: "'", glyph: "'" }, { key: ",", glyph: "," },
    { key: ".", glyph: "." }, { key: "/", glyph: "/" },
  ];
  const fn = [...Array(12)].map((_, i) => ({ key: "F" + (i + 1), glyph: "F" + (i + 1) }));
  return [...letters, ...digits, ...special, ...fn];
})();

/* Default key bindings. Every action lives here so the Controls page can list them. */
const DEFAULT_KEYS = {
  skip: "Enter",        // skip / advance dialogue
  left: "ArrowLeft",    // left direction
  right: "ArrowRight",  // right direction
  hints: "h",
  pause: "p",
  labels: "l",          // toggle room labels (once the lens is found)
  inventory: "i",       // open the full inventory
  tool: "e",            // use the selected tool / equipped item
};

/* Objectives, in order */
const OBJECTIVES = {
  find_key:      "Find a way into <b>House 17</b>",
  find_study:    "Retrieve the <b>red notebook</b> from the study",
  study_locked:  "The study is locked. Find the <b>study key</b>",
  open_notebook: "The notebook has a strange <b>lock with three symbols</b>",
  after_notebook:"Something changed. Find what the <b>iron key</b> opens",
  page_gone:     "The satchel ate the page. Find a <b>pen</b> and <b>paper</b>, then rewrite it",
  basement:      "Understand what the <b>monitors</b> are showing",
  final_door:    "Open the door the house has been <b>protecting</b>",
  choice:        "Decide what the house is allowed to <b>remember</b>",
};

/* Hints — 3 tiers each, keyed by current objective */
const HINTS = {
  find_key: [
    "The note on the door was written for someone who has never been here.",
    "Read the note again: “where the light doesn't reach.” Look at what the porch light touches.",
    "Two flowerpots sit in the lamplight. One sits in shadow. Look under that one.",
  ],
  find_study: [
    "The study is somewhere upstairs.",
    "Climb the stairs at the end of the hallway, then look along the upstairs corridor.",
    "On the landing, the tall door between the picture frames and the closet is the study.",
  ],
  study_locked: [
    "Someone in this house hid things inside everyday routines. The kitchen looks like someone just stepped out.",
    "The shopping list on the fridge names four things, in a specific order. The kitchen still contains all four.",
    "Count them: milk bottles in the fridge, loaves by the board, apples in the bowl, batteries in the drawer. Enter the four counts, in list order, into the lockbox.",
  ],
  open_notebook: [
    "The photographs above the desk were not hung as decoration.",
    "Each photograph contains a clock, and each carries a small symbol. Times put things in order.",
    "Earliest to latest: 8:17, 8:23, 8:31. Set the dials to those photographs' symbols in that order: sun, star, moon.",
  ],
  page_gone: [
    "You read the page before the satchel took it. The words are still yours. You need something to write with, and something blank to write on.",
    "A pen sleeps where the napkins sleep. The dining room sideboard, through the kitchen.",
    "Blank paper waits at the bottom of the drawing stack in the small room. If that room is gone, the archive downstairs has filed its things. Then open the satchel and rewrite the page.",
  ],
  after_notebook: [
    "The hallway is not the same as when you arrived. Look at what hangs on its wall, and what lies in its floor.",
    "There is a hatch lying flat in the hallway floor. The iron key from inside the notebook has waited eleven years for it.",
    "Click the floor hatch in the hallway while the iron key is in your possession.",
  ],
  basement: [
    "Each monitor is stuck at a different time. The house is showing you one evening, out of order.",
    "The keypad asks when the house stopped. One time appears again and again: on clocks, on tape labels, in photographs.",
    "Enter 8 1 7.",
  ],
  final_door: [
    "You have heard this door's language before, on the tape upstairs.",
    "The tape ended with three knocks: two brief, one drawn out.",
    "Knock: SHORT, SHORT, LONG.",
  ],
  choice: [
    "There is no wrong answer. There is only what you can live with.",
    "Erase, and the evening is lost with everything it held. Remember, and the house keeps it, and keeps watching.",
    "Choose. The house will accept either. It only ever wanted the evening finished.",
  ],
};

/* =====================================================================
   HOUSE GRAPH: the single source of truth for how rooms connect.
   Every travel action in the game must correspond to an edge here.
   See docs/ROOM_GRAPH.md for the drawn map.
===================================================================== */
const HOUSE_GRAPH = {
  porch:     ["hallway"],
  hallway:   ["porch", "kitchen", "landing", "basement"],
  kitchen:   ["hallway", "diningroom"],
  diningroom: ["kitchen", "sittingroom"],
  sittingroom: ["diningroom", "washroom"],
  conservatory: ["gallery"],
  landing:   ["hallway", "study", "childroom", "attic", "gallery"],
  gallery:   ["landing", "conservatory", "bathroom", "suite"],
  bathroom:  ["gallery"],
  suite:     ["gallery"],
  washroom:  ["sittingroom"],
  steamroom: ["basement"],
  lavatory:  ["attic"],
  study:     ["landing"],
  childroom: ["landing"],
  attic:     ["landing", "lavatory", "guestroom"],
  guestroom: ["attic"],
  basement:  ["hallway", "memory", "steamroom"],
  memory:    ["basement"],
};

/* Which storey each room sits on. Navigation tooltips may never claim a
   destination on a different floor than the arrow actually leads to. */
const ROOM_FLOORS = {
  porch: 0, hallway: 0, kitchen: 0, diningroom: 0, sittingroom: 0,
  washroom: 0,
  basement: -1, memory: -1, steamroom: -1, guestroom: 1,
  landing: 1, gallery: 1, conservatory: 1, bathroom: 1, suite: 1,
  lavatory: 1, study: 1,
  childroom: 1, attic: 1,
};

/* =====================================================================
   EXIT DESCRIPTORS — the single source of truth for navigation.
   Each edge declares: source room, destination, screen direction, the
   hotspot that performs it, whether it is a visible doorway or an
   off-screen edge exit, and the exact tooltip. NAV_ARROWS is DERIVED
   from this table (see bottom of file), so tooltip, arrow, hotspot and
   graph edge can never disagree.  See docs/DOORWAY_CONTINUITY.md.
===================================================================== */
const EXIT_DESCRIPTORS = {
  hallway: [
    /* the kitchen faces the player through an OPEN doorway, so it is
       clicked directly. The left ARROW is the way back OUTSIDE. */
    { id: "hallway_to_porch", from: "hallway", destination: "porch", screenSide: "left",
      hotspot: "leave", type: "edge_exit", tooltip: "Step back outside" },
    { id: "hallway_to_landing", from: "hallway", destination: "landing", screenSide: "right",
      hotspot: "goup", type: "stairs", tooltip: "Up the stairs" },
  ],
  kitchen: [
    { id: "kitchen_to_diningroom", from: "kitchen", destination: "diningroom", screenSide: "left",
      hotspot: "godining", type: "edge_exit", tooltip: "Through to the dining room" },
    { id: "kitchen_to_hallway", from: "kitchen", destination: "hallway", screenSide: "right",
      hotspot: "goback", type: "edge_exit", tooltip: "Back to the hallway" },
  ],
  diningroom: [
    { id: "diningroom_to_kitchen", from: "diningroom", destination: "kitchen", screenSide: "right",
      hotspot: "dback", type: "edge_exit", tooltip: "Back to the kitchen" },
    /* the sitting room is around the left wall, NOT facing the player, so it
       is carried by the left edge arrow (no door drawn in the scene) */
    { id: "diningroom_to_sittingroom", from: "diningroom", destination: "sittingroom", screenSide: "left",
      hotspot: "gositting", type: "edge_exit", tooltip: "Through to the sitting room" },
  ],
  sittingroom: [
    { id: "sittingroom_to_diningroom", from: "sittingroom", destination: "diningroom", screenSide: "right",
      hotspot: "sitback", type: "edge_exit", tooltip: "Back to the dining room" },
  ],
  conservatory: [
    { id: "conservatory_to_gallery", from: "conservatory", destination: "gallery", screenSide: "left",
      hotspot: "cback", type: "edge_exit", tooltip: "Back to the corridor" },
  ],
  gallery: [
    { id: "gallery_to_landing", from: "gallery", destination: "landing", screenSide: "right",
      hotspot: "gback", type: "edge_exit", tooltip: "Back along the corridor" },
  ],
  bathroom: [
    { id: "bathroom_to_gallery", from: "bathroom", destination: "gallery", screenSide: "left",
      hotspot: "bback", type: "edge_exit", tooltip: "Back to the corridor" },
  ],
  suite: [
    { id: "suite_to_gallery", from: "suite", destination: "gallery", screenSide: "left",
      hotspot: "suback", type: "edge_exit", tooltip: "Back to the corridor" },
  ],
  washroom: [
    { id: "washroom_to_sittingroom", from: "washroom", destination: "sittingroom", screenSide: "left",
      hotspot: "wback", type: "edge_exit", tooltip: "Back to the sitting room" },
  ],
  steamroom: [
    { id: "steamroom_to_basement", from: "steamroom", destination: "basement", screenSide: "left",
      hotspot: "stback", type: "edge_exit", tooltip: "Back to the basement" },
  ],
  lavatory: [
    { id: "lavatory_to_attic", from: "lavatory", destination: "attic", screenSide: "left",
      hotspot: "lvback", type: "edge_exit", tooltip: "Back to the attic" },
  ],
  guestroom: [
    { id: "guestroom_to_attic", from: "guestroom", destination: "attic", screenSide: "left",
      hotspot: "guback", type: "edge_exit", tooltip: "Back to the attic" },
  ],
  landing: [
    { id: "landing_to_gallery", from: "landing", destination: "gallery", screenSide: "left",
      hotspot: "gogallery", type: "edge_exit", tooltip: "The corridor bends left" },
    { id: "landing_to_hallway", from: "landing", destination: "hallway", screenSide: "right",
      hotspot: "godown", type: "stairs", tooltip: "Down the stairs" },
  ],
  study: [
    { id: "study_to_landing", from: "study", destination: "landing", screenSide: "left",
      hotspot: "sback", type: "edge_exit", tooltip: "Back to the corridor" },
  ],
  childroom: [
    { id: "childroom_to_landing", from: "childroom", destination: "landing", screenSide: "right",
      hotspot: "cback", type: "edge_exit", tooltip: "Back to the corridor" },
  ],
  attic: [
    { id: "attic_to_landing", from: "attic", destination: "landing", screenSide: "right",
      hotspot: "aback", type: "edge_exit", tooltip: "Climb back down" },
  ],
  basement: [
    { id: "basement_to_hallway", from: "basement", destination: "hallway", screenSide: "left",
      hotspot: "goup", type: "stairs", tooltip: "Up the stairs" },
  ],
};

/* Screen-safe door zone (1280x720): usable doorways stay inside this
   rectangle so a door is never glued to the viewport edge. Off-screen
   destinations use the glowing edge arrows instead. */
const DOOR_SAFE = { minX: 140, maxX: 1140, minY: 90, maxY: 660 };

/* BRIGHT-ROOM LIGHT RULE — rooms whose palette reads bright (>45% light
   coverage) start DARK with the light off: a wall switch by the door turns
   it on; once on, the fixture flickers in random bursts separated by random
   10/12/15s calm spells, a dim vignette keeps the surround subdued, and dust
   hangs in the beam. */
const ROOM_LIGHTS = {
  suite:    { flag: "suiteLightOn",  at: [168, 300], flicker: true },
  washroom: { flag: "washLightOn",   at: [168, 300], flicker: true },
};

/* Edge arrows: fast navigation along real graph edges only. DERIVED from
   EXIT_DESCRIPTORS so the arrow, its tooltip, its hotspot and the graph
   edge can never disagree. An arrow only appears when its exit hotspot
   exists in the current render (locks, deletions, torch gating and every
   other rule stay in force automatically). Rooms with no descriptor (porch,
   memory) get no arrows: their exits face the player and are clicked. */
const NAV_ARROWS = (() => {
  const map = {};
  Object.keys(ROOM_CONFIG).forEach(r => { map[r] = {}; });
  Object.keys(EXIT_DESCRIPTORS).forEach(room => {
    EXIT_DESCRIPTORS[room].forEach(e => {
      map[room] = map[room] || {};
      map[room][e.screenSide] = e.hotspot;
    });
  });
  return map;
})();

/* look up the descriptor for a room + screen side (used by tooltips) */
function exitDescriptor(room, side) {
  const list = EXIT_DESCRIPTORS[room] || [];
  return list.find(e => e.screenSide === side) || null;
}
