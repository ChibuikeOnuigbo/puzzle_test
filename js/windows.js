/* HOUSE 17 — WINDOW SYSTEM (docs/DEPTH_AND_Z_ORDER.md §window)
   ============================================================================
   One canonical builder for every window that looks OUT of the house.

   THE ABSOLUTE RULE: the exterior scene lives inside a clip of the glass.
   Nothing from outside — grass, trees, birds, clouds, moon, sun — may ever
   render above the interior frame, mullion, sill or wall. DOM order is the
   authoritative depth:

     1  wall + opening            (room draws this)
     2  EXTERIOR, clipped         ← Windows.build() returns this
     3  glass tint + reflection   ← Windows.build() returns this
     4  birds                     (windowBirds, clipped again, in front of
                                   glass tint, behind mullions)
     5  mullions / frame / sill   (room draws this AFTER everything outside)
     6  interior-side FX (drops)  (glassDrops, on the inside face)

   Quality tiers change the actual scene, not a blur:
     HIGH   3 vegetation layers, 4-6 translucent cloud masses (drifting),
            stars at night, ground texture, atmospheric gradient
     MEDIUM 2 vegetation layers, 3 clouds, slower drift, no stars
     LOW    silhouette treeline, 1-2 clouds, static

   Scenes: night | dawn | day | sunset | sea | rain-night.
============================================================================ */
"use strict";

