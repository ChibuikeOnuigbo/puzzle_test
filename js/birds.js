/* =====================================================================
   HOUSE 17 — THE BIRDS, v3 (canvas engine, OOP)
   ---------------------------------------------------------------------
   Birds are pre-baked bitmaps drawn on a <canvas> overlay. No SMIL, no
   SVG blur filters; one requestAnimationFrame that runs only on the
   porch, only while the tab is visible, and holds a single static frame
   under reduced motion.

   Classes: PixelMask · SpriteBaker · Bird · FlyingBird · PerchedBird ·
   Forager · Flock · Sky. Every percentage lives in BIRD_CFG below.

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

    /* 87% of flyers ride above the roofline; the rest drift the high sky */
    aboveRoof: 0.87,

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

    /* acrobatics */
    acrobatics: 0.10,
    acroEvery: [7, 15],
    acroMoves: { loop: 0.20, stoop: 0.30, zig: 0.30, roll: 0.20 },

    wingStyles: { flapper: 0.62, mixer: 0.30, glider: 0.08 },   // fewer long glides

    /* perching / landing. A quarter-ish of flyers break off and settle: about
       7 in 10 of those land on the FOREGROUND TREES (they bank down, become
       front-layer birds, grip the branch and ride its sway, then leave after
       5-7s); the rest touch down on the roof. Everyone else flies through and
       leaves the screen. */
    landChance: 0.30,
    perchOnTree: 0.70,
    perchStaySec: [0.6, 14],                     // roof: some leave almost at once, some wait
    treeStaySec: [5, 7],                         // tree perchers stay 5-7 seconds then leave
    initialPerchedRoof: 2,
    initialPerchedTree: 4,
    foragers: 3,
    /* per-second probability a cruising flyer commits to a landing */
    landRateBack: 0.035,
    landRateFront: 0.05,

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
    bigBirdScale: 0.85,
    bigBirdMax: 5,
    bigBirdPerSide: 3,

    /* size bands (raw scale, before species flavour). Near birds have a
       raised FLOOR so nothing close to the lens reads too small; far birds
       are genuinely small. */
    sizeBands: {
      far:  [0.38, 0.56],
      mid:  [0.60, 0.85],
      near: [0.85, 1.12],                         // lowered again: birds stay modest
    },
    /* absolute hard ceiling for a near/front bird (post species flavour) */
    maxNearScale: 1.18,

    species: {
      swift:    { s: 0.74, v: 1.40, wing: "flapper", tint: "#0b0f16" },
      starling: { s: 0.82, v: 1.20, wing: "flapper", tint: "#0a0e14" },
      sparrow:  { s: 0.84, v: 1.10, wing: "mixer",   tint: "#0b0f16" },
      crow:     { s: 1.02, v: 1.06, wing: "mixer",   tint: "#070a0f" },
      owl:      { s: 1.22, v: 0.95, wing: "mixer",   tint: "#06090d" },
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

      // ---- body: a narrow, angular fuselage — a long triangle/teardrop that
      // tapers to a pointed head/beak and pinches to a thin rump at the tail.
      // No fat oval abdomen: max body depth is only ~13px over a 48px length. ----
      ctx.beginPath();
      ctx.moveTo(-22, 2);                       // tail rump (pinched, thin)
      ctx.quadraticCurveTo(-22, -7, -4, -8);    // back sweeping up to the nape
      ctx.quadraticCurveTo(8, -9, 18, -7);      // crown over the head
      ctx.quadraticCurveTo(24, -5, 24, -2);     // forehead into face
      ctx.quadraticCurveTo(22, 1, 14, 4);       // throat
      ctx.quadraticCurveTo(2, 6, -12, 6);       // shallow breast (straight-ish)
      ctx.quadraticCurveTo(-20, 5, -22, 2);     // belly tapering back to rump
      ctx.closePath(); ctx.fill();

      // ---- beak (small, pointed) ----
      ctx.beginPath();
      ctx.moveTo(23, -5); ctx.lineTo(31, -3); ctx.lineTo(23, -1.5);
      ctx.closePath(); ctx.fill();

      // ---- eye: ONE dot, attached to the near/visible side of the head. It
      // rides the head as the bird banks; the X-squash during a hard bank hides
      // it (far side turns away = the 3D side view). Near/front birds get a
      // clear light catch; far birds a faint dimple. ----
      const eyeX = 15, eyeY = -5, eyeR = 2.1;
      if (eyeShine) {
        ctx.fillStyle = "#f2f5f9";
        ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, 0, TAU); ctx.fill();
        ctx.fillStyle = "#0b0f16";
        ctx.beginPath(); ctx.arc(eyeX + 0.6, eyeY + 0.5, eyeR * 0.72, 0, TAU); ctx.fill();
        ctx.fillStyle = tint;
      } else {
        ctx.fillStyle = "rgba(206,214,224,0.6)";
        ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR * 0.9, 0, TAU); ctx.fill();
        ctx.fillStyle = tint;
      }

      // ---- wings: SMALLER, and the shoulder is mounted further LEFT/back and
      // slightly inward (toward the body, +y), with a touch of sweepback so big
      // birds don't look like they have outsized wings. Far wing first, smaller
      // & raised; near wing overlaps it. ----
      const len = lerp(17, 27, spread), chord = lerp(6, 10, spread);
      const shX = -8, shY = -6;
      const angFar = lerp(-0.95, 0.42, down) + 0.18;
      ctx.save(); ctx.translate(shX - 1.5, shY - 1); this._wing(ctx, angFar, len * 0.82, chord * 0.85, tint, true); ctx.restore();
      const angNear = lerp(-1.05, 0.45, down);
      ctx.save(); ctx.translate(shX, shY); this._wing(ctx, angNear, len, chord, tint, false); ctx.restore();

      ctx.restore();
    }

    _buildFlyer() {
      // baked silhouettes are near-black; a couple of frame sets carry an
      // eye catch-light for the lighter-plumaged (near) birds.
      const set = (style, shine) => {
        const frames = [];
        for (let f = 0; f < CFG.flapFrames; f++) {
          const { c, ctx } = this._flyerCanvas();
          this._drawFlyer(ctx, f / CFG.flapFrames, style, { tint: "#0b0f16", eyeShine: shine });
          frames.push(c);
        }
        return frames;
      };
      this.flyFrames = set("flapper", false);
      this.flyFramesShine = set("flapper", true);
      const g = this._flyerCanvas();
      this._drawFlyer(g.ctx, 0.5, "glider", { tint: "#0b0f16", eyeShine: true });
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
      this.state = "flight"; this.bornT = 0;
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
        const site = this.landing;
        const tx = site.x, ty = site.y - 6;
        const dx = tx - this.x, dy = ty - this.y;
        const dist = Math.hypot(dx, dy) + 0.0001;
        landing = { dx, dy, dist };
        // travel direction is LOCKED at commit time (set when the approach
        // began); it never re-evaluates mid-approach, so the bird cannot
        // thrash left<->right in a flip loop as it crosses the perch.
        const appr = (this._apprDir >= 0 ? 1 : -1);
        this.faceTarget = appr;

        // close enough: settle onto the perch. Generous radius + a near-target
        // condition so a bird that reached perch height but still has a few px of
        // horizontal travel doesn't sit there hovering.
        if (dist < 30 || (Math.abs(dx) < 30 && Math.abs(dy) < 14)) {
          this.dead = true; sky.birdLanded(site, appr); return;
        }

        this._landT = (this._landT || 0) + dt;
        // abort if it OVERSHOT the perch horizontally (now flying away from it
        // in the locked direction) or the approach simply took too long — it
        // keeps flying on rather than hovering/flipping in place.
        const overshot = (appr === 1 && dx < -60) || (appr === -1 && dx > 60);
        if (this._landT > 6 || overshot) {
          this.state = "flight"; this.landing = null; this.canLand = false; this._landT = 0;
          landing = null;
        } else {
          // HOMING with arrival braking: the commanded speed is the distance to
          // go scaled so it vanishes smoothly at the perch (dist*gain), capped
          // by the bird's travel speed. Because speed is proportional to the
          // remaining distance it decelerates right onto the branch and never
          // overshoots into a flip loop. The y term is signed by dy itself, so
          // a bird descending from EITHER side moves DOWN (vy>0) to the perch.
          const gain = 12.0;
          const spd = Math.min(dist * gain, sp * 0.7);
          vx = (dx / dist) * spd;
          vy = (dy / dist) * spd;
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
          aim = -Math.abs(this.fixAngle) + Math.sin(this.bornT / CFG.wobblePeriod * TAU + this.wobPhase) * CFG.wobbleAmpDeg * Math.PI / 180;
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
      const floor = this.state === "landing" ? 432 : CFG.maxFlyY;
      // landing birds may rise right to the roof ridge (a little above the open
      // ceiling) to meet a roof perch; otherwise honour the flight floor.
      const ceiling = this.state === "landing" ? 12 : CFG.minFlyY;
      this.y = clamp(this.y, ceiling, floor);
      if (this.y >= floor - 0.5 && this.vy > 0) this.vy = 0;   // no sinking into the ground

      this.bank = lerp(this.bank, clamp(-this.vy / (sp + 1) * 0.8 + this.acroBank + (this._turnBank || 0), -1.0, 1.0), 0.1);
      this.rot = clamp(Math.atan2(this.vy, Math.abs(this.vx) + 0.001) * 0.55, -0.6, 0.6) + this.acroBank;
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
      const moved = Math.hypot(this.x - this._px, this.y - this._py);
      this._stuckT = moved < 3 ? this._stuckT + dt : 0;
      this._px = this.x; this._py = this.y;
      if (this._stuckT > 0.8) {
        if (this.state === "landing") {
          // a landing bird brakes hard and can legitimately slow down; only give
          // it a grace period (the real abort is the overshoot/timeout logic
          // above, which never thrash-flipped). If it is STILL pinned after the
          // grace, abort and fly on.
          this._landStall = (this._landStall || 0) + dt;
          this._stuckT = 0;
          if (this._landStall > 1.2) {
            this.state = "flight"; this.landing = null; this.canLand = false; this._landT = 0; this._landStall = 0;
          }
        } else {
          this.x += this.facing * 40 * dt * 10;
        }
      } else {
        this._landStall = 0;
      }

      /* edge recycling / landing roll */
      if (this.state === "flight") {
        const off = this.bodyLen;
        if (this.x < -off - 60 || this.x > CFG.world.w + off + 60) {
          if (this.flock) this.dead = true;
          else sky.respawn(this);
          return;
        }
        if (!this.flock && this.canLand && this.bornT > 3) {
          const rate = this.depth === "back" ? CFG.landRateBack : CFG.landRateFront;
          if (Math.random() < dt * rate) {
            const site = sky.pickPerch(this.depth, this.x, this.facing);
            if (site) {
              this.landing = site; this.state = "landing"; this.canLand = false;
              this._landT = 0;
              // lock the travel direction we'll hold on the approach (the sign
              // that actually points us at the perch)
              this._apprDir = site.x >= this.x ? 1 : -1;
              // committing to land brings the bird to the FRONT layer so it stays
              // visible (and can be clipped by nothing) the whole approach down —
              // whether it settles on a foreground tree or the roof.
              this.depth = "front";
              this._wantFace(this._apprDir);
            }
          }
        }
      }
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
      this.y = clamp(this.y + ay * dt * 24, CFG.minFlyY, CFG.maxFlyY - 6);
      this.facing = f.leader.facing;
    }

    _acrobatics(dt, sp) {
      this.acroT -= dt; this.acroBank = 0;
      if (this.acroMove) {
        this.acroClock += dt;
        const t = clamp(this.acroClock / this.acroDur, 0, 1), k = Math.sin(t * Math.PI);
        if (this.acroMove === "loop") this.acroBank = t * TAU;
        else if (this.acroMove === "stoop") { this._acrody += Math.sin(t * Math.PI) * sp * dt * 1.5 * (t < 0.5 ? 1 : -1); this.acroBank = k * 0.8; }
        else if (this.acroMove === "zig") { this._acrody += Math.sin(t * Math.PI * 6) * sp * dt * 0.8; this.acroBank = Math.sin(t * Math.PI * 6) * 0.5; }
        else if (this.acroMove === "roll") this.acroBank = Math.sin(t * TAU) * 0.7;
        if (t >= 1) { this.acroMove = null; this.acroBank = 0; this.acroT = rand(CFG.acroEvery[0], CFG.acroEvery[1]); }
      } else if (this.acroT <= 0) {
        this.acroMove = roll(CFG.acroMoves); this.acroClock = 0;
        this.acroDur = this.acroMove === "loop" ? 1.3 : rand(0.8, 1.2);
      }
    }
  }

  /* ===================== PerchedBird ===================== */
  class PerchedBird extends Bird {
    constructor(site) {
      super(site.x, site.y);
      this.site = site; this.facing = site.face || 1;
      this.size = site.s || 0.7; this.tint = "#10161e";
      this.depth = "front";   // perched birds always render on the front canvas
      this.onTree = !!site.tree;
      this.pose = 0; this.poseT = rand(2, 8); this.bornT = 0;
      // tree perchers stay 5-7s (they're up close on the foreground branches);
      // roof birds may linger a while.
      this.dwell = this.onTree
        ? rand(CFG.treeStaySec[0], CFG.treeStaySec[1])
        : rand(CFG.perchStaySec[0], CFG.perchStaySec[1]);
      this.leaving = false; this.leaveT = 0;
      // a per-tree sway phase/rate so birds follow THEIR branch
      this.swayPhase = (site.x * 0.37) % (Math.PI * 2);
      this.swayRate = this.onTree ? 0.9 : 0;
    }
    update(dt, sky) {
      this.bornT += dt;
      if (!this.leaving) {
        this.poseT -= dt;
        if (this.poseT <= 0) { this.pose = Math.random() < 0.72 ? 0 : (Math.random() < 0.5 ? 1 : 2); this.poseT = rand(2.5, 9); }
        // tree birds are grip-locked to the branch: they breathe-bob AND ride
        // the branch's gentle wind sway (rotation about the feet).
        this.bob = Math.sin(this.bornT * 2.1) * 0.6;
        if (this.onTree) {
          this.branchSway = Math.sin(this.bornT * this.swayRate + this.swayPhase) * 2.6;
        } else this.branchSway = 0;
        if (this.bornT > this.dwell) { this.leaving = true; this.leaveT = 0; }
      } else {
        this.leaveT += dt; this.y -= dt * 80;
        if (this.leaveT > 0.4) { this.dead = true; sky.spawnFlyer({ fromPerch: this.site, dir: this.facing }); }
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
      const tree = [
        { x: 62, y: 296, s: 1.05, face: 1, tree: true }, { x: 128, y: 254, s: 1.0, face: 1, tree: true },
        { x: 34, y: 420, s: 1.1, face: 1, tree: true }, { x: 1178, y: 298, s: 1.05, face: -1, tree: true },
        { x: 1236, y: 258, s: 1.0, face: -1, tree: true }, { x: 1148, y: 382, s: 1.1, face: -1, tree: true },
      ].map(p => ({ ...p, id: "t" + p.x }));
      return { roof, tree };
    }
    /* choose a perch. wantTree picks the group; we only offer sites that are
       roughly AHEAD of the bird's travel direction (so it homes in on a curved
       approach rather than reversing into a flip loop) and aren't occupied.
       Occupancy is keyed by stable site id (the returned site is a copy). */
    pickPerch(depth, fromX, facing) {
      const s = this.sites();
      const used = new Set(this.birds.filter(b => b instanceof PerchedBird && !b.dead && b.site).map(b => b.site.id));
      const wantTree = chance(CFG.perchOnTree);
      let pool = wantTree ? s.tree : s.roof;
      if (typeof facing === "number" && typeof fromX === "number") {
        // only commit to a perch inside a SHORT window ahead — close enough that
        // the arrival-braking has time to slow the bird onto the branch instead
        // of overshooting into a flip loop. Roof perches are small/high so the
        // window is tighter; foreground trees can be taken from a bit farther.
        const reach = wantTree ? 300 : 170;
        const ahead = pool.filter(p => {
          const dd = (p.x - fromX) * facing;           // >0 means ahead
          return dd > 30 && dd < reach;
        });
        if (ahead.length) pool = ahead; else return null;
      }
      const free = pool.filter(p => !used.has(p.id));
      const site = free.length ? pick(free) : null;
      return site ? { ...site } : null;
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
      this._skyClip = new Path2D("M0,0 H1280 V124 L1130,124 L960,300 Q920,380 860,430 L420,430 Q360,380 320,300 L150,124 L0,124 Z");
      this.mounted = true;

      this.birds = []; this.flocks = [];
      const animsOn = (id) => (typeof AnimReg !== "undefined") ? AnimReg.on(id) : !((typeof Settings !== "undefined") && Settings.get && Settings.get("reducedMotion"));
      const reduced = !animsOn("birds");
      const s = this.sites();
      for (let i = 0; i < CFG.initialPerchedRoof; i++) { const p = pick(s.roof); if (!this.birds.some(b => b instanceof PerchedBird && b.site === p)) this.birds.push(new PerchedBird(p)); }
      for (let i = 0; i < CFG.initialPerchedTree; i++) { const p = pick(s.tree); if (!this.birds.some(b => b instanceof PerchedBird && b.site === p)) this.birds.push(new PerchedBird(p)); }
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
      // depth FIRST: ~75% ride the BACK layer (small, high, behind the house);
      // the rest cross in FRONT (near, big). Flocks/small birds ignore the cap.
      const depth = opts.depth || (chance(0.62) ? "back" : "front");
      const lane = opts.lane != null ? opts.lane : (depth === "back" ? 0 : 2);
      const xEdge = dir === 1 ? -60 : CFG.world.w + 60;
      const x = initial ? (chance(0.6) ? (dir === 1 ? rand(120, 600) : rand(680, 1160)) : xEdge) : xEdge;
      let y;
      if (depth === "back") {
        const atX = (x < 0 || x > CFG.world.w) ? (dir === 1 ? 220 : 1060) : x;
        y = clamp(this.roofY(atX) - rand(10, 70), CFG.minFlyY, 150);
      } else {
        y = rand(150, CFG.maxFlyY - 30);
      }
      const species = lane === 2 && chance(CFG.owlChance) ? "owl" : pick(CFG.speciesRoll);
      let scale;
      if (depth === "back") {
        // small far bird
        scale = rand(CFG.sizeBands.far[0], CFG.sizeBands.far[1]) * CFG.species[species].s;
      } else {
        // near bird: big enough to read, then the medium/big cap may shrink it
        scale = Math.max(this._bandFor(2) * CFG.species[species].s, 0.85);
        scale = this._capBigBird(scale, dir);
        scale = Math.min(scale, CFG.maxNearScale);   // hard ceiling on biggest bird
        // if the cap downgraded it, send it to the back instead
      }
      let effLane = lane, effDepth = depth;
      if (effDepth === "front" && scale < CFG.bigBirdScale) { effDepth = "back"; effLane = 0;
        y = clamp(Math.min(y, this.roofY(dir === 1 ? 220 : 1060) - 20), CFG.minFlyY, 150);
      }
      const anchor = effLane === 0 ? CFG.baseSpeed.far : CFG.baseSpeed.near;
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
      const y = fromPerch ? clamp(fromPerch.y - 14, CFG.minFlyY, CFG.maxFlyY) : rand(120, CFG.maxFlyY - 40);
      const lane = y < 130 ? 0 : y < 220 ? 1 : 2;
      const species = pick(CFG.speciesRoll);
      let scale = (fromPerch ? (fromPerch.s || 0.9) * 1.1 : this._bandFor(lane)) * CFG.species[species].s;
      // medium/big cap applies to take-offs too; a downgraded bird goes small+back
      const wasBig = scale >= CFG.bigBirdScale;
      scale = this._capBigBird(scale, dir);
      const isBig = scale >= CFG.bigBirdScale;
      let effLane = lane;
      if (!isBig && wasBig) { effLane = 0; }
      const depth = isBig
        ? ((fromPerch && !fromPerch.tree) ? "back" : (fromPerch ? "front" : this._depthFor(scale)))
        : (wasBig ? "back" : this._depthFor(scale));
      const anchor = effLane === 0 ? CFG.baseSpeed.far : effLane === 1 ? CFG.baseSpeed.mid : CFG.baseSpeed.near;
      const b = new FlyingBird({
        x, y, dir, lane: effLane, species, scale,
        speedAnchor: anchor, speedMul: 1.25, canLand: false,
        headingMode: "wobble", depth,
      });
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

    birdLanded(site, facing) { this.birds.push(new PerchedBird({ ...site, face: facing })); }

    respawn(b) {
      const hint = this._bigBalanceHint();
      const windFight = chance(CFG.fightWind);
      const dir = hint && hint.dir ? hint.dir : (windFight ? -CFG.windDir : (chance(0.62) ? 1 : -1));
      b.bornT = 0; b.state = "flight"; b.landing = null; b.canLand = true;
      b.facing = dir; b.faceTarget = dir; b.face = dir; b.faceScale = dir; b._turnBank = 0;
      b.x = dir === 1 ? -60 : 1340;                 // always from a side edge
      const depth = chance(0.62) ? "back" : "front";
      const lane = depth === "back" ? 0 : 2;
      const species = lane === 2 && chance(CFG.owlChance) ? "owl" : b.speciesKey;
      let scale0;
      if (depth === "back") {
        scale0 = rand(CFG.sizeBands.far[0], CFG.sizeBands.far[1]) * CFG.species[species].s;
        b.y = clamp(this.roofY(dir === 1 ? 220 : 1060) - rand(10, 70), CFG.minFlyY, 150);
      } else {
        scale0 = Math.max(this._bandFor(2) * CFG.species[species].s, 0.85);
        scale0 = this._capBigBird(scale0, dir);
        scale0 = Math.min(scale0, CFG.maxNearScale);
        b.y = rand(150, CFG.maxFlyY - 30);
      }
      let effLane = lane, effDepth = depth;
      if (effDepth === "front" && scale0 < CFG.bigBirdScale) { effDepth = "back"; effLane = 0;
        b.y = clamp(this.roofY(dir === 1 ? 220 : 1060) - 20, CFG.minFlyY, 150);
      }
      b.scale0 = scale0; b.size = scale0;
      b.depth = effDepth; b.lane = effLane;
      b.speedAnchor = effLane === 0 ? CFG.baseSpeed.far : CFG.baseSpeed.near;
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
    }

    _drawFlyer(ctx, b, far) {
      // near/front birds use the eye-catch frame set; far/back birds stay dark
      const shine = !far && b.depth === "front";
      const frames = shine && this.baker.flyFramesShine ? this.baker.flyFramesShine : this.baker.flyFrames;
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
      ctx.rotate(b.rot + (b.acroBank || 0));
      ctx.scale(fs * k, k);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, -w / 2, -h / 2);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    _drawPerchSprite(ctx, spr, b, extraY = 0) {
      const u = 3;
      const k = (30 * b.size) / spr.height;
      const bob = b.bob || 0, peck = b.peck > 0 ? 4 * b.size : 0;
      const feetY = 0; // sprite bottom sits on the perch (after -height translate)
      ctx.save();
      ctx.translate(b.x + (b.zig || 0), b.y + bob + extraY);
      // a tree-perched bird is grip-locked to the limb: rotate about its FEET so
      // it follows the branch's wind sway.
      if (b.branchSway) ctx.rotate((b.branchSway / 40) * b.facing);
      ctx.scale(b.facing * k, k);
      ctx.drawImage(spr, -spr.width / 2, -spr.height + peck);
      // eye: in sprite-local units (the scaleX flip handles facing; the bird is
      // baked facing +x so the head/eye sit on the local right ~0.64 width).
      // near/front TREE birds get a clear warm catch-light (the lantern catches
      // them up close); roof/ground birds get a faint dimple.
      const ex = spr.width * 0.64;
      const ey = spr.height * 0.16 - peck / k;
      const bright = b.onTree;
      if (bright) {
        ctx.fillStyle = "rgba(255,240,205,0.95)";
        ctx.beginPath(); ctx.arc(ex, ey, 3.4, 0, TAU); ctx.fill();
        ctx.fillStyle = "#0a0e14";
        ctx.beginPath(); ctx.arc(ex - 1.0, ey + 0.9, 2.3, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = "rgba(200,210,222,0.5)";
        ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    _drawPerched(ctx, b) {
      const spr = this.baker.perchSprite(b.pose);
      if (!spr) return;
      if (b.onTree && !b.leaving) {
        // the foreground limb the feet grip
        ctx.save(); ctx.strokeStyle = "#05080c"; ctx.lineWidth = 6 * b.size + 2; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(b.x - 30 * b.size, b.y + 3);
        ctx.quadraticCurveTo(b.x, b.y + 6, b.x + 30 * b.size, b.y + 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(40,52,40,0.5)"; ctx.lineWidth = 2 * b.size;
        ctx.beginPath();
        ctx.moveTo(b.x - 30 * b.size, b.y + 1);
        ctx.quadraticCurveTo(b.x, b.y + 4, b.x + 30 * b.size, b.y + 0);
        ctx.stroke(); ctx.restore();
      }
      this._drawPerchSprite(ctx, spr, b);
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
          this._drawPerchSprite(cf, spr, b);
          if (b.site.tree) {
            cf.strokeStyle = "#070a0e"; cf.lineWidth = 5 * b.size + 2; cf.lineCap = "round";
            cf.beginPath(); cf.moveTo(b.x - 26 * b.size, b.y + 2);
            cf.quadraticCurveTo(b.x, b.y + 5, b.x + 26 * b.size, b.y + 1); cf.stroke();
          }
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
    _sky: sky,
  };
})();
