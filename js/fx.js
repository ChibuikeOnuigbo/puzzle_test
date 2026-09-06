/* HOUSE 17 — FX layer: realistic moving lights (cones, slanted pools, motes),
   smart flies, real rain, cobwebs and spiders. All hand authored, no canvas. */
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
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------------- light definitions per room ----------------
     Every light is a cone (slanted trapezium meeting near the source,
     widening to the floor), a floor pool (slanted parallelogram), and a
     cluster of drifting motes. No oval light shapes anywhere. */
  const LIGHTS = {
    porch: [
      { src: [445, 322], floorY: 552, spread: [250, 620], color: "#e8a04c",
        cone: [[432, 320], [458, 320], [560, 552], [320, 552]],
        pool: [[320, 552], [560, 552], [540, 574], [344, 574]], op: 0.16, poolOp: 0.22, motes: 12 },
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

  /* Flies are everywhere the house is, small and loyal. The dining room
     rots, so it keeps three hundred and more of them to itself; every other
     room keeps its own smaller cloud. Each population is persistent: it is
     built once per room per session, so switching a light on or off (which
     re-renders the room) never makes the flies blink out and back in. */
  const FLY_ROOMS = { hallway: 0.85, kitchen: 0.9, diningroom: 1.0, attic: 0.7, basement: 0.75, study: 0.5, childroom: 0.4, porch: 0.3, conservatory: 0.55, gallery: 0.5, bathroom: 0.3 };
  const FLY_COUNTS = {
    diningroom: [150, 190], kitchen: [70, 95], attic: [55, 80], basement: [50, 75],
    hallway: [40, 64], study: [30, 46], conservatory: [30, 46], childroom: [24, 36], porch: [18, 28], gallery: [24, 36], bathroom: [16, 26],
  };
  /* Every room rolls its own fly population ONCE per session: a quarter of
     rooms come out nearly empty, a third moderate, the rest swarming. Two
     playthroughs of the same house never smell quite the same. */
  const flyRoll = {};
  function flyMultiplier(room) {
    if (flyRoll[room] == null) {
      const r = Math.random();
      flyRoll[room] = room === "diningroom"
        ? rnd(1.0, 1.25)                       // the rot is always here, in quantity
        : r < 0.25 ? rnd(0.08, 0.25) : r < 0.6 ? rnd(0.35, 0.7) : rnd(0.9, 1.4);
    }
    return flyRoll[room];
  }

  /* places flies actually want to be: garbage, spoilt food, open wounds of light */
  const FLY_ATTRACTORS = {
    diningroom: [
      { x: 390, y: 608, when: () => !State.flag("diningTidied") },  // the plate gone bad
      { x: 955, y: 596, when: () => !State.flag("diningTidied") },  // the rubbish bags
      { x: 640, y: 610 },                                            // the laid feast
    ],
    bathroom: [
      { x: 660, y: 450 },    // the warm still water
    ],
    conservatory: [
      { x: 1120, y: 556 },   // the gramophone, still warm
      { x: 640, y: 560 },    // the iron bench
    ],
  };

  /* persistent fly populations, one per room */
  const flyStore = {};

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

    // the beam: slanted trapezium, softened, breathing and drifting
    const cone = mk("polygon", {
      points: spec.cone.map(p => p.join(",")).join(" "),
      fill: "url(#" + gradId + ")", filter: fl, opacity: spec.op, "mix-blend-mode": "screen",
    }, g);
    mk("animate", { attributeName: "opacity", values: `${spec.op};${spec.op * 0.72};${spec.op * 0.9};${spec.op}`, dur: `${rnd(4, 8)}s`, repeatCount: "indefinite" }, cone);
    mk("animateTransform", { attributeName: "transform", type: "translate", values: "0,0;-6,0;0,0;6,0;0,0", dur: `${rnd(9, 16)}s`, repeatCount: "indefinite" }, cone);

    // the floor pool: slanted parallelogram, never an oval
    const pool = mk("polygon", {
      points: spec.pool.map(p => p.join(",")).join(" "),
      fill: "url(#" + poolId + ")", filter: "url(#fxblur10)", opacity: spec.poolOp, "mix-blend-mode": "screen",
    }, g);
    mk("animate", { attributeName: "opacity", values: `${spec.poolOp};${spec.poolOp * 0.7};${spec.poolOp}`, dur: `${rnd(5, 9)}s`, repeatCount: "indefinite" }, pool);

    // an object shadow that slowly slides across the light: keeps the room breathing
    if (spec.shadow) {
      const sh = mk("polygon", {
        points: spec.shadow.pts.map(p => p.join(",")).join(" "),
        fill: "#0a0c10", filter: "url(#fxblur8)", opacity: 0.22,
      }, g);
      const d = spec.shadow.drift || 20;
      mk("animateTransform", { attributeName: "transform", type: "translate", values: `0,0;${d},0;0,0;-${d},0;0,0`, dur: `${rnd(11, 18)}s`, repeatCount: "indefinite" }, sh);
    }

    // a small bright core near the source (small slanted quad, not a circle).
    // window lights pass core:false: moonlight has no fixture to glow from.
    if (spec.core === false) return g;
    const core = mk("polygon", {
      points: `${spec.src[0] - 8},${spec.src[1] - 6} ${spec.src[0] + 8},${spec.src[1] - 7} ${spec.src[0] + 6},${spec.src[1] + 8} ${spec.src[0] - 6},${spec.src[1] + 7}`,
      fill: "#fff7e6", filter: "url(#fxblur4)", opacity: 0.9,
    }, g);
    mk("animate", { attributeName: "opacity", values: "0.9;0.7;0.85;0.9", dur: `${rnd(3, 6)}s`, repeatCount: "indefinite" }, core);

    // drifting dust motes inside the beam
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

  /* ---------------- smart flies (persistent per room) ---------------- */
  function buildFlyState(room) {
    const specs = (LIGHTS[room] || []).map(s => ({ x: s.src[0], y: s.src[1] }));
    // blood / night light / "concentration" attractors: mirror hollow + any blood wall
    if (room === "hallway") {
      if (State.flag("mirrorShattered") || State.flag("mirrorCracked")) specs.push({ x: 720, y: 256 });
      if (State.flag("mirrorBlood")) specs.push({ x: 460, y: 300 });
    }
    (FLY_ATTRACTORS[room] || []).forEach(a => { if (!a.when || a.when()) specs.push({ x: a.x, y: a.y }); });
    if (!specs.length) specs.push({ x: 640, y: 200 });
    const base = (FLY_COUNTS[room] || [20, 30]);
    const count = Math.max(4, Math.round((base[0] + rnd(0, base[1] - base[0])) * flyMultiplier(room)));
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        x: rnd(80, 1200), y: rnd(120, 520),
        vx: rnd(-0.4, 0.4), vy: rnd(-0.4, 0.4),
        ph: rnd(0, Math.PI * 2), r: rnd(0.9, 1.6),
        attract: specs[Math.floor(rnd(0, specs.length))],
        straggler: Math.random() < 0.22,
      });
    }
    return data;
  }

  function spawnFlies(room) {
    if (Settings.get("reducedMotion")) { flies = []; return; }
    if (Math.random() > (FLY_ROOMS[room] || 0)) { flies = []; return; }
    const group = svgEl.querySelector("#fx-flies");
    // a room's flies are built once and kept; only the dining room rebuilds
    // when its mess is tidied away, since the flies lose their shrine.
    const sig = room === "diningroom" ? !!State.flag("diningTidied") : 0;
    if (!flyStore[room] || flyStore[room].sig !== sig) {
      flyStore[room] = { sig, data: buildFlyState(room) };
    }
    const data = flyStore[room].data;
    flies = data.map(f => {
      const el = mk("circle", { class: "fx-fly", cx: f.x, cy: f.y, r: f.r, fill: "#0c0a08", opacity: 0.55 }, group);
      el.style.animationDuration = rnd(0.35, 0.95).toFixed(2) + "s";
      return { el, x: f.x, y: f.y, vx: f.vx, vy: f.vy, ph: f.ph, attract: f.attract, straggler: f.straggler };
    });
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
    /* vertical fade = motion blur on a falling stick */
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

    /* the fall: every drop loops top to bottom of the glass, clipped away at
       both ends so the rain never touches the room */
    const fall = (el, dur, begin, dx) => {
      mk("animateTransform", {
        attributeName: "transform", type: "translate",
        values: `0,-26;${dx},${RAIN_CLIP.h + 30}`,
        dur: dur + "s", begin: begin + "s", repeatCount: "indefinite",
      }, el);
    };

    /* each drop is a small group: a bright head and a fainter, thinner tail
       above it. The tail is the fake motion blur: no filters, no gradients
       (a gradient stroke on a zero width bbox would vanish), just two sticks. */
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
        /* a dot: the smallest rain there is, with a whisper of a tail */
        const g = mk("g", {}, inner);
        mk("circle", { cx: x, cy: y, r: rnd(0.5, 1.0), fill: "#d5e8f4", opacity: rnd(0.3, 0.55) }, g);
        mk("line", { x1: x, y1: y - rnd(2.5, 5), x2: x, y2: y - 1, stroke: "#d5e8f4", "stroke-width": 0.5, opacity: 0.18 }, g);
        fall(g, dur, begin, rnd(-2, 2));
      } else if (kind < 4) {
        /* a leaning stick: a different angle every time, both directions */
        const len = rnd(6, 14), ang = rnd(6, 18) * (n % 2 ? 1 : -1);
        const rad = ang * Math.PI / 180;
        const g = drop(x, y, Math.sin(rad) * len, Math.cos(rad) * len, rnd(0.5, 1.0), rnd(0.35, 0.62));
        fall(g, dur, begin, rnd(-4, 4));
      } else {
        /* a straight stick: most of the rain, short and thin */
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

    /* a small bird that crosses the window now and then */
    const bird = mk("g", { opacity: "0.85" }, inner);
    const bw = mk("g", {}, bird);
    mk("ellipse", { cx: 0, cy: 0, rx: 3.4, ry: 1.7, fill: "#12161c" }, bw);
    mk("circle", { cx: 3.4, cy: -1, r: 1.2, fill: "#12161c" }, bw);
    const wingL = mk("path", { d: "M-0.5,-0.6 q-4,-4 -7,-4.6", stroke: "#12161c", "stroke-width": 1.1, fill: "none" }, bw);
    const wingR = mk("path", { d: "M0.5,-0.6 q4,-4 7,-4.6", stroke: "#12161c", "stroke-width": 1.1, fill: "none" }, bw);
    mk("animateTransform", { attributeName: "transform", type: "rotate", values: "0;-26;0;18;0", dur: "0.5s", repeatCount: "indefinite" }, wingL);
    mk("animateTransform", { attributeName: "transform", type: "rotate", values: "0;26;0;-18;0", dur: "0.5s", repeatCount: "indefinite" }, wingR);
    mk("animateTransform", {
      attributeName: "transform", type: "translate",
      values: `${RAIN_CLIP.x - 20},${RAIN_CLIP.y + 46};${RAIN_CLIP.x - 20},${RAIN_CLIP.y + 46};${RAIN_CLIP.x + RAIN_CLIP.w + 20},${RAIN_CLIP.y + 22};${RAIN_CLIP.x + RAIN_CLIP.w + 20},${RAIN_CLIP.y + 22}`,
      keyTimes: "0;0.62;0.8;1", dur: "19s", repeatCount: "indefinite",
    }, bird);

    /* a drip sliding down the inside of the glass, slowly */
    for (let k = 0; k < 3; k++) {
      const x = 930 + k * 42, d = mk("circle", { cx: x, cy: 140, r: 1.4, fill: "#bfe0f2", opacity: 0.6 }, group);
      mk("animate", { attributeName: "cy", values: "136;300", dur: rnd(3.2, 4.8).toFixed(1) + "s", repeatCount: "indefinite" }, d);
      mk("animate", { attributeName: "opacity", values: "0;0.6;0.6;0", dur: rnd(3.2, 4.8).toFixed(1) + "s", repeatCount: "indefinite" }, d);
    }
  }

  /* ---------------- cobwebs + spiders ---------------- */
  function buildCobwebs(room) {
    const group = svgEl.querySelector("#fx-cobwebs");
    const web = (x, y, s) => {
      const g = mk("g", { class: "fx-web", opacity: 0.16 });
      mk("path", { d: `M${x},${y} q${-s},${s * 0.4} ${-s * 1.2},${s} M${x},${y} q${s},${s * 0.4} ${s * 1.2},${s}`, fill: "none", stroke: "#cfc9bc", "stroke-width": 0.8 }, g);
      mk("path", { d: `M${x - s * 0.5},${y + s * 0.42} q${s * 0.2},${s * 0.2} ${s * 0.5},0 M${x - s * 0.9},${y + s * 0.75} q${s * 0.3},${s * 0.2} ${s * 0.6},0`, fill: "none", stroke: "#cfc9bc", "stroke-width": 0.7 }, g);
      return g;
    };
    const spider = (x, y) => {
      const g = mk("g", { class: "fx-spider" });
      const inner = mk("g", {}, g);
      mk("ellipse", { cx: x, cy: y, rx: 2.4, ry: 1.7, fill: "#171210" }, inner);
      mk("circle", { cx: x, cy: y - 1.7, r: 1.1, fill: "#0c0a08" }, inner);
      for (let i = 0; i < 4; i++) {
        const dx = (i % 2 ? 1 : -1) * 2.6, dy = (i < 2 ? -1 : 1) * 2;
        mk("line", { x1: x + dx * 0.3, y1: y + dy * 0.3, x2: x + dx, y2: y + dy, stroke: "#171210", "stroke-width": 0.7 }, inner);
      }
      if (!Settings.get("reducedMotion")) {
        const a = mk("animateTransform", { attributeName: "transform", type: "translate", values: "0,0;2,2;0,0", dur: `${rnd(3, 6)}s`, repeatCount: "indefinite" }, inner);
      }
      return g;
    };
    if (room === "landing" && State.flag("closetOpen")) {
      group.appendChild(web(980, 200, 40));
      group.appendChild(web(1020, 260, 30));
      group.appendChild(spider(990, 235));
    }
    if (room === "attic") { group.appendChild(web(180, 240, 70)); group.appendChild(web(360, 200, 50)); group.appendChild(spider(210, 300)); }
    if (room === "basement") { group.appendChild(web(70, 120, 60)); group.appendChild(web(240, 90, 44)); group.appendChild(spider(90, 150)); }
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
    fx.innerHTML = "";
    mk("g", { id: "fx-lights" }, fx);
    mk("g", { id: "fx-cobwebs" }, fx);
    mk("g", { id: "fx-rain" }, fx);
    mk("g", { id: "fx-flies" }, fx);

    buildLights(room);
    buildCobwebs(room);
    if (room === "childroom") buildRain();
    spawnFlies(room);

    // room label text: hidden unless the surveyor's lens is found and switched on.
    // The toggle is a body class so the CSS cascade (not inline styles) decides.
    syncLabels();

    start();
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

    // local pointer coords inside the scaled svg
    let px = -9999, py = -9999;
    if (pointer.active && rect) {
      const sx = 1280 / rect.width, sy = 720 / rect.height;
      px = (pointer.x - rect.left) * sx; py = (pointer.y - rect.top) * sy;
    }

    for (let mi = 0; mi < motes.length; mi++) {
      const m = motes[mi];
      if ((mi & 1) !== half) continue;   // motes update in alternating halves
      m.ph += 0.008 * dt; m.y -= m.up * dt;
      m.x = m.x0 + Math.sin(m.ph) * m.amp;
      if (m.y < m.y0 - 40) { m.y = m.y0; m.x0 = m.x; m.ph = rnd(0, Math.PI * 2); }
      m.el.setAttribute("cx", m.x.toFixed(1)); m.el.setAttribute("cy", m.y.toFixed(1));
    }

    for (let fi = 0; fi < flies.length; fi++) {
      const f = flies[fi];
      if ((fi & 1) !== half) continue;   // flies update in alternating halves
      // wander
      f.ph += 0.05 * dt;
      f.vx += Math.sin(f.ph) * 0.02; f.vy += Math.cos(f.ph * 0.7) * 0.02;
      f.vx *= 0.96; f.vy *= 0.96;

      // attract toward light / blood / night light unless it is a straggler
      if (!f.straggler && f.attract) {
        f.vx += (f.attract.x - f.x) * 0.0016 * dt;
        f.vy += (f.attract.y - f.y) * 0.0016 * dt;
      } else if (f.straggler) {
        f.vx += Math.sin(f.ph * 0.5) * 0.03;
      }

      // avoid the cursor
      const dxc = f.x - px, dyc = f.y - py, d2 = dxc * dxc + dyc * dyc;
      if (px > -999 && d2 < 110 * 110 && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (110 - d) * 0.09 * dt;
        f.vx += (dxc / d) * push; f.vy += (dyc / d) * push;
      }

      // speed clamp
      const sp = Math.hypot(f.vx, f.vy);
      const max = f.straggler ? 1.6 : 1.1;
      if (sp > max) { f.vx = f.vx / sp * max; f.vy = f.vy / sp * max; }

      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < 30) f.vx += 0.15; if (f.x > 1250) f.vx -= 0.15;
      if (f.y < 60) f.vy += 0.15; if (f.y > 660) f.vy -= 0.15;
      f.el.setAttribute("cx", f.x.toFixed(1)); f.el.setAttribute("cy", f.y.toFixed(1));
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

  return { apply, trackPointer, labelsOn, _flyMult: (r) => flyMultiplier(r) };
})();