const Windows = (() => {
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  const quality = () => { try { return (typeof Settings !== "undefined" && Settings.get("quality")) || "high"; } catch (e) { return "high"; } };
  const animOn = id => (typeof AnimReg !== "undefined") ? AnimReg.on(id) : true;

  /* the room renderer injects its windowBirds builder here (rooms.js) so the
     window system never grows a second bird engine */
  let birdFn = null;
  function registerBirds(fn) { birdFn = fn; }

  const SKIES = {
    night:  { top: "#0b111c", mid: "#141d2b", bot: "#1c2836", horizon: "#22303f" },
    dawn:   { top: "#4a5261", mid: "#6a7078", bot: "#8c8474", horizon: "#a8935f" },
    day:    { top: "#7fa3c0", mid: "#9dbdd4", bot: "#c3d4de", horizon: "#d8e2e4" },
    sunset: { top: "#3a3450", mid: "#6a4a58", bot: "#a86a50", horizon: "#c98a54" },
    sea:    { top: "#0d1622", mid: "#16242f", bot: "#1f3038", horizon: "#28404a" },
  };

  /* ---------- translucent cloud masses: layered radial gradients, no blur,
     never an opaque blob; different densities overlap naturally.
     HIGH tier builds real cumulus: a shaded base slab, ranked lobes along a
     crowned arch, and a bright cap — puffs large amid, tapering at the ends. */
  function clouds(id, g, R, q, scene) {
    const lit = scene === "day" || scene === "dawn";
    const warm = scene === "sunset" || scene === "dawn";
    const base = lit ? "255,255,255" : (warm ? "226,206,196" : "168,186,204");
    const shadow = lit ? "196,206,220" : (warm ? "188,166,158" : "128,142,160");
    const count = q === "high" ? 5 : q === "medium" ? 3 : 1;
    let out = "";
    for (let i = 0; i < count; i++) {
      const cx = g.x + g.w * (0.12 + R() * 0.76);
      const cy = g.y + g.h * (0.10 + R() * 0.30);
      const puffs = q === "high" ? 6 + Math.floor(R() * 4) : q === "medium" ? 3 + Math.floor(R() * 2) : 1;
      const drift = animOn("windowClouds") && q !== "low";
      const dur = (46 + R() * 60).toFixed(0);
      const dx = (8 + R() * 22).toFixed(0);
      const op = (0.10 + R() * 0.14).toFixed(2);
      const span = g.w * (0.20 + R() * 0.14);
      let c = `<g opacity="${op}">`;
      if (q !== "low") {
        /* shaded base slab: the flat underside every real cloud has */
        c += `<ellipse cx="${cx.toFixed(1)}" cy="${(cy + g.h * 0.035).toFixed(1)}" rx="${(span * 0.62).toFixed(1)}" ry="${(span * 0.085).toFixed(1)}" fill="rgb(${shadow})" opacity="0.55"/>`;
        for (let p = 0; p < puffs; p++) {
          /* ranked lobes along an arch: big amid, tapering to the ends */
          const t = puffs === 1 ? 0.5 : p / (puffs - 1);
          const crown = Math.sin(t * Math.PI);                    // 0 at ends, 1 amid
          const px = cx + (t - 0.5) * span * 1.5 + (R() - 0.5) * span * 0.18;
          const py = cy - crown * span * (0.10 + R() * 0.08) + (R() - 0.5) * span * 0.05;
          const rx = span * (0.16 + 0.20 * crown) * (0.85 + R() * 0.3);
          const ry = rx * (0.42 + R() * 0.16);
          c += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="rgb(${base})" opacity="${(0.40 + crown * 0.3 + R() * 0.15).toFixed(2)}"/>`;
        }
        if (q === "high") {
          /* bright cap riding the crown */
          c += `<ellipse cx="${(cx + (R() - 0.5) * span * 0.3).toFixed(1)}" cy="${(cy - span * 0.16).toFixed(1)}" rx="${(span * 0.20).toFixed(1)}" ry="${(span * 0.09).toFixed(1)}" fill="rgb(${base})" opacity="0.85"/>`;
          /* wisps trailing off the lee side */
          c += `<ellipse cx="${(cx + span * 0.72).toFixed(1)}" cy="${(cy + span * 0.02).toFixed(1)}" rx="${(span * 0.26).toFixed(1)}" ry="${(span * 0.05).toFixed(1)}" fill="rgb(${base})" opacity="0.30"/>`;
        }
      } else {
        c += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(g.w * 0.14).toFixed(1)}" ry="${(g.w * 0.05).toFixed(1)}" fill="rgb(${base})" opacity="0.5"/>`;
      }
      c += `</g>`;
      if (drift) c = `<g>${c}<animateTransform attributeName="transform" type="translate" values="0,0;${dx},0;0,0" dur="${dur}s" repeatCount="indefinite"/></g>`;
      out += c;
    }
    return out;
  }

  /* ---------- a treeline rank: organic silhouette with lobed canopy ------ */
  function treeline(g, R, baseY, h, col, lobes, jag) {
    let d = `M${g.x},${baseY}`;
    const n = lobes;
    const step = g.w / n;
    for (let i = 0; i <= n; i++) {
      const x = g.x + i * step;
      const rise = h * (0.45 + R() * 0.55);
      const mx = x - step / 2;
      d += ` Q${mx.toFixed(1)},${(baseY - rise * (jag ? 1.25 : 1)).toFixed(1)} ${x.toFixed(1)},${(baseY - rise * 0.35).toFixed(1)}`;
    }
    d += ` L${g.x + g.w},${baseY} Z`;
    return `<path d="${d}" fill="${col}"/>`;
  }

  /* ---------- ground band + near vegetation, always INSIDE the glass ----- */
  function ground(g, R, q, scene) {
    const night = scene === "night" || scene === "sea";
    const gy = g.y + g.h * 0.82;
    const gc = night ? "#0d1410" : (scene === "dawn" ? "#2c3226" : "#2e4028");
    let out = `<rect x="${g.x}" y="${gy}" width="${g.w}" height="${g.y + g.h - gy}" fill="${gc}"/>`;
    if (q !== "low") {
      /* a second tone band reads as raked grass, not a flat floor */
      out += `<path d="M${g.x},${gy + 4} q${g.w * 0.3},-3 ${g.w * 0.55},0 q${g.w * 0.25},2 ${g.w * 0.45},-1 L${g.x + g.w},${g.y + g.h} L${g.x},${g.y + g.h} Z" fill="${night ? "#0a100c" : "#26361f"}" opacity="0.55"/>`;
      const blades = q === "high" ? 18 : 9;
      const bc = night ? "#141d16" : "#3a4c30";
      const bc2 = night ? "#0f1712" : "#46583a";
      for (let i = 0; i < blades; i++) {
        const bx = g.x + g.w * (i + R()) / blades;
        const bh = 5 + R() * 9;
        out += `<path d="M${bx.toFixed(1)},${gy + 2} q${(R() - 0.5) * 6},${-bh} ${(R() - 0.5) * 3},${-bh - 2}" stroke="${i % 3 ? bc : bc2}" stroke-width="1.4" fill="none"/>`;
      }
      if (q === "high" && !night) {
        /* a few scattered field flowers, small and unsaturated */
        for (let i = 0; i < 4; i++) {
          const fx = g.x + g.w * (0.1 + R() * 0.8);
          const fy = gy + 6 + R() * (g.y + g.h - gy - 10);
          out += `<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="1.4" fill="${R() < 0.5 ? "#c9b8a0" : "#b8a8b0"}" opacity="0.6"/>`;
        }
      }
    }
    return out;
  }

  /* ---------- moon: atmospheric, not a pasted icon ---------- */
  function moon(cx, cy, r, R) {
    let craters = "";
    for (let i = 0; i < 5; i++) {
      const a = R() * Math.PI * 2, d = R() * r * 0.62;
      craters += `<circle cx="${(cx + Math.cos(a) * d).toFixed(1)}" cy="${(cy + Math.sin(a) * d).toFixed(1)}" r="${(r * (0.07 + R() * 0.11)).toFixed(1)}" fill="#aeb9c2" opacity="0.5"/>`;
    }
    return `
      <circle cx="${cx}" cy="${cy}" r="${(r * 3.4).toFixed(1)}" fill="url(#moonglow)"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#d8dee3"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef2f4" stroke-width="0.8" opacity="0.7"/>
      ${craters}`;
  }

  /* ---------- sun: directional glow, never a flat yellow disc ---------- */
  function sun(cx, cy, r, warm) {
    const col = warm ? "#e8b464" : "#e8dcae";
    return `
      <circle cx="${cx}" cy="${cy}" r="${r * 4}" fill="${col}" opacity="0.10"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 2.2}" fill="${col}" opacity="0.16"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${warm ? "#ecc27a" : "#f0e8c0"}"/>`;
  }

  /* ---------- stars (night, high tier) ---------- */
  function stars(g, R) {
    let out = "";
    for (let i = 0; i < 22; i++) {
      const x = g.x + R() * g.w, y = g.y + R() * g.h * 0.55;
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.5 + R() * 0.8).toFixed(1)}" fill="#cfd8e0" opacity="${(0.25 + R() * 0.5).toFixed(2)}"/>`;
    }
    return out;
  }

  /* =====================================================================
     build(id, glass, opt) -> { defs, exterior }
       glass: {x,y,w,h}      the actual pane opening (clip boundary)
       opt:   scene, moon:{u,v,r} fractions, sun:{u,v,r}, horizon (fraction),
              seed, clipPrefix, birds:{count,scale,band,color,flock}
     The caller draws frame/mullions/sill AFTER inserting the returned svg.
  ===================================================================== */
  function build(id, glass, opt = {}) {
    const q = quality();
    const scene = opt.scene || "night";
    const R = rng(opt.seed != null ? opt.seed : (id.length * 787 + glass.x * 3 + glass.y * 11) >>> 0);
    const sky = SKIES[scene] || SKIES.night;
    const clipId = `winclip-${opt.clipPrefix || id}`;
    const horizon = glass.y + glass.h * (opt.horizon != null ? opt.horizon : 0.82);

    const defs = `<clipPath id="${clipId}"><rect x="${glass.x}" y="${glass.y}" width="${glass.w}" height="${glass.h}"/></clipPath>
      <linearGradient id="winsky-${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${sky.top}"/>
        <stop offset="0.55" stop-color="${sky.mid}"/>
        <stop offset="0.9" stop-color="${sky.bot}"/>
        <stop offset="1" stop-color="${sky.horizon}"/>
      </linearGradient>`;

    let ext = "";
    /* sky */
    ext += `<rect x="${glass.x}" y="${glass.y}" width="${glass.w}" height="${glass.h}" fill="url(#winsky-${id})"/>`;
    if (scene === "night" && q === "high") ext += stars(glass, R);

    /* celestial body */
    if (opt.moon) {
      const mr = opt.moon.r != null ? opt.moon.r : Math.min(glass.w, glass.h) * 0.09;
      ext += moon(glass.x + glass.w * (opt.moon.u != null ? opt.moon.u : 0.72), glass.y + glass.h * (opt.moon.v != null ? opt.moon.v : 0.24), mr, R);
    }
    if (opt.sun) {
      const sr = opt.sun.r != null ? opt.sun.r : Math.min(glass.w, glass.h) * 0.10;
      ext += sun(glass.x + glass.w * (opt.sun.u != null ? opt.sun.u : 0.3), glass.y + glass.h * (opt.sun.v != null ? opt.sun.v : 0.3), sr, scene === "sunset");
    }

    /* clouds — translucent, drifting, depth-ordered above the treeline */
    ext += clouds(id, glass, R, q, scene);

    /* far hills: two soft ridges behind the treeline give the view depth */
    if (q !== "low" && scene !== "sea") {
      const night = scene === "night";
      const hillFar = night ? "#131c26" : (scene === "dawn" ? "#4a4e56" : "#527058");
      const hillNear = night ? "#101820" : (scene === "dawn" ? "#41464e" : "#46624e");
      const ridge = (base, amp, col, op, ph) => {
        let d = `M${glass.x},${base}`;
        const n = 5;
        for (let i = 0; i <= n; i++) {
          const hx = glass.x + glass.w * i / n;
          const hy = base - amp * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.7 + ph)));
          d += ` Q${(hx - glass.w / (2 * n)).toFixed(1)},${(hy - amp * 0.3).toFixed(1)} ${hx.toFixed(1)},${hy.toFixed(1)}`;
        }
        return `<path d="${d} L${glass.x + glass.w},${base} Z" fill="${col}" opacity="${op}"/>`;
      };
      ext += ridge(horizon + 1, glass.h * 0.16, hillFar, 0.85, R() * 6);
      if (q === "high") ext += ridge(horizon + 2, glass.h * 0.10, hillNear, 0.9, R() * 6);
    }

    /* vegetation: far rank, mid rank, near rank — all ABOVE ground line */
    const night = scene === "night" || scene === "sea";
    const farC = night ? "#101a22" : (scene === "dawn" ? "#3c424a" : "#41604a");
    const midC = night ? "#0c1418" : (scene === "dawn" ? "#31373c" : "#34503c");
    const nearC = night ? "#080f11" : (scene === "dawn" ? "#262b2e" : "#27402e");
    if (q !== "low") ext += treeline(glass, R, horizon, glass.h * (q === "high" ? 0.20 : 0.16), farC, 6 + Math.floor(R() * 3), false);
    ext += treeline(glass, R, horizon + 2, glass.h * (q === "high" ? 0.16 : 0.13), q === "low" ? nearC : midC, 4 + Math.floor(R() * 3), true);
    if (q !== "low") {
      /* one near tree grown the bedroom-garden way: a tapered trunk with two
         arms, and a lobed crown clustered ON the branch tips — no floating
         foliage, no stick trunk */
      const tx = glass.x + glass.w * (R() < 0.5 ? 0.16 : 0.84);
      const base = horizon + 3;
      const th = glass.h * (q === "high" ? 0.46 : 0.38);
      const rw = glass.w * 0.075;
      let crown = "";
      const lobes = q === "high" ? 5 : 3;
      for (let k = 0; k < lobes; k++) {
        const cx = tx + (R() - 0.5) * rw * 2.2, cy = base - th * (0.72 + R() * 0.5), rr = rw * (0.5 + R() * 0.35);
        crown += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rr.toFixed(1)}" ry="${(rr * 0.75).toFixed(1)}" fill="${k % 2 ? nearC : midC}"/>`;
      }
      ext += `<g><path d="M${tx.toFixed(1)},${base} q-1.5,${(-th * 0.4).toFixed(1)} 0,${(-th * 0.62).toFixed(1)}" stroke="${nearC}" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M${tx.toFixed(1)},${(base - th * 0.5).toFixed(1)} q${(-rw * 0.9).toFixed(1)},${(-th * 0.14).toFixed(1)} ${(-rw * 1.1).toFixed(1)},${(-th * 0.26).toFixed(1)} M${tx.toFixed(1)},${(base - th * 0.58).toFixed(1)} q${(rw * 0.9).toFixed(1)},${(-th * 0.12).toFixed(1)} ${(rw * 1.1).toFixed(1)},${(-th * 0.24).toFixed(1)}" stroke="${nearC}" stroke-width="2" fill="none" stroke-linecap="round"/>
        ${crown}</g>`;
    }

    /* ground */
    ext += ground(glass, R, q, scene);

    /* sea variant: a water band instead of grass */
    if (scene === "sea") {
      const wy = horizon - glass.h * 0.04;
      ext += `<rect x="${glass.x}" y="${wy}" width="${glass.w}" height="${glass.y + glass.h - wy}" fill="#101c26"/>`;
      for (let i = 0; i < (q === "low" ? 3 : 8); i++) {
        const ly = wy + 4 + R() * (glass.y + glass.h - wy - 8);
        ext += `<line x1="${glass.x + R() * glass.w * 0.4}" y1="${ly.toFixed(1)}" x2="${glass.x + glass.w * (0.5 + R() * 0.5)}" y2="${ly.toFixed(1)}" stroke="#3a5666" stroke-width="1" opacity="${(0.2 + R() * 0.3).toFixed(2)}"/>`;
      }
    }

    /* birds: inside the clip, between scenery and glass; the sun/moon disc
       is automatically a no-fly zone */
    if (birdFn && opt.birds) {
      const b = { ...opt.birds };
      if (!b.avoid) {
        const cel = opt.sun ? { u: opt.sun.u, v: opt.sun.v, r: opt.sun.r != null ? opt.sun.r : Math.min(glass.w, glass.h) * 0.10 }
          : opt.moon ? { u: opt.moon.u, v: opt.moon.v, r: opt.moon.r != null ? opt.moon.r : Math.min(glass.w, glass.h) * 0.09 }
          : null;
        if (cel) b.avoid = { u: cel.u != null ? cel.u : 0.72, v: cel.v != null ? cel.v : 0.24, r: (cel.r * 2.4) / glass.w };
      }
      ext += birdFn(id + "-ext", glass, b);
    }

    /* atmospheric depth veil: cooler toward the horizon */
    ext += `<rect x="${glass.x}" y="${horizon - glass.h * 0.2}" width="${glass.w}" height="${glass.h * 0.2}" fill="${sky.horizon}" opacity="0.10"/>`;

    /* glass itself: tint + two faint diagonal reflections (interior side) */
    const tint = night ? "rgba(160,190,215,0.05)" : "rgba(220,235,240,0.08)";
    ext += `<rect x="${glass.x}" y="${glass.y}" width="${glass.w}" height="${glass.h}" fill="${tint}"/>`;
    ext += `<path d="M${glass.x + glass.w * 0.16},${glass.y + glass.h} L${glass.x + glass.w * 0.38},${glass.y} L${glass.x + glass.w * 0.46},${glass.y} L${glass.x + glass.w * 0.24},${glass.y + glass.h} Z" fill="#dceaf4" opacity="0.06"/>`;
    ext += `<path d="M${glass.x + glass.w * 0.62},${glass.y + glass.h} L${glass.x + glass.w * 0.80},${glass.y} L${glass.x + glass.w * 0.84},${glass.y} L${glass.x + glass.w * 0.66},${glass.y + glass.h} Z" fill="#dceaf4" opacity="0.045"/>`;

    /* debug: make the clip boundary obvious */
    if (typeof Debug !== "undefined" && Debug.on("windowClips")) {
      ext += `<rect x="${glass.x}" y="${glass.y}" width="${glass.w}" height="${glass.h}" fill="none" stroke="#00e5ff" stroke-width="1.5" stroke-dasharray="6 4"/>`;
    }

    return { defs, exterior: `<g data-window-ext="${id}" clip-path="url(#${clipId})" pointer-events="none">${ext}</g>` };
  }

  return { build, registerBirds, SKIES, _rng: rng };
})();

(typeof window !== "undefined") && (window.Windows = Windows);
if (typeof module !== "undefined") module.exports = { Windows };
