/* =====================================================================
   KNOCK — pushable things. Tap a knockable object more than 7 times and
   it tips or shatters: the fall is simulated (gravity-eased rotation with
   a small bounce and settle; shattering spawns ceramic shards and rolling
   fruit with velocity, restitution and friction), the crash/thud carries a
   reverb tail, and the pieces stay on the floor.

   The house disagrees with entropy: leave the room and after a random
   17-34 seconds it puts everything back, whole; on return the player
   notices. Knocked state and the house's repair schedule persist in State
   flags so saves keep the mess (or the tidied shelf).
===================================================================== */
/* global State, AudioM, Dialogue */
const Knock = (() => {
  "use strict";

  /* bb: the object's own bounding box in its local coordinates, read from
     the room art, so the physics is identical with or without getBBox. */
  const CFG = [
    { room: "kitchen", hs: "bowl", target: "v_bowl", kind: "shatter", dir: 1, label: "the bowl of apples", shard: "#9fb3b8", n: 9, apples: 3, bb: { x: 390, y: 562, w: 176, h: 72 } },
    { room: "kitchen", hs: "cup", target: "v_cup", kind: "shatter", dir: -1, label: "the teacup", shard: "#c9b8a0", n: 6, bb: { x: 556, y: 578, w: 50, h: 34 } },
    { room: "diningroom", hs: "smallchair", target: "v_smallchair", kind: "tip", dir: 1, label: "the small chair", bb: { x: 834, y: 464, w: 70, h: 224 } },
    { room: "bathroom", hs: "bstand", target: "v_bstand", kind: "tip", dir: 1, label: "the washstand", shard: "#b8bdc1", n: 6, bb: { x: 160, y: 414, w: 160, h: 196 } },
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

  /* settled pieces, deterministic per object: for re-renders after the fall */
  function settledArt(cfg, bb, floorY) {
    const R = rng32(hash(cfg.hs));
    const pieces = makePieces(cfg, bb, floorY, R);
    for (let t = 0; t < 2.4; t += 0.03) stepPieces(pieces, 0.03, floorY);
    return pieces.map(drawPiece).join("");
  }

  /* ---------- applying a knocked pose to the live DOM ------------------ */
  function applyPose(holder, cfg) {
    const el = holder.querySelector("#" + cfg.target);
    if (!el) return;
    const bb = cfg.bb;
    const floorY = bb.y + bb.h + (cfg.kind === "tip" ? 2 : 4);
    if (cfg.kind === "tip") {
      const px = cfg.dir > 0 ? bb.x + bb.w : bb.x;
      const py = bb.y + bb.h;
      el.setAttribute("transform", `${origT(el)} rotate(${(94 * cfg.dir).toFixed(0)} ${px.toFixed(0)} ${py.toFixed(0)})`);
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
    const px = cfg.dir > 0 ? bb.x + bb.w : bb.x, py = bb.y + bb.h;
    const ang = 94 * cfg.dir;
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
              ? [`${cap(cfg.label)} lets go all at once. The sound is bigger than the thing; the walls hand it back twice.`,
                 `It breaks the way small things do — completely. Pieces everywhere, and my ears ringing with the room's own echo.`][hash(cfg.hs) % 2]
              : [`${cap(cfg.label)} tips over slow, then fast, and the floor takes it with a dull knock.`,
                 `Over it goes. I watched the whole fall and did nothing. That is the worst part.`][hash(cfg.hs) % 2]);
          } catch (e) {}
        }
      }
      if (pieces) {
        stepPieces(pieces, dt, floorY);
        dyn.innerHTML = pieces.map(drawPiece).join("");
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
                `${cap(cfg.label)} is back where it was. Whole. The floor keeps no memory of the pieces.`,
                `Someone set ${cfg.label} upright again. No sound of it happening. No sound of anything happening.`,
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
