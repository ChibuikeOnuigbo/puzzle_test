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
    // find the nearest swaying ancestor (depth<=1) for a node
    const swayOf = (node) => {
      let n = node, guard = 0;
      while (n && !(n.swayPivot) && guard++ < 8) n = n._parent;
      return n && n.swayPivot ? n : null;
    };
    const tag = (node, parent) => { node._parent = parent; node.kids.forEach(k => tag(k, node)); };
    tag(root, null);

    const visit = (node) => {
      const isOuter = node.depth >= (tree.model.opt.maxDepth || 4) - 1;
      const inBand = (px, py) => py >= minY && py <= maxY && px > 8 && px < 1272;
      if (isOuter) {
        // the limb tip itself
        if (inBand(node.x2, node.y2)) {
          const sw = swayOf(node);
          out.push({
            x: node.x2, y: node.y2, ang: node.ang, tree: tree.id, face: tree.face,
            kind: "outerTip",
            s: tree.bare ? 1.05 : 0.98,
            sway: sw ? { px: sw.swayPivot.x, py: sw.swayPivot.y, amt: sw.swayAmt, dur: sw.swayDur } : null,
          });
        }
        // the thin free twig ends (the most "unconnected & oscillating" spots)
        for (const t of node.twigs) {
          if (inBand(t.x, t.y)) {
            const sw = swayOf(node);
            out.push({
              x: t.x, y: t.y, ang: t.ang, tree: tree.id, face: tree.face,
              kind: "twigTip",
              s: tree.bare ? 1.0 : 0.92,
              sway: sw ? { px: sw.swayPivot.x, py: sw.swayPivot.y, amt: sw.swayAmt, dur: sw.swayDur } : null,
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

  function anchors() {
    const all = [];
    for (const t of grown()) all.push(...anchorsFor(t));
    return all;
  }

  window.TreePerches = {
    rngFrom, growTree, grown, TREES, anchors,
  };
})();
