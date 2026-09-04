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
        when: () => State.flag("hallLampOn") !== false },
    ],
    kitchen: [
      { src: [640, 96], floorY: 500, spread: [360, 940], color: "#e8a04c",
        cone: [[624, 96], [656, 96], [740, 500], [540, 500]],
        pool: [[540, 500], [740, 500], [720, 528], [560, 528]], op: 0.16, poolOp: 0.22, motes: 16 },
      // moon shaft from the window over the sink, drifting with a cloud shadow
      { src: [640, 160], floorY: 470, spread: [470, 810], color: "#9cc3dc",
        cone: [[608, 152], [672, 152], [760, 470], [520, 470]],
        pool: [[520, 478], [760, 478], [740, 506], [540, 506]], op: 0.1, poolOp: 0.14, motes: 16,
        shadow: { pts: [[560, 478], [720, 478], [710, 506], [570, 506]], drift: 22 } },
    ],
    diningroom: [
      { src: [640, 130], floorY: 560, spread: [360, 940], color: "#e8c87a",
        cone: [[624, 128], [656, 128], [760, 560], [520, 560]],
        pool: [[520, 560], [760, 560], [736, 588], [544, 588]], op: 0.14, poolOp: 0.2, motes: 14 },
      // dawn window: a slanted shaft of cold light, with a drifting curtain shadow
      { src: [220, 235], floorY: 560, spread: [60, 380], color: "#9fb0c2",
        cone: [[150, 235], [290, 235], [382, 560], [42, 560]],
        pool: [[42, 560], [382, 560], [358, 590], [66, 590]], op: 0.11, poolOp: 0.15, motes: 16,
        shadow: { pts: [[180, 560], [340, 560], [330, 592], [190, 592]], drift: 26 } },
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
        pool: [[540, 500], [760, 500], [742, 528], [558, 528]], op: 0.12, poolOp: 0.16, motes: 12 },
    ],
    childroom: [
      { src: [1010, 120], floorY: 500, spread: [780, 1230], color: "#7fa8c9",
        cone: [[996, 118], [1024, 118], [1090, 500], [930, 500]],
        pool: [[930, 500], [1090, 500], [1070, 526], [950, 526]], op: 0.08, poolOp: 0.1, motes: 8 },
    ],
    basement: [
      { src: [640, 126], floorY: 500, spread: [300, 980], color: "#e8a04c",
        cone: [[624, 126], [656, 126], [740, 500], [540, 500]],
        pool: [[540, 500], [740, 500], [720, 528], [560, 528]], op: 0.13, poolOp: 0.18, motes: 12,
        when: () => !!State.flag("basementPower") },
      // the open hatch above: daylight shaft falling down into the dark
      { src: [130, 0], floorY: 500, spread: [60, 220], color: "#a8c8da",
        cone: [[60, 0], [220, 0], [300, 500], [0, 500]],
        pool: [[0, 500], [300, 500], [286, 528], [16, 528]], op: 0.1, poolOp: 0.14, motes: 18 },
    ],
    memory: [
      { src: [640, 158], floorY: 500, spread: [360, 940], color: "#e8a04c",
        cone: [[624, 158], [656, 158], [740, 500], [540, 500]],
        pool: [[540, 500], [740, 500], [720, 528], [560, 528]], op: 0.12, poolOp: 0.18, motes: 12 },
    ],
    attic: [],
  };

  /* flies may gather in these rooms; keep them occasional, never everywhere.
     The dining room rots, so its flies are frequent and loyal to the mess. */
  const FLY_ROOMS = { hallway: 0.5, kitchen: 0.65, diningroom: 0.9, attic: 0.6, basement: 0.55, study: 0.3, childroom: 0.25, porch: 0.18 };
  const FLY_COUNTS = { diningroom: [8, 13], kitchen: [3, 6], attic: [3, 6], basement: [3, 6], hallway: [3, 6] };

  /* places flies actually want to be: garbage, spoilt food, open wounds of light */
  const FLY_ATTRACTORS = {
    diningroom: [
      { x: 390, y: 608, when: () => !State.flag("diningTidied") },  // the plate gone bad
      { x: 955, y: 596, when: () => !State.flag("diningTidied") },  // the rubbish bags
      { x: 640, y: 610 },                                            // the laid feast
    ],
  };

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

    // a small bright core near the source (small slanted quad, not a circle)
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

  /* ---------------- smart flies ---------------- */
  function spawnFlies(room) {
    if (Settings.get("reducedMotion")) return;
    if (Math.random() > (FLY_ROOMS[room] || 0)) return;
    const group = svgEl.querySelector("#fx-flies");
    const specs = (LIGHTS[room] || []).map(s => ({ x: s.src[0], y: s.src[1] }));
    // blood / night light / "concentration" attractors: mirror hollow + any blood wall
    if (room === "hallway") {
      if (State.flag("mirrorShattered") || State.flag("mirrorCracked")) specs.push({ x: 720, y: 256 });
      if (State.flag("mirrorBlood")) specs.push({ x: 460, y: 300 });
    }
    (FLY_ATTRACTORS[room] || []).forEach(a => { if (!a.when || a.when()) specs.push({ x: a.x, y: a.y }); });
    if (!specs.length) specs.push({ x: 640, y: 200 });
    const base = (FLY_COUNTS[room] || [3, 6]);
    const count = base[0] + Math.floor(rnd(0, base[1] - base[0] + 1));
    for (let i = 0; i < count; i++) {
      const fx0 = rnd(80, 1200), fy0 = rnd(120, 520);
      const f = mk("circle", { class: "fx-fly", cx: fx0, cy: fy0, r: rnd(1.4, 2.2), fill: "#0c0a08", opacity: 0.75 }, group);
      mk("animate", { attributeName: "opacity", values: "0.75;0.5;0.75", dur: `${rnd(0.4, 1)}s`, repeatCount: "indefinite" }, f);
      flies.push({
        el: f, x: fx0, y: fy0,
        vx: rnd(-0.4, 0.4), vy: rnd(-0.4, 0.4), ph: rnd(0, Math.PI * 2),
        attract: specs[Math.floor(rnd(0, specs.length))],
        straggler: Math.random() < 0.22,
      });
    }
  }

  /* ---------------- rain (real falling drops) ---------------- */
  function buildRain() {
    const group = svgEl.querySelector("#fx-rain");
    if (Settings.get("reducedMotion")) {
      for (let i = 0; i < 26; i++) mk("line", { x1: 910 + (i % 13) * 16, y1: 128 + (i % 7) * 26, x2: 902 + (i % 13) * 16, y2: 152 + (i % 7) * 26, stroke: "#9cc3dc", "stroke-width": 1.4, opacity: 0.5 }, group);
      return;
    }
    for (let i = 0; i < 34; i++) {
      const x = 908 + (i % 12) * 17, top = 124 + (i % 6) * 30;
      const l = mk("line", { x1: x, y1: top, x2: x - 8, y2: top + 26, stroke: "#a8cde4", "stroke-width": rnd(1, 1.8), opacity: rnd(0.3, 0.65) }, group);
      mk("animateTransform", { attributeName: "transform", type: "translate", values: `0,0;-6,${260};0,0`, dur: `${rnd(0.5, 0.9)}s`, repeatCount: "indefinite" }, l);
    }
    // a drip sliding down the inside of the glass
    for (let i = 0; i < 3; i++) {
      const x = 930 + i * 42, d = mk("circle", { cx: x, cy: 140, r: 1.6, fill: "#bfe0f2", opacity: 0.7 }, group);
      mk("animate", { attributeName: "cy", values: "136;300", dur: `${rnd(2.2, 3.6)}s`, repeatCount: "indefinite" }, d);
      mk("animate", { attributeName: "opacity", values: "0;0.7;0.7;0", dur: `${rnd(2.2, 3.6)}s`, repeatCount: "indefinite" }, d);
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
  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(40, t - last) / 16.6; last = t;

    // local pointer coords inside the scaled svg
    let px = -9999, py = -9999;
    if (pointer.active && rect) {
      const sx = 1280 / rect.width, sy = 720 / rect.height;
      px = (pointer.x - rect.left) * sx; py = (pointer.y - rect.top) * sy;
    }

    for (const m of motes) {
      m.ph += 0.008 * dt; m.y -= m.up * dt;
      m.x = m.x0 + Math.sin(m.ph) * m.amp;
      if (m.y < m.y0 - 40) { m.y = m.y0; m.x0 = m.x; m.ph = rnd(0, Math.PI * 2); }
      m.el.setAttribute("cx", m.x.toFixed(1)); m.el.setAttribute("cy", m.y.toFixed(1));
    }

    for (const f of flies) {
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

  return { apply, trackPointer, labelsOn };
})();
