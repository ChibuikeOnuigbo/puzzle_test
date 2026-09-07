/* HOUSE 17 — ROOM CONDITION STATE (docs/ENVIRONMENTAL_STATE.md)
   ============================================================================
   Every relevant object in the house has a place in a single cleanliness
   ledger. Nothing is hardcoded per fly or per room: the fly engine, the FX
   layer and the debug overlays all read from here.

   Levels (a gradient, not a binary switch):
     clean    — nothing to notice
     slight   — lived-in; a faint attractor
     dirty    — clearly unclean; a real attractor
     strong   — spoilt / rotting; a strong attractor
     waste    — open rubbish; the strongest attractor in the house

   State is PERSISTENT: it rides on State flags (save/load safe). A room can
   evolve clean → slight → dirty → strong → waste over the story, and the
   house tidying a room is a remembered event, never a re-roll per render.
============================================================================ */
"use strict";

const Condition = (() => {
  const LEVELS = { clean: 0, slight: 1, dirty: 2, strong: 3, waste: 4 };

  /* ---------------------------------------------------------------------
     THE LEDGER. One entry per environmentally meaningful object.
       room      room id
       id        element id (also used by the debug overlay)
       label     plain language name
       x, y      where the thing sits (fly target / debug marker)
       base      baseline level when nothing else is known
       flag      optional State flag OVERRIDING the level:
                   { name, when: "true"|"false", level }
                 read: if State.flag(name) === whenValue → level applies
       fly       fly-affinity multiplier on the level's attractor strength
       cleanable whether a story action can clean it (documentation)
  --------------------------------------------------------------------- */
  const LEDGER = [
    /* ---------- dining room: the rotting heart of the house ---------- */
    { room: "diningroom", id: "spoiltPlate", label: "the plate gone bad", x: 368, y: 606, base: "strong",
      flag: { name: "diningTidied", when: true, level: "clean" }, fly: 1.25, cleanable: true },
    { room: "diningroom", id: "rubbishBags", label: "the rubbish bags", x: 1118, y: 610, base: "waste",
      flag: { name: "diningTidied", when: true, level: "clean" }, fly: 1.4, cleanable: true },
    { room: "diningroom", id: "feast", label: "dinner, still warm", x: 640, y: 600, base: "slight", fly: 0.8, cleanable: false },
    { room: "diningroom", id: "tableRunner", label: "the table runner", x: 660, y: 636, base: "clean", fly: 0.4 },

    /* ---------- kitchen: someone stepped out mid-meal ---------- */
    { room: "kitchen", id: "sink", label: "the sink", x: 640, y: 438, base: "slight",
      flag: { name: "tapOverflow", when: true, level: "dirty" }, fly: 0.9, cleanable: false },
    { room: "kitchen", id: "bin", label: "the kitchen bin", x: 948, y: 560, base: "dirty", fly: 1.1, cleanable: false },
    { room: "kitchen", id: "breadBoard", label: "the bread board", x: 330, y: 420, base: "slight", fly: 0.7, cleanable: false },
    { room: "kitchen", id: "teacup", label: "the warm teacup", x: 575, y: 596, base: "slight", fly: 0.5, cleanable: false },
    { room: "kitchen", id: "floorPuddle", label: "water on the floor", x: 700, y: 650, base: "clean",
      flag: { name: "wetFloor", when: true, level: "slight" }, fly: 0.5, cleanable: true },

    /* ---------- hallway: unnervingly clean ---------- */
    { room: "hallway", id: "floor", label: "the hallway floor", x: 640, y: 600, base: "clean", fly: 0.3 },
    { room: "hallway", id: "mirrorHollow", label: "the hollow behind the mirror", x: 720, y: 256, base: "clean",
      flag: { name: "mirrorShattered", when: true, level: "dirty" }, fly: 0.8, cleanable: false },

    /* ---------- sitting room: the fire keeps it dry and clean ---------- */
    { room: "sittingroom", id: "hearth", label: "the hearth", x: 270, y: 520, base: "slight", fly: 0.4, cleanable: false },

    /* ---------- study: paper dust, nothing wet ---------- */
    { room: "study", id: "desk", label: "the desk", x: 520, y: 480, base: "slight", fly: 0.5 },

    /* ---------- attic: eleven years of undisturbed dust ---------- */
    { room: "attic", id: "dust", label: "the attic dust", x: 640, y: 420, base: "dirty", fly: 0.7 },

    /* ---------- basement: cold and slightly wrong ---------- */
    { room: "basement", id: "floor", label: "the basement floor", x: 640, y: 520, base: "slight", fly: 0.6 },

    /* ---------- bathroom: warm standing water ---------- */
    { room: "bathroom", id: "bath", label: "the warm bath", x: 660, y: 450, base: "slight", fly: 0.9, cleanable: false },

    /* ---------- conservatory: plants behave, brass does not ---------- */
    { room: "conservatory", id: "gramophone", label: "the gramophone horn", x: 1120, y: 540, base: "slight", fly: 0.7 },
    { room: "conservatory", id: "bench", label: "the iron bench", x: 640, y: 560, base: "slight", fly: 0.5 },

    /* ---------- porch: outside finds its way in ---------- */
    { room: "porch", id: "doormat", label: "the doormat", x: 640, y: 600, base: "slight", fly: 0.5 },
  ];

  const STRENGTH = { clean: 0, slight: 0.25, dirty: 0.55, strong: 0.85, waste: 1.0 };

  function flagMatches(f) {
    if (!f) return false;
    const v = (typeof State !== "undefined" && State.flag) ? State.flag(f.name) : undefined;
    return f.when === true ? !!v : !v;
  }

  /* current level of one element */
  function levelOf(room, id) {
    const e = LEDGER.find(x => x.room === room && x.id === id);
    if (!e) return "clean";
    if (e.flag && flagMatches(e.flag)) return e.flag.level;
    return e.base;
  }

  /* everything for a room, with resolved levels */
  function elements(room) {
    return LEDGER.filter(e => e.room === room).map(e => ({
      id: e.id, label: e.label, x: e.x, y: e.y,
      level: levelOf(room, e.id),
      cleanable: !!e.cleanable,
    }));
  }

  /* live attractors for the fly engine: position + strength (0..1+) */
  function attractors(room) {
    const out = [];
    for (const e of LEDGER) {
      if (e.room !== room) continue;
      const lv = levelOf(room, e.id);
      const s = STRENGTH[lv] * (e.fly != null ? e.fly : 1);
      if (s > 0.06) out.push({ x: e.x, y: e.y, s, id: e.id, label: e.label });
    }
    return out;
  }

  /* debug: one line per element */
  function describe(room) {
    return elements(room).map(e => `${e.id}:${e.level}`).join(" ");
  }

  return { LEVELS, STRENGTH, ledger: LEDGER.slice(), levelOf, elements, attractors, describe };
})();

(typeof window !== "undefined") && (window.Condition = Condition);
if (typeof module !== "undefined") module.exports = { Condition };
