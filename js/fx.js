/* HOUSE 17 — FX layer: motivated light (cones, slanted pools, motes),
   the fly engine v2 (personal space + states + spatial grid), real rain,
   cobwebs and eight-legged spiders. All hand authored, no canvas.
   See docs/ENVIRONMENTAL_STATE.md (flies/condition) and
   docs/GRAPHICS_PIPELINE.md §debug for the debug overlays. */
"use strict";

const FX = (() => {
  const NS = "http://www.w3.org/2000/svg";
  let raf = null, last = 0;
  let svgEl = null, rect = null;
  let motes = [], flies = [];
  let pointer = { x: -9999, y: -9999, active: false };

  /* ---------------- tiny svg builder ---------------- */
  function mk(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  /* seedable RNG so fly QA is deterministic (FX._setFlySeed) */
  let _seed = 987654321 >>> 0;
  function rnd(a, b) {
    _seed = (_seed * 1664525 + 1013904223) >>> 0;
    return a + (_seed / 4294967296) * (b - a);
  }

  /* ---------------- light definitions per room ----------------
     Every light is a cone (slanted trapezium meeting near the source,
     widening to the floor), a floor pool (slanted parallelogram), and a
     cluster of drifting motes. No oval light shapes anywhere. */
  const LIGHTS = {
    porch: [
      { src: [480, 328], floorY: 552, spread: [380, 600], color: "#e8a04c",
        cone: [[470, 332], [490, 332], [566, 552], [392, 552]],
        pool: [[376, 552], [580, 552], [560, 576], [396, 576]], op: 0.16, poolOp: 0.22, motes: 12 },
    ],
    hallway: [
      { src: [720, 384], floorY: 560, spread: [560, 900], color: "#e8a04c",
        cone: [[706, 382], [736, 382], [820, 566], [600, 566]],
        pool: [[600, 566], [820, 566], [800, 592], [622, 592]], op: 0.14, poolOp: 0.2, motes: 14,
        when: () => State.flag("hallLampOn") === true },
    ],
    kitchen: [
      { src: [640, 96], floorY: 500, spread: [360, 940], color: "#e8a04c",
        cone: [[624, 96], [656, 96], [740, 500], [540, 500]],
        pool: [[540, 500], [740, 500], [720, 528], [560, 528]], op: 0.16, poolOp: 0.22, motes: 16 },
      // moon shaft from the window over the sink, drifting with a cloud shadow
      { src: [640, 160], floorY: 470, spread: [470, 810], color: "#9cc3dc",
        cone: [[608, 152], [672, 152], [760, 470], [520, 470]],
        pool: [[520, 478], [760, 478], [740, 506], [540, 506]], op: 0.1, poolOp: 0.14, motes: 16,
        shadow: { pts: [[560, 478], [720, 478], [710, 506], [570, 506]], drift: 22 , core: false} },
    ],
    diningroom: [
      { src: [640, 130], floorY: 560, spread: [360, 940], color: "#e8c87a",
        cone: [[624, 128], [656, 128], [760, 560], [520, 560]],
        pool: [[520, 560], [760, 560], [736, 588], [544, 588]], op: 0.14, poolOp: 0.2, motes: 14 },
      // dawn window: a slanted shaft of cold light, with a drifting curtain shadow
      { src: [220, 235], floorY: 560, spread: [60, 380], color: "#9fb0c2",
        cone: [[150, 235], [290, 235], [382, 560], [42, 560]],
        pool: [[42, 560], [382, 560], [358, 590], [66, 590]], op: 0.11, poolOp: 0.15, motes: 16,
        shadow: { pts: [[180, 560], [340, 560], [330, 592], [190, 592]], drift: 26 , core: false} },
      /* firelight spilling in from the sitting room doorway */
      { src: [115, 430], floorY: 560, spread: [20, 330], color: "#e8842a",
        cone: [[70, 400], [170, 400], [300, 566], [10, 566]],
        pool: [[10, 566], [300, 566], [280, 592], [26, 592]], op: 0.07, poolOp: 0.09, motes: 6, core: false,
        when: () => !State.flag("roomDeleted_child") },
    ],
    sittingroom: [
      /* the fire itself: warm, breathing, reaching the rug and the sofa */
      { src: [270, 470], floorY: 560, spread: [60, 640], color: "#e8842a",
        cone: [[210, 430], [330, 430], [560, 580], [40, 580]],
        pool: [[40, 580], [560, 580], [520, 610], [70, 610]], op: 0.15, poolOp: 0.2, motes: 10, core: false },
      /* a reading lamp beside the sofa */
      { src: [700, 430], floorY: 560, spread: [600, 830], color: "#e8a04c",
        cone: [[688, 428], [712, 428], [790, 566], [610, 566]],
        pool: [[610, 566], [790, 566], [770, 590], [626, 590]], op: 0.1, poolOp: 0.14, motes: 8,
        when: () => State.flag("sitLampOn") !== false },
    ],
    study: [
      { src: [520, 396], floorY: 560, spread: [330, 720], color: "#e8a04c",
        cone: [[512, 396], [530, 396], [600, 566], [420, 566]],
        pool: [[420, 566], [600, 566], [584, 590], [436, 590]], op: 0.15, poolOp: 0.2, motes: 12,
        when: () => State.flag("studyLampOn") !== false },
    ],
    landing: [
      { src: [650, 130], floorY: 492, spread: [430, 900], color: "#f2e3b8",
        cone: [[632, 128], [668, 128], [760, 500], [540, 500]],
        pool: [[540, 500], [760, 500], [742, 528], [558, 528]], op: 0.12, poolOp: 0.16, motes: 12 , core: false},
    ],
    gallery: [
      { src: [660, 150], floorY: 470, spread: [470, 860], color: "#9cc3dc",
        cone: [[600, 150], [720, 150], [800, 470], [520, 470]],
        pool: [[520, 476], [800, 476], [780, 504], [540, 504]], op: 0.09, poolOp: 0.12, motes: 10, core: false },
      { src: [1060, 476], floorY: 520, spread: [940, 1200], color: "#e8c87a",
        cone: [[1000, 476], [1120, 476], [1180, 560], [960, 560]],
        pool: [[960, 560], [1180, 560], [1160, 586], [980, 586]], op: 0.08, poolOp: 0.1, motes: 6, core: false },
    ],
    childroom: [
      { src: [1010, 120], floorY: 500, spread: [780, 1230], color: "#7fa8c9",
        cone: [[996, 118], [1024, 118], [1090, 500], [930, 500]],
        pool: [[930, 500], [1090, 500], [1070, 526], [950, 526]], op: 0.08, poolOp: 0.1, motes: 8, core: false },
    ],
    basement: [
      { src: [640, 126], floorY: 500, spread: [300, 980], color: "#e8a04c",
        cone: [[624, 126], [656, 126], [740, 500], [540, 500]],
        pool: [[540, 500], [740, 500], [720, 528], [560, 528]], op: 0.13, poolOp: 0.18, motes: 12,
        when: () => !!State.flag("basementPower") },
      // the open hatch above: daylight shaft falling down into the dark
      { src: [130, 0], floorY: 500, spread: [60, 220], color: "#a8c8da",
        cone: [[60, 0], [220, 0], [300, 500], [0, 500]],
        pool: [[0, 500], [300, 500], [286, 528], [16, 528]], op: 0.1, poolOp: 0.14, motes: 18 , core: false},
    ],
    memory: [
      { src: [640, 158], floorY: 500, spread: [360, 940], color: "#e8a04c",
        cone: [[624, 158], [656, 158], [740, 500], [540, 500]],
        pool: [[540, 500], [740, 500], [720, 528], [560, 528]], op: 0.12, poolOp: 0.18, motes: 12 },
    ],
    attic: [],
    bathroom: [
      { src: [1012, 152], floorY: 600, spread: [780, 1180], color: "#a8c8da",
        cone: [[880, 190], [1080, 190], [1180, 600], [780, 600]],
        pool: [[780, 600], [1180, 600], [1150, 632], [812, 632]], op: 0.07, poolOp: 0.09, motes: 8, core: false },
      { src: [40, 470], floorY: 560, spread: [0, 260], color: "#9cc3dc",
        cone: [[0, 470], [80, 470], [220, 560], [0, 560]],
        pool: [[0, 560], [220, 560], [200, 584], [0, 584]], op: 0.05, poolOp: 0.06, motes: 4, core: false },
    ],
    conservatory: [
      { src: [985, 84], floorY: 560, spread: [760, 1210], color: "#a8c8da",
        cone: [[972, 86], [1000, 86], [1110, 566], [860, 566]],
        pool: [[860, 566], [1110, 566], [1090, 596], [884, 596]], op: 0.08, poolOp: 0.1, motes: 10 , core: false},
    ],
  };

  /* =====================================================================
     FLIES v2 — realistic behaviour with MANDATORY personal space.
     ---------------------------------------------------------------------
     Every fly owns: position, velocity, heading, a padded PERSONAL
     DETECTOR BOX (radius pr), a state, an attractor and, for ~45% of the
     room, a loose flock membership.

     The one absolute: SEPARATION ALWAYS BEATS COHESION. Two detector
     regions overlap -> repel; centres may never visually coincide. This
     kills the old single-dot collapse.

     Behaviour states: WANDER, ATTRACTED, DART, PAUSE, LAND, REST,
     DISTURBED. Not every fly is permanently airborne: some land on the
     table, the rubbish, the window sill, rest, then take off again.

     Populations are sane per room (Condition + quality tier) and rolled
     once per session so re-renders never blink them out.
  ===================================================================== */
  const FLY_ROOMS = { hallway: 0.8, kitchen: 0.85, diningroom: 1.0, attic: 0.7, basement: 0.7, study: 0.5, childroom: 0.4, porch: 0.3, conservatory: 0.55, gallery: 0.5, bathroom: 0.3, sittingroom: 0.18 };
  const FLY_COUNTS = {
    diningroom: [26, 34], kitchen: [14, 20], attic: [14, 20], basement: [12, 18],
    hallway: [8, 14], study: [7, 11], conservatory: [8, 12], childroom: [5, 9],
    porch: [6, 10], gallery: [6, 10], bathroom: [4, 8], sittingroom: [3, 6],
  };
  const flyRoll = {};
  function flyMultiplier(room) {
    if (flyRoll[room] == null) {
      const r = Math.random();
      flyRoll[room] = room === "diningroom"
        ? 0.9 + r * 0.35                     // the rot is always here, in quantity
        : r < 0.25 ? 0.08 + r * 0.68 : r < 0.6 ? 0.35 + r * 0.35 : 0.9 + r * 0.5;
    }
    return flyRoll[room];
  }

  /* places flies want: dirty things (Condition ledger), then warm lights */
  function gatherAttractors(room) {
    const out = [];
    if (typeof Condition !== "undefined") Condition.attractors(room).forEach(a => out.push({ ...a }));
    (LIGHTS[room] || []).forEach(s => {
      if (s.color && s.color.startsWith("#e8") && (!s.when || s.when())) out.push({ x: s.src[0], y: s.src[1] + 30, s: 0.34, id: "light" });
    });
    if (room === "hallway") {
      if (State.flag("mirrorShattered") || State.flag("mirrorCracked")) out.push({ x: 720, y: 256, s: 0.5, id: "mirrorHollow" });
      if (State.flag("mirrorBlood")) out.push({ x: 460, y: 300, s: 0.9, id: "blood" });
    }
    if (!out.length) out.push({ x: 640, y: 240, s: 0.2, id: "room" });
    return out;
  }

  /* landing spots per room (tabletops, sills, rubbish) — deterministic-ish */
  const LAND_SPOTS = {
    diningroom: [[368, 596], [640, 590], [900, 588], [1110, 580], [220, 480]],
    kitchen: [[330, 414], [575, 580], [640, 430], [940, 540], [210, 560]],
    hallway: [[720, 414], [420, 560]],
    study: [[520, 452], [900, 560]],
    attic: [[400, 560], [800, 540]],
    basement: [[640, 520], [300, 540]],
  };

  const flyStore = {};
  let flyDebugEls = [];

  function buildFlyState(room) {
    const attractors = gatherAttractors(room);
    const base = (FLY_COUNTS[room] || [8, 12]);
    let count = Math.max(3, Math.round((base[0] + rnd(0, base[1] - base[0])) * flyMultiplier(room)));
    const q = (typeof Art !== "undefined") ? Art.tier() : "high";
    if (q === "medium") count = Math.max(3, Math.round(count * 0.6));
    if (q === "low") count = Math.max(2, Math.round(count * 0.35));
    const spots = LAND_SPOTS[room] || [[640, 560], [320, 540], [960, 540]];
    const data = [];
    for (let i = 0; i < count; i++) {
      /* weighted attractor pick by strength */
      let tot = 0; attractors.forEach(a => tot += a.s);
      let pick = attractors[0], roll = rnd(0, tot);
      for (const a of attractors) { roll -= a.s; if (roll <= 0) { pick = a; break; } }
      data.push({
        x: rnd(90, 1190), y: rnd(120, 520),
        vx: rnd(-0.3, 0.3), vy: rnd(-0.3, 0.3),
        r: rnd(0.9, 1.5),               // visual size
        pr: rnd(8, 14),                 // personal detector radius (padded)
        phase: rnd(0, Math.PI * 2),
        state: "WANDER", t: rnd(1, 4),
        attract: pick,
        flock: rnd(0, 1) < 0.45,        // 45% loose flock membership
        orbit: rnd(0, Math.PI * 2),
        orbitR: rnd(14, 44),            // each fly circles its OWN point
        home: { x: rnd(140, 1140), y: rnd(140, 500) },
        spot: spots[Math.floor(rnd(0, spots.length))],
        straggler: rnd(0, 1) < 0.2,
        landed: false,
      });
    }
    return { data, attractors };
  }

  const FLY_QA = () => (typeof window !== "undefined" && !!window.__QA__);
  function spawnFlies(room) {
    if ((FLY_QA() ? rnd(0, 1) : Math.random()) > (FLY_ROOMS[room] || 0)) { flies = []; return; }
    const group = svgEl.querySelector("#fx-flies");
    /* populations persist per session; the dining room rebuilds when the
       house tidies (its attractors die and the flies disperse) */
    const sig = room === "diningroom" ? !!State.flag("diningTidied") : 0;
    if (!flyStore[room] || flyStore[room].sig !== sig) {
      flyStore[room] = { sig, ...buildFlyState(room) };
    }
    const st = flyStore[room];
    const reduced = Settings.get("reducedMotion");
    flies = st.data.map(f => {
      /* reduced motion: still flies, pre-separated by construction */
      let fx2 = f.x, fy2 = f.y;
      if (reduced) {
        for (let tries = 0; tries < 24; tries++) {
          fx2 = 80 + ((f.x * 7 + tries * 173) % 1100);
          fy2 = 110 + ((f.y * 11 + tries * 97) % 440);
          if (flies.every(o => Math.hypot(o.x - fx2, o.y - fy2) > 22)) break;
        }
      }
      const el = mk("circle", { class: "fx-fly", cx: fx2, cy: fy2, r: f.r, fill: "#0c0a08", opacity: 0.55 }, group);
      el.style.animationDuration = rnd(0.35, 0.95).toFixed(2) + "s";
      return { el, x: fx2, y: fy2, vx: reduced ? 0 : f.vx, vy: reduced ? 0 : f.vy, r: f.r, pr: f.pr, phase: f.phase, state: reduced ? "REST" : f.state, t: f.t, attract: f.attract, flock: f.flock, orbit: f.orbit, orbitR: f.orbitR, home: f.home, spot: f.spot, straggler: f.straggler, landed: false };
    });
    st.attractors && (flyStore[room].attractors = st.attractors);
  }

  /* spatial hash: a fly only checks its own cell + neighbours */
  const CELL = 34;
  function stepFlies(dt, px, py) {
    if (!flies.length) return;
    const grid = new Map();
    for (let i = 0; i < flies.length; i++) {
      const f = flies[i];
      const key = ((f.x / CELL) | 0) + "," + ((f.y / CELL) | 0);
      const b = grid.get(key); if (b) b.push(i); else grid.set(key, [i]);
    }
    /* flock centres (weak cohesion targets) */
    let fcx = 0, fcy = 0, fn = 0, fvx = 0, fvy = 0;
    for (const f of flies) if (f.flock && !f.landed) { fcx += f.x; fcy += f.y; fvx += f.vx; fvy += f.vy; fn++; }
    if (fn) { fcx /= fn; fcy /= fn; fvx /= fn; fvy /= fn; }

    for (let i = 0; i < flies.length; i++) {
      const f = flies[i];
      if (f.landed) {
        f.t -= dt / 60;
        if (f.t <= 0) {                       // take off with a dart
          f.landed = false; f.state = "DART"; f.t = rnd(0.4, 0.9);
          f.vx = rnd(-1.4, 1.4); f.vy = rnd(-1.6, -0.4);
          f.el.setAttribute("opacity", 0.55);
        } else continue;
      }
      f.phase += 0.05 * dt;

      /* ---- separation from overlapping detector boxes (grid lookup) ---- */
      const gx = (f.x / CELL) | 0, gy = (f.y / CELL) | 0;
      let sepX = 0, sepY = 0;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const bucket = grid.get((gx + ox) + "," + (gy + oy));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j === i) continue;
          const o = flies[j]; // landed neighbours still occupy their spot
          const dx = f.x - o.x, dy = f.y - o.y;
          const min = f.pr + o.pr;
          const d2 = dx * dx + dy * dy;
          if (d2 < min * min && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const push = (min - d) / min;                 // 0..1 overlap
            const k = push > 0.5 ? 0.5 : 0.22;            // severe overlap: harder turn
            sepX += (dx / d) * push * k; sepY += (dy / d) * push * k;
          }
        }
      }
      f.vx += sepX * dt; f.vy += sepY * dt;

      /* ---- state machine ---- */
      f.t -= dt / 60;
      if (f.t <= 0) {
        const roll = FLY_QA() ? rnd(0, 1) : Math.random();
        if (f.state === "WANDER") {
          if (roll < 0.3 && f.attract) f.state = "ATTRACTED";
          else if (roll < 0.42) f.state = "DART";
          else if (roll < 0.5) { f.state = "LAND"; }
          else if (roll < 0.62) f.state = "PAUSE";
          f.t = rnd(1.2, 3.4);
        } else if (f.state === "ATTRACTED") {
          f.orbit += rnd(-1.2, 1.2);
          f.t = rnd(1.5, 4);
          if (roll < 0.25) f.state = "WANDER";
        } else if (f.state === "DART") { f.state = "WANDER"; f.t = rnd(1, 3); }
        else if (f.state === "PAUSE") { f.state = "WANDER"; f.t = rnd(1, 3); }
        else if (f.state === "LAND") {
          f.landed = true; f.state = "REST"; f.t = rnd(2, 9);
          /* a resting fly still keeps personal space: pick a free spot */
          let lx = f.spot[0] + rnd(-14, 14), ly = f.spot[1] + rnd(-6, 6);
          for (let tries = 0; tries < 8; tries++) {
            let clear = true;
            for (const o of flies) if (o !== f && o.landed && Math.hypot(o.x - lx, o.y - ly) < 7) { clear = false; break; }
            if (clear) break;
            lx = f.spot[0] + rnd(-16, 16); ly = f.spot[1] + rnd(-8, 8);
          }
          f.x = lx; f.y = ly;
          f.vx = 0; f.vy = 0;
          f.el.setAttribute("cx", f.x.toFixed(1)); f.el.setAttribute("cy", f.y.toFixed(1));
          f.el.setAttribute("opacity", 0.75);
          continue;
        }
      }

      /* ---- steering per state ---- */
      if (f.state === "ATTRACTED" && f.attract && !f.straggler) {
        /* circle a personal offset point near the attractor — they gather,
           they never converge to one dot */
        f.orbit += 0.03 * dt;
        const tx = f.attract.x + Math.cos(f.orbit) * f.orbitR;
        const ty = f.attract.y + Math.sin(f.orbit * 0.8) * f.orbitR * 0.6;
        f.vx += (tx - f.x) * 0.0022 * dt;
        f.vy += (ty - f.y) * 0.0022 * dt;
      } else if (f.state === "DART") {
        if (Math.hypot(f.vx, f.vy) < 0.5) { const a = rnd(0, Math.PI * 2); f.vx = Math.cos(a) * 1.8; f.vy = Math.sin(a) * 1.2; }
      } else if (f.state === "PAUSE") {
        f.vx *= 0.86; f.vy *= 0.86;
      } else { /* WANDER around home */
        f.vx += Math.sin(f.phase) * 0.02 * dt + (f.home.x - f.x) * 0.00035 * dt;
        f.vy += Math.cos(f.phase * 0.7) * 0.02 * dt + (f.home.y - f.y) * 0.00035 * dt;
      }

      /* ---- loose flocking for the 45%: weak cohesion, weaker alignment ---- */
      if (f.flock && fn > 1 && f.state !== "DART") {
        const dcx = fcx - f.x, dcy = fcy - f.y, dc = Math.hypot(dcx, dcy);
        if (dc > 90) { f.vx += (dcx / dc) * 0.028 * dt; f.vy += (dcy / dc) * 0.028 * dt; }
        f.vx += (fvx - f.vx) * 0.006 * dt; f.vy += (fvy - f.vy) * 0.006 * dt;
      }

      /* ---- avoid the cursor ---- */
      const dxc = f.x - px, dyc = f.y - py, d2c = dxc * dxc + dyc * dyc;
      if (px > -999 && d2c < 110 * 110 && d2c > 0.01) {
        const d = Math.sqrt(d2c), push = (110 - d) * 0.09 * dt;
        f.vx += (dxc / d) * push; f.vy += (dyc / d) * push;
        if (f.state === "PAUSE") { f.state = "DART"; f.t = 0.6; }
      }

      f.vx *= 0.965; f.vy *= 0.965;
      const sp = Math.hypot(f.vx, f.vy);
      const max = f.state === "DART" ? 2.4 : 1.15;
      if (sp > max) { f.vx = f.vx / sp * max; f.vy = f.vy / sp * max; }

      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < 30) f.vx += 0.15; if (f.x > 1250) f.vx -= 0.15;
      if (f.y < 60) f.vy += 0.15; if (f.y > 660) f.vy -= 0.15;
      f.el.setAttribute("cx", f.x.toFixed(1)); f.el.setAttribute("cy", f.y.toFixed(1));
    }
  }

  /* QA hooks: measure the population; used by scripts/qa/fly_sim.js */
  function flyStats() {
    if (!flies.length) return { count: 0, minDist: Infinity, bboxArea: 0, landed: 0 };
    let minD = Infinity, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, landed = 0;
    for (let i = 0; i < flies.length; i++) {
      const f = flies[i]; if (f.landed) landed++;
      minX = Math.min(minX, f.x); maxX = Math.max(maxX, f.x);
      minY = Math.min(minY, f.y); maxY = Math.max(maxY, f.y);
      for (let j = i + 1; j < flies.length; j++) {
        const o = flies[j];
        const d = Math.hypot(f.x - o.x, f.y - o.y);
        if (d < minD) minD = d;
      }
    }
    return { count: flies.length, minDist: minD, bboxArea: (maxX - minX) * (maxY - minY), landed };
  }

  /* ---------------- rain (real falling drops, behind the glass) ----------------
     The child room's window looks out on a generated night garden. The rain
     lives INSIDE a clip of the window glass, so not one drop can fall into
     the room. Drops are small and varied on purpose: most are short straight
     sticks, some lean a little this way or that, some are only dots, and
     every size is rolled individually. Each stick is stroked with a vertical
     gradient that fades at its top: a cheap fake motion blur that reads as a
     drop moving fast without a blur filter's frame cost. */
  const RAIN_CLIP = { x: 905, y: 125, w: 210, h: 180 };

  function buildRain() {
    const group = svgEl.querySelector("#fx-rain");
    const defs = svgEl.querySelector("defs") || mk("defs", {}, svgEl);
    if (!svgEl.querySelector("#fxraingrad")) {
      const g = mk("linearGradient", { id: "fxraingrad", x1: "0", y1: "0", x2: "0", y2: "1" }, defs);
      mk("stop", { offset: "0", "stop-color": "#dcecf6", "stop-opacity": "0" }, g);
      mk("stop", { offset: "0.35", "stop-color": "#cfe4f0", "stop-opacity": "0.8" }, g);
      mk("stop", { offset: "1", "stop-color": "#bfe0f2", "stop-opacity": "0.2" }, g);
    }
    const clipId = "fxrainclip";
    if (!svgEl.querySelector("#" + clipId)) {
      /* four panes, not one rectangle: a drop passing a mullion is hidden by
         it for a moment, exactly as real rain behind a window is */
      const cp = mk("clipPath", { id: clipId }, defs);
      const mx = 1006.5, mx2 = 1013.5, my = 211.5, my2 = 218.5;
      const x2 = RAIN_CLIP.x + RAIN_CLIP.w, y2 = RAIN_CLIP.y + RAIN_CLIP.h;
      [[RAIN_CLIP.x, RAIN_CLIP.y, mx, my], [mx2, RAIN_CLIP.y, x2, my],
       [RAIN_CLIP.x, my2, mx, y2], [mx2, my2, x2, y2]].forEach(r =>
        mk("rect", { x: r[0], y: r[1], width: r[2] - r[0], height: r[3] - r[1] }, cp));
    }
    const inner = mk("g", { "clip-path": "url(#" + clipId + ")" }, group);

    if (Settings.get("reducedMotion")) {
      for (let i = 0; i < 26; i++) {
        const x = RAIN_CLIP.x + 6 + (i % 13) * 16, y = RAIN_CLIP.y + 8 + (i % 7) * 24;
        if (i % 5 === 4) mk("circle", { cx: x, cy: y, r: 0.8, fill: "#cfe4f0", opacity: 0.35 }, inner);
        else mk("line", { x1: x, y1: y, x2: x + (i % 7 === 0 ? 2 : 0), y2: y + 9, stroke: "url(#fxraingrad)", "stroke-width": 0.9, opacity: 0.5 }, inner);
      }
      return;
    }

    const fall = (el, dur, begin, dx) => {
      mk("animateTransform", {
        attributeName: "transform", type: "translate",
        values: `0,-26;${dx},${RAIN_CLIP.h + 30}`,
        dur: dur + "s", begin: begin + "s", repeatCount: "indefinite",
      }, el);
    };

    const drop = (x, y, dx, dy, w, o) => {
      const g = mk("g", {}, inner);
      mk("line", { x1: x, y1: y, x2: x + dx, y2: y + dy, stroke: "#d5e8f4", "stroke-width": w, opacity: o, "stroke-linecap": "round" }, g);
      mk("line", { x1: x - dx * 0.9, y1: y - dy * 0.9, x2: x, y2: y, stroke: "#d5e8f4", "stroke-width": w * 0.6, opacity: o * 0.32, "stroke-linecap": "round" }, g);
      return g;
    };

    let i = 0;
    const roll = () => (i++ % 10);
    for (let n = 0; n < 52; n++) {
      const x = RAIN_CLIP.x + rnd(2, RAIN_CLIP.w - 2);
      const y = RAIN_CLIP.y + rnd(-6, RAIN_CLIP.h * 0.55);
      const kind = roll();
      const dur = rnd(1.15, 1.9), begin = -rnd(0, 2);
      if (kind < 2) {
        const g = mk("g", {}, inner);
        mk("circle", { cx: x, cy: y, r: rnd(0.5, 1.0), fill: "#d5e8f4", opacity: rnd(0.3, 0.55) }, g);
        mk("line", { x1: x, y1: y - rnd(2.5, 5), x2: x, y2: y - 1, stroke: "#d5e8f4", "stroke-width": 0.5, opacity: 0.18 }, g);
        fall(g, dur, begin, rnd(-2, 2));
      } else if (kind < 4) {
        const len = rnd(6, 14), ang = rnd(6, 18) * (n % 2 ? 1 : -1);
        const rad = ang * Math.PI / 180;
        const g = drop(x, y, Math.sin(rad) * len, Math.cos(rad) * len, rnd(0.5, 1.0), rnd(0.35, 0.62));
        fall(g, dur, begin, rnd(-4, 4));
      } else {
        const len = rnd(5, 13);
        const g = drop(x, y, 0, len, rnd(0.5, 1.1), rnd(0.35, 0.68));
        fall(g, dur, begin, rnd(-2, 2));
      }
    }

    /* white fog: three slow puffs lying over the garden outside */
    for (let k = 0; k < 3; k++) {
      const w = mk("ellipse", {
        cx: RAIN_CLIP.x + rnd(0, RAIN_CLIP.w), cy: RAIN_CLIP.y + RAIN_CLIP.h - rnd(18, 52),
        rx: rnd(34, 62), ry: rnd(7, 12), fill: "#e8f0f6", opacity: rnd(0.05, 0.09), filter: "url(#fxblur8)",
      }, inner);
      mk("animateTransform", {
        attributeName: "transform", type: "translate",
        values: "0,0;" + rnd(26, 46).toFixed(0) + ",0;0,0", dur: rnd(34, 52).toFixed(0) + "s", repeatCount: "indefinite",
      }, w);
      mk("animate", { attributeName: "opacity", values: "0.05;0.1;0.05", dur: rnd(18, 30).toFixed(0) + "s", repeatCount: "indefinite" }, w);
    }
  }

  /* ---------------- cobwebs + spiders ----------------
     Webs only where neglect would realistically produce them (attic,
     basement, the opened linen closet). Spiders are anatomically coherent:
     cephalothorax + abdomen + EIGHT jointed legs. */
  function buildCobwebs(room) {
    const group = svgEl.querySelector("#fx-cobwebs");
    const web = (x, y, s, seed = 1) => {
      const g = mk("g", { class: "fx-web", opacity: 0.16 });
      /* radial threads from the anchor, then a sagging spiral */
      let radials = "";
      for (let i = 0; i < 5; i++) {
        const a = (0.2 + i * 0.16) * Math.PI;
        radials += `M${x},${y} L${(x + Math.cos(a) * s * 1.3).toFixed(1)},${(y + Math.sin(a) * s * 1.1).toFixed(1)} `;
      }
      mk("path", { d: radials, fill: "none", stroke: "#cfc9bc", "stroke-width": 0.7 }, g);
      mk("path", { d: `M${x},${y} q${-s},${s * 0.4} ${-s * 1.2},${s} M${x},${y} q${s},${s * 0.4} ${s * 1.2},${s}`, fill: "none", stroke: "#cfc9bc", "stroke-width": 0.8 }, g);
      mk("path", { d: `M${x - s * 0.5},${y + s * 0.42} q${s * 0.2},${s * 0.2 + (seed % 3)} ${s * 0.5},0 M${x - s * 0.9},${y + s * 0.75} q${s * 0.3},${s * 0.2} ${s * 0.6},0 M${x + s * 0.2},${y + s * 0.6} q${s * 0.3},${s * 0.16} ${s * 0.62},-0.05`, fill: "none", stroke: "#cfc9bc", "stroke-width": 0.7 }, g);
      return g;
    };
    const spider = (x, y) => {
      const g = mk("g", { class: "fx-spider" });
      const inner = mk("g", {}, g);
      /* abdomen + cephalothorax */
      mk("ellipse", { cx: x, cy: y, rx: 2.6, ry: 1.9, fill: "#171210" }, inner);
      mk("circle", { cx: x, cy: y - 2, r: 1.15, fill: "#0c0a08" }, inner);
      mk("circle", { cx: x - 0.4, cy: y - 2.3, r: 0.28, fill: "#8a9094", opacity: 0.8 }, inner);
      /* eight jointed legs: four a side, two segments each, uneven pose */
      const legs = [[-1, -0.9], [-1.25, -0.3], [-1.2, 0.35], [-0.85, 0.9], [1, -0.9], [1.25, -0.3], [1.2, 0.35], [0.85, 0.9]];
      legs.forEach(([dx, dy], i) => {
        const kx = x + dx * 2.1, ky = y - 1 + dy * 1.6 - 0.8;
        const fx = x + dx * 4.1, fy = y - 1 + dy * 3.1 + (i % 2 ? 0.5 : 0);
        mk("path", { d: `M${x + dx * 0.6},${y - 1.2} L${kx.toFixed(1)},${ky.toFixed(1)} L${fx.toFixed(1)},${fy.toFixed(1)}`, fill: "none", stroke: "#171210", "stroke-width": 0.55 }, inner);
      });
      if (!Settings.get("reducedMotion")) {
        /* tiny leg repositioning: a small shift, a long stillness */
        mk("animateTransform", { attributeName: "transform", type: "translate", values: "0,0;0.8,0.6;0.8,0.6;0,0;0,0", keyTimes: "0;0.06;0.1;0.16;1", dur: `${rnd(9, 16).toFixed(0)}s`, repeatCount: "indefinite" }, inner);
      }
      return g;
    };
    if (room === "landing" && State.flag("closetOpen")) {
      group.appendChild(web(980, 200, 40, 2));
      group.appendChild(web(1020, 260, 30, 5));
      group.appendChild(spider(990, 235));
    }
    if (room === "attic") { group.appendChild(web(180, 240, 70, 3)); group.appendChild(web(360, 200, 50, 8)); group.appendChild(spider(210, 300)); }
    if (room === "basement") { group.appendChild(web(70, 120, 60, 4)); group.appendChild(web(240, 90, 44, 9)); group.appendChild(spider(90, 150)); }
  }

  /* ---------------- debug overlay (fly detectors + attractors) ---------- */
  function buildDebug() {
    const fx = svgEl.querySelector("#fx-root");
    let d = svgEl.querySelector("#fx-debug");
    if (d) d.remove();
    flyDebugEls = [];
    const wantD = typeof Debug !== "undefined" && Debug.on("flyDetectors");
    const wantA = typeof Debug !== "undefined" && Debug.on("attractors");
    const wantC = typeof Debug !== "undefined" && Debug.on("dirtyState");
    if (!wantD && !wantA && !wantC) return;
    d = mk("g", { id: "fx-debug", "pointer-events": "none" }, fx);
    const room = fx.dataset.room;
    if ((wantA || wantC) && typeof Condition !== "undefined" && room) {
      Condition.elements(room).forEach(e => {
        const col = e.level === "clean" ? "#3fbf5f" : e.level === "slight" ? "#c9c35f" : e.level === "dirty" ? "#e8942a" : "#e83a2a";
        mk("circle", { cx: e.x, cy: e.y, r: 7, fill: "none", stroke: col, "stroke-width": 1.4, "stroke-dasharray": "3 3" }, d);
        const t = mk("text", { x: e.x + 9, y: e.y - 6, "font-size": 10, fill: col, "font-family": "monospace" }, d);
        t.textContent = `${e.id}:${e.level}`;
      });
    }
    if (wantA && flyStore[room] && flyStore[room].attractors) {
      flyStore[room].attractors.forEach(a => {
        mk("path", { d: `M${a.x - 6},${a.y} L${a.x + 6},${a.y} M${a.x},${a.y - 6} L${a.x},${a.y + 6}`, stroke: "#ff5df0", "stroke-width": 1.4 }, d);
        const t = mk("text", { x: a.x + 8, y: a.y + 12, "font-size": 10, fill: "#ff5df0", "font-family": "monospace" }, d);
        t.textContent = `att ${a.s.toFixed(2)}`;
      });
    }
    if (wantD) flyDebugEls = flies.map(f => mk("circle", { cx: f.x, cy: f.y, r: f.pr, fill: "none", stroke: "#00e5ff", "stroke-width": 0.8, opacity: 0.6 }, d));
  }

  /* ---------------- mount / unmount ---------------- */
  function apply(holder, room) {
    svgEl = holder.querySelector("svg");
    if (!svgEl) return;
    rect = svgEl.getBoundingClientRect();
    motes = []; flies = [];

    let fx = svgEl.querySelector("#fx-root");
    if (!fx) {
      fx = mk("g", { id: "fx-root", "pointer-events": "none" });
      const hs = svgEl.querySelector("#hotspots");
      if (hs) svgEl.insertBefore(fx, hs); else svgEl.appendChild(fx);
    }
    fx.dataset.room = room;
    fx.innerHTML = "";
    mk("g", { id: "fx-lights" }, fx);
    mk("g", { id: "fx-cobwebs" }, fx);
    mk("g", { id: "fx-rain" }, fx);
    mk("g", { id: "fx-flies" }, fx);

    buildLights(room);
    buildCobwebs(room);
    if (room === "childroom") buildRain();
    spawnFlies(room);
    buildDebug();

    syncLabels();
    start();
  }

  function lightLayer(spec, i) {
    const g = mk("g", { class: "fx-light", "data-fx": "light" });
    const fl = "url(#fxblur8)";
    const gradId = "fxcone" + i;
    const poolId = "fxpool" + i;

    const cg = mk("linearGradient", { id: gradId, x1: "0", y1: "0", x2: "0", y2: "1" });
    mk("stop", { offset: "0", "stop-color": spec.color, "stop-opacity": "0.85" }, cg);
    mk("stop", { offset: "0.5", "stop-color": spec.color, "stop-opacity": "0.32" }, cg);
    mk("stop", { offset: "1", "stop-color": spec.color, "stop-opacity": "0" }, cg);
    g.appendChild(cg);

    const pg = mk("linearGradient", { id: poolId, x1: "0", y1: "0", x2: "1", y2: "0" });
    mk("stop", { offset: "0", "stop-color": spec.color, "stop-opacity": "0" }, pg);
    mk("stop", { offset: "0.5", "stop-color": spec.color, "stop-opacity": "0.9" }, pg);
    mk("stop", { offset: "1", "stop-color": spec.color, "stop-opacity": "0" }, pg);
    g.appendChild(pg);

    const flick = spec.color === "#e8842a" ? 0.55 : 0.72;  // firelight breathes harder
    const cone = mk("polygon", {
      points: spec.cone.map(p => p.join(",")).join(" "),
      fill: "url(#" + gradId + ")", filter: fl, opacity: spec.op, "mix-blend-mode": "screen",
    }, g);
    mk("animate", { attributeName: "opacity", values: `${spec.op};${spec.op * flick};${spec.op * 0.9};${spec.op}`, dur: `${rnd(spec.color === "#e8842a" ? 1.6 : 4, spec.color === "#e8842a" ? 3 : 8)}s`, repeatCount: "indefinite" }, cone);
    mk("animateTransform", { attributeName: "transform", type: "translate", values: "0,0;-6,0;0,0;6,0;0,0", dur: `${rnd(9, 16)}s`, repeatCount: "indefinite" }, cone);

    const pool = mk("polygon", {
      points: spec.pool.map(p => p.join(",")).join(" "),
      fill: "url(#" + poolId + ")", filter: "url(#fxblur10)", opacity: spec.poolOp, "mix-blend-mode": "screen",
    }, g);
    mk("animate", { attributeName: "opacity", values: `${spec.poolOp};${spec.poolOp * 0.7};${spec.poolOp}`, dur: `${rnd(5, 9)}s`, repeatCount: "indefinite" }, pool);

    if (spec.shadow) {
      const sh = mk("polygon", {
        points: spec.shadow.pts.map(p => p.join(",")).join(" "),
        fill: "#0a0c10", filter: "url(#fxblur8)", opacity: 0.22,
      }, g);
      const d = spec.shadow.drift || 20;
      mk("animateTransform", { attributeName: "transform", type: "translate", values: `0,0;${d},0;0,0;-${d},0;0,0`, dur: `${rnd(11, 18)}s`, repeatCount: "indefinite" }, sh);
    }

    if (spec.core === false) return g;
    const core = mk("polygon", {
      points: `${spec.src[0] - 5},${spec.src[1] - 4} ${spec.src[0] + 5},${spec.src[1] - 4} ${spec.src[0] + 4},${spec.src[1] + 5} ${spec.src[0] - 4},${spec.src[1] + 5}`,
      fill: "#ffd894", filter: "url(#fxblur8)", opacity: 0.55,
    }, g);
    mk("animate", { attributeName: "opacity", values: "0.55;0.42;0.52;0.55", dur: `${rnd(3, 6)}s`, repeatCount: "indefinite" }, core);

    const n = spec.motes || 10;
    const bx = Math.min(spec.cone[0][0], spec.cone[3][0]);
    const bw = Math.max(spec.cone[1][0], spec.cone[2][0]) - bx;
    const by = Math.min(spec.cone[0][1], spec.cone[1][1]);
    const bh = Math.max(spec.cone[2][1], spec.cone[3][1]) - by;
    for (let k = 0; k < n; k++) {
      const mx = bx + rnd(0, bw), my = by + rnd(0, bh), o = rnd(0.2, 0.7);
      const m = mk("circle", {
        class: "fx-mote", cx: mx, cy: my,
        r: rnd(0.7, 1.5), fill: spec.color, opacity: o, filter: "url(#fxblur2)",
      }, g);
      motes.push({
        el: m, x0: mx, y0: my, x: mx, y: my,
        ph: rnd(0, Math.PI * 2), sp: rnd(0.12, 0.34), amp: rnd(3, 8), up: rnd(0.08, 0.2), o,
      });
    }
    return g;
  }

  function buildLights(room) {
    const root = svgEl.querySelector("#fx-lights");
    (LIGHTS[room] || []).forEach((spec, i) => {
      if (spec.when && !spec.when()) return;
      root.appendChild(lightLayer(spec, i));
    });
  }

  /* ---------------- animation loop ---------------- */
  function start() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  let fxFrame = 0;
  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(40, t - last) / 16.6; last = t;
    fxFrame++;
    const half = fxFrame & 1;

    let px = -9999, py = -9999;
    if (pointer.active && rect) {
      const sx = 1280 / rect.width, sy = 720 / rect.height;
      px = (pointer.x - rect.left) * sx; py = (pointer.y - rect.top) * sy;
    }

    for (let mi = 0; mi < motes.length; mi++) {
      const m = motes[mi];
      if ((mi & 1) !== half) continue;
      m.ph += 0.008 * dt; m.y -= m.up * dt;
      m.x = m.x0 + Math.sin(m.ph) * m.amp;
      if (m.y < m.y0 - 40) { m.y = m.y0; m.x0 = m.x; m.ph = rnd(0, Math.PI * 2); }
      m.el.setAttribute("cx", m.x.toFixed(1)); m.el.setAttribute("cy", m.y.toFixed(1));
    }

    if (!Settings.get("reducedMotion") && (typeof AnimReg === "undefined" || AnimReg.on("flyWander"))) stepFlies(dt, px, py);

    /* keep the detector overlay seated on the flies */
    if (flyDebugEls.length) {
      for (let i = 0; i < flyDebugEls.length && i < flies.length; i++) {
        flyDebugEls[i].setAttribute("cx", flies[i].x.toFixed(1));
        flyDebugEls[i].setAttribute("cy", flies[i].y.toFixed(1));
      }
    }
  }

  function trackPointer() {
    window.addEventListener("pointermove", e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; }, { passive: true });
    window.addEventListener("pointerdown", e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; }, { passive: true });
    window.addEventListener("resize", () => { if (svgEl) rect = svgEl.getBoundingClientRect(); });
  }

  function syncLabels() {
    document.body.classList.toggle("labels-on", !!Settings.get("labelsOn"));
  }
  function labelsOn(on) {
    Settings.set("labelsOn", !!on);
    syncLabels();
  }

  return {
    apply, trackPointer, labelsOn,
    _flyMult: (r) => flyMultiplier(r),
    _flyStats: flyStats,
    _flyStateCounts: () => { const o = {}; flies.forEach(f => { o[f.state] = (o[f.state] || 0) + 1; }); return o; },
    _step: (dt, px, py) => stepFlies(dt || 1, px || -9999, py || -9999),
    _setFlySeed: n => { _seed = n >>> 0; },
    _respawn: (room) => { delete flyStore[room]; spawnFlies(room); },
    _attractors: gatherAttractors,
  };
})();
