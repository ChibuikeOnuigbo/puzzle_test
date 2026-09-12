/* HOUSE 17 — ART LIBRARY (docs/GRAPHICS_PIPELINE.md)
   ============================================================================
   Upgraded house assets, each authored once and shipped in three VISIBLY
   DIFFERENT tiers — not a blur ladder:

     HIGH   full construction, texture strokes, secondary highlights,
            nuanced gradients, cast + contact shadows
     MEDIUM same construction, fewer texture clusters, simplified shading
     LOW    silhouette + major material masses + lighting logic preserved

   Every asset states its material, sits on its surface with a contact
   shadow, and honours Settings -> Graphics quality. Manifests describing
   reference sources live in art/manifests/.
============================================================================ */
"use strict";

const Art = (() => {
  const tier = () => { try { return (typeof Settings !== "undefined" && Settings.get("quality")) || "high"; } catch (e) { return "high"; } };
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const F = n => +n.toFixed(1);

  /* =====================================================================
     REFRIGERATOR — full rebuild (material: aged enamel over steel).
     3/4 front view with a visible right side plane, rounded door, gasket
     seam, bar handle, kick grille, floor contact shadow. open=true swings
     the door out with real thickness and shows shelf depth; milk bottles
     are passed in so the COUNTING PUZZLE art stays authoritative.
  ===================================================================== */
  function fridge(x, y, opt = {}) {
    /* TWO doors, two hinges of behaviour: the freezer leaf and the fridge
       leaf open INDEPENDENTLY (opt.freezerOpen / opt.open), each swinging on
       the left hinge at its own angle. The stance is near-frontal: a shallow
       right side plane and a thin top plane, no lean. */
    const q = tier(), open = !!opt.open, fOpen = !!opt.freezerOpen;
    const w = opt.w || 170, h = opt.h || 360;
    const sideW = q === "low" ? 0 : 14;
    const bx = x, by = y;
    const R = rng(opt.seed || 17);
    let s = "";
    s += `<ellipse cx="${F(bx + w / 2)}" cy="${F(by + h + 6)}" rx="${w * 0.62}" ry="11" fill="#0d0a08" opacity="0.5"/>`;
    if (sideW) {
      s += `<polygon points="${bx + w},${by + 3} ${bx + w + sideW},${by + 8} ${bx + w + sideW},${by + h - 3} ${bx + w},${by + h}" fill="#6a716c"/>`;
      s += `<polygon points="${bx + w},${by + 3} ${bx + w + sideW},${by + 8} ${bx + w + sideW},${by + h - 3} ${bx + w},${by + h}" fill="#241a11" opacity="0.25"/>`;
      s += `<polygon points="${bx + 3},${by} ${bx + w},${by + 3} ${bx + w + sideW},${by + 8} ${bx + 3 + sideW},${by + 5}" fill="#9aa19b"/>`;
    }
    /* carcase behind the doors */
    s += `<rect x="${bx}" y="${by}" width="${w}" height="${h}" rx="10" fill="#7d847f" stroke="#5d635f" stroke-width="3.4"/>`;
    const splitY = F(by + h * 0.33);
    const doors = [
      { top: by + 4, bot: splitY - 2, open: fOpen, handleH: h * 0.14, leaf: 54 },
      { top: splitY + 2, bot: by + h - 6, open: open, handleH: h * 0.28, leaf: 66 },
    ];
    doors.forEach((d, di) => {
      const dh = d.bot - d.top;
      if (!d.open) {
        /* closed leaf: own rounded panel, gasket seam, brushed sheen */
        s += `<rect x="${bx + 3}" y="${F(d.top)}" width="${w - 6}" height="${F(dh)}" rx="8" fill="#8f9691" stroke="#5d635f" stroke-width="2.6"/>`;
        if (q === "high") {
          for (let i = 0; i < 4; i++) {
            const lx = bx + 16 + i * (w - 32) / 4;
            s += `<line x1="${F(lx)}" y1="${F(d.top + 8)}" x2="${F(lx)}" y2="${F(d.bot - 8)}" stroke="#a7ada8" stroke-width="${(1 + R()).toFixed(1)}" opacity="0.26"/>`;
          }
          s += `<rect x="${bx + 8}" y="${F(d.top + 5)}" width="${w * 0.26}" height="${F(dh - 10)}" rx="7" fill="#cfd4d0" opacity="0.10"/>`;
        } else if (q === "medium") {
          s += `<rect x="${bx + 8}" y="${F(d.top + 5)}" width="${w * 0.22}" height="${F(dh - 10)}" rx="7" fill="#cfd4d0" opacity="0.12"/>`;
        }
        /* handle, hinge-left */
        s += `<rect x="${bx + 10}" y="${F(d.top + 10)}" width="9" height="${F(d.handleH)}" rx="4.5" fill="#5d635f"/>`;
        if (q !== "low") s += `<line x1="${bx + 12.5}" y1="${F(d.top + 14)}" x2="${bx + 12.5}" y2="${F(d.top + 8 + d.handleH)}" stroke="#8b928d" stroke-width="1.6" opacity="0.8"/>`;
      } else {
        /* OPEN leaf: cavity first, then the swung door panel */
        const cav = { x: bx + 8, y: F(d.top + 4), w: w - 16, h: F(dh - 8) };
        s += `<rect x="${cav.x}" y="${cav.y}" width="${cav.w}" height="${cav.h}" rx="4" fill="#1c2226"/>`;
        s += `<rect x="${cav.x}" y="${cav.y}" width="${cav.w}" height="${cav.h}" rx="4" fill="url(#lampglow)" opacity="0.34"/>`;
        s += `<rect x="${cav.x}" y="${cav.y}" width="7" height="${cav.h}" fill="#0f1417" opacity="0.8"/>`;
        s += `<rect x="${cav.x + cav.w - 7}" y="${cav.y}" width="7" height="${cav.h}" fill="#0f1417" opacity="0.6"/>`;
        const shelves = di === 0 ? [0.55] : [0.34, 0.62, 0.88];
        shelves.forEach((fr, i) => {
          const sy = cav.y + cav.h * fr;
          s += `<rect x="${cav.x + 5}" y="${F(sy)}" width="${cav.w - 10}" height="5" rx="2" fill="#39434c"/>`;
          if (q !== "low") s += `<line x1="${cav.x + 6}" y1="${F(sy)}" x2="${cav.x + cav.w - 6}" y2="${F(sy)}" stroke="#515d66" stroke-width="1.2"/>`;
          if (q === "high") s += `<rect x="${cav.x + 6}" y="${F(sy + 5)}" width="${cav.w - 12}" height="5" fill="#0d1114" opacity="0.5"/>`;
        });
        if (di === 0 && q !== "low") {
          /* freezer: two frost boxes on the single shelf */
          s += `<rect x="${cav.x + 12}" y="${F(cav.y + cav.h * 0.55 - 16)}" width="26" height="16" rx="2" fill="#dfe6ea" opacity="0.8"/>`;
          s += `<rect x="${cav.x + 44}" y="${F(cav.y + cav.h * 0.55 - 12)}" width="20" height="12" rx="2" fill="#c8d2d8" opacity="0.8"/>`;
        }
        /* the swung leaf: its own angle per door (freezer stiffer) */
        const swing = di === 0 ? 46 : 66, drop = di === 0 ? 22 : 34;
        s += `<polygon points="${bx},${F(d.top)} ${bx - swing},${F(d.top + drop)} ${bx - swing},${F(d.bot + drop + 8)} ${bx},${F(d.bot)}" fill="#7a817c" stroke="#5d635f" stroke-width="3"/>`;
        s += `<polygon points="${bx - swing},${F(d.top + drop)} ${bx - swing + 7},${F(d.top + drop + 3)} ${bx - swing + 7},${F(d.bot + drop + 4)} ${bx - swing},${F(d.bot + drop + 8)}" fill="#a7ada8"/>`;
        s += `<polygon points="${bx - swing + 7},${F(d.top + drop + 3)} ${bx - 7},${F(d.top + 6)} ${bx - 7},${F(d.bot - 4)} ${bx - swing + 7},${F(d.bot + drop + 4)}" fill="#c9ceca" opacity="0.9"/>`;
        if (q !== "low") {
          s += `<rect x="${bx - swing + 12}" y="${F(d.top + drop + 14)}" width="${swing - 20}" height="${F(dh * 0.5)}" rx="4" fill="none" stroke="#9aa19b" stroke-width="2" opacity="0.7"/>`;
        }
        s += `<ellipse cx="${bx + w * 0.3}" cy="${by + h + 4}" rx="${w * 0.5}" ry="9" fill="#a8c8da" opacity="0.08"/>`;
      }
    });
    /* the split seam between the two doors */
    s += `<line x1="${bx + 3}" y1="${splitY}" x2="${bx + w - 3}" y2="${splitY}" stroke="#3f443f" stroke-width="3"/>`;
    /* kick grille + feet */
    s += `<rect x="${bx + 10}" y="${by + h - 14}" width="${w - 20}" height="8" rx="3" fill="#4c514d"/>`;
    if (q === "high") for (let i = 0; i < 6; i++) s += `<line x1="${F(bx + 18 + i * (w - 36) / 6)}" y1="${by + h - 12}" x2="${F(bx + 18 + i * (w - 36) / 6)}" y2="${by + h - 8}" stroke="#333835" stroke-width="1.6"/>`;
    s += `<rect x="${bx + 12}" y="${by + h - 2}" width="16" height="8" fill="#3f443f"/><rect x="${bx + w - 28}" y="${by + h - 2}" width="16" height="8" fill="#3f443f"/>`;
    return s;
  }

  /* =====================================================================
     MILK BOTTLES — seated on a shelf line (baseline passed in)
  ===================================================================== */
  function milkRow(x, baseline, n, opt = {}) {
    const q = tier(); const gone = opt.goneIndex;
    if (!n) return "";
    const sp = n <= 3 ? 42 : (n === 4 ? 33 : 27), w = n <= 3 ? 24 : 18;
    let s = "";
    for (let i = 0; i < n; i++) {
      if (gone === i) continue;
      const bx = x + i * sp, by = baseline - 48;
      s += `<ellipse cx="${F(bx + w / 2)}" cy="${baseline}" rx="${w * 0.55}" ry="2.4" fill="#0d1114" opacity="0.5"/>`;
      s += `<rect x="${bx}" y="${by}" width="${w}" height="48" rx="5" fill="#e6e9e4"/>`;
      if (q !== "low") {
        s += `<rect x="${bx + 2}" y="${by + 4}" width="${w * 0.28}" height="40" rx="4" fill="#ffffff" opacity="0.5"/>`;
        s += `<rect x="${bx + w * 0.62}" y="${by + 6}" width="${w * 0.18}" height="36" rx="3" fill="#b9c0ba" opacity="0.5"/>`;
      }
      s += `<rect x="${F(bx + (w - 10) / 2)}" y="${by - 10}" width="10" height="12" fill="#e6e9e4"/>`;
      s += `<rect x="${F(bx + (w - 10) / 2)}" y="${by - 12}" width="10" height="5" rx="2" fill="#c9a35f"/>`;
    }
    return s;
  }

  /* =====================================================================
     RUBBISH BAGS — plastic with folds, ties, varied fullness (material:
     thin dark plastic, slightly translucent at the edges)
  ===================================================================== */
  function garbageBags(x, baseY, n, seed = 7) {
    const q = tier(); const R = rng(seed);
    let s = `<ellipse cx="${x}" cy="${baseY + 4}" rx="${34 + n * 22}" ry="11" fill="#0d0a08" opacity="0.45"/>`;
    for (let i = 0; i < n; i++) {
      const bw = 44 + R() * 26, bh = 52 + R() * 30;
      const cx = x + (i - (n - 1) / 2) * (bw * 0.72);
      const top = baseY - bh;
      const lean = (R() - 0.5) * 10;
      /* body: an irregular lumpy silhouette */
      s += `<path d="M${F(cx - bw / 2)},${baseY}
        C${F(cx - bw / 2 - 6)},${F(baseY - bh * 0.42)} ${F(cx - bw * 0.34 + lean)},${F(top + bh * 0.14)} ${F(cx - bw * 0.12 + lean)},${F(top + 6)}
        Q${F(cx + lean)},${top - 4} ${F(cx + bw * 0.14 + lean)},${F(top + 8)}
        C${F(cx + bw * 0.36 + lean)},${F(top + bh * 0.2)} ${F(cx + bw / 2 + 5)},${F(baseY - bh * 0.4)} ${F(cx + bw / 2)},${baseY} Z" fill="#14110e"/>`;
      /* inner sheen fold */
      s += `<path d="M${F(cx - bw * 0.28)},${F(baseY - 6)}
        C${F(cx - bw * 0.3)},${F(baseY - bh * 0.5)} ${F(cx - bw * 0.12 + lean)},${F(top + bh * 0.24)} ${F(cx + lean)},${F(top + 12)}
        C${F(cx + bw * 0.1)},${F(top + bh * 0.3)} ${F(cx + bw * 0.2)},${F(baseY - bh * 0.4)} ${F(cx + bw * 0.16)},${F(baseY - 6)} Z" fill="#23201c" opacity="0.75"/>`;
      /* tie / knot ears */
      s += `<path d="M${F(cx - 6 + lean)},${F(top + 8)} q${-7 + lean * 0.2},-9 -1,-14 q6,3 6,12 Z" fill="#14110e"/>`;
      s += `<path d="M${F(cx + 6 + lean)},${F(top + 8)} q${9 + lean * 0.2},-8 3,-14 q-6,2 -7,12 Z" fill="#1a1713"/>`;
      if (q === "high") {
        /* crease highlights + stress marks */
        s += `<path d="M${F(cx - bw * 0.2)},${F(baseY - bh * 0.3)} q${bw * 0.1},${-bh * 0.16} ${bw * 0.06},${-bh * 0.3}" stroke="#3a3a36" stroke-width="1.8" fill="none" opacity="0.55"/>`;
        s += `<path d="M${F(cx + bw * 0.16)},${F(baseY - bh * 0.26)} q${-bw * 0.04},${-bh * 0.14} 2,${-bh * 0.26}" stroke="#2f2f2b" stroke-width="1.6" fill="none" opacity="0.5"/>`;
        s += `<path d="M${F(cx - bw * 0.34)},${F(baseY - 10)} q${bw * 0.2},6 ${bw * 0.44},2" stroke="#0a0806" stroke-width="2" fill="none" opacity="0.5"/>`;
      } else if (q === "medium") {
        s += `<path d="M${F(cx - bw * 0.2)},${F(baseY - bh * 0.3)} q${bw * 0.08},${-bh * 0.18} ${bw * 0.05},${-bh * 0.28}" stroke="#33332f" stroke-width="1.6" fill="none" opacity="0.5"/>`;
      }
    }
    return s;
  }

  /* =====================================================================
     APPLE — radial shading, dimple, stem, seated contact shadow
  ===================================================================== */
  function apple(cx, cy, r, seed = 1) {
    const q = tier(); const R = rng(seed * 31 + (cx | 0));
    const col = ["#a5503c", "#9c4a36", "#b05a40"][Math.floor(R() * 3)];
    let s = `<ellipse cx="${cx}" cy="${F(cy + r * 0.86)}" rx="${F(r * 1.05)}" ry="${F(r * 0.3)}" fill="#0d0a08" opacity="0.4"/>`;
    if (q === "low") return s + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}"/><path d="M${cx},${cy - r + 1} q3,-6 6,-7" stroke="#46503a" stroke-width="2.6" fill="none"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}"/>`;
    s += `<path d="M${F(cx - r * 0.62)},${F(cy - r * 0.5)} q${r * 0.3},${-r * 0.5} ${r * 0.9},${-r * 0.16} q${-r * 0.7},${r * 0.1} ${-r * 0.9},${r * 0.16} Z" fill="#c97a5a" opacity="0.55"/>`;
    s += `<circle cx="${F(cx - r * 0.34)}" cy="${F(cy - r * 0.4)}" r="${F(r * 0.16)}" fill="#e0a884" opacity="0.7"/>`;
    s += `<path d="M${F(cx + r * 0.5)},${F(cy + r * 0.44)} q${-r * 0.4},${r * 0.28} ${-r * 0.94},0 q${r * 0.5},${r * 0.1} ${r * 0.94},0 Z" fill="#6d2f22" opacity="0.5"/>`;
    s += `<ellipse cx="${cx}" cy="${F(cy - r * 0.82)}" rx="${F(r * 0.3)}" ry="${F(r * 0.14)}" fill="#5d2a1e" opacity="0.8"/>`;
    s += `<path d="M${cx},${F(cy - r * 0.8)} q${r * 0.16},${-r * 0.5} ${r * 0.42},${-r * 0.62}" stroke="#46503a" stroke-width="${F(r * 0.16)}" fill="none" stroke-linecap="round"/>`;
    if (q === "high" && R() < 0.7) s += `<path d="M${F(cx + r * 0.3)},${F(cy - r * 0.9)} q${r * 0.5},${-r * 0.2} ${r * 0.66},${r * 0.12} q${-r * 0.42},${r * 0.06} ${-r * 0.66},${-r * 0.12} Z" fill="#5a6b42"/>`;
    return s;
  }

  /* =====================================================================
     FRAMED PAINTING — real frame (wood grain, bevel, inner edge, glass
     highlight, wall + contact shadow) around canvas art.
     kind: "hall" | "dining" | ... — data in PAINTING_DATA (generated from
     AI references by scripts/gen/painting.js, see art/manifests).
     HIGH: full cell rows + varnish + impasto strokes. MEDIUM: rows only.
     LOW: coarse block masses of the same image.
  ===================================================================== */
  function painting(kind, x, y, w, h, seed = 3) {
    const q = tier(); const R = rng(seed);
    const data = (typeof PAINTING_DATA !== "undefined" && PAINTING_DATA[kind]) || null;
    const fr = Math.max(6, Math.min(w, h) * 0.075);        // frame width
    const bx = x + fr, by = y + fr, bw = w - fr * 2, bh = h - fr * 2;
    let s = "";
    /* wall shadow + contact shadow */
    s += `<rect x="${x + 4}" y="${y + 6}" width="${w}" height="${h}" rx="2" fill="#0b0806" opacity="0.4"/>`;
    /* frame: outer wood, bevel, inner lip */
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#221a12" stroke="#4a3826" stroke-width="${F(fr * 0.5)}"/>`;
    s += `<rect x="${F(x + fr * 0.42)}" y="${F(y + fr * 0.42)}" width="${F(w - fr * 0.84)}" height="${F(h - fr * 0.84)}" fill="none" stroke="#5d4a35" stroke-width="${F(fr * 0.3)}" opacity="0.9"/>`;
    s += `<rect x="${F(bx - fr * 0.2)}" y="${F(by - fr * 0.2)}" width="${F(bw + fr * 0.4)}" height="${F(bh + fr * 0.4)}" fill="none" stroke="#0f0b08" stroke-width="2"/>`;
    if (q === "high") {
      for (let i = 0; i < 7; i++) {
        const gy = y + R() * h;
        s += `<line x1="${x + 1}" y1="${F(gy)}" x2="${F(x + fr * 0.4)}" y2="${F(gy + (R() - 0.5) * 6)}" stroke="#5d4a35" stroke-width="1" opacity="0.5"/>`;
        s += `<line x1="${F(x + w - fr * 0.4)}" y1="${F(gy)}" x2="${x + w - 1}" y2="${F(gy + (R() - 0.5) * 6)}" stroke="#5d4a35" stroke-width="1" opacity="0.5"/>`;
      }
    }
    /* the canvas */
    if (!data) {
      s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#3a3226"/>`;
    } else {
      const gw = data.gw, gh = data.gh, pal = data.palette, rows = data.rows;
      const cw = bw / gw, ch = bh / gh;
      const step = q === "low" ? 3 : 1;        /* LOW = big readable blocks */
      for (let gy = 0; gy < gh; gy += step) {
        const line = rows[gy];
        let gx = 0;
        while (gx < gw) {
          const c = line[gx];
          let run = 1;
          while (gx + run < gw && line[gx + run] === c) run++;
          s += `<rect x="${F(bx + gx * cw)}" y="${F(by + gy * ch)}" width="${F(run * cw + 0.5)}" height="${F(step * ch + 0.5)}" fill="${pal[parseInt(c, 36)]}"/>`;
          gx += run;
        }
      }
      /* varnish depth + a soft top light (high) */
      if (q === "high") {
        s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="url(#artvarnish-${kind})"/>`;
        for (let i = 0; i < 9; i++) {
          const sx = bx + R() * bw, sy = by + R() * bh, len = 4 + R() * 12, a = R() * Math.PI;
          s += `<line x1="${F(sx)}" y1="${F(sy)}" x2="${F(sx + Math.cos(a) * len)}" y2="${F(sy + Math.sin(a) * len)}" stroke="#f2e8d0" stroke-width="1" opacity="${(0.04 + R() * 0.07).toFixed(2)}"/>`;
        }
      } else if (q === "medium") {
        s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh * 0.4}" fill="#f2e8d0" opacity="0.04"/>`;
      }
    }
    /* glass sheen across the whole frame */
    if (q !== "low") s += `<path d="M${F(x + w * 0.14)},${y + h} L${F(x + w * 0.34)},${y} L${F(x + w * 0.42)},${y} L${F(x + w * 0.22)},${y + h} Z" fill="#dceaf4" opacity="0.05"/>`;
    /* hanging nail shadow */
    s += `<circle cx="${F(x + w / 2)}" cy="${y - 3}" r="2" fill="#0b0806" opacity="0.6"/>`;
    return s;
  }

  /* varnish gradient defs needed by paintings (inject into room defs) */
  function paintingDefs(kind) {
    return `<linearGradient id="artvarnish-${kind}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f2e8d0" stop-opacity="0.07"/>
      <stop offset="0.5" stop-color="#241a11" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#0b0806" stop-opacity="0.16"/>
    </linearGradient>`;
  }

  /* =====================================================================
     FIRE — layered flame model (docs/GRAPHICS_PIPELINE.md §fire).
     outer warm body / middle orange / bright inner / small tongues /
     dark gaps / embers. Never three triangles.
  ===================================================================== */
  function fire(cx, baseY, w, opt = {}) {
    const q = tier();
    const on = (typeof AnimReg !== "undefined") ? AnimReg.on("fireFlicker") : true;
    const h = opt.h || w * 1.05;
    const t = (base, alt, dur) => on ? `<animate attributeName="d" values="${base};${alt};${base}" dur="${dur}" repeatCount="indefinite"/>` : "";
    /* ember bed + logs */
    let s = `<ellipse cx="${cx}" cy="${baseY}" rx="${w * 0.62}" ry="${w * 0.14}" fill="#1a0f08"/>`;
    s += `<rect x="${F(cx - w * 0.42)}" y="${F(baseY - w * 0.1)}" width="${w * 0.84}" height="${w * 0.14}" rx="${w * 0.07}" fill="#241a11" transform="rotate(-5 ${cx} ${baseY})"/>`;
    s += `<rect x="${F(cx - w * 0.36)}" y="${F(baseY - w * 0.16)}" width="${w * 0.72}" height="${w * 0.12}" rx="${w * 0.06}" fill="#2c2115" transform="rotate(6 ${cx} ${baseY})"/>`;
    const emberN = q === "high" ? 8 : q === "medium" ? 5 : 3;
    for (let i = 0; i < emberN; i++) {
      const ex = cx + (i / (emberN - 1) - 0.5) * w * 0.8;
      s += `<circle cx="${F(ex)}" cy="${F(baseY - 2 - (i % 3) * 2)}" r="${F(1.4 + (i % 2))}" fill="#e86a2a" opacity="0.8">${on ? `<animate attributeName="opacity" values="0.8;0.3;0.8" dur="${(1.4 + i * 0.3).toFixed(1)}s" repeatCount="indefinite"/>` : ""}</circle>`;
    }
    /* outer warm body */
    const oB = `M${F(cx - w * 0.44)},${baseY} Q${F(cx - w * 0.5)},${F(baseY - h * 0.5)} ${F(cx - w * 0.14)},${F(baseY - h * 0.86)} Q${cx},${F(baseY - h * 1.04)} ${F(cx + w * 0.12)},${F(baseY - h * 0.8)} Q${F(cx + w * 0.48)},${F(baseY - h * 0.42)} ${F(cx + w * 0.44)},${baseY} Z`;
    const oA = `M${F(cx - w * 0.44)},${baseY} Q${F(cx - w * 0.42)},${F(baseY - h * 0.56)} ${F(cx - w * 0.1)},${F(baseY - h * 0.92)} Q${F(cx + w * 0.06)},${F(baseY - h * 1.0)} ${F(cx + w * 0.16)},${F(baseY - h * 0.74)} Q${F(cx + w * 0.4)},${F(baseY - h * 0.38)} ${F(cx + w * 0.44)},${baseY} Z`;
    s += `<path d="${oB}" fill="#c9531f" opacity="0.92">${t(oB, oA, "1.9s")}</path>`;
    /* middle orange */
    const mB = `M${F(cx - w * 0.3)},${baseY} Q${F(cx - w * 0.34)},${F(baseY - h * 0.42)} ${F(cx - w * 0.06)},${F(baseY - h * 0.68)} Q${F(cx + w * 0.02)},${F(baseY - h * 0.8)} ${F(cx + w * 0.1)},${F(baseY - h * 0.6)} Q${F(cx + w * 0.3)},${F(baseY - h * 0.3)} ${F(cx + w * 0.3)},${baseY} Z`;
    const mA = `M${F(cx - w * 0.3)},${baseY} Q${F(cx - w * 0.26)},${F(baseY - h * 0.5)} ${F(cx - w * 0.02)},${F(baseY - h * 0.74)} Q${F(cx + w * 0.08)},${F(baseY - h * 0.76)} ${F(cx + w * 0.14)},${F(baseY - h * 0.52)} Q${F(cx + w * 0.26)},${F(baseY - h * 0.26)} ${F(cx + w * 0.3)},${baseY} Z`;
    s += `<path d="${mB}" fill="#e8842a" opacity="0.95">${t(mB, mA, "1.4s")}</path>`;
    /* bright inner core */
    const iB = `M${F(cx - w * 0.14)},${baseY} Q${F(cx - w * 0.16)},${F(baseY - h * 0.3)} ${cx},${F(baseY - h * 0.5)} Q${F(cx + w * 0.14)},${F(baseY - h * 0.28)} ${F(cx + w * 0.14)},${baseY} Z`;
    const iA = `M${F(cx - w * 0.14)},${baseY} Q${F(cx - w * 0.1)},${F(baseY - h * 0.36)} ${F(cx + w * 0.03)},${F(baseY - h * 0.56)} Q${F(cx + w * 0.16)},${F(baseY - h * 0.24)} ${F(cx + w * 0.14)},${baseY} Z`;
    s += `<path d="${iB}" fill="#f6c96a">${t(iB, iA, "1.1s")}</path>`;
    /* small high-frequency tongues (high only) */
    if (q === "high") {
      [[-0.3, 0.3], [0.02, 0.42], [0.26, 0.28]].forEach(([ox, hh], i) => {
        const tx = cx + w * ox;
        const p1 = `M${F(tx - 4)},${baseY} Q${F(tx - 5)},${F(baseY - h * hh * 0.6)} ${tx},${F(baseY - h * hh)} Q${F(tx + 5)},${F(baseY - h * hh * 0.5)} ${F(tx + 4)},${baseY} Z`;
        const p2 = `M${F(tx - 4)},${baseY} Q${F(tx - 2)},${F(baseY - h * hh * 0.72)} ${F(tx + 2)},${F(baseY - h * hh * 0.9)} Q${F(tx + 6)},${F(baseY - h * hh * 0.44)} ${F(tx + 4)},${baseY} Z`;
        s += `<path d="${p1}" fill="#f6d896" opacity="0.85">${t(p1, p2, (0.6 + i * 0.22).toFixed(2) + "s")}</path>`;
      });
    }
    /* dark gaps at the flame roots */
    s += `<path d="M${F(cx - w * 0.2)},${baseY} q${w * 0.06},${-h * 0.1} ${w * 0.12},0 Z M${F(cx + w * 0.06)},${baseY} q${w * 0.05},${-h * 0.08} ${w * 0.1},0 Z" fill="#2a1207" opacity="0.8"/>`;
    /* rising embers */
    if (q !== "low" && on) {
      const en = q === "high" ? 5 : 3;
      for (let i = 0; i < en; i++) {
        const ex = cx + (i - en / 2) * w * 0.18;
        s += `<circle cx="${F(ex)}" cy="${baseY - h * 0.5}" r="${i % 2 ? 1.1 : 0.8}" fill="#f6a44a">
          <animate attributeName="cy" values="${F(baseY - h * 0.4)};${F(baseY - h * 1.2)}" dur="${(2.2 + i * 0.7).toFixed(1)}s" begin="${(i * 0.9).toFixed(1)}s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;0.9;0" dur="${(2.2 + i * 0.7).toFixed(1)}s" begin="${(i * 0.9).toFixed(1)}s" repeatCount="indefinite"/>
        </circle>`;
      }
    }
    return s;
  }

  /* =====================================================================
     FIREPLACE — masonry construction: chimney breast, stone courses with
     mortar, mantel shelf with crown, deep firebox with soot, hearthstone.
  ===================================================================== */
  function fireplace(x, y, opt = {}) {
    const q = tier(); const R = rng(opt.seed || 23);
    const w = opt.w || 340, h = opt.h || 400;      // breast width / full height
    const bx = x, by = y;                          // top of breast (ceiling)
    const openW = w * 0.56, openH = h * 0.44;      // firebox opening
    const ox = bx + (w - openW) / 2, oy = by + h * 0.36;
    let s = "";
    /* chimney breast */
    s += `<rect x="${bx}" y="${by}" width="${w}" height="${h}" fill="#463b30"/>`;
    s += `<rect x="${bx}" y="${by}" width="${w}" height="${h}" fill="url(#wallg)" opacity="0.4"/>`;
    /* stone courses (high: individual stones; medium: course lines; low: plain) */
    if (q === "high") {
      const rows = 8, ch = h / rows;
      for (let r = 0; r < rows; r++) {
        const yy = by + r * ch;
        let xx = bx + (r % 2 ? -w * 0.04 : 0);
        while (xx < bx + w) {
          const sw = w * (0.16 + R() * 0.14);
          const inOpening = (yy + ch > oy && yy < oy + openH && xx + sw > ox && xx < ox + openW);
          if (!inOpening) {
            const shade = 0.9 + R() * 0.25;
            s += `<rect x="${F(Math.max(bx, xx))}" y="${F(yy + 1.5)}" width="${F(Math.min(sw, bx + w - Math.max(bx, xx)) - 2)}" height="${F(ch - 3)}" rx="2.5" fill="#${Math.round(70 * shade).toString(16).padStart(2, "0")}${Math.round(59 * shade).toString(16).padStart(2, "0")}${Math.round(48 * shade).toString(16).padStart(2, "0")}" opacity="0.9"/>`;
          }
          xx += sw;
        }
      }
    } else if (q === "medium") {
      for (let r = 1; r < 8; r++) s += `<line x1="${bx}" y1="${F(by + r * h / 8)}" x2="${bx + w}" y2="${F(by + r * h / 8)}" stroke="#33291f" stroke-width="2.4" opacity="0.8"/>`;
    }
    /* mantel shelf + crown */
    const my = oy - 16;
    s += `<rect x="${bx - 14}" y="${my}" width="${w + 28}" height="16" rx="3" fill="#5d4a35"/>`;
    s += `<rect x="${bx - 14}" y="${my}" width="${w + 28}" height="5" rx="2" fill="#7d6248"/>`;
    s += `<rect x="${bx - 8}" y="${my + 16}" width="${w + 16}" height="6" fill="#3a2c1e"/>`;
    /* firebox opening: deep, sooted */
    s += `<rect x="${ox}" y="${oy}" width="${openW}" height="${openH}" fill="#0d0906"/>`;
    s += `<rect x="${ox}" y="${oy}" width="${openW}" height="${openH}" fill="none" stroke="#2c2115" stroke-width="6"/>`;
    if (q !== "low") {
      s += `<rect x="${ox + 4}" y="${oy + 4}" width="${openW - 8}" height="${openH - 8}" fill="none" stroke="#1c140d" stroke-width="3" opacity="0.9"/>`;
      /* inner reveal shading */
      s += `<polygon points="${ox},${oy} ${ox + 10},${oy + 8} ${ox + 10},${oy + openH - 6} ${ox},${oy + openH}" fill="#060402" opacity="0.8"/>`;
      s += `<polygon points="${ox + openW},${oy} ${ox + openW - 10},${oy + 8} ${ox + openW - 10},${oy + openH - 6} ${ox + openW},${oy + openH}" fill="#060402" opacity="0.7"/>`;
    }
    /* soot staining above the opening */
    s += `<path d="M${F(ox + openW * 0.12)},${oy} q${openW * 0.2},${-h * 0.09} ${openW * 0.4},0 q${openW * 0.22},${-h * 0.06} ${openW * 0.36},0 L${ox + openW},${oy} Z" fill="#1a140e" opacity="0.55"/>`;
    /* hearthstone */
    s += `<polygon points="${bx - 8},${by + h} ${bx + w + 8},${by + h} ${bx + w + 26},${by + h + 22} ${bx - 26},${by + h + 22}" fill="#57504a"/>`;
    s += `<polygon points="${bx - 26},${by + h + 22} ${bx + w + 26},${by + h + 22} ${bx + w + 26},${by + h + 30} ${bx - 26},${by + h + 30}" fill="#3d3833"/>`;
    if (q === "high") {
      s += `<line x1="${bx + w * 0.3}" y1="${by + h}" x2="${bx + w * 0.24}" y2="${by + h + 22}" stroke="#3d3833" stroke-width="2"/>`;
      s += `<line x1="${bx + w * 0.68}" y1="${by + h}" x2="${bx + w * 0.74}" y2="${by + h + 22}" stroke="#3d3833" stroke-width="2"/>`;
    }
    return { svg: s, opening: { x: ox, y: oy, w: openW, h: openH }, mantelY: my, baseY: by + h };
  }

  /* =====================================================================
     SOFA / ARMCHAIR / RUG / SIDE TABLE — the sitting room furniture
  ===================================================================== */
  function sofa(x, y, opt = {}) {
    const q = tier(); const w = opt.w || 300, h = opt.h || 150;
    const bx = x, by = y;
    const col = opt.col || "#5a3a30", dark = opt.dark || "#422a22", lite = opt.lite || "#6d4a3c";
    let s = `<ellipse cx="${F(bx + w / 2)}" cy="${F(by + h + 6)}" rx="${w * 0.56}" ry="12" fill="#0d0a08" opacity="0.5"/>`;
    /* back */
    s += `<rect x="${bx}" y="${by}" width="${w}" height="${h * 0.52}" rx="${h * 0.14}" fill="${dark}"/>`;
    /* arms */
    s += `<rect x="${bx - w * 0.04}" y="${F(by + h * 0.18)}" width="${w * 0.16}" height="${h * 0.7}" rx="${h * 0.1}" fill="${col}"/>`;
    s += `<rect x="${F(bx + w * 0.88)}" y="${F(by + h * 0.18)}" width="${w * 0.16}" height="${h * 0.7}" rx="${h * 0.1}" fill="${col}"/>`;
    /* seat cushions */
    const cush = 2;
    for (let i = 0; i < cush; i++) {
      const cw = (w * 0.84) / cush;
      const cx2 = bx + w * 0.08 + i * cw;
      s += `<rect x="${F(cx2 + 2)}" y="${F(by + h * 0.46)}" width="${F(cw - 4)}" height="${h * 0.3}" rx="${h * 0.09}" fill="${col}"/>`;
      if (q !== "low") s += `<path d="M${F(cx2 + 6)},${F(by + h * 0.5)} q${F(cw / 2 - 6)},${h * 0.06} ${F(cw - 12)},0" stroke="${dark}" stroke-width="2" fill="none" opacity="0.8"/>`;
    }
    /* front base + legs */
    s += `<rect x="${bx + w * 0.02}" y="${F(by + h * 0.72)}" width="${w * 0.96}" height="${h * 0.2}" rx="6" fill="${dark}"/>`;
    s += `<rect x="${F(bx + w * 0.08)}" y="${F(by + h * 0.9)}" width="12" height="${h * 0.12}" fill="#241a11"/><rect x="${F(bx + w * 0.86)}" y="${F(by + h * 0.9)}" width="12" height="${h * 0.12}" fill="#241a11"/>`;
    if (q === "high") {
      /* back cushion folds + piping + worn highlights */
      for (let i = 0; i < 2; i++) {
        const cw = (w * 0.84) / 2, cx2 = bx + w * 0.08 + i * cw;
        s += `<rect x="${F(cx2 + 4)}" y="${F(by + h * 0.06)}" width="${F(cw - 8)}" height="${h * 0.36}" rx="${h * 0.1}" fill="${lite}" opacity="0.5"/>`;
        s += `<path d="M${F(cx2 + 10)},${F(by + h * 0.14)} q${F(cw * 0.3)},${h * 0.08} ${F(cw * 0.62)},${h * 0.02}" stroke="${dark}" stroke-width="1.6" fill="none" opacity="0.6"/>`;
      }
      s += `<path d="M${F(bx + w * 0.02)},${F(by + h * 0.2)} q${w * 0.1},${-h * 0.06} ${w * 0.14},${h * 0.02}" stroke="${lite}" stroke-width="2" fill="none" opacity="0.5"/>`;
      s += `<path d="M${F(bx + w * 0.9)},${F(by + h * 0.2)} q${-w * 0.08},${-h * 0.06} ${-w * 0.12},${h * 0.02}" stroke="${lite}" stroke-width="2" fill="none" opacity="0.5"/>`;
    } else if (q === "medium") {
      s += `<rect x="${F(bx + w * 0.1)}" y="${F(by + h * 0.08)}" width="${w * 0.36}" height="${h * 0.3}" rx="${h * 0.1}" fill="${lite}" opacity="0.35"/>`;
    }
    /* a folded throw over one arm */
    if (q !== "low") {
      s += `<path d="M${F(bx - w * 0.03)},${F(by + h * 0.2)} q${w * 0.08},${-h * 0.08} ${w * 0.15},${-h * 0.02} l${w * 0.02},${h * 0.4} q${-w * 0.1},${h * 0.06} ${-w * 0.17},0 Z" fill="#7d6248" opacity="0.9"/>`;
      if (q === "high") s += `<path d="M${F(bx)},${F(by + h * 0.26)} l${w * 0.12},${-h * 0.04} M${F(bx + 2)},${F(by + h * 0.36)} l${w * 0.12},${-h * 0.04}" stroke="#5d4a35" stroke-width="1.6" opacity="0.7"/>`;
    }
    return s;
  }

  function armchair(x, y, opt = {}) {
    const q = tier(); const w = opt.w || 130, h = opt.h || 140;
    const col = opt.col || "#4c4a3a", dark = "#38362a", lite = "#5d5a46";
    let s = `<ellipse cx="${F(x + w / 2)}" cy="${F(y + h + 4)}" rx="${w * 0.6}" ry="10" fill="#0d0a08" opacity="0.5"/>`;
    s += `<rect x="${x + w * 0.1}" y="${y}" width="${w * 0.8}" height="${h * 0.56}" rx="${w * 0.16}" fill="${dark}"/>`;
    s += `<rect x="${x}" y="${F(y + h * 0.24)}" width="${w * 0.2}" height="${h * 0.62}" rx="${h * 0.08}" fill="${col}"/>`;
    s += `<rect x="${F(x + w * 0.8)}" y="${F(y + h * 0.24)}" width="${w * 0.2}" height="${h * 0.62}" rx="${h * 0.08}" fill="${col}"/>`;
    s += `<rect x="${F(x + w * 0.14)}" y="${F(y + h * 0.5)}" width="${w * 0.72}" height="${h * 0.26}" rx="${h * 0.08}" fill="${col}"/>`;
    s += `<rect x="${F(x + w * 0.1)}" y="${F(y + h * 0.72)}" width="${w * 0.8}" height="${h * 0.18}" rx="5" fill="${dark}"/>`;
    s += `<rect x="${F(x + w * 0.16)}" y="${F(y + h * 0.88)}" width="9" height="${h * 0.12}" fill="#241a11"/><rect x="${F(x + w * 0.76)}" y="${F(y + h * 0.88)}" width="9" height="${h * 0.12}" fill="#241a11"/>`;
    if (q === "high") {
      s += `<rect x="${F(x + w * 0.2)}" y="${F(y + h * 0.08)}" width="${w * 0.6}" height="${h * 0.4}" rx="${w * 0.12}" fill="${lite}" opacity="0.4"/>`;
      s += `<path d="M${F(x + w * 0.24)},${F(y + h * 0.56)} q${w * 0.26},${h * 0.06} ${w * 0.52},0" stroke="${dark}" stroke-width="2" fill="none" opacity="0.8"/>`;
      s += `<circle cx="${F(x + w * 0.36)}" cy="${F(y + h * 0.26)}" r="1.8" fill="${dark}"/><circle cx="${F(x + w * 0.64)}" cy="${F(y + h * 0.26)}" r="1.8" fill="${dark}"/>`;
    }
    return s;
  }

  function rug(cx, cy, rx, ry, opt = {}) {
    const q = tier(); const col = opt.col || "#5d3a30";
    let s = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${col}"/>`;
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.86}" ry="${ry * 0.84}" fill="none" stroke="${opt.band || "#7d5446"}" stroke-width="3" opacity="0.8"/>`;
    if (q === "high") {
      s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.6}" ry="${ry * 0.58}" fill="none" stroke="${opt.band || "#7d5446"}" stroke-width="2" opacity="0.5"/>`;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        s += `<line x1="${F(cx + Math.cos(a) * rx * 0.3)}" y1="${F(cy + Math.sin(a) * ry * 0.3)}" x2="${F(cx + Math.cos(a) * rx * 0.52)}" y2="${F(cy + Math.sin(a) * ry * 0.52)}" stroke="${opt.band || "#7d5446"}" stroke-width="1.6" opacity="0.4"/>`;
      }
    } else if (q === "medium") {
      s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.5}" ry="${ry * 0.48}" fill="none" stroke="${opt.band || "#7d5446"}" stroke-width="2" opacity="0.4"/>`;
    }
    return s;
  }

  function sideTable(x, y, opt = {}) {
    const q = tier(); const w = opt.w || 70, h = opt.h || 90;
    let s = `<ellipse cx="${F(x + w / 2)}" cy="${F(y + h + 3)}" rx="${w * 0.6}" ry="6" fill="#0d0a08" opacity="0.45"/>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="9" rx="3" fill="#4a3826"/>`;
    if (q !== "low") s += `<rect x="${x + 2}" y="${y + 9}" width="${w - 4}" height="4" fill="#33261a"/>`;
    s += `<rect x="${F(x + w * 0.14)}" y="${y + 12}" width="7" height="${h - 14}" fill="#33261a"/>`;
    s += `<rect x="${F(x + w * 0.74)}" y="${y + 12}" width="7" height="${h - 14}" fill="#33261a"/>`;
    if (q === "high") s += `<rect x="${F(x + w * 0.2)}" y="${F(y + h * 0.55)}" width="${w * 0.6}" height="6" fill="#2c2115"/>`;
    return s;
  }

  /* =====================================================================
     LIGHTS — fixture bodies (the beams live in FX). Each light has a real
     physical identity: housing, bulb, shade, mounting.
  ===================================================================== */
  /* =====================================================================
     PENDANT CEILING LAMP — a real fixture, not a trapezoid: canopy on the
     ceiling, cord, socket stem, a bell shade drawn with curves (rounded
     dome, lip, dark inner mouth), a seated bulb, and a warm halo.
  ===================================================================== */
  function ceilingLamp(x, y, opt = {}) {
    const q = tier(); const on = opt.on !== false;
    const ceilY = opt.ceilY || 0;
    const w = opt.w || 30;                       // shade half-width
    const glow = on ? "#f0c884" : "#6b6154";
    let s = "";
    /* canopy + cord */
    s += `<path d="M${x - 9},${ceilY} L${x + 9},${ceilY} L${x + 5},${ceilY + 7} L${x - 5},${ceilY + 7} Z" fill="#2c241c"/>`;
    s += `<line x1="${x}" y1="${ceilY + 6}" x2="${x}" y2="${y}" stroke="#1c1610" stroke-width="3.4"/>`;
    if (q === "high") s += `<line x1="${x + 1.4}" y1="${ceilY + 8}" x2="${x + 1.4}" y2="${y}" stroke="#3a2f22" stroke-width="1" opacity="0.8"/>`;
    /* socket stem */
    s += `<rect x="${x - 4.5}" y="${y - 2}" width="9" height="12" rx="2.5" fill="#2c241c"/>`;
    /* the bell shade: domed crown, flared lip, dark inner mouth */
    s += `<path d="M${x - w},${y + 26} Q${x - w},${y + 8} ${x - w * 0.45},${y + 5} Q${x},${y + 2} ${x + w * 0.45},${y + 5} Q${x + w},${y + 8} ${x + w},${y + 26} L${x + w + 4},${y + 29} L${x - w - 4},${y + 29} Z" fill="#3a2f22"/>`;
    if (q === "high") {
      /* dome sheen + ribs */
      s += `<path d="M${x - w * 0.7},${y + 10} Q${x - w * 0.5},${y + 6} ${x - w * 0.1},${y + 5.6}" stroke="#5a4a36" stroke-width="2" fill="none" opacity="0.8"/>`;
      s += `<path d="M${x - w * 0.55},${y + 24} Q${x - w * 0.6},${y + 12} ${x - w * 0.2},${y + 7}" stroke="#241c13" stroke-width="1.2" fill="none" opacity="0.55"/>`;
      s += `<path d="M${x + w * 0.55},${y + 24} Q${x + w * 0.6},${y + 12} ${x + w * 0.2},${y + 7}" stroke="#241c13" stroke-width="1.2" fill="none" opacity="0.55"/>`;
      s += `<path d="M${x - w - 4},${y + 29} L${x + w + 4},${y + 29} L${x + w},${y + 31} L${x - w},${y + 31} Z" fill="#4c3f2e"/>`;
    } else if (q === "medium") {
      s += `<path d="M${x - w},${y + 26} Q${x - w},${y + 9} ${x - w * 0.4},${y + 6}" stroke="#4c3f2e" stroke-width="1.8" fill="none" opacity="0.7"/>`;
    }
    /* inner mouth of the shade */
    s += `<ellipse cx="${x}" cy="${y + 29}" rx="${w}" ry="4.6" fill="#171009"/>`;
    /* the bulb, seated inside the mouth (no halo blob: the room's FX light
       layer owns the pool of light beneath the fixture) */
    s += `<ellipse cx="${x}" cy="${y + 31}" rx="11" ry="7.4" fill="${glow}">${on ? `<animate attributeName="opacity" values="1;0.85;1;1" dur="7s" repeatCount="indefinite"/>` : ""}</ellipse>`;
    if (on && q === "high") s += `<ellipse cx="${x - 3}" cy="${y + 29}" rx="3.4" ry="2.2" fill="#fff4d8" opacity="0.8"/>`;
    return s;
  }

  function tableLamp(x, y, opt = {}) {
    const q = tier(); const on = !!opt.on;
    const shade = on ? "#c9a35f" : "#4a3d2c";
    let s = `<ellipse cx="${x}" cy="${y}" rx="20" ry="4" fill="#0d0a08" opacity="0.4"/>`;
    s += `<path d="M${x - 20},${y - 46} L${x + 20},${y - 46} L${x + 14},${y - 20} L${x - 14},${y - 20} Z" fill="${shade}"/>`;
    if (q === "high") s += `<path d="M${x - 20},${y - 46} L${x + 20},${y - 46} L${x + 18},${y - 42} L${x - 18},${y - 42} Z" fill="${on ? "#e0be78" : "#5a4a36"}"/>`;
    s += `<rect x="${x - 3}" y="${y - 20}" width="6" height="14" fill="#2c241c"/>`;
    s += `<ellipse cx="${x}" cy="${y - 4}" rx="12" ry="4" fill="#33261a"/>`;
    if (on && q !== "low") s += `<ellipse cx="${x}" cy="${y - 34}" rx="30" ry="22" fill="url(#lampglow)" opacity="0.6"/>`;
    return s;
  }

  /* =====================================================================
     TAP — a real fixture: base plate, column, curved spout, cross handles.
     opt.on draws the stream from the ACTUAL nozzle position.
  ===================================================================== */
  function tap(x, y, opt = {}) {
    const q = tier(); const on = !!opt.on;
    let s = "";
    /* base plate + column */
    s += `<ellipse cx="${x}" cy="${y}" rx="16" ry="5" fill="#565b60"/>`;
    s += `<rect x="${x - 6}" y="${y - 26}" width="12" height="26" rx="4" fill="#7a817c"/>`;
    if (q !== "low") s += `<line x1="${x - 3}" y1="${y - 24}" x2="${x - 3}" y2="${y - 2}" stroke="#9aa19b" stroke-width="2" opacity="0.7"/>`;
    /* curved spout ending at the nozzle */
    const nx = x + 34, ny = y - 20;
    s += `<path d="M${x},${y - 24} q0,-18 18,-18 q16,0 16,14 l0,6" fill="none" stroke="#7a817c" stroke-width="7" stroke-linecap="round"/>`;
    if (q !== "low") s += `<path d="M${x},${y - 26} q0,-16 18,-16" fill="none" stroke="#9aa19b" stroke-width="2" opacity="0.7"/>`;
    s += `<rect x="${nx - 4}" y="${ny - 2}" width="8" height="7" rx="2" fill="#565b60"/>`;
    /* cross handles */
    [-16, 16].forEach(dx => {
      const hx = x + dx, hy = y - 30;
      s += `<rect x="${hx - 2}" y="${y - 30}" width="4" height="8" fill="#565b60"/>`;
      s += `<circle cx="${hx}" cy="${hy}" r="5" fill="${on && dx < 0 ? "#c9a35f" : "#8f9691"}"/>`;
      s += `<path d="M${hx - 6},${hy} L${hx + 6},${hy} M${hx},${hy - 6} L${hx},${hy + 6}" stroke="#3f443f" stroke-width="2"/>`;
    });
    /* the stream: narrow at nozzle, slightly irregular, widening at impact */
    if (on) {
      const impact = opt.impactY != null ? opt.impactY : y + 20;
      if (q === "low") {
        s += `<path d="M${nx},${ny + 5} q2,${(impact - ny) * 0.5} 0,${impact - ny - 5}" stroke="#a8c8da" stroke-width="3" fill="none" opacity="0.7"/>`;
      } else {
        s += `<path d="M${nx - 2.4},${ny + 5} C${nx - 3},${F((ny + impact) / 2)} ${nx - 4},${F(impact - 8)} ${nx - 6},${impact} L${nx + 6},${impact} C${nx + 4},${F(impact - 8)} ${nx + 3},${F((ny + impact) / 2)} ${nx + 2.4},${ny + 5} Z" fill="#a8c8da" opacity="0.55"/>`;
        s += `<line x1="${nx}" y1="${ny + 6}" x2="${nx}" y2="${impact}" stroke="#e4f0f6" stroke-width="1.6" stroke-dasharray="4 6" opacity="0.8">${(typeof AnimReg === "undefined" || AnimReg.on("windowBirds")) ? "" : ""}</line>`;
        s += `<ellipse cx="${nx}" cy="${impact + 2}" rx="11" ry="3" fill="#a8c8da" opacity="0.5"/>`;
      }
    }
    return s;
  }

  /* =====================================================================
     SAFE / LOCKBOX — thick metal, recessed door, hinge side, scratches
  ===================================================================== */
  function safe(x, y, w, h, opt = {}) {
    const q = tier(); const open = !!opt.open;
    let s = `<ellipse cx="${x + w / 2}" cy="${y + h + 3}" rx="${w * 0.58}" ry="5" fill="#0d0a08" opacity="0.45"/>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="url(#metalg)" stroke="#22262a" stroke-width="3"/>`;
    if (q !== "low") {
      s += `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="3" fill="none" stroke="#565b60" stroke-width="1.4" opacity="0.6"/>`;
      /* hinge side */
      s += `<rect x="${x + w - 7}" y="${y + 6}" width="5" height="${h * 0.26}" rx="2" fill="#3a3e42"/>`;
      s += `<rect x="${x + w - 7}" y="${y + h * 0.62}" width="5" height="${h * 0.26}" rx="2" fill="#3a3e42"/>`;
      /* scratches + edge wear */
      s += `<path d="M${x + 8},${y + h - 8} l${w * 0.2},-3 M${x + w * 0.5},${y + 6} l${w * 0.16},2" stroke="#8a9094" stroke-width="1" opacity="0.5"/>`;
    }
    if (open) {
      s += `<rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" rx="2" fill="#15181b"/>`;
      /* the lifted lid, hinged back-left, with real thickness */
      s += `<rect x="${x - 4}" y="${y - h * 0.52}" width="${w + 2}" height="${h * 0.5}" rx="4" fill="#3a3e42" transform="rotate(-16 ${x} ${y})"/>`;
      s += `<rect x="${x}" y="${y - h * 0.46}" width="${w - 8}" height="${h * 0.4}" rx="3" fill="#2b2f33" transform="rotate(-16 ${x} ${y})"/>`;
    } else {
      s += `<rect x="${F(x + w * 0.36)}" y="${F(y + h * 0.3)}" width="${F(w * 0.3)}" height="${F(h * 0.36)}" rx="2" fill="#15181b"/>`;
      s += `<circle cx="${x + w / 2}" cy="${F(y + h * 0.48)}" r="3.6" fill="#c9a35f"/>`;
      if (q === "high") s += `<circle cx="${x + w / 2}" cy="${F(y + h * 0.48)}" r="6.4" fill="none" stroke="#565b60" stroke-width="1.6"/>`;
    }
    return s;
  }

  return { tier, fridge, milkRow, garbageBags, apple, painting, paintingDefs, fire, fireplace, sofa, armchair, rug, sideTable, ceilingLamp, tableLamp, tap, safe, _rng: rng };
})();

(typeof window !== "undefined") && (window.Art = Art);
if (typeof module !== "undefined") module.exports = { Art };
