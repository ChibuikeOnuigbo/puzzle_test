/* HOUSE 17 — FOG ENGINE
   ============================================================================
   A complete volumetric-style fog system for the game's SVG scenes.

   The fog is a field of soft, blurred blobs (each a layered ellipse or a
   wind-blown streak) arranged into "banks". Every room declares its own
   banks in FOG_PROFILES, so the same engine drives:

     • the porch / yard      — thick ground fog outdoors that rolls and curls
     • every interior        — a thin ceiling mist that clings to the plaster
     • the basement          — cold floor fog plus a drifting shaft-mist
     • the conservatory      — a whole room kept in mist behind wet glass

   THE ENGINE HAS SEVENTEEN CO-OPERATING SUBSYSTEMS
   ----------------------------------------------------------------------------
     1. BANKS      — the field itself: layered, blurred ellipses and streaks
                     that drift on a rotational noise "wind".
     2. STREAMERS  — narrow columns of mist that rise and dissolve, giving
                     the fog a slow vertical life instead of flat scrolling.
     3. GUSTS      — periodic wind-gusts that shove the whole field sideways
                     and briefly thicken it, then let it settle.
     4. EVENTS     — hand-timed choreography per room (a bank that swells,
                     a corner that exhales) so no two minutes look the same.
     5. CLARITY    — the mouse's speed parts the fog: a fast sweep clears a
                     wide swathe, stillness lets it close back in.
     6. FIELD      — a coarse spatial clarity grid that remembers where the
                     mouse has been, so a swept corridor heals slowly instead
                     of snapping shut the moment you stop moving.
     7. SHAFTS     — fog caught in a light beam: slanted trapezoids that
                     widen toward the floor and sway with the drift.
     8. DRAUGHTS   — tongues of mist curling out from under doors.
     9. DRIPS      — condensation sliding down wet glass and dissolving.
    10. VORTICES   — eddies: a blurred core, orbiting wisps, and a gentle
                     tangential tug on the surrounding bank fog.
    11. WISPS      — a foreground depth layer that passes in front of the
                     scene, softer and closer than the banks.
    12. BANDS      — drifting shadow strips cast through the mist.
    13. PANES      — condensation films on window glass with sliding streaks.
    14. RIBBONS    — long curling mist ribbons drawn as animated paths.
    15. MOTES      — dust specks twinkling in the light beams.
    16. CURLS      — fog pooling in the corners and rolling in place.
    17. BREATHS    — exhalations: puffs that swell from a point and fade,
                     the house breathing through vents and drains.
    Plus WEATHER, a slow per-room in-out cycle that thickens and thins the
    whole field over minutes.

   HOW THE FOG "CLEARS" WITH THE MOUSE
   ----------------------------------------------------------------------------
   The engine tracks pointer speed, not just position. The faster the mouse
   sweeps, the harder the fog parts: each blob's opacity falls off inside a
   radius that grows with velocity, and a room-wide "clarity" value rises
   with movement and settles when you stop. Indoors (ceiling mist) and in
   the basement (floor fog) the clearing is a nudge; outdoors it is strong
   enough to actually open the yard up.

   All motion is deterministic-ish noise (seeded per bank), reduced-motion
   renders a still fog, and the whole system can be switched off or scaled
   in Settings → Game.

   This file is intentionally large: every room's fog is hand-choreographed
   bank by bank so nothing repeats and nothing reads as a cheap overlay.
============================================================================ */
"use strict";

