/* HOUSE 17 — AMBIENT ANIMATION REGISTRY
   ============================================================================
   A single OOP-ish registry of every *ambient* animation object in the scene.
   It powers Settings → Reduced motion → "Customize…": each entry is something
   the player can switch off individually without turning off the whole night.

   RULES for what may appear here:
     • ambiance / atmosphere only — birds flying, branches waving, mist;
     • NEVER gameplay-critical motion (door transitions, cursor, puzzle
       feedback, dialogue, the usable tool) — that motion carries information;
     • each entry has a very short name and a one-line description of what it
       does in the world, not how it is coded.

   Code asks `AnimReg.on(id)` (true = animate). Defaults come from each entry;
   when reduced motion is on AND the player has not customized, everything is
   off (a still night). Toggling an entry flips just that object.
============================================================================ */
(function () {
  "use strict";

  const REGISTRY = [
    { id: "birds",        name: "Birds",            def: true,  desc: "Birds flying, flocking, landing and walking in the yard." },
    { id: "birdsFlock",   name: "Murmurations",     def: true,  desc: "The big, far-off flocks that turn together at dusk." },
    { id: "trees",        name: "Swaying trees",    def: true,  desc: "Branches and leaves rocking slowly in the wind." },
    { id: "windowBirds",  name: "Birds at windows", def: true,  desc: "Small birds crossing the sky behind every window of the house." },
    { id: "fog",          name: "Drifting fog",     def: true,  desc: "Mist that rolls through the rooms and across the yard." },
    { id: "moon",         name: "Moon cycle",       def: true,  desc: "The moon turning through its phases as the night passes." },
    { id: "roofShade",    name: "Branch shadows",   def: true,  desc: "Tree shadows sliding slowly across the roof tiles." },
    { id: "smoke",        name: "Chimney smoke",    def: true,  desc: "A thin thread of smoke rising from the chimney." },
    { id: "fireflies",    name: "Fireflies",        def: true,  desc: "Small lights that drift and blink in the dark yard." },
    { id: "drips",        name: "Condensation",     def: true,  desc: "Water sliding down the wet glass and dissolving." },
    { id: "motes",        name: "Dust in light",    def: true,  desc: "Specks of dust drifting through the beams of light." },
    { id: "parallax",     name: "Depth drift",      def: true,  desc: "Background layers shifting as you move the cursor." },
    { id: "ripples",      name: "Ripples",          def: true,  desc: "Small ripples where the cursor crosses water." },
    { id: "lampFlicker",  name: "Lantern flicker", def: true,  desc: "The porch lantern's flame wavering in a draught." },
    { id: "windowGlow",   name: "Window shimmer",  def: true,  desc: "The warm window light breathing very softly." },
    { id: "windowClouds", name: "Clouds at windows", def: true, desc: "Thin clouds drifting behind the glass of every window." },
    { id: "fireFlicker",  name: "Sitting-room fire", def: true, desc: "The fire in the sitting room breathing and splitting into tongues." },
    { id: "ropeSway",     name: "Hatch cord sway", def: true,  desc: "The attic hatch's pull cord oscillating like a small pendulum." },
    { id: "flyWander",    name: "Flies",           def: true,  desc: "Flies keeping their distance and circling the room's dirty things." },
  ];

  const FALLBACK = {};   // overrides set during this session
  function overrides() {
    try {
      const raw = (typeof Settings !== "undefined") && Settings.get ? Settings.get("animToggles") : null;
      return raw && typeof raw === "object" ? raw : FALLBACK;
    } catch (e) { return FALLBACK; }
  }
  function reducedMotion() {
    try { return (typeof Settings !== "undefined") && Settings.get && Settings.get("reducedMotion"); }
    catch (e) { return false; }
  }

  const AnimReg = {
    list: () => REGISTRY.slice(),
    entry: id => REGISTRY.find(r => r.id === id) || null,
    /* should this animation play right now? */
    on(id) {
      const e = REGISTRY.find(r => r.id === id);
      if (!e) return true;
      const ov = overrides();
      if (id in ov) return !!ov[id];
      // no explicit choice: follow the master reduced-motion switch
      return reducedMotion() ? false : e.def;
    },
    set(id, v) {
      const next = { ...overrides(), [id]: !!v };
      FALLBACK[id] = !!v;
      try { (typeof Settings !== "undefined") && Settings.set && Settings.set("animToggles", next); } catch (e) {}
      AnimReg._notify(id);
    },
    /* "stop all / restore all" helpers for the popup */
    setAll(v) {
      const next = {};
      REGISTRY.forEach(r => { next[r.id] = !!v; FALLBACK[r.id] = !!v; });
      try { (typeof Settings !== "undefined") && Settings.set && Settings.set("animToggles", next); } catch (e) {}
      AnimReg._notify("*");
    },
    _cbs: [],
    onChange(fn) { this._cbs.push(fn); },
    _notify(id) { this._cbs.forEach(fn => { try { fn(id); } catch (e) {} }); },
  };

  (typeof window !== "undefined") && (window.AnimReg = AnimReg);
  if (typeof module !== "undefined") module.exports = { AnimReg, REGISTRY };
})();
