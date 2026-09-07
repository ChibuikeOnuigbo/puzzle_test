/* =====================================================================
   HOUSE 17 — THE BIRDS, v3 (canvas engine, OOP)
   ---------------------------------------------------------------------
   Birds are pre-baked bitmaps drawn on a <canvas> overlay. No SMIL, no
   SVG blur filters; one requestAnimationFrame that runs only on the
   porch, only while the tab is visible, and holds a single static frame
   under reduced motion.

   Classes: PixelMask · SpriteBaker · Bird · FlyingBird · PerchedBird ·
   Forager · Flock · Sky. Every percentage lives in BIRD_CFG below.

   v4 (this pass): a flyer decides ONCE at spawn whether it will land
   (35% tree / 8% roof / rest fly through); a committed bird flies a CURVED
   bezier arc onto a free outer branch (time-based, so it can never stall,
   overshoot or flip left/right), zooms smoothly to its perched size, then
   becomes a PerchedBird that is ATTACHED to the branch: each frame its
   anchor is pushed through the same wind rotations the SVG applies to the
   painted limb (tree -> stem -> main branch), so it rides the sway; it keeps
   full height (uniform scale only) and leaves after 4-7s from exactly where
   it sat. Birds.treeMap(true) paints the labelled tree-structure map.
   Removed: the "loop"/"zig" acrobatics (a spinning/thrashing descent), the
   3px/frame stuck-kick (hitching), hard floor pinning (soft steering now).

   Flight rules this pass enforces (all requested):
     * flocks are small up close (<= 4), larger tiny ones far/behind
       (5-7) with an even bigger rare starling murmuration;
     * the SMALLEST birds fly at the BACK (clipped behind the house),
       and ~87% of all flyers stay above the roofline;
     * near/front birds have a raised minimum size so none read tiny;
     * NO bird ever travels in a straight line — every path has a
       continuous wobbly curve/rumble; nothing dives straight down;
     * nothing leaves the bottom of the screen; nothing spawns from a
       random mid-air point — live spawns always come from a side edge;
     * a watchdog guarantees no bird hovers in one spot for > ~0.8s
       (including wind fighters: gusts are short and the bird always
       keeps forward progress);
     * bigger birds fly faster and flap more; the wing never rotates
       past ~70° and a second (far) wing is drawn so a flapping bird
       reads as a two-winged bird;
     * ground birds mostly WALK (a waddle + pecks + zig-zag + a little
       toward/away depth), hop only ~2% of steps, and stay on the path.
===================================================================== */
(function () {
  "use strict";
  if (typeof window === "undefined") return;

  /* ===================================================================
     BIRD_CFG — the single knob panel. Percentages are 0..1.
     =================================================================== */
  const BIRD_CFG = {
    world: { w: 1280, h: 720 },

    population: { flyers: 24, maxFlyers: 30 },

    /* flyers never dip below the centre of the screen +50px */
    centreY: 360,
    maxFlyY: 305,
    minFlyY: 26,

    /* the SMALL birds split: 70% fly HIGH at roof/eave height (behind the
       house), 30% fly LOW down by/under the house in front of the wall. Both
       groups are genuinely small (the low ones only a touch bigger for being
       nearer). Big birds are a separate, rare roll. */
    smallHighShare: 0.70,
    bigBirdRoll: 0.03,
    lowSmallScale: 1.12,

    /* ---- flap cycle ---- */
    flapFrames: 12,
    downstrokeFraction: 0.6,
    farFade: 0.72,

    /* speed styles (weighted roll) */
    speedStyles: { constant: 0.30, accelerate: 0.24, accelGlide: 0.28, bounding: 0.18 },
    baseSpeed: { far: 58, mid: 84, near: 122 },   // raised: bigger birds move
    minForward: 0.22,                            // net horizontal speed floor (no hovering)

    /* heading: straight is REMOVED — every flyer wobbles/curves */
    heading: { wobble: 0.62, oscillate: 0.26, fixedClimb: 0.12 },
    fixedAnglesDeg: [20, 35, 45, 60],            // gentle->steep CLIMBS only (no steep dives)
    wobbleAmpDeg: 7,                             // continuous small curve
    wobblePeriod: 2.1,
    oscillateAmplitudeDeg: 18,
    oscillatePeriod: 3.0,

    /* wind fight: brief, and the bird always keeps moving forward */
    fightWind: 0.15,
    windDir: 1,
    gustEvery: [3.5, 7.0],
    gustDur: [0.18, 0.42],                      // short slams only
    gustSlipPx: 20,

    /* acrobatics: only SMOOTH moves remain. The old "loop" (a full 360deg
       spin) and "zig" (six bank reversals a second) made a descending bird
       look like it was stuck flipping left/right, so they are gone. */
    acrobatics: 0.08,
    acroEvery: [9, 18],
    acroMoves: { stoop: 0.65, roll: 0.35 },

    wingStyles: { flapper: 0.62, mixer: 0.30, glider: 0.08 },   // fewer long glides

    /* perching / landing. A quarter-ish of flyers break off and settle: about
       7 in 10 of those land on the FOREGROUND TREES (they bank down, become
       front-layer birds, grip the branch and ride its sway, then leave after
       5-7s); the rest touch down on the roof. Everyone else flies through and
       leaves the screen. */
    /* decided ONCE at spawn for every solo flyer: 35% will go to a foreground
       TREE (grip a free outer branch, ride its sway, leave after 4-7s); a
       further 8% touch down on the roof; the rest fly through. A flagged
       bird commits as soon as a free anchor lies ahead of it. */
    treeLandChance: 0.35,
    roofLandChance: 0.08,
    perchStaySec: [0.6, 14],                     // roof: some leave almost at once, some wait
    treeStaySec: [4, 7],                         // tree perchers stay 4-7 seconds then leave
    initialPerchedRoof: 2,
    initialPerchedTree: 4,
    foragers: 3,
    /* per-second probability a FLAGGED flyer commits once a perch is ahead */
    landRateBack: 0.9,
    landRateFront: 1.2,
    /* the perched bird's size is carried over from the flyer (no pop) and the
       flyer zooms smoothly toward it on the approach (the tree is nearer the
       lens than the sky). */
    treePerchSize: [0.62, 0.9],

    /* ~75% of flyers ride the BACK z-layer (behind the house); the remaining
       quarter cross in front. Small/back birds may be numerous; medium/big are
       capped separately. */
    backBias: 0.75,
    depthByScale: 0.95,                          // a bird is "front" only when big & near

    /* flocks: tiny up close, more-but-tiny far away */
    flockChance: 0.30,
    flockSize: [2, 4],                           // near / mid flocks: max 4
    farFlockSize: [5, 7],                        // behind-the-house flocks: a few more
    murmurationChance: 0.10,
    murmurationSize: [16, 26],
    boidWeights: { cohesion: 0.9, alignment: 0.8, separation: 1.4, neigh: 70 },

    /* cheap motion-blend */
    afterimages: 2,
    afterimageAlpha: 0.18,
    streak: 0.45,
    streakMinSpeed: 96,

    /* ground birds — they walk an ISOMETRIC map: the house is up-screen (far,
       small), the camera is down-screen (near, big). They wander the yard path
       slowly, drifting toward/away the house as well as side to side, and never
       walk into the house (above the porch line). */
    ground: {
      hopChance: 0.02,
      walkDur: [2.8, 5.2],        // seconds per little walk = slow pace
      stepX: [10, 24],            // side-to-side distance per stroll
      stepDepth: [6, 20],         // toward/away the house (isometric y)
      depthDrift: 0.6,            // most strolls also change depth
      peckEvery: 2.4,
      xMin: 486, xMax: 798,       // stay on the widening path
      yNear: 648, yFar: 600,      // near (big) at the bottom of the path
      porchY: 560,                // never walk above the porch (into the house)
    },

    /* medium & big birds are limited on screen: small birds may break the
       depth/spawn rules, but solo birds this size or larger cap at
       bigBirdMax, split at most bigBirdPerSide one way and the rest the other. */
    bigBirdScale: 0.70,
    bigBirdMax: 5,
    bigBirdPerSide: 3,

    /* size bands (raw scale, before species flavour). Near birds have a
       raised FLOOR so nothing close to the lens reads too small; far birds
       are genuinely small. */
    sizeBands: {
      far:  [0.34, 0.50],
      mid:  [0.52, 0.70],
      near: [0.60, 0.78],                         // the biggest bird is much smaller now
    },
    /* absolute hard ceiling for a near/front bird (post species flavour) */
    maxNearScale: 0.80,

    species: {
      swift:    { s: 0.70, v: 1.40, wing: "flapper", tint: "#0b0f16" },
      starling: { s: 0.76, v: 1.20, wing: "flapper", tint: "#0a0e14" },
      sparrow:  { s: 0.78, v: 1.10, wing: "mixer",   tint: "#0b0f16" },
      crow:     { s: 0.90, v: 1.06, wing: "mixer",   tint: "#070a0f", big: true },
      owl:      { s: 0.94, v: 0.95, wing: "mixer",   tint: "#06090d", big: true },
    },
    speciesRoll: ["swift", "starling", "starling", "sparrow", "sparrow", "crow", "crow"],
    owlChance: 0.04,
  };
  const CFG = BIRD_CFG;

  /* ===================== utilities ===================== */
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rand(a, b + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const chance = p => Math.random() < p;
  function roll(table) { let r = Math.random(); for (const k in table) { r -= table[k]; if (r <= 0) return k; } return Object.keys(table)[0]; }

  /* ===================== PixelMask ===================== */
  class PixelMask {
    static decode(pose) {
      const gw = pose.gw, gh = pose.gh, g = new Uint8Array(gw * gh);
      for (const row of pose.rows)
        for (const r of row.runs)
          for (let x = r[0]; x < r[0] + r[1]; x++) g[row.gy * gw + x] = 1;
      return { gw, gh, g };
    }
  }

  /* ===================== SpriteBaker ===================== */
  class SpriteBaker {
    constructor() { this.flyFrames = []; this.glideFrame = null; this.perchFrames = []; }
    build() { this._buildFlyer(); this._buildPerch(); return this; }

    _flyerCanvas() {
      const SS = 2;
      const c = document.createElement("canvas");
      c.width = 120 * SS; c.height = 96 * SS;
      const ctx = c.getContext("2d");
      ctx.scale(SS, SS);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      c._ss = SS;
      return { c, ctx };
    }

    /* one wing: shoulder at origin, pointing toward +x, with ang = 0 level.
       Clamped to a believable arc (never more than ~70deg either way). */
    _wing(ctx, ang, len, chord, tint, far) {
      ctx.save();
      ctx.rotate(clamp(ang, -1.2, 1.05));
      ctx.fillStyle = tint;
      ctx.globalAlpha = far ? 0.9 : 1;
      const L = far ? len * 0.86 : len, C = far ? chord * 0.9 : chord;
      ctx.beginPath();
      ctx.moveTo(-2, 2);
      ctx.quadraticCurveTo(L * 0.55, -C * 0.5, L, far ? 0 : -1.5);
      const tips = 6;
      for (let i = 1; i <= tips; i++) {
        const t = i / tips;
        ctx.lineTo(L - t * L + 1, (far ? 0 : -1.5) + C * (0.5 + 0.5 * Math.sin(t * Math.PI * 0.6)) + (i % 2 ? C * 0.3 : 0.4));
      }
      ctx.quadraticCurveTo(L * 0.3, C * 0.62, -2, C * 0.4);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    /* Draw the bird facing +x (right). Body is a narrow teardrop / triangle-
       morph (no fat oval), a small beak, and a single NEAR eye: a dot that
       catches the light or stays dark per-species, attached to the head and
       oriented so only the eye facing the camera reads (the far eye is
       hidden behind the head = the 3D side view). Wings mount further back
       (toward the tail) on the shoulder, not from the neck. */
    _drawFlyer(ctx, p, style, opt) {
      const tint = (opt && opt.tint) || "#0b0f16";
      const eyeShine = (opt && opt.eyeShine) ? 1 : 0;   // 1 = specular catch, 0 = dark
      ctx.fillStyle = tint; ctx.lineJoin = "round"; ctx.lineCap = "round";
      const u = p;
      const downFrac = CFG.downstrokeFraction;
      let down, spread;
      if (style === "glider") { down = 0.5; spread = 1.0; }
      else if (u < downFrac) { const q = u / downFrac; down = q; spread = lerp(0.8, 1.0, q); }
      else { const q = (u - downFrac) / (1 - downFrac); down = 1 - q; spread = lerp(1.0, 0.5, q); }

      ctx.save();
      ctx.translate(60, 52);
      const bob = Math.sin(u * TAU) * 1.3;
      ctx.translate(0, bob * (0.4 + down * 0.6));

      // ---- tail: short forked wedge (tapered narrow rump) ----
      const t = (1 - spread);
      ctx.beginPath();
      ctx.moveTo(-18, 1);
      ctx.quadraticCurveTo(-29, -2 - t * 3, -37, -6 - t * 2);
      ctx.quadraticCurveTo(-31, 1, -36, 4 + t * 3);
      ctx.quadraticCurveTo(-28, 6, -18, 5);
      ctx.closePath(); ctx.fill();

      // ---- body: a narrow angular fuselage — a straight-backed wedge that
      // tapers to a pointed head/beak and pinches to a thin rump at the tail.
      // Big birds are SLIMMER still (a shallow belly line), and their abdomen
      // is then rebuilt from LAYERED angular plates — triangles and small
      // squares/rhombs overlapping like scale-feathers (see the low-poly crow
      // reference) — so it never reads as a fat smooth oval. ----
      const big = !!opt.big;
      const belly = big ? 3.2 : 4;
      ctx.beginPath();
      ctx.moveTo(-22, 1);                       // tail rump (pinched, thin)
      ctx.lineTo(-6, -8);                       // straight back to the nape
      ctx.quadraticCurveTo(8, -10, 18, -7);     // crown over the head
      ctx.quadraticCurveTo(24, -5, 24, -2);     // forehead into face
      ctx.lineTo(14, 3);                        // throat (angular)
      ctx.lineTo(-8, belly);                    // breast
      ctx.lineTo(-22, 1);                       // belly tapering back to rump
      ctx.closePath(); ctx.fill();

      if (big) {
        // faceted abdomen: a row of overlapping PLATES along the lower body,
        // each an angular polygon (triangle / square / rhomb), stepping down
        // half a unit below the belly line so the underside is a jagged,
        // layered edge rather than a curve. Drawn breast -> rump so each plate
        // overlaps the one behind it (feather lay).
        ctx.fillStyle = tint;
        const plates = [
          // [x, y, w, h, shape]  shape: 0=triangle down, 1=square, 2=rhomb
          [ 11, 2.2, 5.0, 2.6, 0 ],
          [  6, 2.8, 4.6, 3.0, 1 ],
          [  1, 3.0, 5.0, 3.0, 2 ],
          [ -4, 2.9, 4.6, 2.8, 0 ],
          [ -9, 2.6, 4.6, 2.6, 1 ],
          [-14, 2.0, 4.4, 2.2, 2 ],
          [-18.5, 1.3, 3.4, 1.6, 0 ],
        ];
        for (const [x, y, w, h, shape] of plates) {
          ctx.beginPath();
          if (shape === 0) {          // triangle, point down
            ctx.moveTo(x - w / 2, y - h * 0.35); ctx.lineTo(x + w / 2, y - h * 0.5); ctx.lineTo(x + w * 0.1, y + h * 0.55);
          } else if (shape === 1) {   // square, slightly sheared
            ctx.moveTo(x - w / 2, y - h * 0.4); ctx.lineTo(x + w / 2, y - h * 0.55); ctx.lineTo(x + w / 2 - 0.5, y + h * 0.45); ctx.lineTo(x - w / 2 + 0.5, y + h * 0.5);
          } else {                    // rhomb
            ctx.moveTo(x - w / 2, y); ctx.lineTo(x, y - h * 0.5); ctx.lineTo(x + w / 2, y - 0.2); ctx.lineTo(x + 0.2, y + h * 0.5);
          }
          ctx.closePath(); ctx.fill();
        }
        // plate seams: thin lighter facet edges so the layering reads even at
        // silhouette size (a hint of 3D low-poly shading, not a texture)
        ctx.strokeStyle = "rgba(96,108,124,0.55)"; ctx.lineWidth = 0.7; ctx.lineCap = "round";
        for (const [x, y, w, h, shape] of plates) {
          ctx.beginPath();
          if (shape === 0) { ctx.moveTo(x - w / 2, y - h * 0.35); ctx.lineTo(x + w * 0.1, y + h * 0.55); }
          else if (shape === 1) { ctx.moveTo(x - w / 2 + 0.5, y + h * 0.5); ctx.lineTo(x - w / 2, y - h * 0.4); }
          else { ctx.moveTo(x - w / 2, y); ctx.lineTo(x, y - h * 0.5); }
          ctx.stroke();
        }
        // a second, upper row of small facets on the flank (square + triangle)
        ctx.fillStyle = "rgba(20,26,34,1)";
        const flank = [ [7, 0.2, 3.2, 2.0, 1], [2, 0.6, 3.4, 2.0, 0], [-3, 0.5, 3.2, 1.9, 2], [-8, 0.1, 3.0, 1.8, 1] ];
        for (const [x, y, w, h, shape] of flank) {
          ctx.beginPath();
          if (shape === 0) { ctx.moveTo(x - w / 2, y - h / 2); ctx.lineTo(x + w / 2, y - h / 2); ctx.lineTo(x, y + h / 2); }
          else if (shape === 1) { ctx.moveTo(x - w / 2, y - h / 2); ctx.lineTo(x + w / 2, y - h / 2); ctx.lineTo(x + w / 2, y + h / 2); ctx.lineTo(x - w / 2, y + h / 2); }
          else { ctx.moveTo(x - w / 2, y); ctx.lineTo(x, y - h / 2); ctx.lineTo(x + w / 2, y); ctx.lineTo(x, y + h / 2); }
          ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = "rgba(90,102,118,0.5)"; ctx.lineWidth = 0.6;
        for (const [x, y, w, h] of flank) { ctx.beginPath(); ctx.moveTo(x - w / 2, y + h / 2); ctx.lineTo(x + w / 2, y - h / 2); ctx.stroke(); }
        ctx.fillStyle = tint; ctx.strokeStyle = tint;
      }

      // ---- beak (small, pointed) ----
      ctx.beginPath();
      ctx.moveTo(23, -5); ctx.lineTo(31, -3); ctx.lineTo(23, -1.5);
      ctx.closePath(); ctx.fill();

      // ---- eye: ONE dot, attached to the near/visible side of the head. It
      // rides the head as the bird banks; the X-squash during a hard bank hides
      // it (far side turns away = the 3D side view). Near/front birds get a
      // clear light catch; far birds a faint dimple. ----
      const eyeX = 15, eyeY = -5, eyeR = 2.5;
      if (eyeShine) {
        // near/front birds: a clear pale iris ring with a dark pupil and a
        // pin-point catch-light. Sized so it survives the 0.6x bake scale.
        ctx.fillStyle = "#eef2f7";
        ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, 0, TAU); ctx.fill();
        ctx.fillStyle = "#0b0f16";
        ctx.beginPath(); ctx.arc(eyeX + 0.5, eyeY + 0.4, eyeR * 0.62, 0, TAU); ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(eyeX + 1.0, eyeY - 0.6, 0.6, 0, TAU); ctx.fill();
        ctx.fillStyle = tint;
      } else {
        ctx.fillStyle = "rgba(206,214,224,0.7)";
        ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR * 0.85, 0, TAU); ctx.fill();
        ctx.fillStyle = "#0b0f16";
        ctx.beginPath(); ctx.arc(eyeX + 0.4, eyeY + 0.3, eyeR * 0.45, 0, TAU); ctx.fill();
        ctx.fillStyle = tint;
      }

      // ---- wings: SMALLER, and the shoulder is mounted further LEFT/back and
      // slightly inward (toward the body, +y), with a touch of sweepback so big
      // birds don't look like they have outsized wings. Far wing first, smaller
      // & raised; near wing overlaps it. ----
      // big birds: the wings are ~15% shorter, the shoulder sits further LEFT
      // (toward the tail) and further INWARD (down toward the body line).
      const wk = big ? 0.85 : 1;
      const len = lerp(17, 27, spread) * wk, chord = lerp(6, 10, spread) * (big ? 0.9 : 1);
      const shX = big ? -11 : -8, shY = big ? -4 : -6;
      const angFar = lerp(-0.95, 0.42, down) + 0.18;
      ctx.save(); ctx.translate(shX - 1.5, shY - 1); this._wing(ctx, angFar, len * 0.82, chord * 0.85, tint, true); ctx.restore();
      const angNear = lerp(-1.05, 0.45, down);
      ctx.save(); ctx.translate(shX, shY); this._wing(ctx, angNear, len, chord, tint, false); ctx.restore();

      ctx.restore();
    }

    _buildFlyer() {
      // baked silhouettes are near-black; frame sets: dark far birds, catch-light
      // near birds, and a BIG set with the layered-plate abdomen.
      const set = (style, shine, big) => {
        const frames = [];
        for (let f = 0; f < CFG.flapFrames; f++) {
          const { c, ctx } = this._flyerCanvas();
          this._drawFlyer(ctx, f / CFG.flapFrames, style, { tint: "#0b0f16", eyeShine: shine, big });
          frames.push(c);
        }
        return frames;
      };
      this.flyFrames = set("flapper", false, false);
      this.flyFramesShine = set("flapper", true, false);
      this.flyFramesBig = set("flapper", true, true);
      const g = this._flyerCanvas();
      this._drawFlyer(g.ctx, 0.5, "glider", { tint: "#0b0f16", eyeShine: true, big: true });
      this.glideFrame = g.c;
    }

    _buildPerch() {
      const BD = (typeof BIRD_DATA !== "undefined") ? BIRD_DATA : null;
      if (!BD) return;
      const unit = 3;
      for (let i = 0; i < BD.perch.length; i++) {
        const dec = PixelMask.decode(BD.perch[i]);
        const c = document.createElement("canvas");
        c.width = Math.ceil(dec.gw * unit); c.height = Math.ceil(dec.gh * unit);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#0d1219";
        for (let y = 0; y < dec.gh; y++)
          for (let x = 0; x < dec.gw; x++)
            if (dec.g[y * dec.gw + x]) ctx.fillRect(x * unit, y * unit, unit + 0.5, unit + 0.5);
        this.perchFrames.push(c);
      }
    }
    perchSprite(i) { return this.perchFrames[i % this.perchFrames.length] || null; }
  }
  /* head/eye position per perch pose as a fraction of the sprite (x from the
     left edge, y from the top), read off the pixel masks in bird-data.js */
  SpriteBaker.PERCH_EYES = [[0.79, 0.075], [0.78, 0.08], [0.83, 0.08], [0.6, 0.1], [0.83, 0.2], [0.85, 0.1]];

  /* ===================== Bird ===================== */
  class Bird {
    constructor(x, y) {
      this.x = x; this.y = y; this.dead = false; this.rot = 0;
      this.size = 1; this.facing = 1; this.tint = "#131a24"; this.alpha = 1;
      this.depth = "front"; this.frame = 0; this.history = [];
    }
    pushHistory() {
      this.history.push({ x: this.x, y: this.y, rot: this.rot });
      if (this.history.length > CFG.afterimages) this.history.shift();
    }
  }

  /* ===================== FlyingBird ===================== */
  class FlyingBird extends Bird {
    constructor(o) {
      super(o.x, o.y);
      const sp = o.species ? CFG.species[o.species] : CFG.species.sparrow;
      this.speciesKey = o.species || "sparrow";
      this.tint = sp.tint;
      this.lane = o.lane;
      this.facing = o.dir || 1;
      this.scale0 = o.scale != null ? o.scale : rand(0.9, 1.1) * sp.s;
      this.size = this.scale0;
      this.bodyLen = 60 * this.size;
      this.speedMul = o.speedMul != null ? o.speedMul : rand(0.94, 1.08);
      this.speedAnchor = o.speedAnchor != null ? o.speedAnchor : CFG.baseSpeed.mid;
      this.speed = this.speedAnchor * this.speedMul * sp.v;
      this.wingStyle = o.wing || sp.wing;
      this.speedStyle = o.speedStyle || roll(CFG.speedStyles);
      this.headingMode = o.headingMode || roll(CFG.heading);
      this.fixAngle = pick(CFG.fixedAnglesDeg) * Math.PI / 180;
      this.flapDur = rand(0.26, 0.4) / (sp.v * 0.55 + 0.45);
      this.flapT = Math.random();
      this.glideMode = false;
      this.elev = rand(-0.10, 0.02);
      this.tPhase = Math.random() * 10;
      this.wobPhase = Math.random() * 10;
      this.windFight = o.windFight != null ? o.windFight : chance(CFG.fightWind);
      if (this.windFight) this.facing = -CFG.windDir;
      this.gustT = rand(CFG.gustEvery[0], CFG.gustEvery[1]);
      this.gustTLeft = 0; this.gustSlip = 0;
      this.acro = o.acro != null ? o.acro : chance(CFG.acrobatics);
      this.acroT = rand(CFG.acroEvery[0], CFG.acroEvery[1]);
      this.acroMove = null; this.acroClock = 0; this.acroBank = 0;
      this.flock = o.flock || null;
      this.vx = this.facing * this.speed; this.vy = 0; this.bank = 0;
      this.canLand = o.canLand != null ? o.canLand : true;
      // decided ONCE here: does this bird intend to land, and where?
      //   35% -> a foreground tree (free outer branch), 8% -> the roof.
      // (o.wantPerch lets a respawn / takeoff override the roll.)
      if (o.wantPerch !== undefined) this.wantPerch = o.wantPerch;
      else if (!this.canLand) this.wantPerch = null;
      else { const r = Math.random(); this.wantPerch = r < CFG.treeLandChance ? "tree" : r < CFG.treeLandChance + CFG.roofLandChance ? "roof" : null; }
      this.state = "flight"; this.bornT = 0;
      this.takeoffT = o.takeoff ? 1.2 : 0;         // grace after leaving a low perch
      this._stuckT = 0; this._px = o.x; this._py = o.y;
      this._acrodx = 0; this._acrody = 0;
      this.depth = o.depth || (this.scale0 < CFG.depthByScale ? "back" : "front");
      // smooth heading: facing is a continuous value (-1..1) eased toward its
      // target sign, so a bird that changes direction BANKS round in a curved
      // turn over ~0.6s instead of snapping/flipping instantly.
      this.face = this.facing;
      this.faceTarget = this.facing;
      // a gliding dip: after a burst the bird arcs down (curved, oscillating)
      this.glideDip = 0;
    }
    /* ask the bird to turn to a new travel sign; it banks round in time */
    _wantFace(sign) { const s = sign >= 0 ? 1 : -1; if (s !== this.faceTarget) this.faceTarget = s; }
    _updateFacing(dt) {
      const rate = 3.2;                            // ~0.6s to reverse
      const step = rate * dt;
      this.face += clamp(this.faceTarget - this.face, -step, step);
      if (Math.abs(this.face) < 0.05) this.face += this.faceTarget * 0.02;  // carry through the pivot
      this.facing = this.face >= 0 ? 1 : -1;
      // bank angle while turning: the body rolls into the turn
      this._turnBank = clamp((this.faceTarget - this.face) * -0.9, -0.7, 0.7);
    }

    update(dt, sky) {
      this.bornT += dt;
      let sp = this.speed;

      /* speed styles */
      if (this.speedStyle === "accelerate") {
        const t = clamp(this.bornT / 14, 0, 1);
        sp = this.speed * lerp(0.85, 1.7, t * t);
      } else if (this.speedStyle === "accelGlide") {
        const cyc = (this.bornT % 6) / 6, burst = cyc < 0.5;
        sp = this.speed * (burst ? lerp(1.2, 1.5, cyc / 0.5) : lerp(0.95, 0.7, (cyc - 0.5) / 0.5));
        this.glideMode = !burst;
      } else if (this.speedStyle === "bounding") {
        const cyc = Math.sin(this.bornT * 2.6);
        sp = this.speed * (1 + 0.4 * Math.max(0, cyc));
        this.glideMode = cyc < -0.25;
        this.boundBob = cyc * 12;
      }

      /* wind fight: SHORT gusts only, and forward progress is guaranteed */
      let slip = 0;
      if (this.windFight) {
        this.gustT -= dt;
        if (this.gustTLeft > 0) { this.gustTLeft -= dt; slip = this.gustSlip; this.gustSlip *= 0.92; }
        else if (this.gustT <= 0) { this.gustTLeft = rand(CFG.gustDur[0], CFG.gustDur[1]); this.gustSlip = CFG.gustSlipPx; this.gustT = rand(CFG.gustEvery[0], CFG.gustEvery[1]); slip = this.gustSlip; }
        sp *= 0.8;   // fight, but never stall
      }

      /* smooth facing: ease toward the desired travel sign (banked turn, no
         instant flip). Wind-fighters hold into the wind; everything else turns
         only when it actually needs to (a landing approach). */
      let landing = null;
      let vx, vy;
      if (this.state === "landing" && this.landing) {
        // CURVED ARC APPROACH. At commit we stored a quadratic bezier from the
        // commit point to the perch whose control point sits ABOVE the line
        // between them, so the bird swoops in a smooth curve and comes DOWN
        // onto the branch from slightly above (a flare), never a straight
        // line and never a hover. The perch itself is moving (the branch
        // sways), so the arc's end is re-read live every frame. Progress is
        // time-based: it cannot stall, overshoot or thrash left/right.
        const L = this.landing;
        const live = sky.livePerchPos(L);
        const ex = live.x, ey = live.y - 5;
        this._landT = (this._landT || 0) + dt;
        const u = clamp(this._landT / this._landDur, 0, 1);
        // ease: carries the cruise speed in (a gentle start), decelerates onto
        // the branch (quadratic out) — continuous velocity at both ends
        const e = 1 - Math.pow(1 - u, 1.6);        // smooth ease-out (C1, monotonic)
        const p0x = this._arc.x0, p0y = this._arc.y0;
        const cx = (p0x + ex) / 2 + this._arc.cdx, cy = Math.min(p0y, ey) - this._arc.lift;
        const bx = (1 - e) * (1 - e) * p0x + 2 * (1 - e) * e * cx + e * e * ex;
        const by = (1 - e) * (1 - e) * p0y + 2 * (1 - e) * e * cy + e * e * ey;
        // a little S-wobble across the arc so even the approach isn't a
        // perfect curve (fades out at the branch)
        const wob = Math.sin(u * Math.PI * 2.0) * 6 * Math.sin(u * Math.PI);
        const nx = bx, ny = by + wob;
        vx = (nx - this.x) / Math.max(dt, 1e-4);
        vy = (ny - this.y) / Math.max(dt, 1e-4);
        landing = { u };
        this.faceTarget = this._apprDir;
        // zoom smoothly toward the perched size (the tree is nearer the lens)
        this.size = lerp(this._arc.s0, this._arc.s1, e);
        if (u >= 1) {
          // the site may have been taken while we were on approach
          if (sky.perchFree(L.id)) { this.dead = true; sky.birdLanded(L, this._apprDir, this); return; }
          const alt = sky.pickPerch(this.depth, this.x, this._apprDir, !!L.tree);
          if (alt) { this._beginLanding(alt, sky); return; }
          this.state = "flight"; this.landing = null; this.canLand = false; this.wantPerch = null;
          this.takeoffT = 1.0; this.size = this._arc.s0;
          landing = null;
        }
      }
      this._updateFacing(dt);
      const facing = this.face;     // continuous -1..1 (used for drawing + motion)

      /* open-flight heading — never a straight line; every path climbs/curves. */
      if (!landing) {
        let aim;
        if (this.headingMode === "oscillate") {
          aim = Math.sin(this.bornT / CFG.oscillatePeriod * TAU + this.tPhase) * CFG.oscillateAmplitudeDeg * Math.PI / 180
              + Math.sin(this.bornT / CFG.wobblePeriod * TAU + this.wobPhase) * CFG.wobbleAmpDeg * Math.PI / 180;
        } else if (this.headingMode === "fixedClimb") {
          // a fixed climb that FADES OUT as the bird nears the top of its band
          // (so it levels into a gentle undulation instead of being pinned
          // along the ceiling); once level it behaves like a wobbler.
          const head = clamp((this.y - CFG.minFlyY) / 90, 0, 1);
          aim = -Math.abs(this.fixAngle) * head * head
              + Math.sin(this.bornT / CFG.wobblePeriod * TAU + this.wobPhase) * CFG.wobbleAmpDeg * Math.PI / 180
              + (1 - head) * 0.12 * Math.sin(this.bornT * 1.3 + this.tPhase);
        } else {
          aim = this.elev + Math.sin(this.bornT / CFG.wobblePeriod * TAU + this.wobPhase) * CFG.wobbleAmpDeg * Math.PI / 180;
        }
        // glide dip: when the wings fold the bird arcs gently DOWN along a curve
        // with a small oscillation (a shallow S) — never a straight drop.
        if (this.glideMode && this.state === "flight") {
          this.glideDip = lerp(this.glideDip, 1, 0.04);
        } else {
          this.glideDip = lerp(this.glideDip, 0, 0.06);
        }
        aim += this.glideDip * (0.22 + 0.12 * Math.sin(this.bornT * 2.1 + this.wobPhase));
        // SOFT altitude band: as the bird nears its floor it is steered back
        // up along a curve (and near the ceiling, back down) so it never gets
        // pinned on a line, jittering up/down against a hard clamp.
        const fl = this.depth === "front" ? 440 : CFG.maxFlyY;
        const room = fl - this.y;
        if (room < 60) aim -= (1 - Math.max(0, room) / 60) * 0.75;
        const headroom = this.flock && this.flock.leader === this ? 70 : 40;   // a leader leaves room for its wingmen
        const head = this.y - CFG.minFlyY;
        if (head < headroom && this.takeoffT <= 0) aim += (1 - Math.max(0, head) / headroom) * 0.5;
        aim = clamp(aim, -1.05, 0.5);   // climbs/curves only; no steep dives
        // velocity along the CONTINUOUS facing vector (eases through a turn,
        // giving a curved path) — no teleport, just integrated vector motion.
        vx = Math.cos(aim) * sp * facing;
        vy = Math.sin(aim) * sp;
        /* ambient + gust wind (gust is a brief backward shove) */
        vx += CFG.windDir * 10 + (this.windFight ? CFG.windDir * slip * 9 : 0);
        if (this.boundBob) vy -= this.boundBob * 0.5;
      }

      if (this.flock) this._flockSteer(dt, vx, vy, sp);
      if (this.acro && this.state === "flight" && !this.flock) this._acrobatics(dt, sp);

      /* forward-progress floor: keep crossing the screen in the INTENDED travel
         direction (sign of faceTarget), not the instantaneous facing, so a bird
         mid-turn isn't falsely kicked. Landing birds are exempt (they home). */
      if (this.state === "flight" && !this.acroMove) {
        const dirVx = vx * this.faceTarget;
        const need = this.speed * CFG.minForward;
        if (dirVx < need) vx = this.faceTarget * need;
      }

      this.vx = vx; this.vy = vy;
      this.x += this.vx * dt + this._acrodx;
      this.y += this.vy * dt + this._acrody;
      this._acrodx = 0; this._acrody = 0;

      /* keep the whole body above the ceiling / below the floor; a bird on
         final approach may dip lower to reach a perch, but never below ground */
      // landing birds may rise to the roof ridge (a little above the open
      // ceiling) for a roof perch, or drop to the low foreground branches for a
      // tree perch; open flight honours the normal band.
      // back/high birds stay above the roofline band; FRONT low-small birds are
      // allowed to cruise down in front of the wall & by the porch.
      const lowFloor = this.depth === "front" ? 440 : CFG.maxFlyY;
      if (this.takeoffT > 0) this.takeoffT -= dt;
      const floor = (this.state === "landing" || this.takeoffT > 0) ? 505 : lowFloor;
      const ceiling = this.state === "landing" ? 12 : CFG.minFlyY;
      this.y = clamp(this.y, ceiling, floor);
      if (this.y >= floor - 0.5 && this.vy > 0) this.vy = 0;   // no sinking into the ground

      this.bank = lerp(this.bank, clamp(-this.vy / (sp + 1) * 0.8 + this.acroBank + (this._turnBank || 0), -1.0, 1.0), 0.1);
      // pitch follows the velocity smoothly (eased, so a change of aim never
      // snaps the body); acroBank is folded in ONCE here (it used to be added
      // again at draw time, doubling every roll).
      const pitchWant = clamp(Math.atan2(this.vy, Math.abs(this.vx) + 0.001) * 0.55, -0.6, 0.6)
        + (landing ? -0.25 * landing.u : 0);                 // flare up onto the branch
      this._pitch = lerp(this._pitch == null ? pitchWant : this._pitch, pitchWant, clamp(dt * 8, 0, 1));
      this.rot = this._pitch + this.acroBank;
      // scale the silhouette by the continuous facing so a turn BANKS the body
      // (squash through the pivot) instead of flipping frame-to-frame.
      this.faceScale = Math.max(0.35, Math.abs(this.face)) * (this.facing >= 0 ? 1 : -1);

      /* flaps — every bird flaps; mixers/gliders only briefly fold */
      this.flapT = (this.flapT + dt / this.flapDur) % 1;
      if (this.wingStyle === "mixer") { const c = (this.bornT % 7) / 7; this.glideMode = c > 0.78; }
      else if (this.wingStyle === "glider") { const c = (this.bornT % 5) / 5; this.glideMode = c > 0.55; }
      this.frame = Math.floor(this.flapT * CFG.flapFrames) % CFG.flapFrames;
      this.pushHistory();
      if (this.history.length) { const last = this.history[this.history.length - 1]; last.fs = this.faceScale; last.facing = this.facing; }

      /* stuck watchdog: a bird that barely moves is a bug regardless of state.
         In open flight give a forward kick; if it is stuck on a landing
         approach (overshot / pinned under the perch) it aborts and flies on so
         it never flaps in one spot. */
      // (the old check compared the per-frame distance against a fixed 3px,
      // which at 60fps meant every bird slower than 180px/s -- i.e. nearly all
      // of them -- got a 7px kick every 0.8s: a visible hitch. It is a SPEED
      // now: under 20px/s for 0.8s counts as stuck.)
      const moved = Math.hypot(this.x - this._px, this.y - this._py);
      this._stuckT = moved < 20 * dt ? this._stuckT + dt : 0;
      this._px = this.x; this._py = this.y;
      if (this._stuckT > 0.8 && this.state === "flight") {
        this.x += this.facing * 30 * dt;          // a gentle, continuous nudge
      }

      /* edge recycling / landing roll */
      if (this.state === "flight") {
        const off = this.bodyLen;
        if (this.x < -off - 60 || this.x > CFG.world.w + off + 60) {
          if (this.flock) this.dead = true;
          else sky.respawn(this);
          return;
        }
        if (!this.flock && this.canLand && this.wantPerch && this.bornT > 1.5 && this.takeoffT <= 0) {
          const rate = this.depth === "back" ? CFG.landRateBack : CFG.landRateFront;
          // a back-layer bird may only commit while it is actually VISIBLE (in
          // the sky, not hidden behind the house), otherwise it would pop into
          // view mid-wall when it moves to the front layer.
          if (Math.random() < dt * rate && (this.depth === "front" || sky.inSky(this.x, this.y))) {
            const site = sky.pickPerch(this.depth, this.x, this.facing, this.wantPerch === "tree");
            if (site) this._beginLanding(site, sky);
          }
        }
      }
    }

    /* commit to a perch: build the curved approach arc from here to it */
    _beginLanding(site, sky) {
      this.landing = site; this.state = "landing"; this.canLand = false;
      this._landT = 0;
      this._apprDir = site.x >= this.x ? 1 : -1;
      const live = sky.livePerchPos(site);
      const dx = live.x - this.x, dy = live.y - this.y, dist = Math.hypot(dx, dy);
      // the arc lifts above the chord (more for a long, shallow approach) and
      // bows slightly toward the side it came from, so it curls onto the perch
      const s1 = site.tree
        ? clamp(this.size * 1.15, CFG.treePerchSize[0], CFG.treePerchSize[1])
        : (site.s || 0.66);
      this._arc = {
        x0: this.x, y0: this.y,
        lift: clamp(dist * 0.28, 26, 110) + (dy > 0 ? 0 : 20),
        cdx: -this._apprDir * clamp(dist * 0.12, 10, 50),
        s0: this.size, s1,
      };
      const spd = Math.max(60, this.speed * 0.9);
      this._landDur = clamp((dist * 1.5 + this._arc.lift * 2) / spd, 1.4, 5.0);
      // committing brings the bird to the FRONT layer so it stays visible the
      // whole way in (it is drawn over the house from here on).
      this.depth = "front";
      this._wantFace(this._apprDir);
    }

    _flockSteer(dt, vx, vy, sp) {
      const f = this.flock;
      if (!f || f.leader === this) return;
      const slot = f.slots[this._fid];
      const tx = f.leader.x + slot.dx * -f.leader.facing, ty = f.leader.y + slot.dy;
      let sx = 0, sy = 0;
      for (const m of f.members) {
        if (m === this) continue;
        const dx = this.x - m.x, dy = this.y - m.y, d2 = dx * dx + dy * dy;
        if (d2 < CFG.boidWeights.neigh * CFG.boidWeights.neigh && d2 > 0.01) {
          const d = Math.sqrt(d2); sx += dx / d; sy += dy / d;
        }
      }
      const ax = (tx - this.x) * 0.55 * CFG.boidWeights.cohesion * 0.02
               + (f.leader.vx - this.vx) * 0.05 * CFG.boidWeights.alignment + sx * CFG.boidWeights.separation;
      const ay = (ty - this.y) * 0.55 * CFG.boidWeights.cohesion * 0.02
               + (f.leader.vy - this.vy) * 0.05 * CFG.boidWeights.alignment + sy * CFG.boidWeights.separation;
      this.x += ax * dt * 24;
      this.y = clamp(this.y + ay * dt * 24, CFG.minFlyY + 2, CFG.maxFlyY - 6);
      this.facing = f.leader.facing;
    }

    _acrobatics(dt, sp) {
      this.acroT -= dt; this.acroBank = 0;
      if (this.acroMove) {
        this.acroClock += dt;
        const t = clamp(this.acroClock / this.acroDur, 0, 1), k = Math.sin(t * Math.PI);
        // stoop: one smooth dip-and-recover (a sine, so the entry and exit
        // are continuous); roll: a single gentle wing-over and back.
        if (this.acroMove === "stoop") { this._acrody += Math.sin(t * TAU) * sp * dt * 0.9; this.acroBank = k * 0.45; }
        else if (this.acroMove === "roll") this.acroBank = Math.sin(t * TAU) * 0.5;
        if (t >= 1) { this.acroMove = null; this.acroBank = 0; this.acroT = rand(CFG.acroEvery[0], CFG.acroEvery[1]); }
      } else if (this.acroT <= 0 && this.state === "flight") {
        this.acroMove = roll(CFG.acroMoves); this.acroClock = 0;
        this.acroDur = rand(1.4, 2.2);
      }
    }
  }

  /* ===================== PerchedBird ===================== */
  /* A bird ATTACHED to its perch. For a tree perch the anchor point is a free
     outer branch from the structure map; every frame the bird's position is
     recomputed by pushing that anchor through the SAME chain of wind
     rotations the renderer applies to the painted limb (whole tree -> stem ->
     main branch), so its feet stay on the wood while the branch oscillates.
     Its size is the size the flyer arrived at (no pop), and it keeps its full
     height: nothing squashes it. */
  class PerchedBird extends Bird {
    constructor(site, o = {}) {
      super(site.x, site.y);
      this.site = site; this.facing = site.face || 1;
      this.tint = "#10161e";
      this.depth = "front";   // perched birds always render on the front canvas
      this.onTree = !!site.tree;
      this.size = o.size != null ? o.size : (this.onTree ? rand(CFG.treePerchSize[0], CFG.treePerchSize[1]) : (site.s || 0.7));
      this.pose = 0; this.poseT = rand(2, 8); this.bornT = 0;
      // tree perchers stay 4-7s (they're up close on the foreground branches);
      // roof birds may linger a while.
      this.dwell = this.onTree
        ? rand(CFG.treeStaySec[0], CFG.treeStaySec[1])
        : rand(CFG.perchStaySec[0], CFG.perchStaySec[1]);
      this.leaving = false; this.leaveT = 0;
      this.sway = site.sway || null;
      this.swayChain = site.swayChain || null;
      this.ax = site.x; this.ay = site.y;     // rest position of the anchor
      this.tilt = 0;                          // branch roll under the feet (rad)
      this.settle = o.settle ? 0 : 1;         // 0..1 wing-fold / bob on arrival
    }
    update(dt, sky) {
      this.bornT += dt;
      if (this.settle < 1) this.settle = Math.min(1, this.settle + dt * 2.2);
      if (!this.leaving) {
        this.poseT -= dt;
        if (this.poseT <= 0) { this.pose = Math.random() < 0.72 ? 0 : (Math.random() < 0.5 ? 1 : 2); this.poseT = rand(2.5, 9); }
        this.bob = Math.sin(this.bornT * 2.1) * 0.5;
        if (this.bornT > this.dwell) { this.leaving = true; this.leaveT = 0; }
      } else {
        // take-off: a short hop up + forward, then hand over to a flyer that
        // starts EXACTLY here at this size (continuous, no pop)
        this.leaveT += dt;
        this.bob = -this.leaveT * 70;
        if (this.leaveT > 0.22) {
          this.dead = true;
          sky.spawnFlyer({ fromPerch: { ...this.site, x: this.x, y: this.y + this.bob }, dir: this.facing, size: this.size });
          return;
        }
      }
      // ride the branch: rotate the rest anchor through the wind chain
      if (this.onTree && this.swayChain) {
        const p = sky.swayPoint(this.ax, this.ay, this.swayChain);
        this.x = p.x; this.y = p.y; this.tilt = p.ang;
      }
    }
  }

  /* ===================== Forager (ground, walks) ===================== */
  /* A ground bird walks an isometric yard map. The house sits up-screen (far,
     where birds look smaller); the viewer is down-screen (near, where birds
     look bigger). It wanders SLOWLY along a corridor that follows the widening
     path, choosing a new stroll target in screen-x AND depth (y), so it reads
     as walking toward/away the house, not just sliding left-right. */
  class Forager extends Bird {
    constructor(x, y) {
      super(x, y);
      this.g = CFG.ground;
      this.facing = chance(0.5) ? 1 : -1;
      this.size = 1.2;
      this.tint = "#0f151d"; this.depth = "front";
      this.gx = x; this.gy = y; this.tx = x; this.ty = y;
      this.walkT = 0; this.walkDur = rand(this.g.walkDur[0], this.g.walkDur[1]);
      this.peck = 0; this.peckT = rand(1, 3); this.pose = 0;
      this._pickTarget();
    }
    /* isometric path half-width at a given depth y (widens toward viewer) */
    _halfWidthAt(y) {
      const t = clamp((y - this.g.yFar) / (this.g.yNear - this.g.yFar), 0, 1);
      return lerp(54, 150, t);      // narrow far up by the house, wide near
    }
    _perspSize(y) {
      const t = clamp((y - this.g.yFar) / (this.g.yNear - this.g.yFar), 0, 1);
      return lerp(1.05, 1.55, t);   // small when far, big when near
    }
    _pickTarget() {
      const g = this.g;
      // side-to-side wander, kept inside the isometric path at the new depth
      let ny = this.gy;
      if (Math.random() < g.depthDrift) ny += (chance(0.5) ? 1 : -1) * rand(g.stepDepth[0], g.stepDepth[1]);
      ny = clamp(ny, g.yFar, g.yNear);
      const half = this._halfWidthAt(ny);
      let nx = this.gx + this.facing * rand(g.stepX[0], g.stepX[1]);
      nx = clamp(nx, 640 - half, 640 + half);
      this.tx = nx; this.ty = ny;
      if (Math.abs(nx - this.gx) < 2 || Math.random() < 0.35) this.facing *= -1; // zig-zag
    }
    update(dt) {
      this.walkT += dt;
      const t = clamp(this.walkT / this.walkDur, 0, 1);
      const e = t * t * (3 - 2 * t);    // smooth ease; no bounce
      const hopStep = this._wantHop;
      const bobY = hopStep ? Math.sin(t * Math.PI) * 7 : Math.abs(Math.sin(t * Math.PI * 5)) * 1.2;
      this.x = lerp(this.gx, this.tx, e);
      this.y = lerp(this.gy, this.ty, e) - bobY;
      this.zig = Math.sin(t * Math.PI * 4) * 1.6;
      this.size = lerp(this.size, this._perspSize(this.ty), 0.05);
      // face the way we're actually walking (incl. toward/away depth)
      if (Math.abs(this.tx - this.gx) > 1) this.facing = this.tx >= this.gx ? 1 : -1;
      // occasional peck, and pause to peck rather than always strolling
      this.peckT -= dt;
      if (this.peckT <= 0) { this.peck = 0.35; this.peckT = rand(1.6, this.g.peckEvery); }
      this.peck = Math.max(0, (this.peck || 0) - dt);
      if (t >= 1) {
        this.gx = this.tx; this.gy = this.ty;
        this._wantHop = Math.random() < this.g.hopChance;
        this._pickTarget();
        this.walkT = 0; this.walkDur = rand(this.g.walkDur[0], this.g.walkDur[1]);
      }
    }
  }

  /* ===================== Flock ===================== */
  class Flock {
    constructor(members, dir, formation) {
      this.members = members; this.leader = members[0]; this.formation = formation;
      this.slots = members.map((m, i) => {
        if (i === 0) return { dx: 0, dy: 0 };
        let dx, dy;
        if (formation === "vee") { const side = i % 2 ? 1 : -1, row = Math.ceil(i / 2); dx = -row * 22; dy = side * row * 13; }
        else if (formation === "cloud") { dx = rand(-44, 16); dy = rand(-34, 34); }
        else { dx = -i * 20; dy = (i % 2 ? 1 : -1) * (i % 3) * 5; }
        return { dx, dy };
      });
      members.forEach((m, i) => { m.flock = this; m._fid = i; m.acro = false; m.canLand = false; });
      this.leader.flock = this; this.leader._fid = 0;
    }
    get dead() { return this.leader && this.leader.dead; }
  }

  /* ===================== Sky ===================== */
  class Sky {
    constructor() {
      this.baker = new SpriteBaker();
      this.birds = []; this.flocks = [];
      this.running = false; this.last = 0; this.spawnT = 0;
      this.canvasBack = null; this.canvasFront = null;
      this.ctxBack = null; this.ctxFront = null;
    }

    sites() {
      const roof = [
        { x: 640, y: 27, s: 0.7, face: 1 }, { x: 520, y: 49, s: 0.66, face: 1 },
        { x: 760, y: 53, s: 0.66, face: -1 }, { x: 400, y: 72, s: 0.64, face: 1 },
        { x: 880, y: 76, s: 0.64, face: -1 }, { x: 250, y: 118, s: 0.62, face: 1 },
        { x: 1030, y: 118, s: 0.62, face: -1 }, { x: 352, y: 35, s: 0.66, face: 1 },
      ].map(p => ({ ...p, id: "r" + p.x }));
      // TREE perches come from the SHARED structure map (js/tree-perches.js):
      // they are the real FREE OUTER branch / twig tips of the two foreground
      // trees — the unconnected ends that oscillate — so a bird grips an actual
      // painted branch, never an invented point.
      let tree = [];
      if (typeof window !== "undefined" && window.TreePerches && window.TreePerches.anchors) {
        try {
          tree = window.TreePerches.anchors().map(a => ({
            id: a.tree + ":" + Math.round(a.x) + ":" + Math.round(a.y),
            x: Math.round(a.x), y: Math.round(a.y),
            s: a.s, face: a.face, tree: true,
            branchAng: a.ang, sway: a.sway, swayChain: a.swayChain || null,
            role: a.role, limb: a.limb,
          }));
        } catch (e) { tree = []; }
      }
      return { roof, tree };
    }
    /* choose a perch. wantTree picks the group; we only offer sites that are
       roughly AHEAD of the bird's travel direction (so it homes in on a curved
       approach rather than reversing into a flip loop) and aren't occupied.
       Occupancy is keyed by stable site id (the returned site is a copy). */
    pickPerch(depth, fromX, facing, wantTree) {
      const s = this.sites();
      const used = new Set(this.birds.filter(b => (b instanceof PerchedBird && !b.dead && b.site) || (b instanceof FlyingBird && b.state === "landing" && b.landing)).map(b => (b.site || b.landing).id));
      if (wantTree == null) wantTree = chance(0.8);
      let pool = wantTree ? s.tree : s.roof;
      if (typeof facing === "number" && typeof fromX === "number") {
        // commit only to a perch AHEAD in a comfortable window: far enough to
        // draw a real curved approach, near enough that it happens on screen.
        const reach = wantTree ? 420 : 260;
        const ahead = pool.filter(p => {
          const dd = (p.x - fromX) * facing;           // >0 means ahead
          return dd > 70 && dd < reach;
        });
        if (ahead.length) pool = ahead; else return null;
      }
      const free = pool.filter(p => !used.has(p.id));
      const site = free.length ? pick(free) : null;
      return site ? { ...site } : null;
    }
    perchFree(id) {
      return !this.birds.some(b => b instanceof PerchedBird && !b.dead && b.site && b.site.id === id);
    }
    /* is this point in the open sky (visible for a back-layer bird)? */
    inSky(x, y) {
      if (y < 124) return true;
      if (x < 150 || x > 1130) return true;
      // under the roofline the house hides the back layer; the sky clip
      // roughly follows the gables down to y=300 at x=320/960
      if (x < 320 || x > 960) return y < 124 + (x < 320 ? (320 - x) : (x - 960)) * (176 / 170);
      return false;
    }
    /* SVG animation time (seconds since the porch scene was rendered) */
    svgTime() {
      const svg = this.holder && this.holder.querySelector && this.holder.querySelector("svg");
      try { if (svg && svg.getCurrentTime) return svg.getCurrentTime(); } catch (e) { /* fall through */ }
      return (performance.now() - (this._t0 || 0)) / 1000;
    }
    /* push a rest point through a limb's wind chain (outer group first) */
    swayPoint(x, y, chain) {
      const TP = (typeof window !== "undefined") && window.TreePerches;
      if (!TP || !TP.swayAngleAt || !chain) return { x, y, ang: 0 };
      // if the trees are not animating (motion picker / reduced motion) the
      // painted limbs are at rest, so the bird sits at the rest anchor
      if (typeof AnimReg !== "undefined" && AnimReg.on && !AnimReg.on("trees")) return { x, y, ang: 0 };
      const t = this.svgTime();
      let px = x, py = y, total = 0;
      // apply innermost (last) first, then wrap outward — same as nested <g>s
      for (let i = chain.length - 1; i >= 0; i--) {
        const g = chain[i];
        const a = TP.swayAngleAt(g, t) * Math.PI / 180;
        const dx = px - g.px, dy = py - g.py;
        const c = Math.cos(a), sn = Math.sin(a);
        px = g.px + dx * c - dy * sn;
        py = g.py + dx * sn + dy * c;
        total += a;
      }
      return { x: px, y: py, ang: total };
    }
    /* where a perch site is RIGHT NOW (the branch is moving) */
    livePerchPos(site) {
      if (site && site.tree && site.swayChain) return this.swayPoint(site.x, site.y, site.swayChain);
      return { x: site.x, y: site.y, ang: 0 };
    }
    roofY(x) {
      if (x < 150 || x > 1130) return 124;
      if (x < 640) return 124 - (x - 150) / (640 - 150) * 94;
      return 30 + (x - 640) / (1130 - 640) * 94;
    }

    mount() {
      if (this.mounted) return;
      let testCtx = null;
      try { testCtx = document.createElement("canvas").getContext("2d"); } catch (e) { testCtx = null; }
      if (typeof document === "undefined" || !testCtx) return;
      const holder = document.getElementById("scene-holder");
      if (!holder) return;
      this.holder = holder;
      if (!this._baked) { try { this.baker.build(); this._baked = true; } catch (e) { return; } }

      const mk = z => {
        const c = document.createElement("canvas");
        c.width = CFG.world.w; c.height = CFG.world.h;
        c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:${z}`;
        holder.appendChild(c);
        const ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        return { c, ctx };
      };
      const back = mk(5), front = mk(6);
      this.canvasBack = back.c; this.ctxBack = back.ctx;
      this.canvasFront = front.c; this.ctxFront = front.ctx;
      this._t0 = performance.now();
      this._skyClip = new Path2D("M0,0 H1280 V124 L1130,124 L960,300 Q920,380 860,430 L420,430 Q360,380 320,300 L150,124 L0,124 Z");
      this.mounted = true;

      this.birds = []; this.flocks = [];
      const animsOn = (id) => (typeof AnimReg !== "undefined") ? AnimReg.on(id) : !((typeof Settings !== "undefined") && Settings.get && Settings.get("reducedMotion"));
      const reduced = !animsOn("birds");
      const s = this.sites();
      const takenId = new Set();
      const seedFrom = (pool, n) => {
        for (let i = 0; i < n; i++) {
          const free = pool.filter(p => !takenId.has(p.id));
          if (!free.length) break;
          const p = pick(free); takenId.add(p.id);
          this.birds.push(new PerchedBird(p));
        }
      };
      seedFrom(s.roof, CFG.initialPerchedRoof);
      seedFrom(s.tree, CFG.initialPerchedTree);
      if (!reduced) {
        for (let i = 0; i < CFG.foragers; i++) {
          const fy = rand(CFG.ground.yFar, CFG.ground.yNear);
          const half = 54 + (fy - CFG.ground.yFar) / (CFG.ground.yNear - CFG.ground.yFar) * 96;
          this.birds.push(new Forager(clamp(rand(560, 720), 640 - half, 640 + half), fy));
        }
        for (let i = 0; i < CFG.population.flyers; i++) this._spawnFlyer(true);
      }

      this.running = true; this.last = performance.now();
      this._onVis = () => { if (document.hidden) this._stop(); else if (this.mounted) this._start(); };
      document.addEventListener("visibilitychange", this._onVis);
      this._start();
    }

    unmount() {
      this._stop();
      this.running = false; this.mounted = false;
      if (this.canvasBack) this.canvasBack.remove();
      if (this.canvasFront) this.canvasFront.remove();
      this.canvasBack = this.canvasFront = null;
      if (this._onVis) document.removeEventListener("visibilitychange", this._onVis);
    }
    _start() { if (this._raf) return; const L = t => { this._frame(t); this._raf = requestAnimationFrame(L); }; this._raf = requestAnimationFrame(L); this.last = performance.now(); }
    _stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; }

    /* size band + depth for a lane */
    _bandFor(lane) {
      const b = lane === 0 ? CFG.sizeBands.far : lane === 1 ? CFG.sizeBands.mid : CFG.sizeBands.near;
      return rand(b[0], b[1]);
    }
    _depthFor(scale, forced) { return forced || (scale < CFG.depthByScale ? "back" : "front"); }

    /* Medium/big bird census: solo (non-flock) flyers at or above bigBirdScale.
       Small birds and flock members are exempt and may break the depth rules.
       Enforced: at most bigBirdMax on screen, and no more than bigBirdPerSide
       heading either way (so they read as e.g. 3 from the left, 2 the other). */
    _bigBirds() {
      let total = 0, r = 0, l = 0;
      for (const b of this.birds) {
        if (!(b instanceof FlyingBird) || b.dead || b.flock) continue;
        if (b.size < CFG.bigBirdScale) continue;
        total++;
        if (b.facing >= 0) r++; else l++;
      }
      return { total, r, l };
    }
    /* Given a candidate solo bird's scale/facing, downgrade it to a "small"
       bird if spawning it medium/big would exceed the caps. Small birds are
       allowed anywhere (back / low / edges), so downgrading always works. */
    _capBigBird(scale, facing) {
      if (scale < CFG.bigBirdScale) return scale;
      const c = this._bigBirds();
      const sideCount = facing >= 0 ? c.r : c.l;
      if (c.total >= CFG.bigBirdMax || sideCount >= CFG.bigBirdPerSide) {
        return rand(CFG.sizeBands.far[0], CFG.sizeBands.far[1]);   // downgrade to small
      }
      return scale;
    }
    /* Post-spawn balance WITHOUT teleporting: if too many medium/big birds are
       on screen (or all heading one way), the next spawn should come from the
       under-used side. We only set a HINT read by the spawner — no bird is ever
       repositioned mid-flight, so there is no lag/teleport (all movement is the
       per-frame vector tween). */
    _bigBalanceHint() {
      const big = this.birds.filter(b => b instanceof FlyingBird && !b.dead && !b.flock
        && b.state === "flight" && b.size >= CFG.bigBirdScale);
      const right = big.filter(b => b.facing >= 0).length;
      const left = big.length - right;
      if (big.length >= CFG.bigBirdMax) return { full: true };
      // ask for the under-used direction (keeps a ~3/2 split)
      if (right >= CFG.bigBirdPerSide) return { dir: -1 };
      if (left >= CFG.bigBirdPerSide) return { dir: 1 };
      return null;
    }

    /* a flyer route. dynamic spawns (initial=false) ALWAYS enter from a side
       edge; initial spawns may already be mid-screen (birds present on load). */
    _spawnFlyer(initial, opts = {}) {
      const dir = opts.dir || (chance(0.62) ? 1 : -1);
      const xEdge = dir === 1 ? -60 : CFG.world.w + 60;
      const x = initial ? (chance(0.6) ? (dir === 1 ? rand(120, 600) : rand(680, 1160)) : xEdge) : xEdge;

      // Altitude/size split. The SMALL birds divide two ways:
      //   highSmall (~70%) -> BACK layer, skimming the roof/eaves skyline;
      //   lowSmall  (~30%) -> FRONT layer but still small, crossing LOW in front
      //                       of the wall and down by/under the house & porch.
      // A third roll asks for a near BIG bird; the medium/big cap may shrink it,
      // in which case it folds into the low-small group.
      let effDepth, effLane, scale, y, species;
      const roofHigh = () => {
        const atX = (x < 0 || x > CFG.world.w) ? (dir === 1 ? 220 : 1060) : x;
        return clamp(this.roofY(atX) - rand(6, 46), CFG.minFlyY, 150);
      };
      if (opts.depth === "back" || opts.lane === 0) {
        // forced back (e.g. the spawner when the big quota is full): high small
        species = pick(CFG.speciesRoll);
        effDepth = "back"; effLane = 0;
        scale = rand(CFG.sizeBands.far[0], CFG.sizeBands.far[1]) * CFG.species[species].s;
        y = roofHigh();
      } else {
        const r = Math.random();
        if (r < CFG.smallHighShare * (1 - CFG.bigBirdRoll)) {
          // HIGH small bird at roof/eaves height (70% of the small birds)
          species = pick(CFG.speciesRoll);
          effDepth = "back"; effLane = 0;
          scale = rand(CFG.sizeBands.far[0], CFG.sizeBands.far[1]) * CFG.species[species].s;
          y = roofHigh();
        } else if (r < 1 - CFG.bigBirdRoll) {
          // LOW small bird (the other 30%): FRONT layer, still SMALL, crossing
          // down by / under the house in front of the wall
          species = pick(CFG.speciesRoll);
          effDepth = "front"; effLane = 1;
          scale = rand(CFG.sizeBands.far[0], CFG.sizeBands.far[1]) * CFG.lowSmallScale * CFG.species[species].s;
          y = rand(300, 430);
        } else {
          // BIG/near candidate crossing in front; cap may shrink it to low-small
          species = chance(CFG.owlChance) ? "owl" : pick(CFG.speciesRoll);
          effDepth = "front"; effLane = 2;
          scale = this._bandFor(2) * CFG.species[species].s;
          scale = this._capBigBird(scale, dir);
          scale = Math.min(scale, CFG.maxNearScale);   // hard ceiling on biggest bird
          if (scale < CFG.bigBirdScale) { effLane = 1; y = rand(300, 430); }
          else { y = rand(150, 260); }
        }
      }
      const anchor = effLane === 0 ? CFG.baseSpeed.far : effLane === 1 ? CFG.baseSpeed.mid : CFG.baseSpeed.near;
      const b = new FlyingBird({
        x, y, dir, lane: effLane, species, scale, speedAnchor: anchor,
        depth: effDepth,
        headingMode: opts.heading, wing: opts.wing, speedMul: opts.speedMul, canLand: opts.canLand,
      });
      this.birds.push(b);
      return b;
    }

    spawnFlyer(o = {}) {
      const fromPerch = o.fromPerch;
      const dir = o.dir || (chance(0.5) ? 1 : -1);
      const x = fromPerch ? fromPerch.x : (dir === 1 ? -60 : 1340);
      // a take-off starts EXACTLY where the perched bird was (the y clamp is
      // deferred by the takeoff grace so it climbs out on a curve instead of
      // teleporting up to the flight band)
      const y = fromPerch ? Math.max(CFG.minFlyY, fromPerch.y - 6) : rand(120, CFG.maxFlyY - 40);
      const lane = y < 130 ? 0 : y < 220 ? 1 : 2;
      const species = pick(CFG.speciesRoll);
      let scale = o.size != null ? o.size : ((fromPerch ? (fromPerch.s || 0.9) : this._bandFor(lane)) * CFG.species[species].s);
      scale = Math.min(scale, CFG.maxNearScale);
      const isBig = scale >= CFG.bigBirdScale;
      const effLane = isBig ? 2 : lane;
      const depth = (fromPerch && !fromPerch.tree && !isBig) ? "back" : "front";
      const anchor = effLane === 0 ? CFG.baseSpeed.far : effLane === 1 ? CFG.baseSpeed.mid : CFG.baseSpeed.near;
      const b = new FlyingBird({
        x, y, dir, lane: effLane, species, scale,
        speedAnchor: anchor, speedMul: 1.15, canLand: false, wantPerch: null,
        headingMode: "fixedClimb", depth, takeoff: !!fromPerch,
      });
      // climb out steeply at first (the branch is low) then ease to a cruise
      b.fixAngle = (fromPerch && fromPerch.tree ? 38 : 22) * Math.PI / 180;
      this.birds.push(b);
      return b;
    }

    _spawnFlock() {
      const flockAnimsOn = (typeof AnimReg === "undefined") || AnimReg.on("birdsFlock");
      const murmur = flockAnimsOn && chance(CFG.murmurationChance);
      // flocks high / behind the house are a bit larger and all tiny;
      // closer flocks are capped at 4.
      const far = murmur || chance(0.6);
      const n = murmur ? rint(CFG.murmurationSize[0], CFG.murmurationSize[1])
                       : far ? rint(CFG.farFlockSize[0], CFG.farFlockSize[1])
                             : rint(CFG.flockSize[0], CFG.flockSize[1]);
      const dir = chance(0.5) ? 1 : -1;
      const formation = murmur ? "cloud" : (far ? "cloud" : pick(["line", "vee"]));
      const lane = far ? 0 : 1;
      const y0 = murmur ? rand(48, 90) : clamp(this.roofY(dir === 1 ? 220 : 1060) - rand(20, 70), CFG.minFlyY, 150);
      const members = [];
      for (let i = 0; i < n; i++) {
        const species = murmur ? "starling" : pick(CFG.speciesRoll);
        const rawScale = murmur ? rand(CFG.sizeBands.far[0], CFG.sizeBands.far[1] * 0.9)
                                : far ? rand(0.42, 0.6) : rand(CFG.sizeBands.mid[0], 0.9);
        const b = new FlyingBird({
          x: (dir === 1 ? -70 : 1350) - i * 6,
          y: clamp(y0 + rand(-16, 16) + (murmur ? Math.sin(i) * 14 : 0), CFG.minFlyY, CFG.maxFlyY),
          dir, lane, species,
          scale: rawScale * CFG.species[species].s,
          speedAnchor: murmur ? CFG.baseSpeed.far : (far ? CFG.baseSpeed.far : CFG.baseSpeed.mid),
          speedMul: murmur ? rand(0.98, 1.02) : rand(0.95, 1.05),
          depth: far ? "back" : "front",
          headingMode: "wobble", wing: murmur ? "flapper" : undefined, canLand: false,
        });
        members.push(b); this.birds.push(b);
      }
      this.flocks.push(new Flock(members, dir, formation));
    }

    birdLanded(site, facing, flyer) {
      this.birds.push(new PerchedBird({ ...site, face: facing }, { size: flyer ? flyer.size : undefined, settle: true }));
    }

    respawn(b) {
      const hint = this._bigBalanceHint();
      const windFight = chance(CFG.fightWind);
      const dir = hint && hint.dir ? hint.dir : (windFight ? -CFG.windDir : (chance(0.62) ? 1 : -1));
      b.bornT = 0; b.state = "flight"; b.landing = null; b.canLand = true; b.takeoffT = 0; b._pitch = 0;
      { const r = Math.random(); b.wantPerch = r < CFG.treeLandChance ? "tree" : r < CFG.treeLandChance + CFG.roofLandChance ? "roof" : null; }
      b.facing = dir; b.faceTarget = dir; b.face = dir; b.faceScale = dir; b._turnBank = 0;
      b.x = dir === 1 ? -60 : 1340;                 // always from a side edge
      // same altitude split as the spawner: most small birds HIGH at the roof,
      // ~30% LOW in front of the house, plus an occasional big near bird.
      const roofHighY = () => clamp(this.roofY(dir === 1 ? 220 : 1060) - rand(6, 46), CFG.minFlyY, 150);
      let effDepth, effLane, scale0, species;
      const r = Math.random();
      if (r < CFG.smallHighShare * (1 - CFG.bigBirdRoll)) {
        species = b.speciesKey;
        effDepth = "back"; effLane = 0;
        scale0 = rand(CFG.sizeBands.far[0], CFG.sizeBands.far[1]) * CFG.species[species].s;
        b.y = roofHighY();
      } else if (r < 1 - CFG.bigBirdRoll) {
        species = b.speciesKey;
        effDepth = "front"; effLane = 1;
        scale0 = rand(CFG.sizeBands.far[0], CFG.sizeBands.far[1]) * CFG.lowSmallScale * CFG.species[species].s;
        b.y = rand(300, 430);
      } else {
        species = (chance(CFG.owlChance) ? "owl" : b.speciesKey);
        effDepth = "front"; effLane = 2;
        scale0 = this._bandFor(2) * CFG.species[species].s;
        scale0 = this._capBigBird(scale0, dir);
        scale0 = Math.min(scale0, CFG.maxNearScale);
        if (scale0 < CFG.bigBirdScale) { effLane = 1; b.y = rand(300, 430); }
        else { b.y = rand(150, 260); }
      }
      b.speciesKey = species;
      b.scale0 = scale0; b.size = scale0;
      b.depth = effDepth; b.lane = effLane;
      b.speedAnchor = effLane === 0 ? CFG.baseSpeed.far : effLane === 1 ? CFG.baseSpeed.mid : CFG.baseSpeed.near;
      b.speed = b.speedAnchor * b.speedMul * CFG.species[species].v;
      b.headingMode = roll(CFG.heading);
      b.fixAngle = pick(CFG.fixedAnglesDeg) * Math.PI / 180;
      b.windFight = windFight;
      b.gustT = rand(CFG.gustEvery[0], CFG.gustEvery[1]); b.gustTLeft = 0; b.gustSlip = 0;
      b.acro = chance(CFG.acrobatics); b.acroMove = null; b.acroT = rand(4, 12);
      b.speedStyle = roll(CFG.speedStyles);
      b.wobPhase = Math.random() * 10; b.tPhase = Math.random() * 10; b.history = [];
      b._stuckT = 0; b._px = b.x; b._py = b.y; b.glideMode = false; b.glideDip = 0;
    }

    _frame(t) {
      if (!this.running) return;
      let dt = (t - this.last) / 1000; this.last = t;
      dt = clamp(dt, 0, 0.05);
      const animsOn = (id) => (typeof AnimReg !== "undefined") ? AnimReg.on(id) : !((typeof Settings !== "undefined") && Settings.get && Settings.get("reducedMotion"));
      const reduced = !animsOn("birds");
      const birdsOn = animsOn("birds");
      if (reduced || !birdsOn) {
        if (!this._staticDrawn) { this._clear(); if (!reduced) this._clear(); else this._drawStaticPerched(); this._staticDrawn = true; }
        return;
      }
      this._staticDrawn = false;

      this.spawnT -= dt;
      const flyAlive = this.birds.reduce((n, b) => n + (b instanceof FlyingBird && !b.dead ? 1 : 0), 0);
      if (this.spawnT <= 0 && flyAlive < CFG.population.maxFlyers) {
        this.spawnT = rand(1.4, 3.4);
        // if the medium/big quota is full, send only small birds + flocks (which
        // are exempt) from the under-used side — no bird is ever teleported.
        const hint = this._bigBalanceHint();
        if (hint && hint.full && !chance(CFG.flockChance)) {
          // spawn a deliberately small far/back solo
          const dir = hint.dir || (chance(0.5) ? 1 : -1);
          this._spawnFlyer(false, { dir, depth: "back", lane: 0, scale: undefined });
        } else if (chance(CFG.flockChance)) this._spawnFlock();
        else this._spawnFlyer(false, hint && hint.dir ? { dir: hint.dir } : {});
      }

      for (const b of this.birds) if (!b.dead) b.update(dt, this);
      this.flocks = this.flocks.filter(f => !f.dead);
      this.birds = this.birds.filter(b => !b.dead);
      this._render(dt);
    }

    _clear() {
      if (this.ctxBack) this.ctxBack.clearRect(0, 0, CFG.world.w, CFG.world.h);
      if (this.ctxFront) this.ctxFront.clearRect(0, 0, CFG.world.w, CFG.world.h);
    }

    _render() {
      if (!this.ctxBack || !this.ctxFront) return;
      this._clear();
      const cb = this.ctxBack, cf = this.ctxFront, all = this.birds;
      const back = this._bBack || (this._bBack = []);
      const front = this._bFront || (this._bFront = []);
      back.length = 0; front.length = 0;
      for (let i = 0; i < all.length; i++) { const b = all[i]; if (b.dead) continue; (b.depth === "back" ? back : front).push(b); }
      back.sort((a, b) => a.y - b.y);

      cb.save(); cb.clip(this._skyClip); cb.globalAlpha = 1;
      for (let i = 0; i < back.length; i++) this._drawFlyer(cb, back[i], true);
      cb.restore();

      for (let i = 0; i < front.length; i++) {
        const b = front[i];
        if (b instanceof FlyingBird) this._drawFlyer(cf, b, false);
        else if (b instanceof Forager) this._drawForager(cf, b);
        else if (b instanceof PerchedBird) this._drawPerched(cf, b);
      }
      if (this.showTreeMap) this._drawTreeMap(cf);
    }

    _drawFlyer(ctx, b, far) {
      // far/back birds stay dark; near/front birds get the catch-light; a BIG
      // species (crow/owl) uses the layered-plate abdomen set.
      const isBig = (CFG.species[b.speciesKey] && CFG.species[b.speciesKey].big) || b.size >= CFG.bigBirdScale;
      const frames = isBig && this.baker.flyFramesBig
        ? this.baker.flyFramesBig
        : (!far && b.depth === "front" && this.baker.flyFramesShine ? this.baker.flyFramesShine : this.baker.flyFrames);
      const glide = this.baker.glideFrame;
      const img = b.glideMode ? glide : frames[b.frame % frames.length];
      const ss = img._ss || 1, w = img.width, h = img.height;
      const k = (0.62 * b.size * (far ? 0.86 : 1)) / ss;
      // continuous facing: |face| narrows through a banking turn (squash at the
      // pivot) rather than flipping mirror instantly.
      const fs = b.faceScale != null ? b.faceScale : b.facing;
      ctx.globalAlpha = far ? CFG.farFade : b.alpha;

      const sp = Math.hypot(b.vx, b.vy);
      if (sp > CFG.streakMinSpeed && !far) {
        const len = clamp((sp - CFG.streakMinSpeed) * 0.5, 10, 60) * b.size;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.scale(Math.sign(fs) || b.facing, 1);
        ctx.globalAlpha = CFG.streak * 0.14; ctx.fillStyle = b.tint;
        ctx.beginPath();
        ctx.moveTo(-6 * b.size, -3 * b.size); ctx.lineTo(-len, -0.8 * b.size);
        ctx.lineTo(-len, 0.8 * b.size); ctx.lineTo(-6 * b.size, 3 * b.size);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }

      for (let i = 0; i < b.history.length; i++) {
        const hst = b.history[i];
        ctx.globalAlpha = (i + 1) / (b.history.length + 1) * CFG.afterimageAlpha * (far ? 0.5 : 1);
        ctx.save(); ctx.translate(hst.x, hst.y + (b.zig || 0)); ctx.rotate(hst.rot);
        ctx.scale((hst.fs || b.facing) * k, k); ctx.drawImage(glide, -glide.width / 2, -glide.height / 2); ctx.restore();
      }

      ctx.globalAlpha = far ? CFG.farFade : b.alpha;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.scale(fs * k, k);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, -w / 2, -h / 2);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    _drawPerchSprite(ctx, spr, b, extraY = 0, drawToes = false) {
      // uniform scale from the bird's size: width and height scale TOGETHER so
      // the bird keeps its proportions (no thin-stick squash on landing)
      const k = (30 * b.size) / spr.height;
      const bob = b.bob || 0, peck = b.peck > 0 ? 4 * b.size : 0;
      ctx.save();
      // feet on the anchor: b.x/b.y already ride the branch (PerchedBird
      // pushes its anchor through the wind chain each frame); the body just
      // leans with the limb's local roll.
      ctx.translate(b.x + (b.zig || 0), b.y + bob + extraY);
      if (b.tilt) ctx.rotate(b.tilt);
      // uniform scale only: never squash the bird on arrival or at any time
      ctx.scale(b.facing * k, k);
      ctx.drawImage(spr, -spr.width / 2, -spr.height + peck);
      // eye: sprite-local units (scaleX flip handles facing; bird faces +x so
      // the head/eye sit on the local right). TREE birds are the nearest to the
      // lens (lantern-lit), so their eye is the clearest: pale iris, dark
      // pupil, a pin catch-light. Roof/ground birds a dimmer version.
      // (the sprite is drawn offset by -width/2, -height, so the eye has to be
      // placed in that same space; per-pose head positions come from the masks)
      const EYE = SpriteBaker.PERCH_EYES[b.pose % SpriteBaker.PERCH_EYES.length] || [0.78, 0.08];
      const ex = spr.width * (EYE[0] - 0.5);
      const ey = -spr.height * (1 - EYE[1]) + peck;
      const bright = b.onTree;
      const r = bright ? 4.2 : 3.0;
      ctx.fillStyle = bright ? "rgba(255,244,214,0.98)" : "rgba(214,222,232,0.7)";
      ctx.beginPath(); ctx.arc(ex, ey, r, 0, TAU); ctx.fill();
      ctx.fillStyle = "#0a0e14";
      ctx.beginPath(); ctx.arc(ex + 0.6, ey + 0.6, r * 0.6, 0, TAU); ctx.fill();
      if (bright) { ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(ex + 1.6, ey - 1.2, 1.1, 0, TAU); ctx.fill(); }
      if (drawToes) {
        // toe-grips clamped onto the limb at the feet (sprite bottom)
        ctx.strokeStyle = "#04070b"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(s * 4, -2); ctx.lineTo(s * 9, 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(s * 4, -2); ctx.lineTo(s * 2, 3); ctx.stroke();
        }
      }
      ctx.restore();
    }

    /* DEBUG OVERLAY (Birds.treeMap(true)): paints the tree structure map over
       the scene — stem, connected branches, outer free branches (their free
       ends ringed) and every perch anchor — so you can see exactly which
       section is which and where a bird may grip. */
    _drawTreeMap(ctx) {
      const TP = (typeof window !== "undefined") && window.TreePerches;
      if (!TP || !TP.describe) return;
      const trees = TP.describe();
      const t = this.svgTime();
      ctx.save(); ctx.lineCap = "round"; ctx.font = "10px monospace";
      for (const tr of trees) {
        for (const sct of tr.sections) {
          const col = sct.kind === "stem" ? "#ff5a3c" : sct.kind === "main branch" ? "#ffb02e" : sct.kind === "branch" ? "#5ad0ff" : "#7dff6a";
          ctx.strokeStyle = col; ctx.lineWidth = sct.kind === "stem" ? 3 : sct.kind === "outer free branch" ? 1 : 1.6;
          ctx.globalAlpha = sct.kind === "outer free branch" ? 0.7 : 0.95;
          ctx.beginPath(); ctx.moveTo(sct.from[0], sct.from[1]); ctx.quadraticCurveTo(sct.mid[0], sct.mid[1], sct.to[0], sct.to[1]); ctx.stroke();
          if (sct.freeEnd) { ctx.beginPath(); ctx.arc(sct.to[0], sct.to[1], 3, 0, TAU); ctx.stroke(); }
          if (sct.sways) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sct.swayPivot[0], sct.swayPivot[1], 4, 0, TAU); ctx.fill(); }
        }
        ctx.globalAlpha = 1;
        for (const p of tr.perches) {
          const site = { x: p.x, y: p.y, tree: true, swayChain: (this.sites().tree.find(s => Math.round(s.x) === p.x && Math.round(s.y) === p.y) || {}).swayChain };
          const live = this.livePerchPos(site);
          ctx.fillStyle = p.role === "free twig" ? "#ffffff" : "#c8ff7a";
          ctx.beginPath(); ctx.arc(live.x, live.y, 2.6, 0, TAU); ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(live.x, live.y); ctx.stroke();
        }
        // legend + counts per tree
        const lx = tr.tree === "edgeL" ? 12 : 1010, ly = 470;
        const lines = [
          `${tr.tree}: stem ${tr.counts.stem}, main ${tr.counts.mainBranches}, branch ${tr.counts.branches}, outer free ${tr.counts.outerFree}`,
          `perch anchors: ${tr.perches.length}  (sway t=${t.toFixed(1)}s)`,
          "red=stem  orange=main branch  blue=branch",
          "green=OUTER FREE branch (free end ringed)",
          "dot: perch anchor (white=free twig)",
        ];
        ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(lx - 4, ly - 12, 262, lines.length * 12 + 6);
        ctx.fillStyle = "#e8e8e8";
        lines.forEach((l, i) => ctx.fillText(l, lx, ly + i * 12));
      }
      ctx.restore();
    }

    _drawPerched(ctx, b) {
      const spr = this.baker.perchSprite(b.pose);
      if (!spr) return;
      // No invented branch: the bird sits on a real painted limb of the
      // foreground tree (SVG layer beneath this canvas), placed there from the
      // shared tree-structure map. The grip toes are drawn with the sprite.
      this._drawPerchSprite(ctx, spr, b, 0, !!b.onTree && !b.leaving);
    }

    _drawForager(ctx, b) {
      const spr = this.baker.perchSprite(0);
      if (!spr) return;
      this._drawPerchSprite(ctx, spr, b);
    }

    _drawStaticPerched() {
      const cf = this.ctxFront; if (!cf) return;
      for (const b of this.birds) {
        if (b instanceof PerchedBird && !b.leaving) {
          const spr = this.baker.perchSprite(0);
          if (!spr) continue;
          this._drawPerchSprite(cf, spr, b, 0, !!b.onTree);
        }
      }
    }
  }

  const sky = new Sky();
  window.Birds = {
    part: () => "",
    mount: () => sky.mount(),
    unmount: () => sky.unmount(),
    config: CFG,
    /* Birds.treeMap(true) paints the labelled tree-structure map (stem /
       branch / outer free branch / perch anchors) over the porch; false hides
       it. Birds.treeMap() returns the map data (also TreePerches.describe()). */
    treeMap: (on) => { if (on === undefined) return (window.TreePerches && window.TreePerches.describe) ? window.TreePerches.describe() : []; sky.showTreeMap = !!on; return sky.showTreeMap; },
    _sky: sky,
  };
})();
