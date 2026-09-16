/* =====================================================================
   KNOCK — pushable things. Tap a knockable object more than 7 times and
   it tips or shatters: the fall is simulated (gravity-eased rotation with
   a small bounce and settle; shattering spawns ceramic shards and rolling
   fruit with velocity, restitution and friction), the crash/thud carries a
   reverb tail, and the pieces stay on the floor.

   ASSET TREE: entries may declare children (things resting on them) and a
   parent. When a parent falls, every child rides the same rotation about
   the parent's pivot — the cup goes over with the table, the jug with the
   washstand — while each child can still be knocked on its own.

   SHADOWS: every knockable's contact shadow (class .kshadow) is
   counter-rotated while the object falls and stretched out under the
   lying body once it lands; shatter debris casts its own scatter shadow.

   The house disagrees with entropy: leave the room and after a random
   17-34 seconds it puts everything back, whole; on return the player
   notices. Knocked state and the repair schedule persist in State flags.
===================================================================== */
/* global State, AudioM, Dialogue */
const Knock = (() => {
  "use strict";

  /* bb: the object's own bounding box in local coordinates, read from the
     room art, so the physics is identical with or without getBBox. */
  const CFG = [
    { room: "kitchen", hs: "bowl", target: "v_bowl", kind: "shatter", dir: 1, label: "the bowl of apples", shard: "#9fb3b8", n: 9, apples: 3, bb: { x: 390, y: 562, w: 176, h: 72 } },
    { room: "kitchen", hs: "ktable", target: "v_table", kind: "tip", dir: 1, label: "the kitchen table", bb: { x: 290, y: 584, w: 364, h: 122 }, children: ["cup"] },
    { room: "kitchen", hs: "cup", target: "v_cup", kind: "shatter", dir: -1, parent: "ktable", label: "the teacup", shard: "#c9b8a0", n: 6, bb: { x: 556, y: 578, w: 50, h: 34 } },
    { room: "diningroom", hs: "smallchair", target: "v_smallchair", kind: "tip", dir: 1, label: "the small chair", bb: { x: 834, y: 464, w: 70, h: 224 } },
    { room: "bathroom", hs: "bstand", target: "v_bstand", kind: "tip", dir: 1, label: "the washstand", shard: "#b8bdc1", n: 6, bb: { x: 160, y: 414, w: 160, h: 196 } },
    { room: "bathroom", hs: "bjug", target: "v_bjug", kind: "tip", dir: 1, parent: "bstand", label: "the jug", bb: { x: 232, y: 408, w: 46, h: 62 } },
    { room: "study", hs: "slamp", target: "v_slamp", kind: "tip", dir: -1, label: "the desk lamp", shard: "#d8b46a", n: 5, bb: { x: 436, y: 364, w: 42, h: 38 } },
    { room: "conservatory", hs: "wcan", target: "v_wcan", kind: "tip", dir: 1, label: "the watering can", bb: { x: 530, y: 638, w: 60, h: 28 } },
    { room: "washroom", hs: "wstool", target: "v_wstool", kind: "tip", dir: -1, label: "the stool", bb: { x: 180, y: 440, w: 80, h: 104 } },
  ];
  const byHs = {};
  CFG.forEach((c) => { byHs[c.room + ":" + c.hs] = c; });

  const taps = {};          /* runtime tap counters, reset on leaving */
  const noticed = {};       /* repair comments already said */
  let raf = 0;

  const rng32 = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hash = (s) => { let h = 9; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 387420489); return h >>> 0; };

  const knocked = (hs) => !!State.flag("knock:" + hs);
  const reduced = () => { try { return typeof Settings !== "undefined" && Settings.get("reducedMotion"); } catch (e) { return false; } };

  function origT(el) {
    if (el.dataset.ot === undefined) el.dataset.ot = el.getAttribute("transform") || "";
    return el.dataset.ot;
  }
  const pivotOf = (cfg) => {
    const bb = cfg.bb;
    return [cfg.dir > 0 ? bb.x + bb.w : bb.x, bb.y + bb.h];
  };
  const ANG = 94;

  /* ---------- shard physics: shared by live fall and static rebuild ---- */
  function makePieces(cfg, bb, floorY, R) {
    const pieces = [];
    const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
    for (let i = 0; i < (cfg.n || 8); i++) {
      const a = R() * Math.PI - Math.PI; /* up-left..up-right burst */
      const sp = 90 + R() * 190;
      pieces.push({
        kind: "shard",
        x: cx + (R() - 0.5) * bb.w * 0.7, y: cy + (R() - 0.5) * bb.h * 0.5,
        vx: Math.cos(a) * sp * (R() < 0.5 ? 1 : -1) * 0.7, vy: -Math.abs(Math.sin(a)) * sp,
        rot: R() * 360, vr: (R() - 0.5) * 720,
        s: 3 + R() * 7, col: cfg.shard, rest: 0.22 + R() * 0.14,
      });
    }
    for (let i = 0; i < (cfg.apples || 0); i++) {
      pieces.push({
        kind: "apple",
        x: cx + (i - 1) * 14, y: cy - 6,
        vx: (R() - 0.5) * 260 + cfg.dir * 60, vy: -60 - R() * 80,
        rot: 0, vr: 0, s: 8 + R() * 2, col: i % 2 ? "#a5503c" : "#5d7a5a", rest: 0.34,
      });
    }
    return pieces;
  }
  function stepPieces(pieces, dt, floorY) {
    pieces.forEach((p) => {
      p.vy += 1500 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const fy = floorY - p.s * 0.5;
      if (p.y > fy) {
        p.y = fy;
        if (Math.abs(p.vy) > 60) { p.vy = -p.vy * p.rest; p.vx *= 0.72; p.vr *= 0.6; }
        else { p.vy = 0; p.vx *= (p.kind === "apple" ? 0.985 : 0.8); p.vr = p.vx / p.s; }
      }
      if (p.kind === "apple" && p.y >= fy - 0.5 && Math.abs(p.vx) < 4) p.vr = 0;
    });
  }
  function drawPiece(p) {
    if (p.kind === "apple") {
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.s.toFixed(1)}" fill="${p.col}"/><path d="M${p.x.toFixed(1)},${(p.y - p.s).toFixed(1)} q2,-4 4,-5" stroke="#3a2c1e" stroke-width="1.6" fill="none"/>`;
    }
    const s = p.s;
    return `<polygon points="${(-s * 0.6).toFixed(1)},${(s * 0.4).toFixed(1)} ${(s * 0.5).toFixed(1)},${(s * 0.5).toFixed(1)} ${(s * 0.1).toFixed(1)},${(-s * 0.6).toFixed(1)}" fill="${p.col}" stroke="#0d0a08" stroke-width="0.6" opacity="0.95" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${p.rot.toFixed(0)})"/>`;
  }
  /* pieces plus one soft scatter shadow under the whole cluster */
  function drawPieces(pieces, floorY) {
    let mn = 1e9, mx = -1e9;
    pieces.forEach((p) => { mn = Math.min(mn, p.x - p.s); mx = Math.max(mx, p.x + p.s); });
    return `<ellipse cx="${((mn + mx) / 2).toFixed(0)}" cy="${(floorY + 3).toFixed(0)}" rx="${((mx - mn) / 2 + 5).toFixed(0)}" ry="3.5" fill="#0d0a08" opacity="0.3"/>`
      + pieces.map(drawPiece).join("");
  }

  /* settled pieces, deterministic per object: for re-renders after the fall */
  function settledArt(cfg, bb, floorY) {
    const R = rng32(hash(cfg.hs));
    const pieces = makePieces(cfg, bb, floorY, R);
    for (let t = 0; t < 2.4; t += 0.03) stepPieces(pieces, 0.03, floorY);
    return drawPieces(pieces, floorY);
  }

  /* ---------- the contact shadow follows the fall ---------------------- */
  function shadowPose(el, cfg, a, settle) {
    const sh = el.querySelector(".kshadow");
    if (!sh) return;
    const [px, py] = pivotOf(cfg);
    sh.setAttribute("transform", `rotate(${(-a).toFixed(1)} ${px.toFixed(0)} ${py.toFixed(0)})`);
    if (settle) {
      sh.setAttribute("cx", (px + cfg.dir * cfg.bb.h * 0.42).toFixed(0));
      sh.setAttribute("rx", (cfg.bb.h * 0.5).toFixed(0));
    }
  }

  const childEls = (holder, cfg, el) => (cfg.children || [])
    .map((h) => byHs[cfg.room + ":" + h])
    .filter(Boolean)
    .map((cc) => holder.querySelector("#" + cc.target))
    .filter((ce) => ce && (!el || !el.contains(ce))); /* nested art rides for free */

  /* ---------- applying a knocked pose to the live DOM ------------------ */
  function applyPose(holder, cfg) {
    const el = holder.querySelector("#" + cfg.target);
    if (!el) return;
    const bb = cfg.bb;
    const floorY = bb.y + bb.h + (cfg.kind === "tip" ? 2 : 4);
    const [px, py] = pivotOf(cfg);
    if (cfg.kind === "tip") {
      const a = ANG * cfg.dir;
      el.setAttribute("transform", `${origT(el)} rotate(${a.toFixed(0)} ${px.toFixed(0)} ${py.toFixed(0)})`);
      shadowPose(el, cfg, a, true);
      /* the asset tree: anything resting on it goes over with it */
      childEls(holder, cfg, el).forEach((ce) =>
        ce.setAttribute("transform", `${origT(ce)} rotate(${a.toFixed(0)} ${px.toFixed(0)} ${py.toFixed(0)})`));
    } else {
      el.style.display = "none";
    }
    /* pieces on the floor */
    if (cfg.kind !== "shatter" && !cfg.shard && !cfg.apples) return;
    let dyn = holder.querySelector("#knock-dyn");
    if (!dyn) {
      const mid = holder.querySelector("#layer-mid");
      if (!mid) return;
      mid.insertAdjacentHTML("beforeend", `<g id="knock-dyn" pointer-events="none"></g>`);
      dyn = holder.querySelector("#knock-dyn");
    }
    dyn.insertAdjacentHTML("beforeend", settledArt(cfg, bb, floorY));
  }

  /* ---------- the live fall ------------------------------------------- */
  function fall(cfg) {
    const holder = document.getElementById("scene-holder");
    const el = holder && holder.querySelector("#" + cfg.target);
    if (!el) return;
    const bb = cfg.bb;
    const floorY = bb.y + bb.h + (cfg.kind === "tip" ? 2 : 4);
    State.setFlag("knock:" + cfg.hs, true);
    if (reduced() || typeof requestAnimationFrame === "undefined") { applyPose(holder, cfg); return; }
    const ot = origT(el);
    const [px, py] = pivotOf(cfg);
    const ang = ANG * cfg.dir;
    const kids = childEls(holder, cfg, el).map((ce) => [ce, origT(ce)]);
    const t0 = performance.now();
    let impacted = false, pieces = null, lastT = t0;
    let dyn = holder.querySelector("#knock-dyn");
    if (!dyn) {
      holder.querySelector("#layer-mid").insertAdjacentHTML("beforeend", `<g id="knock-dyn" pointer-events="none"></g>`);
      dyn = holder.querySelector("#knock-dyn");
    }
    const step = (nowT) => {
      const t = (nowT - t0) / 1000;
      const dt = Math.min(0.05, (nowT - lastT) / 1000); lastT = nowT;
      if (!impacted) {
        const k = Math.min(1, t / 0.5);
        let a = ang * k * k;                    /* gravity-eased tip */
        if (t > 0.5 && t < 0.62) a = ang * 1.06; /* the little bounce */
        if (t >= 0.62) a = ang;
        el.setAttribute("transform", `${ot} rotate(${a.toFixed(1)} ${px.toFixed(0)} ${py.toFixed(0)})`);
        shadowPose(el, cfg, a, t >= 0.62);
        kids.forEach(([ce, cot]) =>
          ce.setAttribute("transform", `${cot} rotate(${a.toFixed(1)} ${px.toFixed(0)} ${py.toFixed(0)})`));
        if (t >= 0.5 && !impacted) {
          impacted = true;
          if (cfg.kind === "shatter" || cfg.shard) {
            if (cfg.kind === "shatter") el.style.display = "none";
            const R = rng32(hash(cfg.hs));
            pieces = makePieces(cfg, bb, floorY, R);
            AudioM.crash();
          } else AudioM.thud();
          try {
            Dialogue.say(cfg.kind === "shatter"
              ? ["Smashed. The echo outlasts it.", "It breaks all at once. Hm."][hash(cfg.hs) % 2]
              : ["Over it goes.", "Down it comes. The floor barely notices."][hash(cfg.hs) % 2]);
          } catch (e) {}
        }
      }
      if (pieces) {
        stepPieces(pieces, dt, floorY);
        dyn.innerHTML = drawPieces(pieces, floorY);
        const calm = pieces.every((p) => p.vy === 0 && Math.abs(p.vx) < 3);
        if (calm && t > 1.4) { raf = 0; return; }
      } else if (t > 0.8) { raf = 0; return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  /* ---------- tap hook from the hotspot wiring ------------------------ */
  function tap(hs, room) {
    const cfg = byHs[room + ":" + hs];
    if (!cfg || knocked(hs)) return;
    taps[hs] = (taps[hs] || 0) + 1;
    const holder = document.getElementById("scene-holder");
    const el = holder && holder.querySelector("#" + cfg.target);
    if (el && !reduced()) {
      const bb = cfg.bb;
      const px = bb.x + bb.w / 2, py = bb.y + bb.h;
      const w = Math.min(2 + taps[hs] * 0.9, 9) * cfg.dir;
      const ot = origT(el);
      el.setAttribute("transform", `${ot} rotate(${w.toFixed(1)} ${px.toFixed(0)} ${py.toFixed(0)})`);
      setTimeout(() => { if (!knocked(hs)) el.setAttribute("transform", ot); }, 130);
    }
    AudioM.clink(Math.min(taps[hs], 6));
    if (taps[hs] > 7) fall(cfg);
  }

  /* ---------- room enter/leave: the house tidies up -------------------- */
  function leave(room) {
    CFG.forEach((cfg) => {
      if (cfg.room !== room) return;
      taps[cfg.hs] = 0;
      if (knocked(cfg.hs) && !State.flag("knockFix:" + cfg.hs)) {
        State.setFlag("knockFix:" + cfg.hs, Date.now() + 17000 + Math.random() * 17000);
      }
    });
  }
  function sync(room) {
    const holder = document.getElementById("scene-holder");
    if (!holder) return;
    const old = holder.querySelector("#knock-dyn");
    if (old) old.remove(); /* render rebuilds; pieces must not accumulate */
    CFG.forEach((cfg) => {
      if (cfg.room !== room) return;
      if (knocked(cfg.hs)) {
        const fix = State.flag("knockFix:" + cfg.hs);
        if (fix && Date.now() > fix) {
          /* the house put it back while I was gone */
          State.setFlag("knock:" + cfg.hs, false);
          State.setFlag("knockFix:" + cfg.hs, false);
          if (!noticed[cfg.hs]) {
            noticed[cfg.hs] = true;
            try {
              State.addAware(1);
              Dialogue.say([
                `${cap(cfg.label)} is back where it was. Whole.`,
                `Set upright again. No sound of it happening.`,
              ][hash(cfg.hs) % 2]);
            } catch (e) {}
          }
        } else {
          applyPose(holder, cfg);
        }
      }
    });
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  return { tap, leave, sync, CFG };
})();
if (typeof module !== "undefined" && module.exports) module.exports = { Knock };
