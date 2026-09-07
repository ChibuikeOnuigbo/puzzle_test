/* =====================================================================
   HOUSE 17 — TREE STRUCTURE MAP (shared by the renderer and the birds)
   ---------------------------------------------------------------------
   The foreground framing trees are "grown" deterministically here from a
   seed, exactly once. The room renderer draws the limbs from THIS model
   (so what you see is the map), and the bird engine reads the SAME model
   to find where it is allowed to land.

   Each node is labelled by role:
     * "stem"  - the trunk (depth 0), rooted at the ground; it only rocks.
     * "branch" - a limb whose base is connected to another limb (depth>=1).
     * a branch whose far end splits into only smaller twigs / carries the
       foliage is a FREE OUTER branch: its tip is not connected to anything
       beyond it, so it swings/oscillates on its own pivot and is the place
       a bird can grip with its legs.

   Exposes:
     TreePerches.growTree(seed, x, baseY, h, opt) -> node tree + flat list
     TreePerches.foreground()                       -> the two edge trees
     TreePerches.anchors()                          -> perch points for birds
   ===================================================================== */
(function () {
  "use strict";

  function rngFrom(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ t >>> 15, 1 | t);
      r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }

  /* Grow one tree. This mirrors the drawing math EXACTLY (same R() call
     order, including the canopy ellipses) so recorded tip coordinates sit
     on the limbs that are actually painted. */
  function growTree(seed, x, baseY, h, opt = {}) {
    const R = rngFrom(seed);
    const bare = !!opt.bare;
    const lean = opt.lean || 0;
    const maxDepth = opt.maxDepth || 4;
    const swayDur = opt.swayDur || 9;
    const swayAmt = opt.swayAmt || 0.5;
    const nodes = [];
    let id = 0;

    function limb(x1, y1, ang, len, w, depth) {
      const bend = (R() - 0.5) * 0.44;
      const cx = x1 + Math.cos(ang + bend * 0.4) * len * 0.5;
      const cy = y1 + Math.sin(ang + bend * 0.4) * len * 0.5;
      const x2 = x1 + Math.cos(ang + bend) * len;
      const y2 = y1 + Math.sin(ang + bend) * len;

      const node = {
        id: id++, x1, y1, x2, y2, cx, cy, w: Math.max(1.1, w),
        ang: ang + bend, len, depth,
        role: depth === 0 ? "stem" : "branch",
        freeTip: false,            // set below for the outer, unconnected ends
        canopies: [], twigs: [], kids: [],
        swayPivot: null, swayAmt: 0, swayDur: 0,
      };

      // canopy blob just behind a fork (matches renderer R() order)
      if (!bare && depth >= 2 && R() < 0.4) {
        const rs = len * (0.34 + R() * 0.2);
        node.canopies.push({ x: x2 - rs * 0.4, y: y2 - rs * 0.3, rx: rs * 0.9, ry: rs * 0.42, a: 0.95 });
      }
      // free twigs poking past the outer canopy — the very ends a bird grips
      if (!bare && depth >= maxDepth - 1) {
        for (let k = 0; k < 2; k++) {
          const ta = ang + (R() - 0.5) * 1.1;
          const tl = len * (0.5 + R() * 0.4);
          node.twigs.push({ x: x2 + Math.cos(ta) * tl, y: y2 + Math.sin(ta) * tl, ang: ta, len: tl });
        }
      }
      // large canopy blob
      if (!bare && depth >= 3 && R() < 0.75) {
        const rr = len * (0.6 + R() * 0.4);
        node.canopies.push({ x: x2, y: y2 - rr * 0.18, rx: rr * (1.15 + R() * 0.55), ry: rr * (0.48 + R() * 0.2), a: 1 });
        node.canopies.push({ x: x2 + rr * 0.5, y: y2 - rr * 0.42, rx: rr * 0.8, ry: rr * 0.34, a: 0.9 });
      }

      if (depth >= maxDepth) { node.freeTip = true; nodes.push(node); return node; }

      const kids = depth === 0 ? 3 : (bare ? (R() < 0.5 ? 3 : 2) : (R() < 0.35 ? 3 : 2));
      for (let i = 0; i < kids; i++) {
        const spread = (i - (kids - 1) / 2) * (0.52 + R() * 0.34) + (R() - 0.5) * 0.3;
        const child = limb(x2, y2, ang + spread, len * (0.64 + R() * 0.14), w * 0.6, depth + 1);
        node.kids.push(child);
      }
      if (depth < 2) {
        const child = limb(x2, y2, ang + (R() - 0.5) * 0.22, len * 0.76, w * 0.68, depth + 1);
        node.kids.push(child);
      }

      // limbs at depth<=1 swing as a group about their own root pivot
      if (depth <= 1) {
        node.swayPivot = { x: x1, y: y1 };
        node.swayAmt = swayAmt * (1.5 + depth * 0.7 + R() * 0.6);
        node.swayDur = swayDur * (0.5 + R() * 0.28);
      }
      nodes.push(node);
      return node;
    }

    const trunkW = Math.max(9, h * 0.042);
    const root = limb(x, baseY, -Math.PI / 2 + lean, h * 0.34, trunkW, 0);
    return { root, nodes, seed, x, baseY, h, opt, bare };
  }

  /* The two huge edge trees framing the porch — exact same arguments the
     renderer uses, so the perch map sits on the painted branches. */
  const TREES = [
    { id: "edgeL", seed: 7,  x: 34,   baseY: 714, h: 560, opt: { swayDur: 9,  swayAmt: 0.45, lean: 0.07 }, face: 1 },
    { id: "edgeR", seed: 13, x: 1248, baseY: 722, h: 600, opt: { bare: true, swayDur: 11, swayAmt: 0.55, lean: -0.06 }, face: -1 },
  ];

  let _grown = null;
  function grown() {
    if (_grown) return _grown;
    _grown = TREES.map(t => ({ ...t, model: growTree(t.seed, t.x, t.baseY, t.h, t.opt) }));
    return _grown;
  }

  /* Walk a tree and collect the points a bird may grip: the FREE OUTER
     branch tips (deep limb ends + the thin twig ends) that lie in the
     on-screen porch band, with the sway pivot of the outer limb so a
     perched bird can oscillate with that branch. */
  function anchorsFor(tree) {
    const out = [];
    const { root } = tree.model;
    const minY = 190, maxY = 486;          // porch band a bird can settle in
    const tag = (node, parent) => { node._parent = parent; node.kids.forEach(k => tag(k, node)); };
    tag(root, null);
    // The FULL chain of wind transforms that move a given limb, outermost
    // first, exactly as the renderer nests them:
    //   whole tree rocks about its base  ->  the stem's own rock about the base
    //   -> the main limb's swing about its own root.
    // A bird gripping the limb is pushed through the same chain each frame,
    // so its feet stay on the painted wood.
    const opt = tree.opt || {};
    const chainOf = (node) => {
      const chain = [{ px: tree.x, py: tree.baseY, amt: opt.swayAmt || 0.5, dur: opt.swayDur || 9, what: "tree" }];
      const anc = [];
      for (let n = node; n; n = n._parent) if (n.swayPivot) anc.unshift(n);
      for (const n of anc) chain.push({ px: n.swayPivot.x, py: n.swayPivot.y, amt: n.swayAmt, dur: n.swayDur, what: n.depth === 0 ? "stem" : "main branch", limb: n.id });
      return chain;
    };
    const legacySway = (chain) => { const l = chain[chain.length - 1]; return { px: l.px, py: l.py, amt: l.amt, dur: l.dur, limb: l.limb, tree: tree.id }; };

    const visit = (node) => {
      const isOuter = node.depth >= (tree.model.opt.maxDepth || 4) - 1;
      const inBand = (px, py) => py >= minY && py <= maxY && px > 8 && px < 1272;
      if (isOuter) {
        const chain = chainOf(node);
        // the limb tip itself
        if (inBand(node.x2, node.y2)) {
          out.push({
            x: node.x2, y: node.y2, ang: node.ang, tree: tree.id, face: tree.face,
            kind: "outerTip", role: "outer free branch", limb: node.id,
            s: tree.bare ? 1.05 : 0.98,
            sway: legacySway(chain), swayChain: chain,
          });
        }
        // the thin free twig ends (the most "unconnected & oscillating" spots)
        for (const t of node.twigs) {
          if (inBand(t.x, t.y)) {
            out.push({
              x: t.x, y: t.y, ang: t.ang, tree: tree.id, face: tree.face,
              kind: "twigTip", role: "free twig", limb: node.id,
              s: tree.bare ? 1.0 : 0.92,
              sway: legacySway(chain), swayChain: chain,
            });
          }
        }
      }
      node.kids.forEach(visit);
    };
    visit(root);

    // de-duplicate points that landed within a few px of each other
    const picked = [];
    for (const a of out) {
      if (!picked.some(p => Math.hypot(p.x - a.x, p.y - a.y) < 26)) picked.push(a);
    }
    return picked;
  }

  /* The exact angle (degrees) a sway group is rotated by at SVG time t. The
     renderer animates values="-amt;amt;-amt" over dur seconds with the default
     linear calcMode, so the angle is a triangle wave. */
  function swayAngleAt(s, t) {
    if (!s || !s.dur) return 0;
    const f = ((t / s.dur) % 1 + 1) % 1;
    const tri = f < 0.5 ? f * 2 : 2 - f * 2;      // 0 -> 1 -> 0
    return -s.amt + 2 * s.amt * tri;
  }

  function anchors() {
    const all = [];
    for (const t of grown()) all.push(...anchorsFor(t));
    return all;
  }

  /* A human-readable MAP of each tree: which limb is the stem, which are
     connected branches, and which are the OUTER FREE branches (their far end
     is not connected to anything, so they swing on their own and are the
     only places a bird may grip). Used by the debug overlay (Birds.treeMap)
     and by anyone reading the structure. */
  function describe() {
    return grown().map(t => {
      const maxDepth = t.model.opt.maxDepth || 4;
      const sections = t.model.nodes.map(n => {
        const outer = n.depth >= maxDepth - 1;
        const kind = n.depth === 0 ? "stem"
          : outer ? "outer free branch"
          : (n.depth === 1 ? "main branch" : "branch");
        return {
          id: n.id, kind, depth: n.depth,
          from: [Math.round(n.x1), Math.round(n.y1)], to: [Math.round(n.x2), Math.round(n.y2)],
          mid: [Math.round(n.cx), Math.round(n.cy)],
          connectedEnd: "from",                       // the base is always attached
          freeEnd: outer ? "to" : null,               // outer limbs end in the air
          sways: !!n.swayPivot,
          swayPivot: n.swayPivot ? [Math.round(n.swayPivot.x), Math.round(n.swayPivot.y)] : null,
          twigs: n.twigs.map(tw => [Math.round(tw.x), Math.round(tw.y)]),
        };
      });
      return {
        tree: t.id, seed: t.seed, base: [t.x, t.baseY], height: t.h, bare: !!t.bare,
        counts: {
          stem: sections.filter(s => s.kind === "stem").length,
          mainBranches: sections.filter(s => s.kind === "main branch").length,
          branches: sections.filter(s => s.kind === "branch").length,
          outerFree: sections.filter(s => s.kind === "outer free branch").length,
        },
        sections,
        perches: anchorsFor(t).map(a => ({ x: Math.round(a.x), y: Math.round(a.y), role: a.role, limb: a.limb, swayLimb: a.sway ? a.sway.limb : null })),
      };
    });
  }

  window.TreePerches = {
    rngFrom, growTree, grown, TREES, anchors, describe, swayAngleAt,
  };
})();
