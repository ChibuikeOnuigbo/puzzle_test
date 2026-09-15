/* =====================================================================
   FIRE — an OOP particle flame emitter, adapted from the pixi
   particle-emitter "flame" example (lifetime 0.1-0.75, frequency 0.001,
   alpha 0.62->0, scale 0.25->0.75, colour fff191->ff622c, upward spawn
   at ~270deg from a small torus). Each particle is a morphing teardrop
   path whose tip and waist jitter on its own noise phase, so the fire
   is never the same shape twice. The luminous core is a second, hotter
   emitter layer (whiter colour list, smaller torus) so the heart of the
   fire reads incandescent, not orange.

   FlameEmitter is fully configurable: spawn rate, speed, scale list,
   colour list, torus radius and particle budget are plain config, so a
   different fire (stove, candle) is just a different config object.
===================================================================== */
/* global Settings */
const Fire = (() => {
  "use strict";

  const lerp = (a, b, t) => a + (b - a) * t;
  function hex(c) {
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  }
  function rampColor(list, t) {
    /* list: [{t, c:[r,g,b]}...] */
    for (let i = 1; i < list.length; i++) {
      if (t <= list[i].t) {
        const a = list[i - 1], b = list[i];
        const k = (t - a.t) / Math.max(0.0001, b.t - a.t);
        return `rgb(${Math.round(lerp(a.c[0], b.c[0], k))},${Math.round(lerp(a.c[1], b.c[1], k))},${Math.round(lerp(a.c[2], b.c[2], k))})`;
      }
    }
    return `rgb(${list[list.length - 1].c.join(",")})`;
  }

  /* one morphing flame particle */
  class FlameParticle {
    constructor(em) { this.em = em; this.alive = false; }
    spawn(now) {
      const c = this.em.cfg;
      const a = Math.random() * Math.PI * 2;
      const r = c.torus.inner + Math.random() * (c.torus.radius - c.torus.inner);
      this.x = Math.cos(a) * r;
      this.y = Math.sin(a) * r * 0.28;              /* flattened ring */
      this.life = lerp(c.lifetime.min, c.lifetime.max, Math.random());
      this.born = now;
      this.speed = lerp(c.speed.min, c.speed.max, Math.random());
      this.drift = (Math.random() - 0.5) * c.drift;
      this.s0 = lerp(c.scale.start, c.scale.start, 0) * lerp(0.85, 1.15, Math.random());
      this.s1 = c.scale.end * lerp(0.85, 1.15, Math.random());
      this.seed = Math.random() * 100;
      this.wobF = 6 + Math.random() * 7;            /* tip wiggle hz */
      this.alive = true;
    }
    /* teardrop with a wobbling tip: random shape, morphing every frame */
    path(t, now) {
      const s = lerp(this.s0, this.s1, t) * this.em.cfg.size;
      const wig = Math.sin((now * 0.001 * this.wobF + this.seed)) * s * 0.34;
      const wig2 = Math.cos((now * 0.001 * (this.wobF * 0.7) + this.seed * 1.7)) * s * 0.22;
      const tipH = s * (1.7 + 0.5 * Math.sin(now * 0.001 * 4 + this.seed));
      const x = this.px, y = this.py;
      return `M${(x - s * 0.52).toFixed(1)},${y.toFixed(1)}` +
        ` Q${(x - s * 0.62 + wig2).toFixed(1)},${(y - s * 0.72).toFixed(1)} ${(x + wig * 0.5).toFixed(1)},${(y - tipH).toFixed(1)}` +
        ` Q${(x + s * 0.62 + wig2).toFixed(1)},${(y - s * 0.72).toFixed(1)} ${(x + s * 0.52).toFixed(1)},${y.toFixed(1)} Z`;
    }
  }

  /* the configurable emitter */
  class FlameEmitter {
    constructor(cfg) {
      this.cfg = cfg;
      this.parts = Array.from({ length: cfg.max }, () => new FlameParticle(this));
      this.acc = 0;
    }
    update(dt, now) {
      const c = this.cfg;
      this.acc += dt / c.frequency;
      while (this.acc >= 1) {
        this.acc -= 1;
        const p = this.parts.find((q) => !q.alive);
        if (p) p.spawn(now);
      }
      this.parts.forEach((p) => {
        if (!p.alive) return;
        const age = (now - p.born) / 1000;
        if (age > p.life) { p.alive = false; return; }
        const t = age / p.life;
        p.py = this.cfg.y - (age * p.speed) * this.cfg.size * 0.02;
        p.px = this.cfg.x + p.x * this.cfg.size * 0.02 + Math.sin(age * 3 + p.seed) * p.drift * t;
        p.t = t;
      });
    }
  }

  /* configs in the spirit of the pixi flame example */
  function makeConfigs(cx, baseY, w, tierName) {
    const body = {
      x: cx, y: baseY, size: w * 0.16,
      lifetime: { min: 0.35, max: 1.0 },
      frequency: 0.05,
      speed: { min: 60, max: 90 },
      drift: 10,
      scale: { start: 0.55, end: 1.15 },
      torus: { radius: w * 0.30, inner: 0 },
      alpha: 0.62,
      colors: [{ t: 0, c: hex("fff191") }, { t: 0.55, c: hex("ff9a2c") }, { t: 1, c: hex("ff622c") }],
      max: tierName === "high" ? 22 : tierName === "medium" ? 14 : 8,
    };
    const core = {
      x: cx, y: baseY - w * 0.02, size: w * 0.10,
      lifetime: { min: 0.25, max: 0.7 },
      frequency: 0.06,
      speed: { min: 50, max: 75 },
      drift: 5,
      scale: { start: 0.4, end: 0.9 },
      torus: { radius: w * 0.14, inner: 0 },
      alpha: 0.9,
      /* the luminous heart: white-hot through most of the life */
      colors: [{ t: 0, c: hex("fffbe0") }, { t: 0.45, c: hex("ffe89a") }, { t: 1, c: hex("ffb43c") }],
      max: tierName === "high" ? 12 : tierName === "medium" ? 8 : 4,
    };
    return [body, core];
  }

  let raf = 0, emitters = [], nodes = [], last = 0, holderRef = null;

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    emitters.forEach((em, i) => {
      em.update(dt, now);
      const g = nodes[i];
      if (!g) return;
      let k = 0;
      em.parts.forEach((p) => {
        if (!p.alive) return;
        let el = g.children[k];
        if (!el) {
          g.insertAdjacentHTML("beforeend", `<path d="" fill="#ff622c" opacity="0"/>`);
          el = g.children[k];
        }
        el.setAttribute("d", p.path(p.t, now));
        el.setAttribute("fill", rampColor(em.cfg.colors, p.t));
        el.setAttribute("opacity", (em.cfg.alpha * (1 - p.t)).toFixed(2));
        k++;
      });
      while (g.children.length > k) g.removeChild(g.lastChild);
    });
  }

  function staticLogs(cx, baseY, w) {
    /* real turned logs: bark body, cut ends with rings, resting crossed */
    const s = [];
    const log = (x, y, len, rot, tone) => {
      s.push(`<g transform="rotate(${rot} ${x} ${y})">
        <rect x="${x - len / 2}" y="${y - 7}" width="${len}" height="14" rx="7" fill="${tone}" stroke="#170d06" stroke-width="2"/>
        <path d="M${x - len / 2 + 6},${y - 4} q${len * 0.3},-2 ${len * 0.6},0 M${x - len / 2 + 8},${y + 3} q${len * 0.25},2 ${len * 0.5},0" stroke="#170d06" stroke-width="1.4" fill="none" opacity="0.7"/>
        <ellipse cx="${x + len / 2 - 2}" cy="${y}" rx="4.4" ry="6.4" fill="#c9a35f"/>
        <ellipse cx="${x + len / 2 - 2}" cy="${y}" rx="2.6" ry="4" fill="none" stroke="#8a6a3a" stroke-width="1.2"/>
        <ellipse cx="${x + len / 2 - 2}" cy="${y}" rx="1" ry="1.6" fill="#8a6a3a"/>
      </g>`);
    };
    log(cx - w * 0.16, baseY - 4, w * 0.62, -6, "#3a2a1a");
    log(cx + w * 0.14, baseY - 6, w * 0.58, 7, "#2c2115");
    log(cx, baseY - 14, w * 0.4, -2, "#453322");
    return s.join("");
  }

  function mount(holder, room) {
    unmount();
    if (room !== "sittingroom") return;
    const svg = holder.querySelector("svg");
    const fireG = svg && svg.querySelector("#v_fire");
    if (!fireG) return;
    const reduced = typeof Settings !== "undefined" && Settings.get("reducedMotion");
    const tierName = (typeof quality === "function") ? quality() : "high";
    /* the opening is drawn by the fireplace art: find its firebox rect */
    const box = fireG.querySelector("rect[fill='#0d0906']");
    if (!box) return;
    const ox = +box.getAttribute("x"), oy = +box.getAttribute("y");
    const ow = +box.getAttribute("width"), oh = +box.getAttribute("height");
    const cx = ox + ow / 2, baseY = oy + oh - 12;
    fireG.insertAdjacentHTML("beforeend",
      `<g id="fire-logs">${staticLogs(cx, baseY, ow)}</g><g id="fire-particles" style="mix-blend-mode:screen"></g><g id="fire-core" style="mix-blend-mode:screen"></g>`);
    nodes = [svg.querySelector("#fire-particles"), svg.querySelector("#fire-core")];
    emitters = makeConfigs(cx, baseY, ow, tierName).map((c) => new FlameEmitter(c));
    if (reduced || typeof requestAnimationFrame === "undefined") {
      /* one static pose: step the sim a moment and freeze */
      const now = Date.now();
      for (let i = 0; i < 40; i++) emitters.forEach((em) => em.update(0.03, now + i * 30));
      emitters.forEach((em, i) => {
        const g = nodes[i];
        let k = 0;
        em.parts.forEach((p) => {
          if (!p.alive) return;
          const el = g.children[k] || (g.insertAdjacentHTML("beforeend", `<path/>`), g.children[k]);
          el.setAttribute("d", p.path(p.t, now));
          el.setAttribute("fill", rampColor(em.cfg.colors, p.t));
          el.setAttribute("opacity", (em.cfg.alpha * (1 - p.t)).toFixed(2));
          k++;
        });
      });
    } else if (typeof requestAnimationFrame !== "undefined") {
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  }

  function unmount() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    emitters = []; nodes = [];
  }

  return { mount, unmount, FlameEmitter, FlameParticle };
})();
if (typeof module !== "undefined" && module.exports) module.exports = { Fire };
