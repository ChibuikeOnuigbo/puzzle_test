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
  kitchen:  { ripple: "#b8c98f", name: "The Kitchen" },
  study:    { ripple: "#c98f6a", name: "The Study" },
  basement: { ripple: "#7fa89a", name: "The Basement" },
  memory:   { ripple: "#d8c9a8", name: "The Fifth Room" },
  landing:  { ripple: "#a89a7f", name: "The Upstairs Corridor" },
  childroom:{ ripple: "#c9b8d8", name: "The Child's Room" },
  attic:    { ripple: "#8f8778", name: "The Attic" },
};

/* Puzzle answers & data — one source of truth */
const PUZZLE_CONFIG = {
  lockbox: {},                                   // code is per run: State.get().counts.code (milk, bread, apples, batteries)
  notebook: { order: ["sun", "star", "moon"] },  // 8:17 sun, 8:23 star, 8:31 moon
  keypad817: { code: "817" },
  knock: { pattern: ["short", "short", "long"] },
  potIndex: 2, // the pot outside the porch light's reach (0-based, rightmost)
};

/* Secrets — 5 optional discoveries. All found = secret ending. */
const SECRETS = {
  drawing:  "A child's drawing under the doormat",
  gclock:   "The grandfather clock's engraving",
  teacup:   "A cup of tea that is still warm",
  oldphoto: "A photograph dated eleven years ago",
  cam05:    "The unplugged fifth camera",
};

/* Default settings */
const DEFAULT_SETTINGS = {
  master: 0.8, sfx: 0.9, ambient: 0.6,
  reducedMotion: false, textSize: 1, parallax: true,
  subtitles: true, tiredness: true,
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
    "Blank paper waits at the bottom of the drawing stack in the child's room. If that room is gone, the archive downstairs has filed its things. Then open the satchel and rewrite the page.",
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
  diningroom: ["kitchen"],
  landing:   ["hallway", "study", "childroom", "attic"],
  study:     ["landing"],
  childroom: ["landing"],
  attic:     ["landing"],
  basement:  ["hallway", "memory"],
  memory:    ["basement"],
};

/* Edge arrows: fast navigation. Each entry maps a screen edge to the
   hotspot action that performs that travel. An arrow only appears if
   the hotspot exists in the current render (locks, deletions, torch
   gating and every other rule stay in force automatically). */
/* Edge arrows: fast navigation along real graph edges only. An arrow only
   appears when its exit exists AND the direction is not already a door the
   player clicks directly. The landing's left arrow is disabled because two
   doors (child room, study) face the player; the porch door faces the
   player so it is clicked, not arrowed. */
const NAV_ARROWS = {
  porch:      {},
  hallway:    { left: "gokitchen", right: "goup" },
  kitchen:    { left: "godining", right: "goback" },
  diningroom: { right: "dback" },
  landing:    { right: "godown" },
  study:      { left: "sback" },
  childroom:  { right: "cback" },
  attic:      { right: "aback" },
  basement:   { left: "goup" },
  memory:     {},
};
