/* HOUSE 17 — DEBUG FLAGS (dev only, never visible in normal play).
   Toggle from the console:  Debug.set('flyDetectors', true)
   or load with ?debug=flyDetectors,windowClips,dirtyState,navEdges,attractors
   See docs/GRAPHICS_PIPELINE.md §debug for the full list. */
"use strict";

const Debug = (() => {
  const flags = {
    zorder: false, windowClips: false, doorwayApertures: false,
    flyDetectors: false, attractors: false, dirtyState: false,
    navEdges: false, hotspots: false, lights: false, previews: false,
  };
  try {
    const m = /[?&]debug=([^&]+)/.exec(typeof location !== "undefined" ? location.search : "");
    if (m) m[1].split(",").forEach(k => { if (k in flags) flags[k] = true; });
  } catch (e) {}
  return {
    on: id => !!flags[id],
    set(id, v = true) { if (id in flags) flags[id] = !!v; },
    list: () => ({ ...flags }),
  };
})();

(typeof window !== "undefined") && (window.Debug = Debug);
if (typeof module !== "undefined") module.exports = { Debug };