const Fog = (() => {

  /* ==========================================================================
     0. CONSTANTS, PRNG, AND MATH
  ========================================================================== */
  const NS = "http://www.w3.org/2000/svg";
  const STAGE_W = 1280, STAGE_H = 720;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const smoother = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
  const mix = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  const deg2rad = (d) => d * Math.PI / 180;
  const rad2deg = (r) => r * 180 / Math.PI;
  const sign = (v) => (v < 0 ? -1 : 1);
  const fract = (v) => v - Math.floor(v);
  const norm = (v, lo, hi) => (v - lo) / (hi - lo);
  const range = (v, inLo, inHi, outLo, outHi) => lerp(outLo, outHi, norm(v, inLo, inHi));
  const rampUp = (t, lo, hi) => smooth(norm(t, lo, hi));
  const rampDown = (t, lo, hi) => 1 - smooth(norm(t, lo, hi));

  /* --- seeded, deterministic PRNG (mulberry32) ---
     A per-bank seed means the fog looks identical every visit, which is
     exactly what a haunted house would do: the same mist, in the same
     corners, waiting. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function hash1(n, seed) {
    let h = (n * 2654435761 + seed * 40503) | 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  }

  /* --- value noise (2D) + fBm ---
     Used to lay banks out organically and to steer drift so the fog never
     moves in a straight line. Not "perlin" in the strict sense, but smooth,
     coherent, and cheap. */
  function valueNoise2(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = smoother(fx), sy = smoother(fy);
    const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
    const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
  }
  function fbm2(x, y, seed, octaves) {
    octaves = octaves || 4;
    let v = 0, amp = 0.5, f = 1, tot = 0;
    for (let i = 0; i < octaves; i++) {
      v += valueNoise2(x * f, y * f, seed + i * 101) * amp;
      tot += amp;
      amp *= 0.5; f *= 2.03;
    }
    return v / tot;
  }
  /* a gentle rotational flow field from two noise planes — the fog's "wind" */
  function flowAngle(x, y, t, seed) {
    const s = 0.0016;
    const a = fbm2(x * s, y * s + t * 0.11, seed, 3);
    const b = fbm2(x * s + 17.3, y * s + 8.1 - t * 0.09, seed + 77, 3);
    return (a - 0.5) * TAU * 0.9 + (b - 0.5) * 0.8;
  }

  /* --- small colour helpers --- */
  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return [255, 255, 255];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }
  function rgbToHex(r, g, b) {
    const c = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
    return "#" + c(r) + c(g) + c(b);
  }
  function shade(hex, t) {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(mix(r, 255, t), mix(g, 255, t), mix(b, 255, t));
  }
  function darken(hex, t) {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(mix(r, 0, t), mix(g, 0, t), mix(b, 0, t));
  }
  function tintToward(hex, target, t) {
    const [r, g, b] = hexToRgb(hex);
    const [tr, tg, tb] = hexToRgb(target);
    return rgbToHex(mix(r, tr, t), mix(g, tg, t), mix(b, tb, t));
  }

  /* ==========================================================================
     1. EASING + MOTION LIBRARY
     Small but complete: the fog's opacity breathing, drift easing and
     clarity settling all route through these so motion feels the same
     everywhere.
  ========================================================================== */
  const EASE = {
    linear: (t) => clamp(t, 0, 1),
    inQuad: (t) => { t = clamp(t, 0, 1); return t * t; },
    outQuad: (t) => { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); },
    inOutQuad: (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    outCubic: (t) => { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); },
    inOutCubic: (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outQuart: (t) => { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 4); },
    inOutSine: (t) => { t = clamp(t, 0, 1); return -(Math.cos(Math.PI * t) - 1) / 2; },
    outBack: (t) => { t = clamp(t, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    elastic: (t) => { t = clamp(t, 0, 1); const c4 = (TAU) / 3; return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1; },
  };
  function ease(name, t) { return (EASE[name] || EASE.inOutSine)(t); }

  /* --- phase generators: breathing curves from a time value --- */
  function breathe(t, period, depth) {
    const p = ((t % period) / period);
    return 1 - Math.sin(p * Math.PI) * depth;
  }
  function pulse(t, period, sharpness) {
    const p = ((t % period) / period);
    return Math.pow(Math.sin(p * Math.PI), sharpness || 1);
  }
  function drift(t, period) {
    const p = (t % period) / period;
    return Math.sin(p * TAU);
  }

  /* ==========================================================================
     2. FOG PROFILE DATA
     Every room's choreography. Each bank is a set of blobs sharing a region,
     a density, a drift and a hue. Regions are rectangles (or ellipses) in
     stage coordinates; a bank may hold several hundred blobs at high density,
     but blobs are cheap and blurred, so the field stays smooth.
  ========================================================================== */

  /* bank builders — a fluent, readable way to declare the fog */
  const R = {
    rect: (x, y, w, h) => ({ type: "rect", x, y, w, h }),
    ellipse: (cx, cy, rx, ry) => ({ type: "ellipse", cx, cy, rx, ry }),
    path: (d) => ({ type: "path", d }),
    band: (x0, y0, x1, y1) => ({ type: "quad", pts: [x0, y0, x1, y0, x1, y1, x0, y1] }),
    /* a slanted trapezium band — for under-door draughts and window shafts */
    trap: (p) => ({ type: "quad", pts: p }),
  };

  /* streamer config helper: narrow columns of mist that rise and dissolve */
  const STREAM = (count, w, h, dur, o) => ({ count, w, h, dur, o });
  /* event helper: a timed swell in one bank */
  const EVT = (at, swell, dur) => ({ at, swell, dur });

  const P = {
    /* ================= PORCH — the yard breathes ================= */
    porch: {
      kind: "outside", density: 1.0, tint: "#7d8b99", clarityFloor: 0.18, clarityCeil: 0.96,
      gust: { period: 24000, strength: 14, len: 2600 },
      glow: [[445, 322, "#e8a04c", 210], [640, 210, "#9cc3dc", 160], [880, 300, "#e8a04c", 120]],
      banks: [
        { seed: 101, region: R.rect(0, 560, 1280, 160), count: 34, rMin: 40, rMax: 130, oMin: 0.10, oMax: 0.30,
          drift: [10, -3], flow: 0.5, rise: -4, sway: 40, wrap: true, shape: "blob", hue: "#76839a", settle: 0.5,
          streamers: STREAM(4, 26, 130, 14000, 0.2) },
        { seed: 102, region: R.rect(0, 500, 1280, 120), count: 26, rMin: 60, rMax: 190, oMin: 0.06, oMax: 0.20,
          drift: [16, -2], flow: 0.7, rise: -2, sway: 70, wrap: true, shape: "streak", hue: "#8a97a6", settle: 0.4,
          streamers: STREAM(3, 40, 150, 16000, 0.16) },
        { seed: 103, region: R.rect(0, 640, 1280, 80), count: 30, rMin: 30, rMax: 90, oMin: 0.16, oMax: 0.36,
          drift: [22, -5], flow: 0.9, rise: -7, sway: 60, wrap: true, shape: "streak", hue: "#6d7b88", settle: 0.35,
          streamers: STREAM(5, 20, 90, 10000, 0.24) },
        { seed: 104, region: R.ellipse(240, 470, 300, 90), count: 18, rMin: 24, rMax: 70, oMin: 0.08, oMax: 0.22,
          drift: [6, -4], flow: 0.4, rise: -6, sway: 30, wrap: false, shape: "blob", hue: "#96a3b2", settle: 0.6 },
        { seed: 105, region: R.ellipse(1030, 500, 320, 100), count: 18, rMin: 26, rMax: 74, oMin: 0.08, oMax: 0.24,
          drift: [8, -3], flow: 0.45, rise: -5, sway: 34, wrap: false, shape: "blob", hue: "#96a3b2", settle: 0.55 },
        { seed: 106, region: R.band(452, 680, 830, 720), count: 16, rMin: 20, rMax: 60, oMin: 0.10, oMax: 0.24,
          drift: [-6, -2], flow: 0.3, rise: -3, sway: 24, wrap: false, shape: "streak", hue: "#8f9aa6", settle: 0.5 },
        { seed: 107, region: R.rect(0, 40, 1280, 180), count: 14, rMin: 60, rMax: 200, oMin: 0.03, oMax: 0.10,
          drift: [9, 1], flow: 0.3, rise: 0, sway: 90, wrap: true, shape: "streak", hue: "#98a5b3", settle: 0.7 },
        { seed: 108, region: R.rect(0, 300, 500, 240), count: 14, rMin: 50, rMax: 140, oMin: 0.04, oMax: 0.12,
          drift: [13, -1], flow: 0.5, rise: -1, sway: 60, wrap: true, shape: "blob", hue: "#8b98a5", settle: 0.6 },
        { seed: 109, region: R.trap([150, 520, 200, 520, 320, 660, 120, 660]), count: 10, rMin: 24, rMax: 62, oMin: 0.10, oMax: 0.24,
          drift: [4, -5], flow: 0.4, rise: -6, sway: 26, wrap: false, shape: "streak", hue: "#6f7c88", settle: 0.5,
          streamers: STREAM(2, 18, 100, 12000, 0.2) },
        { seed: 110, region: R.trap([1100, 520, 1160, 520, 1240, 664, 1040, 664]), count: 10, rMin: 24, rMax: 62, oMin: 0.10, oMax: 0.24,
          drift: [4, -5], flow: 0.4, rise: -6, sway: 26, wrap: false, shape: "streak", hue: "#6f7c88", settle: 0.5,
          streamers: STREAM(2, 18, 100, 12000, 0.2) },
        { seed: 111, region: R.ellipse(640, 360, 380, 92), count: 16, rMin: 28, rMax: 80, oMin: 0.05, oMax: 0.14,
          drift: [9, -2], flow: 0.45, rise: -3, sway: 42, wrap: false, shape: "blob", hue: "#93a0ae", settle: 0.55 },
        { seed: 112, region: R.rect(0, 220, 1280, 150), count: 16, rMin: 60, rMax: 170, oMin: 0.03, oMax: 0.09,
          drift: [15, -1], flow: 0.6, rise: -1, sway: 82, wrap: true, shape: "streak", hue: "#9aa7b4", settle: 0.6 },
        { seed: 113, region: R.band(300, 640, 720, 700), count: 12, rMin: 22, rMax: 60, oMin: 0.08, oMax: 0.2,
          drift: [7, -3], flow: 0.4, rise: -4, sway: 28, wrap: false, shape: "streak", hue: "#7c8894", settle: 0.45 },
        { seed: 114, region: R.ellipse(700, 560, 220, 70), count: 12, rMin: 20, rMax: 52, oMin: 0.09, oMax: 0.22,
          drift: [5, -4], flow: 0.35, rise: -5, sway: 22, wrap: false, shape: "blob", hue: "#84909c", settle: 0.5 },
      ],
      events: [
        EVT(6000, 1.5, 4000),   // a slow swell rolls in from the left after a few seconds
        EVT(18000, 1.4, 5000),
        EVT(34000, 1.6, 4200),
        EVT(52000, 1.5, 4600),
        EVT(72000, 1.35, 4000),

      ],
    },

    /* ================= HALLWAY — mist at the ceiling ================= */
    hallway: {
      kind: "ceiling", density: 0.55, tint: "#8a7f6c", clarityFloor: 0.55, clarityCeil: 0.9,
      gust: { period: 30000, strength: 6, len: 2000 },
      glow: [[720, 384, "#e8a04c", 150]],
      banks: [
        { seed: 201, region: R.rect(0, 84, 1280, 150), count: 22, rMin: 46, rMax: 130, oMin: 0.05, oMax: 0.14,
          drift: [7, 0], flow: 0.4, rise: -2, sway: 50, wrap: true, shape: "blob", hue: "#8a7f6c", settle: 0.7,
          streamers: STREAM(2, 22, 80, 18000, 0.12) },
        { seed: 202, region: R.rect(0, 96, 1280, 90), count: 16, rMin: 30, rMax: 80, oMin: 0.06, oMax: 0.16,
          drift: [11, 0], flow: 0.5, rise: -1, sway: 60, wrap: true, shape: "streak", hue: "#7a7264", settle: 0.65 },
        { seed: 203, region: R.ellipse(340, 150, 180, 70), count: 10, rMin: 26, rMax: 60, oMin: 0.06, oMax: 0.15,
          drift: [5, -1], flow: 0.35, rise: -2, sway: 28, wrap: false, shape: "blob", hue: "#958a76", settle: 0.75 },
        { seed: 204, region: R.ellipse(960, 150, 200, 74), count: 10, rMin: 26, rMax: 62, oMin: 0.06, oMax: 0.15,
          drift: [5, -1], flow: 0.35, rise: -2, sway: 28, wrap: false, shape: "blob", hue: "#958a76", settle: 0.75 },
        { seed: 205, region: R.rect(0, 178, 1280, 40), count: 12, rMin: 20, rMax: 46, oMin: 0.05, oMax: 0.12,
          drift: [-8, 0], flow: 0.3, rise: -1, sway: 36, wrap: true, shape: "streak", hue: "#7e7666", settle: 0.8 },
        { seed: 206, region: R.trap([66, 176, 234, 176, 234, 340, 66, 300]), count: 10, rMin: 20, rMax: 52, oMin: 0.06, oMax: 0.14,
          drift: [6, -2], flow: 0.3, rise: -3, sway: 20, wrap: false, shape: "streak", hue: "#a8926c", settle: 0.7,
          streamers: STREAM(1, 16, 80, 15000, 0.12) },
        { seed: 207, region: R.ellipse(720, 320, 120, 70), count: 8, rMin: 16, rMax: 40, oMin: 0.05, oMax: 0.12,
          drift: [2, -3], flow: 0.25, rise: -4, sway: 12, wrap: false, shape: "streak", hue: "#c8a878", settle: 0.7 },
        { seed: 208, region: R.rect(0, 150, 1280, 60), count: 12, rMin: 24, rMax: 60, oMin: 0.05, oMax: 0.12,
          drift: [-6, 0], flow: 0.3, rise: -1, sway: 34, wrap: true, shape: "streak", hue: "#857c6c", settle: 0.75 },
        { seed: 209, region: R.ellipse(1150, 300, 150, 60), count: 8, rMin: 18, rMax: 44, oMin: 0.05, oMax: 0.12,
          drift: [3, -2], flow: 0.25, rise: -3, sway: 16, wrap: false, shape: "streak", hue: "#968c78", settle: 0.7 },
        { seed: 210, region: R.trap([40, 220, 180, 220, 180, 420, 40, 380]), count: 8, rMin: 18, rMax: 46, oMin: 0.05, oMax: 0.12,
          drift: [5, -2], flow: 0.3, rise: -3, sway: 18, wrap: false, shape: "streak", hue: "#8a8070", settle: 0.7 },
        { seed: 211, region: R.ellipse(420, 180, 160, 60), count: 8, rMin: 20, rMax: 50, oMin: 0.05, oMax: 0.12,
          drift: [4, -1], flow: 0.3, rise: -2, sway: 22, wrap: false, shape: "blob", hue: "#958a76", settle: 0.75 },
      ],
      events: [
        EVT(9000, 1.35, 3500),
        EVT(24000, 1.3, 3000),
        EVT(36000, 1.3, 3200),
        EVT(54000, 1.25, 2800),

      ],
    },

    /* ================= KITCHEN — window steam + a ghost of the tap ================= */
    kitchen: {
      kind: "ceiling", density: 0.45, tint: "#8f8472", clarityFloor: 0.6, clarityCeil: 0.94,
      gust: { period: 36000, strength: 5, len: 1800 },
      glow: [[640, 96, "#e8a04c", 180], [640, 160, "#9cc3dc", 130]],
      banks: [
        { seed: 301, region: R.rect(0, 80, 1280, 130), count: 16, rMin: 40, rMax: 110, oMin: 0.05, oMax: 0.13,
          drift: [6, 0], flow: 0.35, rise: -2, sway: 44, wrap: true, shape: "blob", hue: "#8f8472", settle: 0.75 },
        { seed: 302, region: R.rect(520, 120, 240, 180), count: 12, rMin: 22, rMax: 56, oMin: 0.07, oMax: 0.16,
          drift: [3, -2], flow: 0.3, rise: -3, sway: 20, wrap: false, shape: "streak", hue: "#9aa6b2", settle: 0.7,
          streamers: STREAM(2, 14, 90, 13000, 0.14) },
        { seed: 303, region: R.ellipse(640, 180, 260, 70), count: 12, rMin: 28, rMax: 70, oMin: 0.05, oMax: 0.12,
          drift: [4, -1], flow: 0.3, rise: -2, sway: 30, wrap: false, shape: "blob", hue: "#a8b4c0", settle: 0.8 },
        { seed: 304, region: R.rect(560, 420, 200, 120), count: 8, rMin: 16, rMax: 40, oMin: 0.06, oMax: 0.14,
          drift: [0, -4], flow: 0.25, rise: -5, sway: 12, wrap: false, shape: "streak", hue: "#b8c8d4", settle: 0.75,
          streamers: STREAM(3, 12, 110, 9000, 0.16) },
        { seed: 305, region: R.rect(0, 470, 1280, 250), count: 12, rMin: 30, rMax: 90, oMin: 0.03, oMax: 0.09,
          drift: [5, -2], flow: 0.3, rise: -3, sway: 40, wrap: true, shape: "blob", hue: "#7d766a", settle: 0.8 },
        { seed: 306, region: R.ellipse(155, 440, 120, 70), count: 8, rMin: 16, rMax: 42, oMin: 0.05, oMax: 0.12,
          drift: [0, -3], flow: 0.25, rise: -4, sway: 10, wrap: false, shape: "streak", hue: "#c8b894", settle: 0.7,
          streamers: STREAM(2, 12, 80, 10000, 0.14) },
        { seed: 307, region: R.rect(0, 200, 1280, 120), count: 12, rMin: 36, rMax: 96, oMin: 0.04, oMax: 0.1,
          drift: [5, 0], flow: 0.3, rise: -1, sway: 40, wrap: true, shape: "blob", hue: "#857a68", settle: 0.75 },
        { seed: 308, region: R.ellipse(900, 150, 140, 60), count: 8, rMin: 18, rMax: 46, oMin: 0.05, oMax: 0.12,
          drift: [3, -2], flow: 0.25, rise: -3, sway: 16, wrap: false, shape: "streak", hue: "#a8b4c0", settle: 0.75 },
        { seed: 309, region: R.rect(60, 520, 300, 130), count: 8, rMin: 22, rMax: 56, oMin: 0.05, oMax: 0.12,
          drift: [2, -3], flow: 0.25, rise: -4, sway: 16, wrap: false, shape: "streak", hue: "#8f9288", settle: 0.7 },
        { seed: 310, region: R.ellipse(1050, 560, 140, 70), count: 8, rMin: 20, rMax: 50, oMin: 0.05, oMax: 0.12,
          drift: [0, -3], flow: 0.2, rise: -4, sway: 12, wrap: false, shape: "blob", hue: "#b8c0c0", settle: 0.7 },
      ],
      events: [
        EVT(11000, 1.4, 3600),
        EVT(27000, 1.35, 3200),
        EVT(43000, 1.35, 3400),
        EVT(63000, 1.3, 3000),

      ],
    },

    /* ================= DINING ROOM — food steam + dawn glass ================= */
    diningroom: {
      kind: "ceiling", density: 0.5, tint: "#8f8778", clarityFloor: 0.6, clarityCeil: 0.94,
      gust: { period: 34000, strength: 5, len: 1900 },
      glow: [[640, 130, "#e8c87a", 190], [220, 235, "#9fb0c2", 120]],
      banks: [
        { seed: 401, region: R.rect(0, 90, 1280, 140), count: 18, rMin: 44, rMax: 120, oMin: 0.05, oMax: 0.13,
          drift: [7, 0], flow: 0.4, rise: -2, sway: 48, wrap: true, shape: "blob", hue: "#8f8778", settle: 0.75,
          streamers: STREAM(2, 20, 80, 16000, 0.12) },
        { seed: 402, region: R.ellipse(640, 200, 300, 80), count: 12, rMin: 26, rMax: 64, oMin: 0.06, oMax: 0.14,
          drift: [4, -1], flow: 0.3, rise: -3, sway: 26, wrap: false, shape: "blob", hue: "#a89f8a", settle: 0.8 },
        { seed: 403, region: R.rect(110, 120, 220, 230), count: 10, rMin: 20, rMax: 50, oMin: 0.06, oMax: 0.14,
          drift: [2, -2], flow: 0.25, rise: -3, sway: 18, wrap: false, shape: "streak", hue: "#a8b6c2", settle: 0.75,
          streamers: STREAM(2, 14, 90, 13000, 0.13) },
        { seed: 404, region: R.ellipse(500, 600, 220, 60), count: 10, rMin: 16, rMax: 42, oMin: 0.07, oMax: 0.16,
          drift: [0, -4], flow: 0.2, rise: -5, sway: 10, wrap: false, shape: "streak", hue: "#c2c8c4", settle: 0.7,
          streamers: STREAM(3, 10, 70, 8000, 0.16) },
        { seed: 405, region: R.ellipse(700, 606, 200, 50), count: 9, rMin: 14, rMax: 38, oMin: 0.06, oMax: 0.14,
          drift: [0, -4], flow: 0.2, rise: -5, sway: 10, wrap: false, shape: "streak", hue: "#c2c8c4", settle: 0.7,
          streamers: STREAM(2, 10, 70, 8000, 0.14) },
        { seed: 406, region: R.ellipse(1120, 640, 160, 80), count: 8, rMin: 18, rMax: 46, oMin: 0.06, oMax: 0.14,
          drift: [3, -2], flow: 0.3, rise: -3, sway: 16, wrap: false, shape: "blob", hue: "#7a7264", settle: 0.7 },
        { seed: 407, region: R.rect(0, 180, 1280, 110), count: 12, rMin: 40, rMax: 104, oMin: 0.04, oMax: 0.1,
          drift: [6, 0], flow: 0.35, rise: -1, sway: 44, wrap: true, shape: "blob", hue: "#8f8778", settle: 0.75 },
        { seed: 408, region: R.ellipse(960, 200, 180, 70), count: 10, rMin: 22, rMax: 54, oMin: 0.05, oMax: 0.12,
          drift: [3, -1], flow: 0.3, rise: -2, sway: 22, wrap: false, shape: "streak", hue: "#a89f8a", settle: 0.75 },
        { seed: 409, region: R.rect(0, 560, 1280, 90), count: 12, rMin: 24, rMax: 60, oMin: 0.05, oMax: 0.12,
          drift: [5, -2], flow: 0.3, rise: -3, sway: 32, wrap: true, shape: "streak", hue: "#7a7264", settle: 0.7 },
        { seed: 410, region: R.ellipse(320, 620, 180, 70), count: 8, rMin: 18, rMax: 44, oMin: 0.05, oMax: 0.12,
          drift: [0, -4], flow: 0.2, rise: -5, sway: 10, wrap: false, shape: "streak", hue: "#c2c8c4", settle: 0.7 },
      ],
      events: [
        EVT(8000, 1.3, 3400),
        EVT(21000, 1.45, 3800),
        EVT(33000, 1.4, 3600),
        EVT(52000, 1.35, 3400),

      ],
    },

    /* ================= CONSERVATORY — mist behind wet glass ================= */
    conservatory: {
      kind: "room", density: 1.0, tint: "#6f8a84", clarityFloor: 0.3, clarityCeil: 0.88,
      gust: { period: 20000, strength: 10, len: 3000 },
      glow: [[640, 380, "#9cc3dc", 240]],
      banks: [
        { seed: 501, region: R.rect(0, 470, 1280, 250), count: 40, rMin: 50, rMax: 150, oMin: 0.10, oMax: 0.30,
          drift: [8, -2], flow: 0.5, rise: -3, sway: 60, wrap: true, shape: "blob", hue: "#6f8a84", settle: 0.4,
          streamers: STREAM(6, 24, 140, 11000, 0.22) },
        { seed: 502, region: R.rect(0, 300, 1280, 220), count: 30, rMin: 40, rMax: 120, oMin: 0.06, oMax: 0.18,
          drift: [12, -1], flow: 0.6, rise: -1, sway: 70, wrap: true, shape: "streak", hue: "#7f9a94", settle: 0.45,
          streamers: STREAM(4, 34, 160, 14000, 0.18) },
        { seed: 503, region: R.rect(0, 60, 1280, 200), count: 20, rMin: 60, rMax: 180, oMin: 0.04, oMax: 0.12,
          drift: [9, 1], flow: 0.4, rise: 0, sway: 80, wrap: true, shape: "streak", hue: "#8aa6a0", settle: 0.6 },
        { seed: 504, region: R.ellipse(180, 540, 260, 130), count: 16, rMin: 30, rMax: 80, oMin: 0.09, oMax: 0.22,
          drift: [5, -3], flow: 0.4, rise: -4, sway: 34, wrap: false, shape: "blob", hue: "#7a9a92", settle: 0.5,
          streamers: STREAM(3, 20, 110, 12000, 0.18) },
        { seed: 505, region: R.ellipse(1090, 540, 260, 130), count: 16, rMin: 30, rMax: 80, oMin: 0.09, oMax: 0.22,
          drift: [5, -3], flow: 0.4, rise: -4, sway: 34, wrap: false, shape: "blob", hue: "#7a9a92", settle: 0.5,
          streamers: STREAM(3, 20, 110, 12000, 0.18) },
        { seed: 506, region: R.ellipse(640, 620, 380, 120), count: 20, rMin: 26, rMax: 72, oMin: 0.12, oMax: 0.28,
          drift: [7, -4], flow: 0.5, rise: -5, sway: 44, wrap: false, shape: "streak", hue: "#6d8a84", settle: 0.4,
          streamers: STREAM(4, 22, 120, 10000, 0.2) },
        { seed: 507, region: R.rect(0, 0, 1280, 70), count: 14, rMin: 30, rMax: 90, oMin: 0.06, oMax: 0.16,
          drift: [5, 1], flow: 0.3, rise: 1, sway: 40, wrap: true, shape: "streak", hue: "#9cb8b0", settle: 0.6 },
        { seed: 508, region: R.trap([60, 470, 240, 470, 340, 680, 40, 680]), count: 12, rMin: 22, rMax: 60, oMin: 0.10, oMax: 0.24,
          drift: [5, -4], flow: 0.4, rise: -5, sway: 26, wrap: false, shape: "streak", hue: "#5f7a74", settle: 0.45,
          streamers: STREAM(2, 18, 120, 10000, 0.2) },
        { seed: 509, region: R.trap([1040, 470, 1220, 470, 1300, 680, 980, 680]), count: 12, rMin: 22, rMax: 60, oMin: 0.10, oMax: 0.24,
          drift: [5, -4], flow: 0.4, rise: -5, sway: 26, wrap: false, shape: "streak", hue: "#5f7a74", settle: 0.45,
          streamers: STREAM(2, 18, 120, 10000, 0.2) },
        { seed: 510, region: R.rect(0, 180, 1280, 130), count: 22, rMin: 44, rMax: 120, oMin: 0.06, oMax: 0.16,
          drift: [10, -1], flow: 0.55, rise: -1, sway: 64, wrap: true, shape: "blob", hue: "#7f9a94", settle: 0.5 },
        { seed: 511, region: R.ellipse(640, 360, 340, 120), count: 16, rMin: 34, rMax: 90, oMin: 0.08, oMax: 0.2,
          drift: [6, -2], flow: 0.5, rise: -2, sway: 40, wrap: false, shape: "streak", hue: "#8aa6a0", settle: 0.5,
          streamers: STREAM(3, 20, 110, 12000, 0.16) },
        { seed: 512, region: R.rect(0, 560, 1280, 160), count: 20, rMin: 30, rMax: 80, oMin: 0.12, oMax: 0.28,
          drift: [7, -4], flow: 0.5, rise: -5, sway: 44, wrap: true, shape: "streak", hue: "#6d8a84", settle: 0.4 },
        { seed: 513, region: R.ellipse(420, 640, 260, 110), count: 12, rMin: 24, rMax: 62, oMin: 0.11, oMax: 0.26,
          drift: [5, -4], flow: 0.4, rise: -5, sway: 30, wrap: false, shape: "blob", hue: "#7a9a92", settle: 0.45 },
      ],
      events: [
        EVT(5000, 1.5, 4200),
        EVT(14000, 1.4, 4800),
        EVT(26000, 1.6, 4000),
        EVT(38000, 1.45, 4600),
        EVT(50000, 1.5, 4400),
        EVT(66000, 1.4, 4000),

      ],
    },

    /* ================= STUDY — dust in the lamp, smoke from the lamp ================= */
    study: {
      kind: "ceiling", density: 0.4, tint: "#8a8070", clarityFloor: 0.62, clarityCeil: 0.95,
      gust: { period: 40000, strength: 4, len: 1600 },
      glow: [[520, 396, "#e8a04c", 140], [1070, 240, "#9cc3dc", 90]],
      banks: [
        { seed: 601, region: R.rect(0, 80, 1280, 130), count: 16, rMin: 40, rMax: 110, oMin: 0.05, oMax: 0.13,
          drift: [6, 0], flow: 0.35, rise: -2, sway: 44, wrap: true, shape: "blob", hue: "#8a8070", settle: 0.75,
          streamers: STREAM(2, 18, 80, 17000, 0.12) },
        { seed: 602, region: R.ellipse(520, 380, 200, 110), count: 14, rMin: 18, rMax: 46, oMin: 0.08, oMax: 0.18,
          drift: [3, -3], flow: 0.3, rise: -4, sway: 20, wrap: false, shape: "streak", hue: "#c8b894", settle: 0.6,
          streamers: STREAM(3, 12, 90, 9000, 0.16) },
        { seed: 603, region: R.rect(960, 110, 220, 260), count: 10, rMin: 22, rMax: 54, oMin: 0.05, oMax: 0.12,
          drift: [2, -2], flow: 0.25, rise: -3, sway: 18, wrap: false, shape: "streak", hue: "#a8b4c0", settle: 0.75,
          streamers: STREAM(2, 12, 80, 14000, 0.12) },
        { seed: 604, region: R.rect(380, 400, 480, 90), count: 10, rMin: 20, rMax: 56, oMin: 0.04, oMax: 0.10,
          drift: [3, -2], flow: 0.3, rise: -3, sway: 26, wrap: true, shape: "blob", hue: "#6f6656", settle: 0.8 },
        { seed: 605, region: R.rect(0, 160, 1280, 90), count: 12, rMin: 36, rMax: 96, oMin: 0.04, oMax: 0.1,
          drift: [5, 0], flow: 0.3, rise: -1, sway: 38, wrap: true, shape: "blob", hue: "#8a8070", settle: 0.75 },
        { seed: 606, region: R.ellipse(760, 200, 180, 70), count: 8, rMin: 18, rMax: 44, oMin: 0.05, oMax: 0.12,
          drift: [2, -2], flow: 0.25, rise: -3, sway: 16, wrap: false, shape: "streak", hue: "#9a9282", settle: 0.75 },
        { seed: 607, region: R.rect(0, 540, 1280, 80), count: 10, rMin: 24, rMax: 60, oMin: 0.05, oMax: 0.12,
          drift: [4, -1], flow: 0.3, rise: -2, sway: 28, wrap: true, shape: "streak", hue: "#6f6656", settle: 0.75 },
        { seed: 608, region: R.ellipse(300, 300, 140, 60), count: 8, rMin: 18, rMax: 44, oMin: 0.05, oMax: 0.12,
          drift: [3, -1], flow: 0.3, rise: -2, sway: 18, wrap: false, shape: "blob", hue: "#8a8070", settle: 0.7 },
      ],
      events: [
        EVT(13000, 1.3, 3400),
        EVT(26000, 1.3, 3200),
        EVT(44000, 1.25, 2800),

      ],
    },

    /* ================= BASEMENT — cold floor fog + shaft mist ================= */
    basement: {
      kind: "floor", density: 1.0, tint: "#5d6873", clarityFloor: 0.3, clarityCeil: 0.8,
      gust: { period: 26000, strength: 7, len: 2200 },
      glow: [[640, 126, "#e8a04c", 150], [130, 0, "#a8c8da", 160]],
      banks: [
        { seed: 701, region: R.rect(0, 470, 1280, 250), count: 40, rMin: 44, rMax: 130, oMin: 0.09, oMax: 0.26,
          drift: [6, -2], flow: 0.45, rise: -3, sway: 54, wrap: true, shape: "blob", hue: "#5d6873", settle: 0.45,
          streamers: STREAM(6, 22, 120, 10000, 0.2) },
        { seed: 702, region: R.rect(0, 500, 1280, 160), count: 28, rMin: 30, rMax: 90, oMin: 0.11, oMax: 0.28,
          drift: [9, -3], flow: 0.55, rise: -4, sway: 60, wrap: true, shape: "streak", hue: "#53606b", settle: 0.4,
          streamers: STREAM(5, 18, 100, 9000, 0.22) },
        { seed: 703, region: R.rect(0, 46, 1280, 90), count: 16, rMin: 34, rMax: 90, oMin: 0.06, oMax: 0.15,
          drift: [5, 0], flow: 0.3, rise: -1, sway: 40, wrap: true, shape: "streak", hue: "#6a7680", settle: 0.7 },
        { seed: 704, region: R.band(40, 0, 320, 500), count: 14, rMin: 22, rMax: 60, oMin: 0.07, oMax: 0.16,
          drift: [2, 3], flow: 0.3, rise: 3, sway: 20, wrap: false, shape: "streak", hue: "#8fa2b0", settle: 0.65,
          streamers: STREAM(2, 16, 120, 11000, 0.14) },
        { seed: 705, region: R.ellipse(1160, 250, 200, 120), count: 12, rMin: 20, rMax: 52, oMin: 0.05, oMax: 0.13,
          drift: [-3, -1], flow: 0.3, rise: -2, sway: 22, wrap: false, shape: "blob", hue: "#7a8892", settle: 0.7 },
        { seed: 706, region: R.rect(0, 620, 1280, 100), count: 20, rMin: 26, rMax: 70, oMin: 0.14, oMax: 0.3,
          drift: [7, -3], flow: 0.5, rise: -4, sway: 50, wrap: true, shape: "streak", hue: "#4d5a64", settle: 0.35,
          streamers: STREAM(3, 18, 90, 8000, 0.22) },
        { seed: 707, region: R.ellipse(640, 500, 240, 90), count: 10, rMin: 20, rMax: 52, oMin: 0.06, oMax: 0.14,
          drift: [2, -2], flow: 0.25, rise: -3, sway: 18, wrap: false, shape: "streak", hue: "#8fa0aa", settle: 0.6,
          streamers: STREAM(2, 14, 100, 10000, 0.14) },
        { seed: 708, region: R.rect(0, 200, 1280, 110), count: 12, rMin: 40, rMax: 104, oMin: 0.05, oMax: 0.13,
          drift: [5, 0], flow: 0.35, rise: -1, sway: 42, wrap: true, shape: "blob", hue: "#6a7680", settle: 0.7 },
        { seed: 709, region: R.ellipse(900, 420, 180, 90), count: 10, rMin: 20, rMax: 50, oMin: 0.06, oMax: 0.14,
          drift: [3, -2], flow: 0.3, rise: -3, sway: 20, wrap: false, shape: "streak", hue: "#7a8892", settle: 0.65 },
        { seed: 710, region: R.rect(0, 560, 1280, 80), count: 14, rMin: 22, rMax: 56, oMin: 0.12, oMax: 0.28,
          drift: [7, -3], flow: 0.45, rise: -4, sway: 40, wrap: true, shape: "streak", hue: "#53606b", settle: 0.4 },
        { seed: 711, region: R.ellipse(320, 640, 220, 90), count: 10, rMin: 18, rMax: 46, oMin: 0.1, oMax: 0.24,
          drift: [4, -3], flow: 0.35, rise: -4, sway: 24, wrap: false, shape: "blob", hue: "#5d6873", settle: 0.45 },
      ],
      events: [
        EVT(7000, 1.4, 3800),
        EVT(19000, 1.5, 4200),
        EVT(31000, 1.35, 3600),
        EVT(44000, 1.45, 4000),
        EVT(60000, 1.35, 3600),

      ],
    },

    /* ================= LANDING — corridor mist under daylight ================= */
    landing: {
      kind: "ceiling", density: 0.4, tint: "#a89a7f", clarityFloor: 0.62, clarityCeil: 0.95,
      gust: { period: 38000, strength: 5, len: 1800 },
      glow: [[650, 130, "#f2e3b8", 150], [600, 172, "#f2e3b8", 90]],
      banks: [
        { seed: 801, region: R.rect(0, 84, 1280, 140), count: 18, rMin: 44, rMax: 120, oMin: 0.04, oMax: 0.12,
          drift: [7, 0], flow: 0.4, rise: -2, sway: 48, wrap: true, shape: "blob", hue: "#a89a7f", settle: 0.75,
          streamers: STREAM(2, 20, 80, 16000, 0.11) },
        { seed: 802, region: R.rect(540, 130, 220, 180), count: 10, rMin: 20, rMax: 50, oMin: 0.06, oMax: 0.14,
          drift: [3, -2], flow: 0.3, rise: -3, sway: 20, wrap: false, shape: "streak", hue: "#e8dcb8", settle: 0.7,
          streamers: STREAM(2, 12, 90, 12000, 0.13) },
        { seed: 803, region: R.rect(0, 470, 1280, 40), count: 10, rMin: 24, rMax: 64, oMin: 0.04, oMax: 0.10,
          drift: [5, 0], flow: 0.3, rise: 0, sway: 34, wrap: true, shape: "streak", hue: "#8f866e", settle: 0.8 },
        { seed: 804, region: R.rect(0, 200, 1280, 90), count: 12, rMin: 36, rMax: 96, oMin: 0.04, oMax: 0.1,
          drift: [6, 0], flow: 0.35, rise: -1, sway: 40, wrap: true, shape: "blob", hue: "#a89a7f", settle: 0.75 },
        { seed: 805, region: R.ellipse(900, 200, 160, 64), count: 8, rMin: 18, rMax: 44, oMin: 0.05, oMax: 0.12,
          drift: [3, -1], flow: 0.3, rise: -2, sway: 18, wrap: false, shape: "streak", hue: "#c0b498", settle: 0.75 },
        { seed: 806, region: R.rect(0, 540, 1280, 60), count: 10, rMin: 22, rMax: 56, oMin: 0.05, oMax: 0.12,
          drift: [4, -1], flow: 0.3, rise: -2, sway: 28, wrap: true, shape: "streak", hue: "#8f866e", settle: 0.75 },
        { seed: 807, region: R.ellipse(380, 180, 150, 60), count: 8, rMin: 18, rMax: 44, oMin: 0.05, oMax: 0.12,
          drift: [4, -1], flow: 0.3, rise: -2, sway: 20, wrap: false, shape: "blob", hue: "#c8bca0", settle: 0.75 },
      ],
      events: [
        EVT(16000, 1.3, 3200),
        EVT(30000, 1.3, 3000),
        EVT(47000, 1.25, 2600),

      ],
    },

    /* ================= CHILD ROOM — rain-haze at the window ================= */
    childroom: {
      kind: "ceiling", density: 0.45, tint: "#7a86a0", clarityFloor: 0.6, clarityCeil: 0.94,
      gust: { period: 32000, strength: 5, len: 1800 },
      glow: [[1010, 120, "#7fa8c9", 120]],
      banks: [
        { seed: 901, region: R.rect(0, 84, 1280, 140), count: 16, rMin: 40, rMax: 110, oMin: 0.04, oMax: 0.12,
          drift: [6, 0], flow: 0.35, rise: -2, sway: 44, wrap: true, shape: "blob", hue: "#7a86a0", settle: 0.75,
          streamers: STREAM(2, 18, 80, 16000, 0.11) },
        { seed: 902, region: R.rect(900, 120, 220, 190), count: 12, rMin: 18, rMax: 46, oMin: 0.07, oMax: 0.16,
          drift: [2, -3], flow: 0.3, rise: -4, sway: 18, wrap: false, shape: "streak", hue: "#9fb8d0", settle: 0.7,
          streamers: STREAM(2, 12, 90, 12000, 0.13) },
        { seed: 903, region: R.ellipse(500, 620, 260, 80), count: 10, rMin: 24, rMax: 60, oMin: 0.05, oMax: 0.12,
          drift: [3, -1], flow: 0.3, rise: -2, sway: 24, wrap: false, shape: "blob", hue: "#8a98b4", settle: 0.75 },
        { seed: 904, region: R.rect(0, 460, 1280, 60), count: 10, rMin: 20, rMax: 52, oMin: 0.05, oMax: 0.12,
          drift: [5, -1], flow: 0.3, rise: -2, sway: 30, wrap: true, shape: "streak", hue: "#6f7c94", settle: 0.8 },
        { seed: 905, region: R.rect(0, 180, 1280, 90), count: 12, rMin: 36, rMax: 96, oMin: 0.04, oMax: 0.1,
          drift: [6, 0], flow: 0.35, rise: -1, sway:40, wrap: true, shape: "blob", hue: "#7a86a0", settle: 0.75 },
        { seed: 906, region: R.ellipse(640, 200, 200, 76), count: 8, rMin: 20, rMax: 48, oMin: 0.05, oMax: 0.12,
          drift: [3, -1], flow: 0.3, rise: -2, sway: 20, wrap: false, shape: "streak", hue: "#9aa8c0", settle: 0.75 },
        { seed: 907, region: R.rect(0, 540, 1280, 70), count: 10, rMin: 22, rMax: 54, oMin: 0.05, oMax: 0.12,
          drift: [4, -1], flow: 0.3, rise: -2, sway: 26, wrap: true, shape: "streak", hue: "#6f7c94", settle: 0.75 },
        { seed: 908, region: R.ellipse(250, 300, 140, 64), count: 8, rMin: 18, rMax: 44, oMin: 0.05, oMax: 0.12,
          drift: [3, -1], flow: 0.3, rise: -2, sway: 18, wrap: false, shape: "blob", hue: "#8a98b4", settle: 0.75 },
      ],
      events: [
        EVT(14000, 1.3, 3400),
        EVT(28000, 1.3, 3200),
        EVT(45000, 1.25, 2800),

      ],
    },

    /* ================= ATTIC — hanging dust in the beam ================= */
    attic: {
      kind: "room", density: 0.85, tint: "#6d6454", clarityFloor: 0.4, clarityCeil: 0.9,
      gust: { period: 28000, strength: 6, len: 2000 },
      glow: [[640, 400, "#c9b98a", 220]],
      banks: [
        { seed: 1001, region: R.rect(0, 40, 1280, 220), count: 26, rMin: 40, rMax: 120, oMin: 0.06, oMax: 0.16,
          drift: [5, 1], flow: 0.4, rise: 0, sway: 50, wrap: true, shape: "blob", hue: "#6d6454", settle: 0.6,
          streamers: STREAM(3, 20, 100, 13000, 0.14) },
        { seed: 1002, region: R.ellipse(640, 400, 260, 220), count: 14, rMin: 20, rMax: 52, oMin: 0.08, oMax: 0.18,
          drift: [2, -2], flow: 0.3, rise: -3, sway: 22, wrap: false, shape: "streak", hue: "#c8b894", settle: 0.55,
          streamers: STREAM(3, 12, 100, 9000, 0.16) },
        { seed: 1003, region: R.rect(0, 600, 1280, 120), count: 14, rMin: 30, rMax: 80, oMin: 0.05, oMax: 0.13,
          drift: [4, -2], flow: 0.3, rise: -3, sway: 34, wrap: true, shape: "blob", hue: "#5d574c", settle: 0.65 },
        { seed: 1004, region: R.rect(0, 240, 1280, 100), count: 12, rMin: 34, rMax: 90, oMin: 0.04, oMax: 0.11,
          drift: [3, 1], flow: 0.35, rise: 0, sway: 40, wrap: true, shape: "streak", hue: "#7a7162", settle: 0.7 },
        { seed: 1005, region: R.rect(0, 140, 1280, 100), count: 14, rMin: 40, rMax: 104, oMin: 0.05, oMax: 0.13,
          drift: [4, 1], flow: 0.35, rise: 0, sway: 44, wrap: true, shape: "blob", hue: "#6d6454", settle: 0.65 },
        { seed: 1006, region: R.ellipse(400, 300, 200, 90), count: 10, rMin: 20, rMax: 50, oMin: 0.06, oMax: 0.14,
          drift: [2, -2], flow: 0.25, rise: -3, sway: 18, wrap: false, shape: "streak", hue: "#857a68", settle: 0.6 },
        { seed: 1007, region: R.rect(0, 500, 1280, 90), count: 12, rMin: 26, rMax: 66, oMin: 0.06, oMax: 0.14,
          drift: [4, -2], flow: 0.3, rise: -3, sway: 30, wrap: true, shape: "streak", hue: "#5d574c", settle: 0.65 },
        { seed: 1008, region: R.ellipse(900, 200, 180, 80), count: 8, rMin: 20, rMax: 48, oMin: 0.05, oMax: 0.12,
          drift: [3, 1], flow: 0.3, rise: 0, sway: 22, wrap: false, shape: "blob", hue: "#7a7162", settle: 0.7 },
      ],
      events: [
        EVT(12000, 1.35, 3600),
        EVT(25000, 1.4, 3800),
        EVT(36000, 1.4, 3600),
        EVT(54000, 1.3, 3200),

      ],
    },

    /* ================= MEMORY (fifth room) — fog that stands still ================= */
    memory: {
      kind: "room", density: 0.7, tint: "#8a8678", clarityFloor: 0.5, clarityCeil: 0.9,
      gust: { period: 50000, strength: 3, len: 2400 },
      glow: [[640, 158, "#e8a04c", 160]],
      banks: [
        { seed: 1101, region: R.rect(0, 480, 1280, 240), count: 30, rMin: 44, rMax: 130, oMin: 0.08, oMax: 0.22,
          drift: [4, -1], flow: 0.35, rise: -2, sway: 44, wrap: true, shape: "blob", hue: "#8a8678", settle: 0.55,
          streamers: STREAM(3, 22, 110, 15000, 0.16) },
        { seed: 1102, region: R.rect(0, 60, 1280, 200), count: 18, rMin: 50, rMax: 140, oMin: 0.04, oMax: 0.11,
          drift: [6, 0], flow: 0.3, rise: 0, sway: 60, wrap: true, shape: "streak", hue: "#989484", settle: 0.7 },
        { seed: 1103, region: R.ellipse(1050, 470, 200, 120), count: 10, rMin: 24, rMax: 60, oMin: 0.06, oMax: 0.14,
          drift: [2, -1], flow: 0.25, rise: -2, sway: 20, wrap: false, shape: "blob", hue: "#7a766a", settle: 0.7 },
        { seed: 1104, region: R.rect(0, 200, 1280, 100), count: 14, rMin: 44, rMax: 116, oMin: 0.04, oMax: 0.1,
          drift: [5, 0], flow: 0.3, rise: -1, sway: 46, wrap: true, shape: "blob", hue: "#8a8678", settle: 0.7 },
        { seed: 1105, region: R.ellipse(640, 360, 280, 100), count: 10, rMin: 26, rMax: 64, oMin: 0.06, oMax: 0.14,
          drift: [3, -1], flow: 0.3, rise: -2, sway: 26, wrap: false, shape: "streak", hue: "#9a9688", settle: 0.65 },
        { seed: 1106, region: R.rect(0, 560, 1280, 90), count: 12, rMin: 30, rMax: 74, oMin: 0.06, oMax: 0.14,
          drift: [4, -1], flow: 0.3, rise: -2, sway: 32, wrap: true, shape: "streak", hue: "#7a766a", settle: 0.65 },
        { seed: 1107, region: R.ellipse(300, 300, 150, 64), count: 8, rMin: 20, rMax: 48, oMin: 0.05, oMax: 0.12,
          drift: [3, -1], flow: 0.25, rise: -2, sway: 18, wrap: false, shape: "blob", hue: "#989484", settle: 0.7 },
      ],
      events: [
        EVT(17000, 1.3, 4000),
        EVT(30000, 1.3, 3600),
        EVT(50000, 1.25, 3200),

      ],
    },
  };

  /* ==========================================================================
     2b. EXTENDED CHOREOGRAPHY (layer two)
     Kept separate from the bank data so the two layers can be tuned
     independently. Adds, per room:

       • shafts   — fog caught in a light beam: a slanted column that widens
                    toward the floor and sways as the fog drifts. Never an
                    oval, always a trapezoid converging on the floor.
       • draughts — thin tongues of mist curling out from under doors.
       • drips    — condensation that slides down wet glass and fades.
       • vortices — slow eddies: a blurred core with orbiting wisps that
                    also pull the surrounding bank fog tangentially.
       • wisps    — a foreground depth layer that passes in front of the
                    scene, far softer than the banks behind it.
  ========================================================================== */

  /* ROOM CHOREOGRAPHY MANIFEST — what each room's fog actually does.
     Read top to bottom as a list of decisions, not settings:

     PORCH        outside ground fog: three rolling banks low on the grass,
                  two tree-shadows that never quite line up, a moon shaft
                  that only exists when the clouds let it, and two eddies
                  that turn in the corners by the steps. Weather, deep.
     HALLWAY      ceiling mist only. A lamp shaft that widens at the floor,
                  two under-door curls (front + kitchen), and the single
                  patience of a house holding its breath.
     KITCHEN      window steam off the sink, a ghost column above the stove,
                  condensation that runs on the pane, one breath from the
                  drain. The fog here always smells faintly of copper.
     DININGROOM   chandelier shaft over the table, dawn glass on the left,
                  steam rising off the spoilt food while it lasts, and a
                  breath from the garbage before the house takes it away.
     CONSERVATORY the wettest room: three glass shafts, four sliding drips,
                  two floor ribbons, an eddy in the centre, and the most
                  aggressive weather of any room. More fog than anywhere.
     STUDY        desk-lamp shaft and window shaft, dust motes only where
                  the lamp can reach them. The quietest fog in the house.
     BASEMENT     floor fog, not ceiling fog: two cold banks low down, a
                  hatch shaft from above, a window shaft, two floor eddies,
                  shadow bands and breaths along the concrete.
     LANDING      daylight corridor mist: one wide shaft and not much else.
                  The landing is a place you pass through; so is its fog.
     CHILDROOM    rain haze at the window, a pane that weeps, motes that
                  drift in the light from outside and never come in far.
     ATTIC        one moon shaft at the far window, a single ribbon, and
                  the torch beam: the only fog in the house the player
                  can cut open by hand. The rest of the dark is solid.
     MEMORY       fog that barely moves. One patient shaft, one breath,
                  a weather cycle so long it might as well be a held note.
  ========================================================================== */
  const SHAFT = (x1, y1, x2, y2, w, o, hue, sway) => ({ x1, y1, x2, y2, w, o, hue, sway });
  const DRAUGHT = (x, y, w, up, o) => ({ x, y, w, up, o });
  const DRIP = (x, y0, y1, dur, o) => ({ x, y0, y1, dur, o });
  const VORTEX = (cx, cy, r, pull, o) => ({ cx, cy, r, pull, o });

  const P2 = {
    /* ================= PORCH — shafts through the trees ================= */
    porch: {
      shafts: [
        SHAFT(445, 322, 560, 700, 150, 0.10, "#e8a04c", 18),
        SHAFT(880, 300, 940, 700, 130, 0.08, "#e8a04c", 16),
        SHAFT(640, 130, 760, 700, 200, 0.05, "#9cc3dc", 12),
      ],
      draughts: [DRAUGHT(240, 600, 120, true, 0.06), DRAUGHT(1000, 610, 110, true, 0.05)],
      vortices: [VORTEX(220, 620, 90, 0.6, 0.08), VORTEX(1060, 630, 80, 0.5, 0.07)],
      wisps: { count: 5, o: 0.05, speed: 0.4 },
    },

    /* ================= HALLWAY — lamp shaft + under-door curls ================= */
    hallway: {
      shafts: [SHAFT(720, 360, 700, 660, 110, 0.07, "#e8a04c", 10)],
      draughts: [DRAUGHT(140, 560, 90, true, 0.05), DRAUGHT(1140, 560, 90, true, 0.05)],
    },

    /* ================= KITCHEN — window steam + sink condensation ================= */
    kitchen: {
      shafts: [
        SHAFT(520, 96, 560, 560, 120, 0.06, "#9cc3dc", 10),
        SHAFT(820, 96, 820, 540, 100, 0.05, "#e8a04c", 10),
      ],
      draughts: [DRAUGHT(600, 600, 80, true, 0.05), DRAUGHT(60, 590, 70, true, 0.04)],
      drips: [DRIP(500, 96, 260, 9000, 0.5), DRIP(545, 96, 300, 11000, 0.4)],
    },

    /* ================= DINING ROOM — chandelier + dawn glass ================= */
    diningroom: {
      shafts: [
        SHAFT(640, 130, 640, 620, 150, 0.07, "#e8c87a", 10),
        SHAFT(210, 235, 300, 640, 110, 0.05, "#9fb0c2", 9),
      ],
      draughts: [DRAUGHT(60, 600, 80, true, 0.04), DRAUGHT(1210, 600, 80, true, 0.04)],
    },

    /* ================= CONSERVATORY — glass shafts, drips, an eddy ================= */
    conservatory: {
      shafts: [
        SHAFT(320, 60, 420, 640, 150, 0.07, "#9cc3dc", 14),
        SHAFT(640, 60, 640, 660, 170, 0.08, "#b8d4de", 14),
        SHAFT(960, 60, 860, 640, 150, 0.07, "#9cc3dc", 14),
      ],
      draughts: [DRAUGHT(60, 600, 90, true, 0.06), DRAUGHT(1210, 600, 90, true, 0.05)],
      drips: [
        DRIP(180, 60, 300, 8000, 0.5),
        DRIP(420, 60, 340, 9500, 0.45),
        DRIP(760, 60, 320, 11000, 0.4),
        DRIP(1080, 60, 300, 9000, 0.5),
      ],
      vortices: [VORTEX(640, 580, 110, 0.7, 0.09)],
      wisps: { count: 4, o: 0.05, speed: 0.35 },
    },

    /* ================= STUDY — desk lamp + window ================= */
    study: {
      shafts: [
        SHAFT(520, 396, 560, 640, 100, 0.08, "#e8a04c", 8),
        SHAFT(1070, 240, 1030, 560, 90, 0.05, "#9cc3dc", 8),
      ],
      draughts: [DRAUGHT(1210, 600, 70, true, 0.04)],
    },

    /* ================= BASEMENT — shaft mist + cold floor eddies ================= */
    basement: {
      shafts: [
        SHAFT(640, 126, 640, 640, 130, 0.07, "#e8a04c", 9),
        SHAFT(130, 40, 260, 600, 120, 0.06, "#a8c8da", 8),
      ],
      draughts: [DRAUGHT(640, 620, 100, true, 0.06)],
      vortices: [VORTEX(340, 620, 100, 0.6, 0.08), VORTEX(980, 620, 90, 0.5, 0.07)],
      wisps: { count: 4, o: 0.05, speed: 0.3 },
    },

    /* ================= LANDING — daylight shaft ================= */
    landing: {
      shafts: [SHAFT(600, 172, 600, 640, 100, 0.06, "#f2e3b8", 8)],
    },

    /* ================= CHILD ROOM — rain window ================= */
    childroom: {
      shafts: [SHAFT(1010, 120, 960, 600, 110, 0.06, "#7fa8c9", 9)],
      draughts: [DRAUGHT(60, 600, 70, true, 0.04)],
    },

    /* ================= ATTIC — one moon shaft; the torch is separate ================= */
    attic: {
      shafts: [SHAFT(1200, 130, 1080, 640, 90, 0.05, "#9cc3dc", 8)],
      draughts: [DRAUGHT(640, 620, 90, true, 0.05)],
      wisps: { count: 3, o: 0.05, speed: 0.3 },
    },

    /* ================= MEMORY — a single patient shaft ================= */
    memory: {
      shafts: [SHAFT(640, 158, 640, 640, 120, 0.07, "#e8a04c", 8)],
      wisps: { count: 3, o: 0.04, speed: 0.25 },
    },
  };

  /* ==========================================================================
     2c. LAYER THREE — shadow bands, window panes, ribbons, motes, weather
     These are the slow, "weathering" touches that make the fog feel like it
     lives in the house instead of being painted over it:

       • bands   — soft shadow strips that drift across the floor as the
                   light above shifts through the mist.
       • panes   — condensation on the window glass: a faint film plus
                   thin streaks that slide down and dissolve.
       • ribbons — long curling mist ribbons that undulate across the room.
       • motes   — dust specks caught in the light beams, twinkling.
       • weather — a very slow in-out cycle: the whole room's fog thickens
                   and thins over minutes, like a storm breathing.
  ========================================================================== */
  const BAND = (y, h, o, hue, speed) => ({ y, h, o, hue, speed });
  const PANE = (x, y, w, h, o, flow) => ({ x, y, w, h, o, flow });
  const RIBBON = (y, w, h, o, hue, speed, amp) => ({ y, w, h, o, hue, speed, amp });
  const MOTES = (count, o) => ({ count, o });
  const WEATHER = (period, depth) => ({ period, depth });
  /* corner curls: fog pooling where ceiling meets wall and rolling slowly */
  const CURL = (x, y, r, o, hue) => ({ x, y, r, o, hue });
  /* breaths: a puff of fog that swells from a point, then dissolves —
     the house exhaling through a vent, a drain, a crack in the wall */
  const BREATH = (x, y, r0, r1, dur, o, hue) => ({ x, y, r0, r1, dur, o, hue });

  const P3 = {
    porch: {
      weather: WEATHER(90000, 0.25),
      ribbons: [
        RIBBON(600, 1280, 70, 0.10, "#76839a", 0.05, 22),
        RIBBON(660, 1280, 50, 0.08, "#8a97a6", 0.07, 18),
      ],
      bands: [BAND(560, 60, 0.06, "#3c4650", 0.02), BAND(620, 44, 0.05, "#3c4650", 0.03)],
      motes: MOTES(10, 0.5),
      corners: [CURL(70, 700, 120, 0.12, "#6d7b88"), CURL(1210, 700, 120, 0.12, "#6d7b88")],
      breaths: [BREATH(640, 700, 30, 190, 9000, 0.10, "#76839a"), BREATH(300, 690, 24, 150, 11000, 0.08, "#8a97a6")],
    },
    hallway: {
      weather: WEATHER(120000, 0.18),
      bands: [BAND(300, 34, 0.04, "#2e2a24", 0.015)],
      motes: MOTES(8, 0.5),
      corners: [CURL(40, 84, 90, 0.09, "#8a7f6c"), CURL(1240, 84, 90, 0.09, "#8a7f6c")],
    },
    kitchen: {
      weather: WEATHER(110000, 0.16),
      panes: [PANE(470, 100, 130, 150, 0.05, 0.02)],
      motes: MOTES(7, 0.5),
      corners: [CURL(40, 90, 80, 0.08, "#8f8472"), CURL(1240, 90, 80, 0.08, "#8f8472")],
      breaths: [BREATH(560, 600, 20, 130, 9500, 0.09, "#b8c8d4")],
    },
    diningroom: {
      weather: WEATHER(105000, 0.16),
      panes: [PANE(150, 160, 150, 170, 0.05, 0.02)],
      motes: MOTES(9, 0.5),
      bands: [BAND(520, 40, 0.05, "#2e2a24", 0.015)],
      corners: [CURL(40, 96, 84, 0.08, "#8f8778"), CURL(1240, 96, 84, 0.08, "#8f8778")],
      breaths: [BREATH(500, 620, 20, 120, 10000, 0.09, "#c2c8c4")],
    },
    conservatory: {
      weather: WEATHER(80000, 0.3),
      ribbons: [
        RIBBON(500, 1280, 90, 0.12, "#6f8a84", 0.06, 26),
        RIBBON(600, 1280, 70, 0.10, "#7f9a94", 0.08, 20),
      ],
      panes: [PANE(60, 60, 1160, 340, 0.05, 0.015)],
      motes: MOTES(12, 0.5),
      corners: [CURL(40, 90, 110, 0.11, "#6f8a84"), CURL(1240, 90, 110, 0.11, "#6f8a84")],
      breaths: [
        BREATH(640, 640, 28, 200, 8000, 0.12, "#6f8a84"),
        BREATH(180, 640, 20, 140, 10000, 0.09, "#7f9a94"),
        BREATH(1090, 640, 20, 140, 12000, 0.09, "#7f9a94"),
      ],
    },
    study: {
      weather: WEATHER(130000, 0.14),
      motes: MOTES(7, 0.5),
      corners: [CURL(40, 86, 78, 0.08, "#8a8070"), CURL(1240, 86, 78, 0.08, "#8a8070")],
    },
    basement: {
      weather: WEATHER(95000, 0.24),
      ribbons: [
        RIBBON(560, 1280, 80, 0.12, "#5d6873", 0.05, 24),
        RIBBON(640, 1280, 60, 0.10, "#53606b", 0.07, 18),
      ],
      bands: [BAND(500, 50, 0.06, "#22262a", 0.02), BAND(600, 40, 0.05, "#22262a", 0.025)],
      motes: MOTES(6, 0.45),
      corners: [CURL(40, 700, 120, 0.12, "#4d5a64"), CURL(1240, 700, 120, 0.12, "#4d5a64")],
      breaths: [BREATH(640, 680, 26, 190, 8500, 0.11, "#5d6873"), BREATH(300, 680, 20, 130, 10500, 0.08, "#53606b")],
    },
    landing: {
      weather: WEATHER(125000, 0.15),
      motes: MOTES(6, 0.45),
      corners: [CURL(40, 90, 80, 0.07, "#a89a7f"), CURL(1240, 90, 80, 0.07, "#a89a7f")],
    },
    childroom: {
      weather: WEATHER(115000, 0.16),
      panes: [PANE(900, 110, 180, 150, 0.05, 0.02)],
      motes: MOTES(6, 0.45),
      corners: [CURL(40, 88, 76, 0.07, "#7a86a0"), CURL(1240, 88, 76, 0.07, "#7a86a0")],
    },
    attic: {
      weather: WEATHER(100000, 0.2),
      motes: MOTES(8, 0.5),
      ribbons: [RIBBON(480, 1280, 60, 0.08, "#6d6454", 0.04, 16)],
      corners: [CURL(30, 40, 90, 0.09, "#6d6454"), CURL(1250, 40, 90, 0.09, "#6d6454")],
      breaths: [BREATH(640, 700, 22, 150, 9500, 0.08, "#6d6454")],
    },
    memory: {
      weather: WEATHER(150000, 0.1),
      motes: MOTES(5, 0.4),
      corners: [CURL(40, 90, 84, 0.08, "#8a8678"), CURL(1240, 90, 84, 0.08, "#8a8678")],
      breaths: [BREATH(640, 640, 24, 160, 11000, 0.08, "#8a8678")],
    },
  };

  /* merge the base profile with its layer-two and layer-three choreography */
  function mergeProfile(base, ...extras) {
    const out = { ...base };
    for (const ex of extras) if (ex) for (const k in ex) out[k] = ex[k];
    return out;
  }

  /* GLOBAL FOG OPACITY SCALE
     The fog is tuned to whisper, not to shout. Every actor's opacity is
     multiplied by this factor, set per room kind in apply():

       • outside  — the porch keeps a faint ground mist (the one part of the
                    fog that is meant to stay visible, but very low).
       • room     — conservatory, attic, memory: a bare tint of air.
       • floor    — the basement: barely-there cold haze.
       • ceiling  — hall, kitchen, dining, study, landing, child room: the
                    lightest touch of all.

     Lower any value to thin that kind of room; raise it to thicken. This is
     the single dial for how much fog the player actually sees. */
  function roomOpacityFactor(kind) {
    switch (kind) {
      case "outside": return 0.4;   // porch: faint rolling mist remains
      case "room":    return 0.22;  // conservatory, attic, memory
      case "floor":   return 0.18;  // basement floor fog
      default:        return 0.18;  // ceiling rooms: the lightest touch
    }
  }

  /* ==========================================================================
     3. ENGINE STATE
  ========================================================================== */
  let svgEl = null, root = null, raf = null, lastT = 0, elapsed = 0;
  let blobs = [];                 // live fog particles for the current room
  let streamers = [];             // rising mist columns
  let room = null;
  let mounted = false;

  /* pointer + clarity */
  const mouse = { x: -9999, y: -9999, active: false, lx: -9999, ly: -9999 };
  let pointerSpeed = 0;           // px/frame, smoothed
  let clearRadius = 36;           // current fog-clearing radius (grows with speed)
  let clarity = 0.5;              // room-wide clarity 0..1 (1 = clear)
  let gustPhase = 0;              // 0..1 through the current gust cycle
  let gustBoost = 0;              // 0..1 gust intensity envelope
  let eventIndex = 0;             // choreography cursor
  let eventActive = null;         // currently running swell event
  let pulseAt = 0, pulseX = 0, pulseY = 0, pulseR = 0;  // one-off clear pulse

  let density = 1;                // from Settings.fogDensity
  let enabled = true;             // from Settings.fog
  let reduced = false;            // from Settings.reducedMotion

  /* layer-two actors */
  let shafts = [];                // light shafts (fog caught in a beam)
  let draughts = [];              // under-door fog tongues
  let drips = [];                 // condensation streaks on glass
  let vortices = [];              // swirling eddies
  let wisps = [];                 // foreground depth wisps

  /* layer-three actors */
  let bands = [];                 // drifting shadow strips
  let panes = [];                 // condensation films on windows
  let ribbons = [];               // curling mist ribbons
  let motes = [];                 // dust specks in the beams
  let curls = [];                 // corner fog pools
  let breaths = [];               // expanding exhalation puffs
  let weather = 1;                // slow in-out fog cycle (1 = base)
  let opacFactor = 1;             // global opacity scale for the current room

  /* spatial clarity: a coarse grid that remembers where the mouse swept.
     The fog parts locally and heals back slowly, so a fast sweep leaves a
     clear corridor that lingers for a moment instead of closing instantly.
     This is what makes clearing feel "little or a lot" — slow wandering
     barely parts it, a fast swipe carves a long clear channel. */
  const CLR = { cols: 24, rows: 14, cell: null };
  const CLR_DECAY = 0.955;        // per-frame healing rate
  const CLR_W = () => STAGE_W / CLR.cols;
  const CLR_H = () => STAGE_H / CLR.rows;
  function initClarity() { CLR.cell = new Float32Array(CLR.cols * CLR.rows); }
  function stampClarity(px, py, strength, radius) {
    if (!CLR.cell) initClarity();
    const cw = CLR_W(), ch = CLR_H();
    const cx = Math.floor(px / cw), cy = Math.floor(py / ch);
    const rad = Math.max(1, Math.ceil(radius / Math.min(cw, ch)));
    for (let gx = cx - rad; gx <= cx + rad; gx++) {
      for (let gy = cy - rad; gy <= cy + rad; gy++) {
        if (gx < 0 || gy < 0 || gx >= CLR.cols || gy >= CLR.rows) continue;
        const fall = 1 - Math.hypot(gx - cx, gy - cy) / (rad + 1);
        if (fall <= 0) continue;
        const i = gy * CLR.cols + gx;
        CLR.cell[i] = Math.max(CLR.cell[i], strength * fall);
      }
    }
  }
  function sampleClarity(x, y) {
    if (!CLR.cell) return 0;
    const cw = CLR_W(), ch = CLR_H();
    const gx = clamp((x - cw * 0.5) / cw, 0, CLR.cols - 1.001);
    const gy = clamp((y - ch * 0.5) / ch, 0, CLR.rows - 1.001);
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const i = y0 * CLR.cols + x0;
    const a = CLR.cell[i], b = CLR.cell[i + 1];
    const c = CLR.cell[i + CLR.cols], d = CLR.cell[i + CLR.cols + 1];
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  }
  function decayClarity() {
    if (!CLR.cell) return;
    for (let i = 0; i < CLR.cell.length; i++) CLR.cell[i] *= CLR_DECAY;
  }

  /* ==========================================================================
     4. SVG BUILDERS
  ========================================================================== */
  function mk(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* unique ids per mount so filters never collide across rooms */
  let uid = 0;
  function nid(p) { return "fog" + p + (uid++); }

  /* the svg's <defs>, created on demand. Filters and shaft gradients live
     here so ids never collide across rooms. */
  function ensureDefs() {
    if (!svgEl) return null;
    let defs = svgEl.querySelector("defs");
    if (!defs) { defs = mk("defs", {}, svgEl); svgEl.insertBefore(defs, svgEl.firstChild); }
    return defs;
  }

  /* build the shared blur filters once per root */
  function buildFilters(holder) {
    const defs = ensureDefs();
    if (!defs) return;
    const mkFilter = (std, id) => {
      if (holder.querySelector("#" + id)) return;
      const f = mk("filter", { id, x: "-60%", y: "-60%", width: "220%", height: "220%" }, defs);
      mk("feGaussianBlur", { in: "SourceGraphic", stdDeviation: std }, f);
    };
    mkFilter(16, "fogblur16");
    mkFilter(24, "fogblur24");
    mkFilter(36, "fogblur36");
    mkFilter(52, "fogblur52");
    mkFilter(8, "fogblur8");
  }

  function pickBlur(r) {
    if (r < 24) return "url(#fogblur16)";
    if (r < 46) return "url(#fogblur24)";
    if (r < 100) return "url(#fogblur36)";
    return "url(#fogblur52)";
  }

  /* build a clip path for a bank region (keeps fog inside its zone) */
  function regionClip(region, id) {
    const cp = mk("clipPath", { id });
    if (region.type === "rect") mk("rect", { x: region.x, y: region.y, width: region.w, height: region.h }, cp);
    else if (region.type === "ellipse") mk("ellipse", { cx: region.cx, cy: region.cy, rx: region.rx, ry: region.ry }, cp);
    else if (region.type === "path") mk("path", { d: region.d }, cp);
    else if (region.type === "quad") mk("polygon", { points: region.pts.join(" ") }, cp);
    return cp;
  }

  /* place a point uniformly inside a region */
  function pointInRegion(region, rng) {
    if (region.type === "rect") {
      return [region.x + rng() * region.w, region.y + rng() * region.h];
    }
    if (region.type === "ellipse") {
      const a = rng() * TAU, r = Math.sqrt(rng());
      return [region.cx + Math.cos(a) * region.rx * r, region.cy + Math.sin(a) * region.ry * r];
    }
    if (region.type === "quad") {
      const [x0, y0, x1, y1, x2, y2, x3, y3] = region.pts;
      const u = rng(), v = rng();
      return [x0 + (x1 - x0) * u + (x3 - x0) * v, y0 + (y1 - y0) * u + (y3 - y0) * v];
    }
    /* path: fall back to a broad spread */
    return [rng() * STAGE_W, 200 + rng() * 300];
  }

  /* x-range of a region (for streamer placement) */
  function regionXRange(region) {
    if (region.type === "rect") return [region.x, region.x + region.w];
    if (region.type === "ellipse") return [region.cx - region.rx, region.cx + region.rx];
    if (region.type === "quad") {
      const xs = region.pts.filter((_, i) => i % 2 === 0);
      return [Math.min(...xs), Math.max(...xs)];
    }
    return [0, STAGE_W];
  }
  function regionYRange(region) {
    if (region.type === "rect") return [region.y, region.y + region.h];
    if (region.type === "ellipse") return [region.cy - region.ry, region.cy + region.ry];
    if (region.type === "quad") {
      const ys = region.pts.filter((_, i) => i % 2 === 1);
      return [Math.min(...ys), Math.max(...ys)];
    }
    return [0, STAGE_H];
  }

  /* does a region wrap horizontally? (rects spanning the full width do) */
  function regionWraps(region) {
    return region.type === "rect" && region.x <= 0 && region.x + region.w >= STAGE_W - 1;
  }

  /* ==========================================================================
     5. PARTICLE SPAWN
  ========================================================================== */
  function spawnBank(bank, group) {
    const rng = mulberry32(bank.seed);
    const clipId = nid("clip");
    const clip = regionClip(bank.region, clipId);
    group.appendChild(clip);
    const layer = mk("g", { "clip-path": "url(#" + clipId + ")", class: "fog-bank", "data-seed": bank.seed }, group);
    const wraps = regionWraps(bank.region);
    const count = Math.round(bank.count * density);

    for (let i = 0; i < count; i++) {
      const [x, y] = pointInRegion(bank.region, rng);
      const r = lerp(bank.rMin, bank.rMax, rng());
      const baseO = lerp(bank.oMin, bank.oMax, rng()) * opacFactor;
      const streak = bank.shape === "streak";
      const aspect = streak ? lerp(2.6, 4.4, rng()) : lerp(0.7, 1.15, rng());
      const rot = streak ? lerp(-18, 12, rng()) : 0;
      const hue = tintToward(bank.hue, "#cfd6dc", rng() * 0.18);

      const el = mk("ellipse", {
        class: "fog-blob",
        cx: x, cy: y,
        rx: r, ry: r * aspect,
        fill: hue,
        opacity: baseO,
        filter: pickBlur(r),
        transform: streak ? `rotate(${rot} ${x} ${y})` : "",
      }, layer);

      blobs.push({
        el,
        x, y, r, baseO,
        hue,
        ph: rng() * TAU,
        seed: bank.seed + i,
        driftX: bank.drift[0], driftY: bank.drift[1],
        flow: bank.flow || 0.4,
        rise: bank.rise || 0,
        sway: bank.sway || 40,
        settle: bank.settle != null ? bank.settle : 0.5,
        wrap: wraps,
        region: bank.region,
        streak,
        bankSeed: bank.seed,
      });
    }

    /* rising mist columns (streamers) */
    if (bank.streamers && bank.streamers.count) {
      const st = bank.streamers;
      const [x0, x1] = regionXRange(bank.region);
      const [y0, y1] = regionYRange(bank.region);
      const srng = mulberry32(bank.seed * 7 + 3);
      for (let i = 0; i < st.count; i++) {
        const col = mk("rect", {
          class: "fog-streamer",
          x: lerp(x0, x1, srng()),
          y: y1,
          width: lerp(st.w[0], st.w[1], srng()),
          height: 0,
          fill: tintToward(bank.hue, "#e8ecf0", 0.2),
          opacity: 0,
          filter: "url(#fogblur24)",
        }, layer);
        streamers.push({
          el: col,
          x0: lerp(x0, x1, srng()),
          y0, y1,
          h: lerp(st.h[0], st.h[1], srng()),
          dur: lerp(st.dur * 0.7, st.dur * 1.3, srng()),
          o: lerp(st.o * 0.7, st.o * 1.3, srng()) * opacFactor,
          t: srng() * st.dur * 1.4,   // desynchronised starts
          phase: srng() * TAU,
          rise: lerp(0.12, 0.3, srng()),
        });
      }
    }
  }

  /* a depth haze: huge, faint, behind everything */
  function spawnDepthHaze(profile, group) {
    if (!profile) return;
    const rng = mulberry32(9131);
    for (let i = 0; i < 5; i++) {
      const r = lerp(160, 340, rng());
      const el = mk("ellipse", {
        class: "fog-haze",
        cx: lerp(-60, STAGE_W + 60, rng()),
        cy: lerp(80, STAGE_H - 60, rng()),
        rx: r, ry: r * 0.6,
        fill: profile.tint || "#8a97a6",
        opacity: lerp(0.02, 0.05, rng()) * opacFactor,
        filter: "url(#fogblur52)",
      }, group);
      blobs.push({
        el, x: parseFloat(el.getAttribute("cx")), y: parseFloat(el.getAttribute("cy")),
        r, baseO: parseFloat(el.getAttribute("opacity")),
        ph: rng() * TAU, seed: 9000 + i,
        driftX: lerp(2, 5, rng()), driftY: lerp(-1, 1, rng()),
        flow: 0.15, rise: 0, sway: 60, settle: 0.9, wrap: true,
        region: { type: "rect", x: -80, y: -40, w: STAGE_W + 160, h: STAGE_H + 120 },
        streak: false, bankSeed: 0,
      });
    }
  }

  /* ==========================================================================
     5b. LAYER-TWO SPAWNERS
     Shafts, draughts, drips, vortices and wisps. Each returns live actor
     records the animation loop drives frame by frame.
  ========================================================================== */

  /* --- light shafts: fog in a beam, a trapezoid that widens to the floor --- */
  function shaftPoints(s, sway) {
    const topW = Math.max(3, s.w * 0.07);
    const x2 = s.x2 + sway, x1 = s.x1 + sway * 0.2;
    return (x1 - topW).toFixed(1) + "," + s.y1 + " " + (x1 + topW).toFixed(1) + "," + s.y1 + " " +
           (x2 + s.w).toFixed(1) + "," + s.y2 + " " + (x2 - s.w).toFixed(1) + "," + s.y2;
  }

  function spawnShafts(profile, group) {
    if (!profile.shafts || !profile.shafts.length) return;
    const defs = ensureDefs();
    const rng = mulberry32(8121);
    profile.shafts.forEach((s) => {
      const gid = nid("shg");
      const grad = mk("linearGradient", { id: gid, x1: "0", y1: "0", x2: "0", y2: "1" }, defs);
      const so = s.o * opacFactor;
      mk("stop", { offset: "0", "stop-color": s.hue, "stop-opacity": (so * 1.1).toFixed(3) }, grad);
      mk("stop", { offset: "0.55", "stop-color": s.hue, "stop-opacity": (so * 0.5).toFixed(3) }, grad);
      mk("stop", { offset: "1", "stop-color": s.hue, "stop-opacity": "0" }, grad);
      const poly = mk("polygon", {
        class: "fog-shaft",
        points: shaftPoints(s, 0),
        fill: "url(#" + gid + ")",
        opacity: so.toFixed(3),
        filter: "url(#fogblur36)",
      }, group);
      shafts.push({ el: poly, s: { ...s, o: so }, ph: rng() * TAU });
    });
  }

  /* --- draughts: tongues of mist curling out from under doors --- */
  function spawnDraughts(profile, group) {
    if (!profile.draughts || !profile.draughts.length) return;
    const rng = mulberry32(9917);
    profile.draughts.forEach((d) => {
      const el = mk("ellipse", {
        class: "fog-draught",
        cx: d.x, cy: d.y, rx: d.w * 0.5, ry: 14,
        fill: "#cfd6dc",
        opacity: (d.o * opacFactor).toFixed(3),
        filter: "url(#fogblur24)",
      }, group);
      draughts.push({ el, d: { ...d, o: d.o * opacFactor }, ph: rng() * TAU });
    });
  }

  /* --- drips: condensation sliding down wet glass, then gone --- */
  function spawnDrips(profile, group) {
    if (!profile.drips || !profile.drips.length) return;
    profile.drips.forEach((d) => {
      const el = mk("rect", {
        class: "fog-drip",
        x: d.x, y: d.y0, width: 1.6, height: 12,
        fill: "#eef3f6",
        opacity: 0,
        filter: "url(#fogblur8)",
      }, group);
      drips.push({ el, d: { ...d, o: d.o * opacFactor }, t: Math.random() * d.dur });
    });
  }

  /* --- vortices: a blurred core with orbiting wisps that drag the banks --- */
  function spawnVortices(profile, group) {
    if (!profile.vortices || !profile.vortices.length) return;
    const rng = mulberry32(701);
    profile.vortices.forEach((v) => {
      const vo = v.o * opacFactor;
      const core = mk("ellipse", {
        class: "fog-vortex",
        cx: v.cx, cy: v.cy, rx: v.r * 0.35, ry: v.r * 0.22,
        fill: "#d4dce2", opacity: vo.toFixed(3), filter: "url(#fogblur24)",
      }, group);
      const sat = [];
      for (let k = 0; k < 3; k++) {
        const se = mk("ellipse", {
          class: "fog-vortex-sat",
          cx: v.cx, cy: v.cy, rx: v.r * 0.16, ry: v.r * 0.1,
          fill: "#dfe6ea", opacity: (vo * 0.6).toFixed(3), filter: "url(#fogblur16)",
        }, group);
        sat.push({ el: se, a0: rng() * TAU, rr: lerp(v.r * 0.55, v.r, rng()), sp: lerp(0.8, 1.6, rng()) * (rng() < 0.5 ? 1 : -1) });
      }
      vortices.push({ core, sat, v: { ...v, o: vo }, ang: rng() * TAU });
    });
  }

  /* --- wisps: a foreground depth layer that passes in front of the scene --- */
  function spawnWisps(profile, group) {
    if (!profile.wisps || !profile.wisps.count) return;
    const rng = mulberry32(3301);
    const g = mk("g", { class: "fog-wisps" }, group);
    const n = profile.wisps.count;
    for (let i = 0; i < n; i++) {
      const r = lerp(220, 420, rng());
      const y = rng() < 0.5 ? lerp(60, 220, rng()) : lerp(560, 700, rng());
      const wO = lerp(0.02, 0.05, rng()) * opacFactor;
      const el = mk("ellipse", {
        class: "fog-wisp",
        cx: rng() * STAGE_W, cy: y, rx: r, ry: r * 0.32,
        fill: profile.tint || "#aab4bd",
        opacity: wO.toFixed(3),
        filter: "url(#fogblur52)",
      }, g);
      wisps.push({
        el,
        x: parseFloat(el.getAttribute("cx")), y,
        r, o: wO,
        sp: lerp(0.15, 0.5, rng()) * (rng() < 0.5 ? 1 : -1),
        ph: rng() * TAU,
      });
    }
  }

  /* ==========================================================================
     5c. LAYER-THREE SPAWNERS
  ========================================================================== */

  /* --- bands: soft shadow strips that drift across the floor --- */
  function spawnBands(profile, group) {
    if (!profile.bands || !profile.bands.length) return;
    const rng = mulberry32(4403);
    profile.bands.forEach((b) => {
      const el = mk("ellipse", {
        class: "fog-band",
        cx: rng() * STAGE_W, cy: b.y, rx: lerp(120, 190, rng()), ry: b.h * 0.5,
        fill: b.hue, opacity: (b.o * opacFactor).toFixed(3), filter: "url(#fogblur36)",
      }, group);
      bands.push({
        el,
        x: parseFloat(el.getAttribute("cx")),
        b: { ...b, o: b.o * opacFactor },
        dir: rng() < 0.5 ? 1 : -1,
        ph: rng() * TAU,
      });
    });
  }

  /* --- panes: condensation film + streaks that slide down the glass --- */
  function spawnPanes(profile, group) {
    if (!profile.panes || !profile.panes.length) return;
    const rng = mulberry32(5511);
    profile.panes.forEach((p) => {
      const film = mk("rect", {
        class: "fog-pane",
        x: p.x, y: p.y, width: p.w, height: p.h,
        fill: "#c9d6de", opacity: (p.o * opacFactor).toFixed(3), filter: "url(#fogblur24)",
      }, group);
      const streaks = [];
      for (let k = 0; k < 3; k++) {
        const sx = p.x + 10 + rng() * (p.w - 20);
        const len = 10 + rng() * p.h * 0.4;
        const ln = mk("line", {
          class: "fog-pane-streak",
          x1: sx, y1: p.y, x2: sx, y2: p.y + len,
          stroke: "#eef3f6", "stroke-width": 1.4, opacity: 0,
        }, group);
        streaks.push({ el: ln, x: sx, len, phase: rng() * p.h, sp: 0.2 + rng() * 0.5 });
      }
      panes.push({ el: film, p: { ...p, o: p.o * opacFactor }, streaks, ph: rng() * TAU });
    });
  }

  /* --- ribbons: long curling mist ribbons drawn as animated paths --- */
  function ribbonPath(r, t, ph) {
    const seg = [];
    const N = 13;
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * STAGE_W;
      const y = r.y
        + Math.sin(x * 0.008 + t * r.speed + ph) * r.amp
        + Math.sin(x * 0.013 - t * r.speed * 0.6 + ph * 1.7) * r.amp * 0.4;
      seg.push((i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1));
    }
    return seg.join(" ");
  }

  function spawnRibbons(profile, group) {
    if (!profile.ribbons || !profile.ribbons.length) return;
    const rng = mulberry32(6627);
    profile.ribbons.forEach((r) => {
      const el = mk("path", {
        class: "fog-ribbon",
        fill: "none", stroke: r.hue, "stroke-width": r.h,
        "stroke-linecap": "round",
        d: ribbonPath(r, 0, rng() * TAU),
        opacity: (r.o * opacFactor).toFixed(3), filter: "url(#fogblur24)",
      }, group);
      ribbons.push({ el, r: { ...r, o: r.o * opacFactor }, ph: rng() * TAU });
    });
  }

  /* --- motes: dust specks drifting and twinkling in the light --- */
  function spawnMotes(profile, group) {
    if (!profile.motes || !profile.motes.count) return;
    const rng = mulberry32(7733);
    for (let i = 0; i < profile.motes.count; i++) {
      const r = lerp(1.2, 2.6, rng());
      const el = mk("circle", {
        class: "fog-mote",
        cx: rng() * STAGE_W, cy: lerp(60, STAGE_H - 40, rng()), r,
        fill: "#f2efe6", opacity: 0,
      }, group);
      motes.push({
        el,
        x: parseFloat(el.getAttribute("cx")),
        y: parseFloat(el.getAttribute("cy")),
        r, o: profile.motes.o * opacFactor, ph: rng() * TAU,
        spx: lerp(-0.2, 0.2, rng()), spy: lerp(-0.12, 0.05, rng()),
      });
    }
  }

  /* --- curls: fog pooling in the corners, rolling slowly --- */
  function spawnCurls(profile, group) {
    if (!profile.corners || !profile.corners.length) return;
    const rng = mulberry32(8839);
    profile.corners.forEach((c) => {
      const co = c.o * opacFactor;
      const core = mk("ellipse", {
        class: "fog-curl",
        cx: c.x, cy: c.y, rx: c.r, ry: c.r * 0.6,
        fill: c.hue, opacity: co.toFixed(3), filter: "url(#fogblur36)",
      }, group);
      const subs = [];
      for (let k = 0; k < 2; k++) {
        const se = mk("ellipse", {
          class: "fog-curl-sub",
          cx: c.x, cy: c.y, rx: c.r * 0.5, ry: c.r * 0.3,
          fill: c.hue, opacity: (co * 0.5).toFixed(3), filter: "url(#fogblur24)",
        }, group);
        subs.push({ el: se, a0: rng() * TAU, rr: c.r * 0.6, sp: 0.3 + rng() * 0.4 });
      }
      curls.push({ core, subs, c: { ...c, o: co }, ang: rng() * TAU, ph: rng() * TAU });
    });
  }

  /* --- breaths: a puff of fog that swells from a point and dissolves --- */
  function spawnBreaths(profile, group) {
    if (!profile.breaths || !profile.breaths.length) return;
    const rng = mulberry32(4019);
    profile.breaths.forEach((b) => {
      const el = mk("ellipse", {
        class: "fog-breath",
        cx: b.x, cy: b.y, rx: b.r0, ry: b.r0 * 0.5,
        fill: b.hue, opacity: 0, filter: "url(#fogblur24)",
      }, group);
      breaths.push({ el, b: { ...b, o: b.o * opacFactor }, t: rng() * b.dur });
    });
  }

  /* ==========================================================================
     6. MOUNT / UNMOUNT
  ========================================================================== */
  function apply(holder, newRoom) {
    if (!holder) return;
    svgEl = holder.querySelector("svg");
    if (!svgEl) { teardown(); return; }

    room = newRoom;
    readSettings();
    buildFilters(holder);

    /* create the fog root just above the FX root (so mist lies over light) */
    const fx = svgEl.querySelector("#fx-root");
    root = svgEl.querySelector("#fog-root");
    if (!root) {
      root = mk("g", { id: "fog-root", "pointer-events": "none" });
      if (fx) svgEl.insertBefore(root, fx.nextSibling);
      else svgEl.appendChild(root);
    }
    root.innerHTML = "";
    blobs = [];
    streamers = [];
    shafts = [];
    draughts = [];
    drips = [];
    vortices = [];
    wisps = [];
    bands = [];
    panes = [];
    ribbons = [];
    motes = [];
    curls = [];
    breaths = [];
    weather = 1;
    uid = 0;
    initClarity();

    const profile = mergeProfile(P[newRoom] || P.hallway, P2[newRoom], P3[newRoom]);
    opacFactor = roomOpacityFactor(profile.kind);
    if (enabled && profile) {
      if (profile.tint) {
        const scrim = mk("rect", {
          x: 0, y: 0, width: STAGE_W, height: STAGE_H,
          fill: profile.tint, opacity: (0.03 * opacFactor).toFixed(3),
        }, root);
        root.insertBefore(scrim, root.firstChild);
      }
      spawnDepthHaze(profile, root);
      for (const bank of profile.banks) spawnBank(bank, root);
      /* layer two: shafts under the banks, wisps last (foreground) */
      spawnShafts(profile, root);
      spawnDraughts(profile, root);
      spawnDrips(profile, root);
      spawnVortices(profile, root);
      spawnWisps(profile, root);
      /* layer three */
      spawnBands(profile, root);
      spawnPanes(profile, root);
      spawnRibbons(profile, root);
      spawnMotes(profile, root);
      spawnCurls(profile, root);
      spawnBreaths(profile, root);
    }

    mounted = true;
    elapsed = 0;
    eventIndex = 0;
    eventActive = null;
    gustPhase = 0;
    clarity = (profile && profile.clarityFloor != null) ? profile.clarityFloor : 0.5;
    start();
  }

  function teardown() {
    if (root) { root.innerHTML = ""; }
    blobs = [];
    streamers = [];
    shafts = [];
    draughts = [];
    drips = [];
    vortices = [];
    wisps = [];
    bands = [];
    panes = [];
    ribbons = [];
    motes = [];
    curls = [];
    breaths = [];
    weather = 1;
    mounted = false;
    stop();
  }

  /* ==========================================================================
     7. SETTINGS + POINTER
  ========================================================================== */
  function readSettings() {
    enabled = Settings.get("fog") !== false;
    density = clamp(Settings.get("fogDensity") != null ? Settings.get("fogDensity") : 0.7, 0, 1);
    reduced = !!Settings.get("reducedMotion");
  }

  function setEnabled(on) { enabled = !!on; }
  function setDensity(d) { density = clamp(d, 0, 1); }

  function trackPointer() {
    window.addEventListener("pointermove", (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      if (!mouse.active) { mouse.lx = mouse.x; mouse.ly = mouse.y; mouse.active = true; }
    }, { passive: true });
    window.addEventListener("pointerdown", (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
    }, { passive: true });
    window.addEventListener("pointerout", () => { mouse.active = false; }, { passive: true });
  }

  /* a one-off clearing pulse — e.g. when a light is switched on */
  function pulse(x, y, r) {
    pulseAt = elapsed; pulseX = x; pulseY = y; pulseR = r || 240;
  }

  /* a forced gust — a door opens somewhere and the fog surges in from it.
     The loop's own gust envelope will lerp this back down over a few
     frames, so a single call reads as one breath, not a permanent wind. */
  function gustNow(strength) {
    gustBoost = clamp(strength != null ? strength : 1, 0, 1);
    /* the surge also parts the fog a little at the cursor, so the player
       feels it as motion, not just a number changing somewhere. */
    pulse(640, 360, 260);
  }

  /* ==========================================================================
     8. ANIMATION LOOP
  ========================================================================== */
  function start() {
    if (raf) return;
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (!mounted || !blobs.length) return;

    const dt = clamp((t - lastT) / 16.6, 0.05, 3);
    lastT = t;
    elapsed += dt * 16.6;

    const profile = mergeProfile(P[room] || P.hallway, P2[room], P3[room]);
    const floor = (profile && profile.clarityFloor != null) ? profile.clarityFloor : 0.5;
    const ceil = (profile && profile.clarityCeil != null) ? profile.clarityCeil : 0.9;
    /* slow weather: the whole room's fog thickens and thins over minutes */
    weather = profile.weather
      ? 1 + Math.sin((elapsed * TAU) / profile.weather.period) * profile.weather.depth
      : 1;

    /* ---- 1. pointer velocity → clear radius + clarity ---- */
    if (mouse.active && mouse.lx > -999) {
      const dx = mouse.x - mouse.lx, dy = mouse.y - mouse.ly;
      const speed = Math.hypot(dx, dy);
      pointerSpeed = lerp(pointerSpeed, speed, 0.24);
      mouse.lx = mouse.x; mouse.ly = mouse.y;
    } else {
      pointerSpeed *= 0.86;
    }
    const speedTarget = clamp(22 + pointerSpeed * 0.85, 22, 210);
    clearRadius = lerp(clearRadius, speedTarget, 0.16);
    const clarityTarget = clamp(ceil - (ceil - floor) * smooth(norm(pointerSpeed, 0, 120)), floor, ceil);
    clarity = lerp(clarity, clarityTarget, 0.03);

    /* ---- 2. gust cycle ---- */
    let gust = 0;
    if (profile.gust) {
      const g = profile.gust;
      gustPhase = (elapsed % g.period) / g.period;
      const inGust = gustPhase * g.period;
      const len = g.len;
      const a = rampUp(inGust, 0, len * 0.4) * rampDown(inGust, len * 0.55, len);
      gustBoost = lerp(gustBoost, a, 0.1);
      gust = gustBoost * g.strength;
    }

    /* ---- 3. choreography events ---- */
    if (profile.events && profile.events.length) {
      if (!eventActive && eventIndex < profile.events.length) {
        const ev = profile.events[eventIndex];
        if (elapsed >= ev.at) { eventActive = { ...ev, start: elapsed }; eventIndex++; }
      }
      if (eventActive && elapsed - eventActive.start > eventActive.dur) eventActive = null;
    }
    const eventSwell = () => {
      if (!eventActive) return 1;
      const k = (elapsed - eventActive.start) / eventActive.dur;
      return 1 + (eventActive.swell - 1) * Math.sin(clamp(k, 0, 1) * Math.PI);
    };
    const swell = eventSwell();

    /* ---- 4. cursor position in stage coords ---- */
    let px = -9999, py = -9999;
    if (mouse.active && svgEl) {
      let r = svgEl.getBoundingClientRect();
      if (!r || !r.width) r = { left: 0, top: 0, width: 1280, height: 720 };
      const sx = STAGE_W / r.width, sy = STAGE_H / r.height;
      px = (mouse.x - r.left) * sx; py = (mouse.y - r.top) * sy;
    }

    /* ---- 4b. spatial clarity field: stamp where the mouse swept, heal ---- */
    if (px > -999 && mouse.active) {
      const stampStrength = clamp(pointerSpeed / 110, 0, 1);
      stampClarity(px, py, stampStrength, clearRadius);
    }
    decayClarity();

    /* ---- 4c. attic torch: the beam the player points parts the fog ---- */
    let beam = null;
    if (room === "attic" && typeof State !== "undefined" && State.hasItem &&
        State.hasItem("torch") && State.flag && State.flag("torchOn")) {
      const hole = document.getElementById("torch-hole");
      if (hole) {
        const hx = parseFloat(hole.getAttribute("cx"));
        const hy = parseFloat(hole.getAttribute("cy"));
        if (!isNaN(hx) && !isNaN(hy)) beam = { x: hx, y: hy, r: 190 };
      }
    }

    /* ---- 5. per-blob update ---- */
    const light = profile && profile.glow ? profile.glow : null;
    const pulseAge = elapsed - pulseAt;
    const pulseOn = pulseAge >= 0 && pulseAge < 1200;

    for (const b of blobs) {
      if (reduced) continue;   // static fog: leave attributes as spawned

      /* organic drift: base wind + rotational flow + sway + gust shove */
      const ang = flowAngle(b.x * 0.01, b.y * 0.01, elapsed * 0.001, b.seed);
      b.ph += 0.006 * dt;
      b.x += (b.driftX + gust + Math.cos(ang) * 6 * b.flow) * dt + Math.cos(b.ph) * b.sway * 0.004 * dt;
      b.y += (b.driftY + b.rise + Math.sin(ang * 0.7) * 5 * b.flow) * dt;

      keepInside(b, dt);

      /* opacity: base * breathing * swell * clarity * (mouse clearing) * light scatter */
      let o = b.baseO;
      o *= 0.82 + 0.18 * breathe(elapsed, 4200 + b.seed % 900, 1);
      o *= swell;
      o *= weather;
      o *= lerp(0.55, 1.0, clarity);
      /* spatial clarity: fog thinned where the mouse recently swept */
      const local = sampleClarity(b.x, b.y);
      if (local > 0.001) o *= lerp(1, 0.25, clamp(local, 0, 1));
      if (px > -999) {
        const d2c = dist2(b.x, b.y, px, py);
        const r2 = clearRadius * clearRadius;
        if (d2c < r2) {
          const d = Math.sqrt(d2c) || 0.001;
          const k = smooth(1 - d / clearRadius);     // 1 at centre, 0 at edge
          o *= lerp(1, 0.16, k);
        }
      }
      if (pulseOn) {
        const d = dist(b.x, b.y, pulseX, pulseY);
        if (d < pulseR) o *= lerp(1, 0.2, smooth(1 - d / pulseR) * (1 - pulseAge / 1200));
      }
      if (beam) {
        const d = dist(b.x, b.y, beam.x, beam.y);
        if (d < beam.r) o *= lerp(1, 0.12, smooth(1 - d / beam.r));
      }
      if (light) {
        for (const g of light) {
          const d = dist(b.x, b.y, g[0], g[1]);
          const glow = g[3];
          if (d < glow) {
            const k = smooth(1 - d / glow);
            o += 0.05 * opacFactor * k;              // lamplight makes fog visible
          }
        }
      }
      o = clamp(o, 0, 0.5);

      b.el.setAttribute("cx", b.x.toFixed(1));
      b.el.setAttribute("cy", b.y.toFixed(1));
      b.el.setAttribute("opacity", o.toFixed(3));
    }

    /* ---- 6. streamers: rise, sway, dissolve ---- */
    for (const s of streamers) {
      s.t += dt * 16.6;
      const cycle = s.t % s.dur;
      const k = cycle / s.dur;
      const h = s.h * Math.sin(k * Math.PI);        // grow then shrink
      const xw = s.x0 + Math.sin(cycle * 0.001 + s.phase) * 8;
      const opacity = s.o * Math.sin(k * Math.PI) * lerp(0.5, 1, clarity) * swell;
      s.el.setAttribute("x", xw.toFixed(1));
      s.el.setAttribute("y", (s.y1 - h).toFixed(1));
      s.el.setAttribute("height", h.toFixed(1));
      s.el.setAttribute("opacity", clamp(opacity, 0, 0.4).toFixed(3));
    }

    /* ---- 7. light shafts: sway and breathe with the fog ---- */
    if (!reduced) {
      for (const sh of shafts) {
        sh.ph += 0.004 * dt;
        const sway = Math.sin(sh.ph) * sh.s.sway + gust * 0.6;
        sh.el.setAttribute("points", shaftPoints(sh.s, sway));
        sh.el.setAttribute("opacity", (sh.s.o * (0.8 + 0.2 * breathe(elapsed, 5200 + sh.s.x1 % 700, 1)) * swell).toFixed(3));
      }
    }

    /* ---- 8. draughts: curl up and away from the door gap ---- */
    if (!reduced) {
      for (const d of draughts) {
        d.ph += 0.01 * dt;
        const xw = d.d.x + Math.sin(d.ph) * d.d.w * 0.3;
        const yw = d.d.y + Math.sin(d.ph * 0.7) * 6 + Math.cos(d.ph) * 5;
        d.el.setAttribute("cx", xw.toFixed(1));
        d.el.setAttribute("cy", yw.toFixed(1));
        d.el.setAttribute("opacity", (d.d.o * (0.6 + 0.4 * breathe(elapsed, 6800, 1)) * swell).toFixed(3));
      }
    }

    /* ---- 9. drips: slide down the glass and dissolve ---- */
    if (!reduced) {
      for (const dr of drips) {
        dr.t += dt * 16.6;
        const k = (dr.t % dr.d.dur) / dr.d.dur;
        const y = lerp(dr.d.y0, dr.d.y1, ease("outCubic", k));
        dr.el.setAttribute("y", y.toFixed(1));
        dr.el.setAttribute("opacity", (dr.d.o * Math.sin(clamp(k, 0, 1) * Math.PI)).toFixed(3));
      }
    }

    /* ---- 10. vortices: spin their wisps and pull nearby fog ---- */
    if (!reduced) {
      for (const vx of vortices) {
        vx.ang += 0.004 * dt;
        for (const sat of vx.sat) {
          const a = sat.a0 + vx.ang * sat.sp;
          sat.el.setAttribute("cx", (vx.v.cx + Math.cos(a) * sat.rr).toFixed(1));
          sat.el.setAttribute("cy", (vx.v.cy + Math.sin(a) * sat.rr * 0.6).toFixed(1));
        }
        /* drag the bank fog tangentially near the core */
        const pullR = vx.v.r * 1.6;
        for (const b of blobs) {
          const dx = b.x - vx.v.cx, dy = b.y - vx.v.cy;
          const d2v = dx * dx + dy * dy;
          if (d2v < pullR * pullR) {
            const d = Math.sqrt(d2v) || 0.001;
            const k = (1 - d / pullR) * vx.v.pull * 0.16;
            b.x += -dy * k * dt;
            b.y += dx * k * dt;
          }
        }
        vx.core.setAttribute("opacity", (vx.v.o * (0.7 + 0.3 * breathe(elapsed, 9000, 1))).toFixed(3));
      }
    }

    /* ---- 11. wisps: foreground drift, faint and slow ---- */
    if (!reduced) {
      for (const w of wisps) {
        w.x += w.sp * dt * 0.6;
        if (w.x < -w.r) w.x = STAGE_W + w.r;
        if (w.x > STAGE_W + w.r) w.x = -w.r;
        w.el.setAttribute("cx", w.x.toFixed(1));
        w.el.setAttribute("cy", (w.y + Math.sin(elapsed * 0.0004 + w.ph) * 14).toFixed(1));
        w.el.setAttribute("opacity", (w.o * (0.75 + 0.25 * breathe(elapsed, 12000 + w.ph, 1))).toFixed(3));
      }
    }

    /* ---- 12. bands: shadow strips drifting across the floor ---- */
    if (!reduced) {
      for (const bd of bands) {
        bd.x += bd.b.speed * bd.dir * dt * 10;
        if (bd.x < -200) bd.x = STAGE_W + 200;
        if (bd.x > STAGE_W + 200) bd.x = -200;
        bd.el.setAttribute("cx", bd.x.toFixed(1));
        bd.el.setAttribute("cy", (bd.b.y + Math.sin(elapsed * 0.0005 + bd.ph) * 8).toFixed(1));
        bd.el.setAttribute("opacity", (bd.b.o * weather * (0.7 + 0.3 * breathe(elapsed, 9800, 1))).toFixed(3));
      }
    }

    /* ---- 13. panes: condensation film + sliding streaks ---- */
    if (!reduced) {
      for (const p of panes) {
        p.el.setAttribute("opacity", (p.p.o * weather * (0.8 + 0.2 * breathe(elapsed, 11000, 1))).toFixed(3));
        for (const st of p.streaks) {
          const y = p.p.y + ((st.phase + elapsed * st.sp) % p.p.h);
          st.el.setAttribute("y1", y.toFixed(1));
          st.el.setAttribute("y2", (y + st.len).toFixed(1));
          st.el.setAttribute("opacity", (0.5 * opacFactor * Math.sin(((elapsed * st.sp) / p.p.h) * TAU * 0.5 + st.phase) ** 2).toFixed(3));
        }
      }
    }

    /* ---- 14. ribbons: undulating mist lines ---- */
    if (!reduced) {
      for (const rb of ribbons) {
        rb.el.setAttribute("d", ribbonPath(rb.r, elapsed * 0.001, rb.ph));
        rb.el.setAttribute("opacity", (rb.r.o * weather * (0.8 + 0.2 * breathe(elapsed, 7600, 1))).toFixed(3));
      }
    }

    /* ---- 15. motes: dust drifting and twinkling in the light ---- */
    if (!reduced) {
      for (const m of motes) {
        m.x += m.spx * dt;
        m.y += m.spy * dt;
        if (m.x < 0) m.x = STAGE_W; if (m.x > STAGE_W) m.x = 0;
        if (m.y < 40) m.y = STAGE_H - 40; if (m.y > STAGE_H - 40) m.y = 40;
        m.el.setAttribute("cx", m.x.toFixed(1));
        m.el.setAttribute("cy", m.y.toFixed(1));
        const tw = 0.4 + 0.6 * Math.sin(elapsed * 0.003 + m.ph) ** 2;
        m.el.setAttribute("opacity", (m.o * tw * weather).toFixed(3));
      }
    }

    /* ---- 16. curls: corner fog rolling in place ---- */
    if (!reduced) {
      for (const cl of curls) {
        cl.ang += 0.003 * dt;
        for (const sb of cl.subs) {
          const a = sb.a0 + cl.ang * sb.sp;
          sb.el.setAttribute("cx", (cl.c.x + Math.cos(a) * sb.rr).toFixed(1));
          sb.el.setAttribute("cy", (cl.c.y + Math.sin(a) * sb.rr * 0.6).toFixed(1));
        }
        cl.core.setAttribute("opacity", (cl.c.o * weather * (0.8 + 0.2 * breathe(elapsed, 10400, 1))).toFixed(3));
      }
    }

    /* ---- 17. breaths: exhalations swelling from a point ---- */
    if (!reduced) {
      for (const br of breaths) {
        br.t += dt * 16.6;
        const k = (br.t % br.b.dur) / br.b.dur;
        const r = lerp(br.b.r0, br.b.r1, ease("outCubic", k));
        br.el.setAttribute("rx", r.toFixed(1));
        br.el.setAttribute("ry", (r * 0.5).toFixed(1));
        br.el.setAttribute("opacity", (br.b.o * weather * Math.sin(clamp(k, 0, 1) * Math.PI)).toFixed(3));
      }
    }
  }

  /* keep a blob within its bank's region; wrap horizontally where allowed */
  function keepInside(b, dt) {
    const r = b.region;
    if (r.type === "rect") {
      const pad = 30;
      if (b.wrap) {
        if (b.x < r.x - pad) b.x = r.x + r.w + pad * 0.5;
        if (b.x > r.x + r.w + pad) b.x = r.x - pad * 0.5;
      } else {
        if (b.x < r.x + pad) { b.x = r.x + pad; }
        if (b.x > r.x + r.w - pad) { b.x = r.x + r.w - pad; }
      }
      if (b.y < r.y - pad) b.y = r.y + r.h - pad * 0.4;
      if (b.y > r.y + r.h + pad) b.y = r.y - pad * 0.4;
      return;
    }
    if (r.type === "ellipse") {
      const nx = (b.x - r.cx) / r.rx, ny = (b.y - r.cy) / r.ry;
      const d = nx * nx + ny * ny;
      if (d > 1) {
        const k = 1 / Math.sqrt(d);
        b.x = r.cx + nx * r.rx * k * 0.95;
        b.y = r.cy + ny * r.ry * k * 0.95;
      }
      return;
    }
    if (r.type === "quad") {
      const [x0, y0, x1, y1, x2, y2, x3, y3] = r.pts;
      const minx = Math.min(x0, x1, x2, x3), maxx = Math.max(x0, x1, x2, x3);
      const miny = Math.min(y0, y1, y2, y3), maxy = Math.max(y0, y1, y2, y3);
      if (b.wrap) {
        if (b.x < minx) b.x = maxx;
        if (b.x > maxx) b.x = minx;
      } else {
        b.x = clamp(b.x, minx, maxx);
      }
      b.y = clamp(b.y, miny, maxy);
      return;
    }
  }

  /* ==========================================================================
     8b. TUNING + PERFORMANCE NOTES
     The engine is deliberately cheap so a room can carry several hundred
     blurred blobs without the frame budget noticing:

       • Every blob is a single SVG ellipse with one Gaussian blur filter.
         The five blur radii (8/16/24/36/52) are shared, never duplicated,
         so the GPU compositor can batch them.
       • Motion is attribute-only (cx/cy/opacity/points/d). No per-frame
         DOM creation, no innerHTML churn, no layout reflows. The only DOM
         reads per frame are the svg's bounding box and the attic torch
         hole, both cheap.
       • The clarity grid is 24 × 14 = 336 floats. Stamping and decay are
         O(cells) per frame, which is nothing; sampling is O(1) bilinear.
       • Vortex drag is O(vortices × blobs). Vortices are capped at two per
         room, so this is a few hundred cheap multiplies — below the cost
         of one string allocation.
       • Reduced motion renders everything static: the loop still runs but
         every actor update is skipped, so the field becomes a photograph.

     To thicken a room: raise its bank counts and oMin/oMax, or add banks.
     To make a room clearer: raise clarityFloor and clarityCeil. To change
     how fast the mouse parts it: scale the pointerSpeed → clearRadius
     mapping (line "speedTarget") or the stampClarity strength divisor.
     Everything else is data. Nothing is magic.

     9. PUBLIC API
  ========================================================================== */
  return {
    apply, teardown, trackPointer,
    setEnabled, setDensity, pulse, gustNow,
    /* QA / debug introspection */
    _count: () => blobs.length,
    _streamers: () => streamers.length,
    _shafts: () => shafts.length,
    _draughts: () => draughts.length,
    _drips: () => drips.length,
    _vortices: () => vortices.length,
    _wisps: () => wisps.length,
    _bands: () => bands.length,
    _panes: () => panes.length,
    _ribbons: () => ribbons.length,
    _motes: () => motes.length,
    _curls: () => curls.length,
    _breaths: () => breaths.length,
    _weather: () => weather,
    _room: () => room,
    _clarity: () => clarity,
    _clearRadius: () => clearRadius,
    _localClarity: (x, y) => sampleClarity(x, y),
    _profiles: () => Object.keys(P),
    _layers: () => Object.keys(P2),
    _layers3: () => Object.keys(P3),
  };
})();
