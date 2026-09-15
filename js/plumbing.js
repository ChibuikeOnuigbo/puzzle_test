/* =====================================================================
   PLUMBING — one water simulation shared by every fixture in the house.

   Every source (tap, shower, flush, weeping pipe) ramps its flow open
   and closed the way the kitchen tap does: water is physical, never
   abrupt. Left running, each source is cut by the house after its own
   random longer span. Toggled abusively — 3-5 quick repeats, a limit
   rolled per source — the house closes the main: ALL water is off
   entirely and refuses, until a calm span passes and the valve reopens.

   Basins hold water against a drain; run past capacity and the overflow
   spreads a floor puddle that evaporates in real time. Toilets can
   clog: the bowl rises, gurgles, and drains late — but never crests the
   rim, so a clog never floods.

   The module owns a dynamic overlay <g id="plumb-dyn"> inside the live
   room SVG; the tick loop ramps flows, fills basins, grows puddles and
   evaporates them, writing straight to the DOM so water moves between
   renders instead of snapping with them.
===================================================================== */
/* global State, AudioM */
const Plumbing = (() => {
  "use strict";

  /* ---- fixture geometry, matched to each room's static art ---- */
  const SOURCES = {
    ktap: {
      room: "kitchen", kind: "tap", legacy: true,
    },
    ssink: {
      room: "suite", kind: "tap",
      spout: [514, 292], streamTo: 338,
      basin: { cx: 500, top: 412, rx: 96, ry: 7, span: 58 },
      puddle: { cx: 500, cy: 636, rx: 170, ry: 16 },
    },
    sshower: {
      room: "suite", kind: "shower",
      head: [1011, 164], floor: 556, width: 62,
      puddle: { cx: 1016, cy: 600, rx: 150, ry: 14 },
    },
    wsink: {
      room: "washroom", kind: "tap",
      spout: [640, 293], streamTo: 312,
      basin: { cx: 640, top: 338, rx: 83, ry: 7, span: 24 },
      puddle: { cx: 640, cy: 560, rx: 150, ry: 14 },
    },
    wtoilet: {
      room: "washroom", kind: "flush",
      chain: [1012, 190, 307],
      bowl: { cx: 980, cy: 338, rx: 51, ry: 15 },
    },
    lbasin: {
      room: "lavatory", kind: "tap",
      spout: [646, 384], streamTo: 428,
      basin: { cx: 620, top: 428, rx: 122, ry: 6, span: 26 },
      puddle: { cx: 620, cy: 596, rx: 160, ry: 14 },
    },
  };

  /* ---- per-source runtime ---- */
  const R = {};
  function rt(id) {
    if (!R[id]) {
      R[id] = {
        on: false, flow: 0, level: 0, puddle: 0,
        clogged: false, clogClearAt: 0,
        cutUntil: 0, runDeadline: 0, flushUntil: 0,
        abuseLimit: 3 + Math.floor(Math.random() * 3), /* 3..5 */
        toggles: [], cutSaid: false, clogSaid: false,
      };
    }
    return R[id];
  }

  let houseOffUntil = 0;
  const now = () => Date.now();

  function houseOff() { return now() < houseOffUntil; }

  function say(msg) {
    if (typeof toast === "function") { try { toast(msg); } catch (e) {} }
  }

  /* persist the discrete facts a save should carry */
  function persist() {
    try {
      State.setFlag("plumbHouseOffUntil", houseOffUntil);
      Object.keys(SOURCES).forEach((id) => {
        if (SOURCES[id].kind === "flush") State.setFlag("plumbClog:" + id, R[id] && R[id].clogged ? 1 : 0);
      });
    } catch (e) {}
  }
  function restore() {
    try {
      const u = State.flag("plumbHouseOffUntil");
      if (u && u > now()) houseOffUntil = u;
      Object.keys(SOURCES).forEach((id) => {
        if (SOURCES[id].kind === "flush" && State.flag("plumbClog:" + id)) {
          rt(id).clogged = true;
          rt(id).clogClearAt = now() + 15000 + Math.random() * 10000;
        }
      });
    } catch (e) {}
  }

  /* ---- the abuse rule: quick repeats close the main for a calm span ---- */
  function noteToggle(id) {
    const r = rt(id);
    const t = now();
    r.toggles.push(t);
    r.toggles = r.toggles.filter((x) => t - x < 12000);
    if (r.toggles.length >= r.abuseLimit) {
      r.toggles = [];
      r.abuseLimit = 3 + Math.floor(Math.random() * 3);
      const calm = (20 + Math.random() * 25) * 1000;
      houseOffUntil = t + calm;
      Object.keys(R).forEach((k) => { R[k].on = false; });
      say("Somewhere in the walls, the main valve closes. The water is off entirely.");
      persist();
      return true;
    }
    return false;
  }

  /* ---- public interaction: one entry point for every fixture ---- */
  function use(id) {
    const cfg = SOURCES[id];
    if (!cfg) return false;
    const r = rt(id);
    const t = now();
    if (houseOff()) {
      say("The tap gives nothing. The house has closed the main; it will change its mind in a while.");
      return "blocked";
    }
    if (t < r.cutUntil) {
      say("That valve stays shut for now. The house cut it, and the house keeps its own hours.");
      return "blocked";
    }
    if (noteToggle(id)) { syncKitchen(); return "blocked"; }

    if (cfg.kind === "flush") {
      /* a flush is a fixed pull: the tank empties, then refills */
      if (r.flow > 0.1) return true; /* mid-flush: ignore */
      r.on = true;
      r.flushUntil = t + 3200;
      if (!r.clogged && Math.random() < 0.18) {
        r.clogged = true;
        r.clogClearAt = t + 12000 + Math.random() * 12000;
        r.clogSaid = false;
      }
      if (AudioM && AudioM.tapSqueak) AudioM.tapSqueak();
      persist();
      return true;
    }

    r.on = !r.on;
    if (r.on) r.runDeadline = t + (50 + Math.random() * 70) * 1000; /* random longer span */
    if (AudioM && AudioM.tapSqueak) AudioM.tapSqueak();
    syncKitchen();
    return r.on;
  }

  /* if the main closes while the kitchen tap runs, the kitchen obeys too */
  function syncKitchen() {
    try {
      if (houseOff() && State.flag("tapOn")) {
        State.setFlag("tapOn", false);
        State.setFlag("tapOverflow", false);
        if (typeof Rooms !== "undefined" && State.get().room === "kitchen") Rooms.render();
      }
    } catch (e) {}
  }

  /* ---- simulation tick ---- */
  let last = now();
  function tick() {
    const t = now();
    let dt = (t - last) / 1000;
    last = t;
    if (dt > 2) dt = 2; /* tab was asleep: water does not flood while unwatched */
    const off = houseOff();

    Object.keys(SOURCES).forEach((id) => {
      const cfg = SOURCES[id];
      if (cfg.legacy) return; /* kitchen tap simulated by its own story logic */
      const r = rt(id);

      /* the house cuts a source left running too long */
      if (r.on && cfg.kind !== "flush" && t > r.runDeadline) {
        r.on = false;
        r.cutUntil = t + (20 + Math.random() * 20) * 1000;
        if (!r.cutSaid) { r.cutSaid = true; say("A valve closes in the wall. The house rationed that tap."); }
      }
      if (t > r.cutUntil) r.cutSaid = false;
      if (cfg.kind === "flush" && r.on && t > r.flushUntil) r.on = false;

      /* flow ramps like the kitchen tap: never abrupt */
      const target = (r.on && !off) ? 1 : 0;
      const ramp = dt / 0.8;
      r.flow += (target - r.flow) * Math.min(1, ramp * 3.2);
      if (Math.abs(target - r.flow) < 0.02) r.flow = target;

      /* clogs clear on their own clock */
      if (r.clogged && t > r.clogClearAt) {
        r.clogged = false;
        if (!r.clogSaid) { r.clogSaid = true; say("A long glug somewhere behind the tiles. The drain clears."); }
        persist();
      }

      /* basin level against the drain; overflow feeds the floor */
      if (cfg.kind === "tap" || cfg.kind === "shower") {
        const fill = cfg.kind === "shower" ? 0.16 : 0.22;
        const drain = cfg.kind === "shower" ? 0.15 : 0.17;
        r.level += (r.flow * fill - (r.level > 0 ? drain : 0)) * dt;
        if (r.level > 1) { r.puddle += (r.level - 1) * 0.9 * dt; r.level = 1; }
        if (r.level < 0) r.level = 0;
        if (cfg.kind === "shower") { r.puddle += r.flow * 0.012 * dt; } /* spray carries */
      }
      if (cfg.kind === "flush") {
        if (r.flow > 0.05) {
          r.level += (r.clogged ? 0.55 : 0.25) * r.flow * dt;
          if (!r.clogged && t > r.flushUntil) r.level -= 0.9 * dt;
        } else {
          r.level -= (r.clogged ? 0.05 : 0.6) * dt;
        }
        const cap = r.clogged ? 0.86 : 0.6; /* a clog never crests the rim */
        if (r.level > cap) r.level = cap;
        if (r.level < 0) r.level = 0;
      }

      /* evaporation: real time dries the floor */
      if (r.flow < 0.05) r.puddle -= dt / 150;
      if (r.puddle > 1) r.puddle = 1;
      if (r.puddle < 0) r.puddle = 0;
    });

    draw(t);
  }

  /* ---- dynamic overlay ---- */
  let refs = {};
  function mount(room) {
    refs = {};
    const holder = document.getElementById("scene-holder");
    if (!holder) return;
    const svg = holder.querySelector("svg");
    const mid = svg && svg.querySelector("#layer-mid");
    if (!mid) return;
    let out = "";
    Object.keys(SOURCES).forEach((id) => {
      const cfg = SOURCES[id];
      if (cfg.room !== room || cfg.legacy) return; /* kitchen keeps its own art */
      out += overlayFor(id, cfg);
    });
    if (!out) return;
    mid.insertAdjacentHTML("beforeend", `<g id="plumb-dyn" pointer-events="none">${out}</g>`);
    Object.keys(SOURCES).forEach((id) => {
      const cfg = SOURCES[id];
      if (cfg.room !== room || cfg.legacy) return;
      refs[id] = {
        stream: svg.querySelector(`#pw-stream-${id}`),
        splash: svg.querySelector(`#pw-splash-${id}`),
        basin: svg.querySelector(`#pw-basin-${id}`),
        puddle: svg.querySelector(`#pw-puddle-${id}`),
        swirl: svg.querySelector(`#pw-swirl-${id}`),
        chain: svg.querySelector(`#pw-chain-${id}`),
        spray: svg.querySelector(`#pw-spray-${id}`),
      };
    });
    draw(now());
  }

  function overlayFor(id, cfg) {
    if (cfg.kind === "tap") {
      const [sx, sy] = cfg.spout;
      const b = cfg.basin, p = cfg.puddle;
      return `
        <path id="pw-stream-${id}" d="M${sx - 1.6},${sy} L${sx - 1.2},${cfg.streamTo} L${sx + 1.2},${cfg.streamTo} L${sx + 1.6},${sy} Z" fill="#b9d2dc" opacity="0"/>
        <ellipse id="pw-splash-${id}" cx="${sx}" cy="${cfg.streamTo + 2}" rx="7" ry="2.4" fill="#cfe4ec" opacity="0"/>
        <ellipse id="pw-basin-${id}" cx="${b.cx}" cy="${b.top}" rx="${b.rx}" ry="${b.ry}" fill="#22333d" opacity="0"/>
        <ellipse id="pw-puddle-${id}" cx="${p.cx}" cy="${p.cy}" rx="0" ry="0" fill="#26363f" opacity="0.5"/>`;
    }
    if (cfg.kind === "shower") {
      const [hx, hy] = cfg.head;
      const p = cfg.puddle;
      let lines = "";
      for (let i = 0; i < 12; i++) {
        const x = hx - cfg.width / 2 + 3 + i * (cfg.width - 6) / 11;
        lines += `<line x1="${x.toFixed(1)}" y1="${hy + 4}" x2="${(x - 1.5).toFixed(1)}" y2="${cfg.floor}" stroke="#cfe4ec" stroke-width="2"/>`;
      }
      return `
        <g id="pw-spray-${id}" opacity="0">${lines}<ellipse cx="${hx}" cy="${cfg.floor + 4}" rx="${cfg.width}" ry="7" fill="#cfe4ec" opacity="0.5"/></g>
        <ellipse id="pw-puddle-${id}" cx="${p.cx}" cy="${p.cy}" rx="0" ry="0" fill="#26363f" opacity="0.5"/>`;
    }
    if (cfg.kind === "flush") {
      const [cx, cy0, cy1] = cfg.chain;
      const b = cfg.bowl;
      return `
        <g id="pw-chain-${id}" opacity="0"><line x1="${cx + 4}" y1="${cy0 + 6}" x2="${cx + 10}" y2="${cy1 - 8}" stroke="#8a8f92" stroke-width="3"/><circle cx="${cx + 11}" cy="${cy1 - 4}" r="7" fill="none" stroke="#8a8f92" stroke-width="3"/></g>
        <ellipse id="pw-basin-${id}" cx="${b.cx}" cy="${b.cy}" rx="${b.rx}" ry="${b.ry * 0.4}" fill="#314652" opacity="0"/>
        <path id="pw-swirl-${id}" d="M${b.cx - 26},${b.cy} q13,7 26,0 q13,-7 26,0" stroke="#cfe4ec" stroke-width="2.4" fill="none" opacity="0"/>`;
    }
    return "";
  }

  function draw(t) {
    Object.keys(refs).forEach((id) => {
      const r = R[id];
      const cfg = SOURCES[id];
      const el = refs[id];
      if (!r || !el) return;
      if (el.stream) {
        el.stream.setAttribute("opacity", (r.flow * 0.85).toFixed(2));
        const sy = cfg.spout[1];
        const len = (cfg.streamTo - sy) * r.flow;
        el.stream.setAttribute("d", `M${cfg.spout[0] - 1.6},${sy} L${cfg.spout[0] - 1.2},${sy + len} L${cfg.spout[0] + 1.2},${sy + len} L${cfg.spout[0] + 1.6},${sy} Z`);
      }
      if (el.splash) el.splash.setAttribute("opacity", (r.flow * 0.5).toFixed(2));
      if (el.spray) el.spray.setAttribute("opacity", (r.flow * 0.55).toFixed(2));
      if (el.basin && cfg.kind !== "flush") {
        const b = cfg.basin;
        const lvl = r.level;
        el.basin.setAttribute("opacity", lvl > 0.02 ? "0.8" : "0");
        el.basin.setAttribute("cy", (b.top - lvl * b.span).toFixed(1));
        el.basin.setAttribute("rx", (b.rx * (0.72 + 0.28 * lvl)).toFixed(1));
      }
      if (el.basin && cfg.kind === "flush") {
        const b = cfg.bowl;
        const lvl = r.level;
        el.basin.setAttribute("opacity", lvl > 0.03 ? "0.85" : "0");
        el.basin.setAttribute("ry", (b.ry * (0.35 + 0.65 * lvl)).toFixed(1));
      }
      if (el.swirl) el.swirl.setAttribute("opacity", (r.flow * 0.7).toFixed(2));
      if (el.chain) el.chain.setAttribute("opacity", r.flow > 0.05 ? "0.9" : "0");
      if (el.puddle) {
        const p = cfg.puddle;
        const k = r.puddle;
        el.puddle.setAttribute("rx", (p.rx * k).toFixed(1));
        el.puddle.setAttribute("ry", (p.ry * k).toFixed(1));
        el.puddle.setAttribute("opacity", k > 0.02 ? "0.5" : "0");
      }
    });
  }

  /* house valve state for room code (kitchen refusal line) */
  function refusal() {
    return houseOff()
      ? "The handle turns, but the house has closed the main. Nothing comes. It will relent in a while."
      : null;
  }

  let timer = null;
  function start() {
    if (timer) return;
    restore();
    timer = setInterval(tick, 200);
  }

  if (typeof document !== "undefined" && typeof setInterval !== "undefined") start();

  return { SOURCES, use, mount, houseOff, refusal, start, noteToggle, _rt: rt };
})();
if (typeof module !== "undefined" && module.exports) module.exports = { Plumbing };
