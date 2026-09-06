/* =====================================================================
   HOUSE 17 — THE BIRDS
   A session-randomised avian life for the porch sky, roof and trees,
   painted from the AI silhouette sheets (js/bird-data.js: eight flight
   poses, six perched poses, decoded to two-tone pixel runs).

   Everything here is rolled once per page load from a single seed:

     • the SKY STATE   — some evenings have no birds at all (the house
       holds its breath); most have one to three groups;
     • the GROUPS      — sizes 1,2,3,4,5,6,7 and the rare big flock of
       8-11, in line, vee, column, echelon or scatter formation;
     • the BIRDS       — each with its own lane, speed, bob, wing style
       (flapper / glider / mixer), depth scale and blur;
     • the ACROBATICS  — loops, stoops, zigs, tumbles and mid-air rolls,
       weighted so soloists show off and flock birds mostly hold station;
     • the PERCHES     — ridge stones, eaves, gutter, chimney pot, the
       front trees near the lens and the back trees behind the house;
       some birds are sitting when you arrive, some land while you watch
       (flight path freezes onto the perch and the sprite swaps), some
       get bored and leave.

   Motion is pure SMIL (animateMotion along generated bezier paths with
   rotate="auto", discrete opacity wing cycles, frozen landings), so it
   costs nothing when the tab is hidden and stops dead under reduced
   motion, which renders only the perched birds.

   The layer is split in three depth parts so the house can sandwich it:
   back  — far sky lanes and the trees behind the house (blurred, small);
   mid   — the roofline perches, drawn over the tiles;
   front — near lens flyers and the front-tree perches, big and crisp.
===================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     0. small maths: seeded rng, hashing, easing, formatting
  ------------------------------------------------------------------ */
  /* QA snapshots need a deterministic sky; live play rolls its own */
  const SEED = (typeof window !== "undefined" && window.__QA__) ? 20260906 : (Math.random() * 0x7fffffff) | 0;

  function mulberry(a) {
    let t = a >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = mulberry(SEED);
  const rnd = (a, b) => a + R() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(R() * arr.length)];
  const chance = p => R() < p;
  const f1 = n => n.toFixed(1);
  const f2 = n => n.toFixed(2);
  /* smooth ease for bobs and loops */
  const ease = t => t * t * (3 - 2 * t);

  /* ------------------------------------------------------------------
     1. pose pixels -> svg paths
     BIRD_DATA poses are {gw, gh, rows:[{gy, runs:[[x,len,idx]]}]}; a
     sprite is one path per tone, drawn at `cell` px per grid unit.
  ------------------------------------------------------------------ */
  const BD = (typeof BIRD_DATA !== "undefined") ? BIRD_DATA : null;

  function posePaths(pose, cell) {
    if (!pose) return "";
    const acc = ["", ""];
    for (const row of pose.rows) {
      const y = row.gy * cell;
      for (const r of row.runs) {
        const w = r[1] * cell + 0.35;
        acc[r[2]] += `M${f2(r[0] * cell)},${f2(y)}h${f2(w)}v${f2(cell + 0.35)}h${f2(-w)}z`;
      }
    }
    let out = "";
    if (acc[0]) out += `<path d="${acc[0]}" fill="${BD.palette[0]}"/>`;
    if (acc[1]) out += `<path d="${acc[1]}" fill="${BD.palette[1]}" opacity="0.85"/>`;
    return out;
  }
  const FLY = i => (BD ? BD.fly[i % BD.fly.length] : null);
  const PER = i => (BD ? BD.perch[i % BD.perch.length] : null);
  /* flight pose roles: 0 wings up, 1 mid, 3 down, 4 glide, 5 bank, 6 stoop */
  const P_UP = 0, P_MID = 1, P_DOWN = 3, P_GLIDE = 4, P_BANK = 5, P_STOOP = 6;

  /* ------------------------------------------------------------------
     2. depth, blur and speed model
     scale < 0.5  : far lane   -> soft blur, faded
     scale 0.5-0.9: mid lane   -> crisp
     scale > 0.9  : near lens  -> crisp, bigger wing shadow
     speed > 70px/s             -> motion blur + a stretched sprite
  ------------------------------------------------------------------ */
  function depthAttrs(scale, speed) {
    let filt = "", op = 1, stretch = 1;
    if (scale < 0.5) { filt = ' filter="url(#fxblur1)"'; op = 0.85; }
    if (speed > 70) { filt = ' filter="url(#fxblur1)"'; stretch = 1.12; }
    return { filt, op, stretch };
  }

  /* ------------------------------------------------------------------
     3. the wing cycle: three flap frames in a discrete opacity loop,
        or a held glide, or a mixer that flaps then rests on the wind
  ------------------------------------------------------------------ */
  function wingSprite(cell, style, flapDur) {
    const up = posePaths(FLY(P_UP), cell);
    const mid = posePaths(FLY(P_MID), cell);
    const down = posePaths(FLY(P_DOWN), cell);
    const glide = posePaths(FLY(P_GLIDE), cell);
    if (style === "glider") return `<g>${glide}</g>`;
    const disc = ' calcMode="discrete"';
    const cyc = (values) => `<animate attributeName="opacity" values="${values}" keyTimes="0;0.28;0.5;0.78" dur="${f2(flapDur)}s" repeatCount="indefinite"${disc}/>`;
    const flap =
      `<g opacity="1">${up}${cyc("1;0;0;0")}</g>` +
      `<g opacity="0">${mid}${cyc("0;1;0;1")}</g>` +
      `<g opacity="0">${down}${cyc("0;0;1;0")}</g>`;
    if (style === "flapper") return flap;
    /* mixer: flap for a while, then fold into a glide, then flap again */
    const gd = rnd(6, 11);
    const hold = `<animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;${f2(0.55)};${f2(0.58)};${f2(0.92)};1" dur="${f2(gd)}s" repeatCount="indefinite"/>`;
    const ghide = `<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${f2(0.55)};${f2(0.58)};${f2(0.92)};1" dur="${f2(gd)}s" repeatCount="indefinite"/>`;
    return `<g opacity="1">${flap}${hold}</g><g opacity="0">${glide}${ghide}</g>`;
  }

  /* ------------------------------------------------------------------
     4. acrobatics library — each move rewrites part of the path or
        adds a sprite-level animation. t is the fraction along the run
        where the move happens.
  ------------------------------------------------------------------ */
  const ACRO = {
    /* a full loop-the-loop: two cubics that cross back over themselves */
    loop(t, x, y, dir, r) {
      const d = dir;
      return ` c ${f1(d * r * 1.2)},${f1(-r * 1.9)} ${f1(d * r * 2.6)},${f1(-r * 0.6)} ${f1(d * r * 1.5)},${f1(r * 0.4)}` +
             ` c ${f1(-d * r * 0.9)},${f1(r * 0.8)} ${f1(-d * r * 0.5)},${f1(-r * 0.9)} ${f1(d * r * 0.7)},${f1(-r * 0.5)}`;
    },
    /* a hunting stoop: drop fast, flatten, climb back */
    stoop(t, x, y, dir, r) {
      const d = dir;
      return ` c ${f1(d * r)},${f1(r * 1.7)} ${f1(d * r * 1.4)},${f1(r * 1.9)} ${f1(d * r * 2.2)},${f1(r * 1.6)}` +
             ` c ${f1(d * r * 0.8)},${f1(-r * 0.9)} ${f1(d * r * 0.9)},${f1(-r * 1.4)} ${f1(d * r * 1.6)},${f1(-r * 1.6)}`;
    },
    /* a sharp zig: up-down-up in three tight segments */
    zig(t, x, y, dir, r) {
      const d = dir;
      return ` l ${f1(d * r * 0.7)},${f1(-r * 0.9)} l ${f1(d * r * 0.7)},${f1(r * 1.1)} l ${f1(d * r * 0.7)},${f1(-r * 0.7)}`;
    },
    /* a tumble: the sprite spins a full turn while the path dips */
    tumble(t, x, y, dir, r) {
      return { path: ` c ${f1(dir * r)},${f1(r * 0.6)} ${f1(dir * r * 1.6)},${f1(r * 0.7)} ${f1(dir * r * 2.2)},${f1(r * 0.2)}`, spin: true };
    },
    /* a roll: mirror the sprite mid-air (scaleX flip and back) */
    roll(t, x, y, dir, r) {
      return { path: ` c ${f1(dir * r * 1.4)},${f1(-r * 0.4)} ${f1(dir * r * 2)},${f1(-r * 0.2)} ${f1(dir * r * 2.6)},0`, flip: true };
    },
  };
  const ACRO_NAMES = ["loop", "stoop", "zig", "tumble", "roll"];

  /* ------------------------------------------------------------------
     5. perch catalogue — porch stage coordinates, scale and facing
  ------------------------------------------------------------------ */
  const PERCH_ROOF = [
    { x: 640, y: 27, s: 0.62, face: 1, kind: "ridge" },
    { x: 520, y: 49, s: 0.6, face: 1, kind: "ridge" },
    { x: 760, y: 53, s: 0.6, face: -1, kind: "ridge" },
    { x: 400, y: 72, s: 0.58, face: 1, kind: "ridge" },
    { x: 880, y: 76, s: 0.58, face: -1, kind: "ridge" },
    { x: 250, y: 118, s: 0.56, face: 1, kind: "eave" },
    { x: 1030, y: 118, s: 0.56, face: -1, kind: "eave" },
    { x: 500, y: 119, s: 0.55, face: -1, kind: "gutter" },
    { x: 820, y: 119, s: 0.55, face: 1, kind: "gutter" },
    { x: 352, y: 35, s: 0.6, face: 1, kind: "chimney" },
  ];
  const PERCH_FRONT = [
    { x: 62, y: 296, s: 0.95, face: 1, kind: "oak" },
    { x: 128, y: 254, s: 0.9, face: 1, kind: "oak" },
    { x: 34, y: 420, s: 1.0, face: 1, kind: "oak" },
    { x: 1178, y: 298, s: 0.95, face: -1, kind: "dead" },
    { x: 1236, y: 258, s: 0.9, face: -1, kind: "dead" },
    { x: 1148, y: 382, s: 1.0, face: -1, kind: "dead" },
  ];
  const PERCH_BACK = [
    { x: 58, y: 428, s: 0.5, face: 1, kind: "backtree" },
    { x: 118, y: 408, s: 0.48, face: 1, kind: "backtree" },
    { x: 1162, y: 418, s: 0.5, face: -1, kind: "backtree" },
    { x: 1224, y: 398, s: 0.48, face: -1, kind: "backtree" },
    { x: 92, y: 452, s: 0.46, face: -1, kind: "backtree" },
  ];

  /* ------------------------------------------------------------------
     6. sky lanes and the session sky state
  ------------------------------------------------------------------ */
  const LANES = [
    { y0: 46, y1: 112, scale: [0.34, 0.5], speed: [26, 48] },   // up in the sky, far
    { y0: 118, y1: 220, scale: [0.5, 0.8], speed: [38, 70] },   // middle
    { y0: 232, y1: 348, scale: [0.85, 1.35], speed: [60, 105] },// low, near lens
  ];

  /* ------------------------------------------------------------------
     9b. species: each group is one species, and the species decides how
     big the birds read, how fast they go and how they use their wings.
     Swifts tear about up high; starlings murmur; sparrows hop and flap;
     crows row along deliberately; an owl, rarely, sails the low lane.
  ------------------------------------------------------------------ */
  const SPECIES = {
    swift:    { s: 0.80, v: 1.35, wing: "flapper", lanes: [0, 0, 1] },
    starling: { s: 0.88, v: 1.12, wing: "flapper", lanes: [0, 1, 1] },
    sparrow:  { s: 0.84, v: 1.00, wing: "mixer",   lanes: [1, 2, 2] },
    crow:     { s: 1.18, v: 0.88, wing: "mixer",   lanes: [1, 1, 2] },
    owl:      { s: 1.42, v: 0.66, wing: "glider",  lanes: [2] },
  };
  const SPECIES_NAMES = ["swift", "starling", "starling", "sparrow", "sparrow", "crow", "crow"];
  function pickSpecies(lane) {
    if (lane === 2 && chance(0.06)) return "owl";            // a rare low glider
    const list = SPECIES_NAMES.filter(n => SPECIES[n].lanes.indexOf(lane) >= 0);
    return list.length ? pick(list) : "starling";
  }

  /* a murmuration: one nervous body of starlings, shared rhythm */
  function planMurmuration() {
    if (!chance(0.09)) return null;
    return {
      size: ri(18, 30),
      dir: chance(0.5) ? 1 : -1,
      y: rnd(54, 96),
      speed: rnd(0.95, 1.1),
      ph: rnd(0, 6),
    };
  }
  /* yard foragers: hops and pecks down on the ground near the steps */
  const FORAGE_Y = [598, 636];
  function planForagers() {
    if (!chance(0.55)) return [];
    const n = ri(1, 3), out = [];
    for (let i = 0; i < n; i++) {
      out.push({ x: rnd(430, 860), y: rnd(FORAGE_Y[0], FORAGE_Y[1]), s: rnd(1.35, 1.8), face: chance(0.5) ? 1 : -1 });
    }
    return out;
  }

  function groupSize() {
    const r = R();
    if (r < 0.18) return 1;
    if (r < 0.34) return 2;
    if (r < 0.48) return 3;
    if (r < 0.60) return 4;
    if (r < 0.70) return 5;
    if (r < 0.78) return 6;
    if (r < 0.85) return 7;
    return 8 + Math.floor(R() * 4);           // the rare big flock, 8-11
  }

  function planSky() {
    const plan = { quiet: false, groups: [], perchRoof: [], perchFront: [], perchBack: [] };
    if (!BD) return plan;
    if (chance(0.12)) { plan.quiet = true; return plan; }   // some evenings: nothing
    const ng = chance(0.5) ? 1 : chance(0.75) ? 2 : 3;
    for (let g = 0; g < ng; g++) {
      const size = groupSize();
      const lane = pick([0, 0, 0, 0, 1, 1, 2]);            // the sky up top first
      plan.groups.push({
        size,
        lane,
        species: pickSpecies(lane),
        dir: chance(0.62) ? 1 : -1,
        formation: pick(["line", "line", "vee", "column", "echelon", "scatter"]),
        speed: rnd(0.85, 1.2),
        acro: chance(0.5),
      });
    }
    /* perched life: roof, front trees, back trees — never all at once */
    const roofN = ri(0, 3), frontN = ri(0, 2), backN = ri(0, 2);
    const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    plan.perchRoof = shuffle(PERCH_ROOF).slice(0, roofN);
    plan.perchFront = shuffle(PERCH_FRONT).slice(0, frontN);
    plan.perchBack = shuffle(PERCH_BACK).slice(0, backN);
    plan.murm = planMurmuration();
    plan.forage = planForagers();
    return plan;
  }

  const PLAN = planSky();

  /* ------------------------------------------------------------------
     7. formation offsets for member i of n
  ------------------------------------------------------------------ */
  function formationOffset(form, i, n, dir) {
    switch (form) {
      case "vee": {
        const side = i % 2 ? 1 : -1;
        const row = Math.ceil(i / 2);
        return { dx: -dir * row * 34, dy: side * row * 20 };
      }
      case "column": return { dx: -dir * i * 12, dy: i * 26 };
      case "echelon": return { dx: -dir * i * 30, dy: -i * 12 };
      case "scatter": return { dx: rnd(-70, 70), dy: rnd(-46, 46) };
      default: return { dx: -dir * i * 30, dy: (i % 2 ? 1 : -1) * (i % 3) * 7 };
    }
  }

  /* ------------------------------------------------------------------
     8. one flying bird: path + motion + wings + optional landing
     Returns an svg string. `land` is a perch site or null.
  ------------------------------------------------------------------ */
  let uid = 0;

  function buildFlyer(o) {
    const lane = LANES[o.lane];
    const sp = (o.species && SPECIES[o.species]) || null;
    const scale = rnd(lane.scale[0], lane.scale[1]) * (o.scaleMul || 1) * (sp ? sp.s : 1);
    const speed = rnd(lane.speed[0], lane.speed[1]) * (o.speedMul || 1) * (sp ? sp.v : 1);
    const dir = o.dir;
    const y0 = (o.forceY != null ? o.forceY + rnd(-8, 8) : rnd(lane.y0, lane.y1)) + (o.dy || 0);
    const qa = typeof window !== "undefined" && window.__QA__;
    /* QA snapshots cannot advance SMIL time, so in QA the run starts
       on-screen; live play always enters from beyond the edge */
    const xStart = o.land ? (dir === 1 ? -160 - (o.stag || 0) : 1440 + (o.stag || 0))
      : qa ? (dir === 1 ? rnd(140, 620) : rnd(660, 1140))
      : (dir === 1 ? -160 - (o.stag || 0) : 1440 + (o.stag || 0));
    const xEnd = o.land ? o.land.x : (dir === 1 ? 1440 : -160);
    const yEnd = o.land ? o.land.y - 7 * o.land.s : y0 + rnd(-30, 30);
    const dist = Math.abs(xEnd - xStart);
    const dur = o.land ? Math.min(46, dist / speed) : dist / speed;
    const { filt, op, stretch } = depthAttrs(scale, speed);
    const cell = 1.15 * scale;
    const style = o.style || (sp ? sp.wing : null) || pick(["flapper", "flapper", "mixer", "glider"]);
    const flapDur = rnd(0.34, 0.62) / (speed / 50 + 0.4);

    /* ---- the path: four to six bobbing segments, one acrobatic ---- */
    const segs = o.land ? 3 : ri(4, 6);
    let d = `M${f1(xStart)},${f1(y0)}`;
    let cx = xStart, cy = y0;
    const acroAt = o.acro ? ri(1, segs - 1) : -1;
    let spin = false, flip = false;
    const segLen = (xEnd - xStart) / segs;
    for (let sgi = 0; sgi < segs; sgi++) {
      const nx = cx + segLen;
      const ny = (sgi === segs - 1 && o.land) ? yEnd : y0 + Math.sin(sgi * 1.7 + o.ph) * rnd(6, 20);
      if (sgi === acroAt) {
        const name = pick(ACRO_NAMES);
        const r = rnd(16, 34) * scale + 10;
        const res = ACRO[name](sgi, cx, cy, dir, r);
        if (typeof res === "string") d += res;
        else { d += res.path; spin = spin || !!res.spin; flip = flip || !!res.flip; }
        cx += segLen * 0.7; cy = ny;
        d += ` S ${f1(cx + segLen * 0.3)},${f1(ny)} ${f1(nx)},${f1(ny)}`;
      } else {
        d += ` C ${f1(cx + segLen * 0.33)},${f1(cy + rnd(-16, 16))} ${f1(cx + segLen * 0.66)},${f1(ny + rnd(-16, 16))} ${f1(nx)},${f1(ny)}`;
      }
      cx = nx; cy = ny;
    }

    /* ---- speed bursts: keyPoints along the same path ---- */
    let kp = "";
    if (!o.land && chance(0.34)) {
      kp = ` keyPoints="0;0.42;0.58;1" keyTimes="0;0.5;0.62;1" calcMode="linear"`;
    }

    /* ---- sprite: wings + optional spin / roll anims ---- */
    const face = dir === 1 ? 1 : -1;
    let sprite = wingSprite(cell, style, flapDur);
    if (spin) {
      sprite = `<g><animateTransform attributeName="transform" type="rotate" values="0;360" dur="${f2(rnd(0.9, 1.5))}s" begin="${f2(dur * 0.45)}s" repeatCount="1"/>${sprite}</g>`;
    }
    if (flip) {
      sprite = `<g><animateTransform attributeName="transform" type="scale" values="1 1;1 1;-1 1;-1 1;1 1" keyTimes="0;0.44;0.5;0.62;0.68" dur="${f2(dur)}s" repeatCount="indefinite" additive="sum"/>${sprite}</g>`;
    }

    /* ---- landing: freeze on the perch and swap to a perched pose ---- */
    let landSwap = "";
    const id = "bf" + (uid++);
    if (o.land) {
      const ps = perchedSprite(o.land, cell * 0.92, { idle: false });
      landSwap =
        `<set attributeName="opacity" to="0" begin="${f2(dur)}s" />` +
        perchWrap(o.land, cell * 0.92, `<set attributeName="opacity" to="1" begin="${f2(dur)}s"/>${ps}`, ' opacity="0"');
    }

    /* resvg (offline snapshots) has no animateMotion: in QA the bird is
       parked at a point along its run with a plausible tilt, so stills
       show the sky populated; browsers get the real motion element. */
    const qaPark = qa && !o.land
      ? ` transform="translate(${f1(xStart + (xEnd - xStart) * 0.4)},${f1(y0 + Math.sin(o.ph || 1) * 10)}) rotate(${f1(dir * rnd(-7, 7))})"`
      : "";
    const motion = qa && !o.land ? "" :
      `<animateMotion path="${d}" dur="${f2(dur)}s" rotate="auto"${kp} repeatCount="${o.land ? "1" : "indefinite"}"${o.land ? ' fill="freeze"' : ""}/>`;
    return `<g opacity="${op}"${filt}>
      <g${qaPark}>
        ${motion}
        <g transform="scale(${f2(face * scale * stretch)},${f2(scale)}) translate(${f1(-12 * cell)},${f1(-14 * cell)})">
          ${sprite}
        </g>
      </g>
      ${landSwap}
    </g>`;
  }

  /* ------------------------------------------------------------------
     9. one perched bird: pose + idle life (head turn, tail flick,
        the occasional song) + optional take-off
  ------------------------------------------------------------------ */
  function perchWrap(site, cell, inner, extra = "") {
    const pw = PER(0).gw * cell, ph = PER(0).gh * cell;
    return `<g transform="translate(${f1(site.x)},${f1(site.y)}) scale(${f1(site.face * site.s)},${f1(site.s)}) translate(${f1(-pw / 2)},${f1(-ph)})"${extra}>${inner}</g>`;
  }
  function perchedSprite(site, cell, o = {}) {
    const sit = posePaths(PER(0), cell);
    const sing = posePaths(PER(2), cell);
    const preen = posePaths(PER(1), cell);
    const idleDur = rnd(17, 31);
    const t1 = rnd(0.3, 0.44), t2 = t1 + rnd(0.05, 0.1), t3 = t2 + rnd(0.05, 0.12);
    const idle = o.idle === false ? "" :
      `<animate attributeName="opacity" values="1;1;0;0;1;1" keyTimes="0;${f2(t1)};${f2(t1 + 0.01)};${f2(t2)};${f2(t2 + 0.01)};1" dur="${f2(idleDur)}s" repeatCount="indefinite"/>`;
    const idle2 = o.idle === false ? "" :
      `<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${f2(t1)};${f2(t1 + 0.01)};${f2(t2)};${f2(t2 + 0.01)};1" dur="${f2(idleDur)}s" repeatCount="indefinite"/>`;
    const idle3 = o.idle === false ? "" :
      `<animate attributeName="opacity" values="0;0;0;0;1;1;0;0" keyTimes="0;${f2(t2)};${f2(t2 + 0.01)};${f2(t3)};${f2(t3 + 0.01)};${f2(t3 + 0.08)};${f2(t3 + 0.09)};1" dur="${f2(idleDur)}s" repeatCount="indefinite"/>`;
    /* a small tail flick / body shift while sitting */
    const flick = o.idle === false ? "" :
      `<animateTransform attributeName="transform" type="rotate" values="0;0;-5;4;0;0" keyTimes="0;${f2(t1)};${f2(t1 + 0.02)};${f2(t1 + 0.05)};${f2(t1 + 0.08)};1" dur="${f2(idleDur)}s" repeatCount="indefinite" additive="sum"/>`;
    return `<g>${flick}<g opacity="1">${sit}${idle}</g><g opacity="0">${sing}${idle2}</g><g opacity="0">${preen}${idle3}</g></g>`;
  }

  function buildPercher(site, part) {
    const cell = 1.15 * site.s;
    const { filt, op } = depthAttrs(site.s, 0);
    const takeOff = chance(0.3);
    const T = rnd(22, 55);
    let inner = `<g>${perchedSprite(site, cell, {})}`;
    if (takeOff) inner += `<set attributeName="opacity" to="0" begin="${f2(T)}s"/>`;
    inner += `</g>`;
    let out = `<g opacity="${op}"${filt}>` + perchWrap(site, cell, inner);
    if (takeOff) {
      /* the same bird leaves: a short flap run off screen */
      const dir = site.face * (chance(0.7) ? -1 : 1);
      const y0 = site.y - 8;
      const d = `M${site.x},${y0} C ${site.x + dir * 60},${y0 - 40} ${site.x + dir * 160},${y0 - 90} ${dir === 1 ? 1440 : -160},${rnd(60, 200)}`;
      out += `<g opacity="0"${filt}><set attributeName="opacity" to="${op}" begin="${f2(T)}s"/>
        <g><animateMotion path="${d}" dur="${f2(rnd(7, 11))}s" begin="${f2(T)}s" rotate="auto" fill="freeze"/>
        <g transform="scale(${f2(dir * site.s)},${f2(site.s)}) translate(${f1(-12 * cell)},${f1(-14 * cell)})">${wingSprite(cell, "flapper", 0.4)}</g></g></g>`;
    }
    return out + "</g>";
  }

  /* a flyer that lands: built from the group loop with o.land set */
  function buildLander(site, dir) {
    return buildFlyer({
      lane: 1, dir: -dir || 1, acro: chance(0.3), land: site,
      style: "flapper", scaleMul: 0.9 / site.s * site.s, speedMul: 0.8, stag: rnd(0, 200), ph: rnd(0, 6),
    });
  }

  /* ------------------------------------------------------------------
     9c. yard foragers: a hop-stop-peck life on the ground near the steps
  ------------------------------------------------------------------ */
  function buildForager(site) {
    const cell = 1.15 * site.s;
    const { filt, op } = depthAttrs(site.s * 0.72, 40);
    const qa = typeof window !== "undefined" && window.__QA__;
    const hops = ri(4, 7);
    let d = `M${f1(site.x)},${f1(site.y)}`;
    for (let i = 0; i < hops; i++) {
      d += ` q ${f1(rnd(7, 13) * site.face)},${f1(-rnd(6, 11))} ${f1(rnd(14, 26) * site.face)},0`;
    }
    const kps = ["0"], kts = ["0"];
    for (let i = 0; i < hops; i++) {
      kps.push(f2((i + 1) / hops), f2((i + 1) / hops));
      kts.push(f2((i + 0.35) / hops), f2((i + 1) / hops));
    }
    const dur = rnd(9, 16);
    const park = qa ? ` transform="translate(${f1(site.x)},${f1(site.y)})"` : "";
    const motion = qa ? "" :
      `<animateMotion path="${d}" dur="${f2(dur)}s" calcMode="linear" keyPoints="${kps.join(";")}" keyTimes="${kts.join(";")}" repeatCount="indefinite"/>`;
    const peck = qa ? "" :
      `<animateTransform attributeName="transform" type="rotate" additive="sum" values="0;0;24;2;0;0;28;4;0" keyTimes="0;0.3;0.38;0.44;0.5;0.72;0.8;0.86;1" dur="${f2(rnd(5, 9))}s" repeatCount="indefinite"/>`;
    /* the porch lamp rims them: a static warm stroke, never a fade */
    return `<g opacity="${op}"${filt}>
      <g${park}>
        ${motion}
        <g stroke="#3d3322" stroke-width="${f1(0.5 * site.s)}" transform="scale(${f2(site.face * site.s)},${f2(site.s)}) translate(${f1(-PER(0).gw / 2 * cell)},${f1(-PER(0).gh * cell)})">${peck}${posePaths(PER(3), cell)}</g>
      </g>
    </g>`;
  }

  /* ------------------------------------------------------------------
     10. assemble the three depth parts for a room
  ------------------------------------------------------------------ */
  function part(which) {
    if (!BD || typeof document === "undefined") return "";
    if ((State.get().room || "") !== "porch") return "";
    if (PLAN.quiet) return "";
    const rm = Settings.get("reducedMotion");
    if (rm) {
      /* reduced motion: only the sitting birds, perfectly still */
      if (which === "mid") return `<g id="v_birds-mid">${PLAN.perchRoof.map(s => stillPerch(s)).join("")}</g>`;
      if (which === "front") return `<g id="v_birds-front">${PLAN.perchFront.map(s => stillPerch(s)).join("")}${PLAN.forage.map(s => stillPerch(s)).join("")}</g>`;
      if (which === "back") return `<g id="v_birds-back">${PLAN.perchBack.map(s => stillPerch(s)).join("")}</g>`;
      return "";
    }
    if (which === "back") {
      let out = `<g id="v_birds-back">`;
      PLAN.groups.forEach((g, gi) => {
        if (g.lane !== 0) return;
        for (let i = 0; i < g.size; i++) {
          const off = formationOffset(g.formation, i, g.size, g.dir);
          out += buildFlyer({
            lane: 0, dir: g.dir, acro: g.acro && chance(0.3), dy: off.dy, stag: -off.dx * g.dir + i * 6,
            speedMul: g.speed * rnd(0.94, 1.06), ph: rnd(0, 6), species: g.species,
          });
        }
      });
      /* a murmuration: one body of starlings breathing across the high sky */
      if (PLAN.murm) {
        const m = PLAN.murm;
        for (let i = 0; i < m.size; i++) {
          out += buildFlyer({
            lane: 0, dir: m.dir, species: "starling", acro: false, style: "flapper",
            forceY: m.y + Math.sin(i * 1.7 + m.ph) * 16, dy: rnd(-6, 6),
            stag: (i % 6) * 3, speedMul: m.speed * rnd(0.985, 1.015), ph: m.ph + i * 0.35,
          });
        }
      }
      out += PLAN.perchBack.map(s => buildPercher(s, "back")).join("");
      /* one group sometimes crosses far behind the house, mid lane */
      if (chance(0.5)) {
        const g = PLAN.groups[0];
        if (g && g.lane === 1) {
          for (let i = 0; i < Math.min(3, g.size); i++) {
            out += buildFlyer({ lane: 1, dir: g.dir, acro: false, stag: i * 40, speedMul: g.speed, ph: rnd(0, 6) });
          }
        }
      }
      return out + "</g>";
    }
    if (which === "mid") {
      let out = `<g id="v_birds-mid">`;
      out += PLAN.perchRoof.map(s => buildPercher(s, "mid")).join("");
      /* a lander arrives on the roof once per session, maybe */
      if (chance(0.55) && PLAN.perchRoof.length < PERCH_ROOF.length) {
        const used = new Set(PLAN.perchRoof.map(s => s.x));
        const free = PERCH_ROOF.filter(s => !used.has(s.x));
        if (free.length) out += buildLander(pick(free), chance(0.5) ? 1 : -1);
      }
      return out + "</g>";
    }
    if (which === "front") {
      let out = `<g id="v_birds-front">`;
      PLAN.groups.forEach((g, gi) => {
        if (g.lane !== 2 && g.lane !== 1) return;
        const n = g.lane === 2 ? g.size : Math.min(2, g.size);
        for (let i = 0; i < n; i++) {
          const off = formationOffset(g.formation, i, g.size, g.dir);
          out += buildFlyer({
            lane: g.lane, dir: g.dir, acro: g.acro && chance(0.55), dy: off.dy, stag: -off.dx * g.dir + i * 8,
            speedMul: g.speed * rnd(0.92, 1.1), ph: rnd(0, 6), species: g.species,
          });
        }
      });
      /* soloists: one bird, its own business, maximum acrobatics */
      if (chance(0.6)) {
        out += buildFlyer({ lane: 2, dir: chance(0.5) ? 1 : -1, acro: true, speedMul: rnd(1.1, 1.4), ph: rnd(0, 6) });
      }
      out += PLAN.perchFront.map(s => buildPercher(s, "front")).join("");
      out += PLAN.forage.map(s => buildForager(s)).join("");
      if (chance(0.4)) {
        const used = new Set(PLAN.perchFront.map(s => s.x));
        const free = PERCH_FRONT.filter(s => !used.has(s.x));
        if (free.length) out += buildLander(pick(free), chance(0.5) ? 1 : -1);
      }
      return out + "</g>";
    }
    return "";
  }

  function stillPerch(site) {
    const cell = 1.15 * site.s;
    const { filt, op } = depthAttrs(site.s, 0);
    return `<g opacity="${op}"${filt}>` + perchWrap(site, cell, posePaths(PER(0), cell)) + `</g>`;
  }

  /* ------------------------------------------------------------------
     11. export
  ------------------------------------------------------------------ */
  window.Birds = {
    part,
    _plan: () => ({
      seed: SEED,
      quiet: PLAN.quiet,
      groups: PLAN.groups.map(g => g.size),
      species: PLAN.groups.map(g => g.species),
      lanes: PLAN.groups.map(g => g.lane),
      murm: PLAN.murm ? PLAN.murm.size : 0,
      forage: PLAN.forage.length,
      perchRoof: PLAN.perchRoof.length,
      perchFront: PLAN.perchFront.length,
      perchBack: PLAN.perchBack.length,
    }),
  };
})();
