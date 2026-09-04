/* HOUSE 17 — rooms: hand-authored SVG scenes + hotspot definitions.
   Visual bounds ≠ interaction bounds: every hotspot rect is deliberately larger than its visual. */
"use strict";

const Rooms = (() => {

  /* ---------- shared SVG snippets ---------- */
  const DEFS = `
  <defs>
    <linearGradient id="wallg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3d332a"/><stop offset="1" stop-color="#2c241d"/>
    </linearGradient>
    <linearGradient id="floorg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#241b14"/><stop offset="1" stop-color="#17110c"/>
    </linearGradient>
    <linearGradient id="nightg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#141b26"/><stop offset="1" stop-color="#1d2733"/>
    </linearGradient>
    <radialGradient id="lampglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#e8a04c" stop-opacity="0.55"/><stop offset="1" stop-color="#e8a04c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="coldglow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#7fa8c9" stop-opacity="0.4"/><stop offset="1" stop-color="#7fa8c9" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="woodg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a3826"/><stop offset="1" stop-color="#33261a"/>
    </linearGradient>
    <linearGradient id="metalg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a4d50"/><stop offset="1" stop-color="#2e3134"/>
    </linearGradient>
    <!-- soft blur bank for the FX light system: no hard vector edges on light -->
    <filter id="fxblur2"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="fxblur4"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="fxblur8"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="fxblur10"><feGaussianBlur stdDeviation="10"/></filter>
  </defs>`;

  const hs = (id, x, y, w, h, label, target) =>
    `<rect class="hotspot" data-hs="${id}" ${target ? `data-target="${target}"` : ""} data-label="${label}" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`;

  const clockFace = (cx, cy, r, hourDeg, minDeg, faceCol = "#d8c9a8") => `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${faceCol}" stroke="#221c16" stroke-width="${r * 0.08}"/>
    ${[0,90,180,270].map(a => `<line x1="${cx + Math.sin(a * Math.PI / 180) * r * 0.82}" y1="${cy - Math.cos(a * Math.PI / 180) * r * 0.82}" x2="${cx + Math.sin(a * Math.PI / 180) * r * 0.7}" y2="${cy - Math.cos(a * Math.PI / 180) * r * 0.7}" stroke="#221c16" stroke-width="${Math.max(1, r * 0.05)}"/>`).join("")}
    <line x1="${cx}" y1="${cy}" x2="${cx + Math.sin(hourDeg * Math.PI / 180) * r * 0.45}" y2="${cy - Math.cos(hourDeg * Math.PI / 180) * r * 0.45}" stroke="#221c16" stroke-width="${Math.max(1.5, r * 0.07)}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${cx + Math.sin(minDeg * Math.PI / 180) * r * 0.68}" y2="${cy - Math.cos(minDeg * Math.PI / 180) * r * 0.68}" stroke="#221c16" stroke-width="${Math.max(1, r * 0.045)}" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="${Math.max(1.5, r * 0.06)}" fill="#221c16"/>`;
  // 8:17 → hour ≈ 248.5°, minute = 102°
  const CLOCK_817 = (cx, cy, r, col) => clockFace(cx, cy, r, 248, 102, col);

  const person = (x, y, s, col, blur = false) => `
    <g ${blur ? 'filter="url(#blurf)" opacity="0.75"' : ""}>
      <circle cx="${x}" cy="${y - s * 0.78}" r="${s * 0.16}" fill="${col}"/>
      <path d="M${x - s * 0.2},${y} L${x - s * 0.16},${y - s * 0.6} Q${x},${y - s * 0.72} ${x + s * 0.16},${y - s * 0.6} L${x + s * 0.2},${y} Z" fill="${col}"/>
    </g>`;

  /* ---- pixel-art trees: hand bitmapped, monochrome with dark pixels ----
     No visual assets are loaded; the trees are drawn cell by cell from these
     bitmaps. Rows may be ragged; the renderer walks each row as a run of
     colour and emits one rect per run, so a whole row of foliage is a single
     node. Palette keys: t trunk, D dark speckle, M foliage, L moonlit rim. */
  const PX_PAL = { t: "#07090c", D: "#05070a", M: "#0a0e15", L: "#121a26" };
  function pxArt(rows, px, x, y, flip) {
    let out = "";
    for (let r = 0; r < rows.length; r++) {
      const row = flip ? [...rows[r]].reverse().join("") : rows[r];
      let c = 0;
      while (c < row.length) {
        const ch = row[c];
        if (ch === "." || ch === " ") { c++; continue; }
        let run = c + 1;
        while (run < row.length && row[run] === ch) run++;
        out += `<rect x="${x + c * px}" y="${y + r * px}" width="${(run - c) * px}" height="${px}" fill="${PX_PAL[ch] || PX_PAL.M}"/>`;
        c = run;
      }
    }
    return out;
  }
  const TREE_OAK = [
    ".........DDD..........",
    ".......DDMMMDD........",
    "......DMMMMMMMD.......",
    ".....DMMMMMMMMMD......",
    "....DMMMMMMMMMMMD.....",
    "...DMMMMMMMMMMMMMD....",
    "..DMMMMMMMMMMMMMMMD...",
    "..DMMMMMMMMMMMMMMMD...",
    ".DMMMMMMMMMMMMMMMMMLD.",
    ".DMMMMDDMMMMMMMMMMMLD.",
    "DDMMMMMDDMMMMMMMMMMMLD",
    "DDMMMMMDMMMMMMMMMMMLD.",
    ".DMMMMMDMMMMMMMMMMMD..",
    ".DMMMMMMMMMMDDMMMMMD..",
    "..DMMMMMMMMMMDMMMMD...",
    "..DMMMMMMMMMMMMMMMD...",
    "...DMMMMMMMMMMMMMD....",
    "...DDMMMMMMMMMMMDD....",
    "....DDMMMMMMMMMDD.....",
    ".....DDDMMMMMDDD......",
    "......DDDMMMDDD.......",
    "........DDDDD.........",
    "..........tt..........",
    "..........ttt.........",
    ".........tttt.........",
    ".........tttt.........",
    ".........tttt.........",
    "..........ttt.........",
    "..........ttt.........",
    "...........t..........",
  ];
  const TREE_DEAD = [
    "........ttt...........",
    ".......tttttt.........",
    "......ttt.tttt........",
    ".....tttt..ttttt......",
    "....ttttt...ttttt.....",
    "...tttttt....ttttt....",
    "..ttttttt.....ttttt...",
    ".ttttttt.......ttttt..",
    ".tttttt.........ttttt.",
    "ttttttt..........ttttt",
    ".ttttt...........tttt.",
    "..tttt............tt..",
    "...ttt..............tt",
    "....tt..............tt",
    ".....tt............tt.",
    "......tt..........tt..",
    ".......tt........tt...",
    "........tt......tt....",
    ".........tt....tt.....",
    "..........tt..tt......",
    "...........tttt.......",
    "............tt........",
    "............tt........",
    "............tt........",
    "............tt........",
    "............tt........",
  ];
  const TREE_CONIFER = [
    ".......t.......",
    ".......tt......",
    ".......tt......",
    "......tttt.....",
    "......ttttt....",
    ".....ttttttt...",
    ".....ttttttt...",
    "....ttttttttt..",
    "....ttttttttt..",
    "...ttttttttttt.",
    "...ttttttttttt.",
    "..tttttttttttt.",
    "..tttttttttttt.",
    ".ttttttttttttt.",
    ".ttttttttttttt.",
    ".ttttttttttttt.",
    "..ttttttttttt..",
    "..ttttttttttt..",
    "...ttttttttt...",
    "...ttttttttt...",
    "....ttttttt....",
    "....ttttttt....",
    ".....ttttt.....",
    "......ttt......",
    ".......tt......",
    ".......tt......",
    ".......tt......",
  ];
  /* a small perched bird: head, body, tail, and a soft dark shadow beneath */
  const bird = (x, y, s = 1) => `
    <ellipse cx="${x + 5 * s}" cy="${y + 5 * s}" rx="${7 * s}" ry="${2 * s}" fill="#04060a" opacity="0.5"/>
    <rect x="${x + 3 * s}" y="${y}" width="${6 * s}" height="${3 * s}" fill="#0a0e15"/>
    <rect x="${x}" y="${y + 1 * s}" width="${3 * s}" height="${2 * s}" fill="#0a0e15"/>
    <rect x="${x + 9 * s}" y="${y + 1 * s}" width="${4 * s}" height="${1 * s}" fill="#0a0e15"/>
    <rect x="${x + 2 * s}" y="${y + 1 * s}" width="${1 * s}" height="${1 * s}" fill="#121a26"/>`;

  /* a tuft of night grass: three thin blades */
  const tuft = (x, y, c) => `
    <g stroke="${c || "#162019"}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.9">
      <path d="M${x},${y} q3,-9 7,-11"/>
      <path d="M${x},${y} q0,-12 0,-13"/>
      <path d="M${x},${y} q-3,-9 -7,-11"/>
    </g>`;

  /* a fallen leaf, small and dull */
  const leaf = (x, y, r, rot, c) => `
    <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.6}" fill="${c || "#2a231a"}" opacity="0.75" transform="rotate(${rot} ${x} ${y})"/>`;

  /* branchwork for the oak: several limbs and twigs reaching from the trunk
     into the canopy, so the crown reads as connected wood, not a blob */
  const oakBranches = (x, y, px) => {
    const tx = x + 11 * px, ty = y + 13 * px;
    const w = Math.max(1.2, px * 0.4);
    const q = (dx, dy, ex, ey) => `M${tx},${ty} q${dx},${dy} ${ex},${ey}`;
    return `<g stroke="#05070a" stroke-width="${w}" fill="none" stroke-linecap="round" opacity="0.9">
      <path d="${q(-4 * px, -5 * px, -8 * px, -11 * px)}"/>
      <path d="${q(-px, -7 * px, px, -14 * px)}"/>
      <path d="${q(4 * px, -5 * px, 7 * px, -11 * px)}"/>
      <path d="${q(-2 * px, -4 * px, -4 * px, -8 * px)}"/>
      <path d="${q(2 * px, -4 * px, 4 * px, -8 * px)}"/>
      <path d="M${tx - 4 * px},${ty - 8 * px} q-${2 * px},-${3 * px} -${4 * px},-${5 * px}"/>
      <path d="M${tx + 4 * px},${ty - 8 * px} q${2 * px},-${3 * px} ${4 * px},-${5 * px}"/>
    </g>`;
  };

  /* render a tree from a bitmap: pixel art plus optional branchwork, all
     swayed by the wind around the trunk's foot (skipped under reduced motion) */
  const pixTree = (bitmap, px, x, base, opt = {}) => {
    const rows = bitmap.length;
    const y = base - rows * px;
    const pivotCol = opt.pivotCol != null ? opt.pivotCol : bitmap[0].length / 2;
    const cx = x + pivotCol * px;
    let inner = pxArt(bitmap, px, x, y, opt.flip);
    if (opt.branches) inner += oakBranches(x, y, px);
    if (Settings.get("reducedMotion") || !opt.swayDur) return inner;
    const amt = opt.swayAmt != null ? opt.swayAmt : 0.9;
    return `<g>${inner}<animateTransform attributeName="transform" type="rotate" values="-${amt} ${cx} ${base};${amt} ${cx} ${base};-${amt} ${cx} ${base}" dur="${opt.swayDur}s" repeatCount="indefinite"/></g>`;
  };

  /* a leaf torn off the trees and carried sideways by the wind */
  const blowLeaf = (y, dur, sx, c) => `
    <g>
      <ellipse cx="-30" cy="${y}" rx="${6 * sx}" ry="${3.5 * sx}" fill="${c || "#3a352c"}" opacity="0.75" transform="rotate(20 -30 ${y})"/>
      <animateTransform attributeName="transform" type="translate" values="-60,0;620,${-12 * sx};1340,${6 * sx}" dur="${dur}s" repeatCount="indefinite"/>
    </g>`;

  /* =====================================================================
     GENERATED FOREST — pixel data extracted from the reference PNG by
     scripts/gen/forest.js (FOREST_DATA). Each layer is redrawn as one path
     per shade so the whole treeline stays light, and each tree is cut into
     a trunk/lower group plus two crown groups that wave on their own pivots.
  ===================================================================== */
  const FOREST = (typeof FOREST_DATA !== "undefined") ? FOREST_DATA : null;
  const F_PAL = (FOREST && FOREST.palette) || { 1: "#0a0e15", 2: "#07090c", 3: "#05070a" };
  /* clip a run list to the column window [lo, hi) */
  function fClip(runs, lo, hi) {
    const out = [];
    for (const r of runs) {
      const s = Math.max(r[0], lo), e = Math.min(r[0] + r[1], hi);
      if (e > s) out.push([s, e - s, r[2]]);
    }
    return out;
  }
  /* turn rows (gy + runs) into one <path> per shade; gyOf maps grid row to y */
  function fRows(rows, gyOf, cell, ox) {
    const acc = { 1: "", 2: "", 3: "" };
    for (const row of rows) {
      const y = gyOf(row.gy);
      for (const r of row.runs) {
        acc[r[2]] += `M${ox + r[0] * cell},${y}h${r[1] * cell}v${cell}h${-r[1] * cell}z`;
      }
    }
    let out = "";
    for (const c of [1, 2, 3]) if (acc[c]) out += `<path d="${acc[c]}" fill="${F_PAL[c]}"/>`;
    return out;
  }
  /* one generated tree, optionally split into swaying crown groups */
  function fTree(t, opt = {}) {
    const cell = opt.cell || FOREST.cell;              // px per grid cell
    const groundGy = opt.groundGy != null ? opt.groundGy : FOREST.near.groundGy;
    const baseY = opt.baseY || 536;
    const gyOf = gy => baseY + (gy - groundGy) * cell;
    const ox = (opt.cx != null ? opt.cx : t.trunkCx * cell) - t.trunkCx * cell;
    const crownFrac = opt.crownFrac != null ? opt.crownFrac : 0.45;
    const crownBaseGy = t.top + (groundGy - t.top) * crownFrac;
    const crownBaseY = gyOf(crownBaseGy);
    const baseRows = [], leftRows = [], rightRows = [];
    for (const row of t.rows) {
      if (row.gy > crownBaseGy) baseRows.push(row);
      else {
        const l = fClip(row.runs, 0, t.trunkCx);
        const r = fClip(row.runs, t.trunkCx, FOREST.gw);
        if (l.length) leftRows.push({ gy: row.gy, runs: l });
        if (r.length) rightRows.push({ gy: row.gy, runs: r });
      }
    }
    const cx = t.trunkCx * cell;
    const sway = (pivot, dur, amt, sign) => `\n          <animateTransform attributeName="transform" type="rotate" values="${-amt} ${pivot[0]} ${pivot[1]};${amt} ${pivot[0]} ${pivot[1]};${-amt} ${pivot[0]} ${pivot[1]}" dur="${dur}s" repeatCount="indefinite"/>`;
    const rm = Settings.get("reducedMotion");
    const dur = opt.dur || (8 + (t.x0 % 5) * 1.3);
    const amt = opt.amt || (0.5 + (t.x0 % 3) * 0.22);
    if (rm || opt.static) {
      return `<g>${fRows(t.rows, gyOf, cell, ox)}</g>`;
    }
    return `<g>
        <g>${fRows(baseRows, gyOf, cell, ox)}${sway([cx, baseY], dur, amt, 1)}</g>
        <g>${fRows(leftRows, gyOf, cell, ox)}${sway([cx, crownBaseY], dur * 0.82, amt * 1.7, -1)}</g>
        <g>${fRows(rightRows, gyOf, cell, ox)}${sway([cx, crownBaseY], dur * 0.9, amt * 1.5, 1)}</g>
      </g>`;
  }
  function forestFar() {
    if (!FOREST) return "";
    const gyOf = gy => 424 + (gy - FOREST.far.groundGy) * FOREST.cell;
    return `<g id="v_forest-far" filter="url(#fxblur2)" opacity="0.62">${fRows(FOREST.far.rows, gyOf, FOREST.cell, 0)}</g>`;
  }
  function forestFog() {
    return `<g id="v_forest-fog" pointer-events="none">
      <rect x="0" y="392" width="1280" height="120" fill="url(#forestfog)" opacity="0.5"/>
      <ellipse cx="300" cy="446" rx="240" ry="16" fill="#7a8492" opacity="0.05" filter="url(#fxblur8)"/>
      <ellipse cx="960" cy="438" rx="260" ry="18" fill="#7a8492" opacity="0.05" filter="url(#fxblur8)"/>
    </g>`;
  }
  function forestNear() {
    if (!FOREST) return "";
    const groundGy = FOREST.near.groundGy;
    const gyOf = gy => 536 + (gy - groundGy) * FOREST.cell;
    const trees = FOREST.trees.map(t => fTree(t, { baseY: 536 })).join("");
    return `<g id="v_forest-near">
      <g id="v_forest-near-bg">${fRows(FOREST.near.rows, gyOf, FOREST.cell, 0)}</g>
      <g id="v_forest-trees">${trees}</g>
    </g>`;
  }


  /* =====================================================================
     DINING ROOM — and, when the house has deleted a room, THE ARCHIVE
     (the deleted room's contents get filed here: replacement, not loss)
  ===================================================================== */
  function svgDining() {
    const act2 = State.flag("act2");
    const archive = State.flag("roomDeleted_child");
    const sbOpen = State.flag("sbOpen");
    const flipped = State.flag("portraitFlipped");
    const moved = State.flag("smallChairMoved");
    return `<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    <g id="layer-back">
      <rect width="1280" height="500" fill="url(#wallg)"/>
      ${[...Array(6)].map((_, i) => `<rect x="${i * 224}" y="120" width="200" height="360" fill="#3f342a" opacity="0.18"/>`).join("")}
      <rect x="0" y="500" width="1280" height="220" fill="url(#floorg)"/>
      ${[...Array(7)].map((_, i) => `<line x1="${i * 200}" y1="500" x2="${i * 200 + 50}" y2="720" stroke="#100c09" stroke-width="2" opacity="0.5"/>`).join("")}
      <!-- dawn window: the fourth sky this house cannot agree on -->
      <g id="v_dwin">
        <rect x="110" y="120" width="220" height="230" fill="#5d6570" stroke="#2c241c" stroke-width="10"/>
        <rect x="116" y="126" width="208" height="120" fill="#78818c"/>
        <rect x="116" y="246" width="208" height="98" fill="#4a525c"/>
        <rect x="116" y="228" width="208" height="20" fill="#a8935f" opacity="0.4"/>
        <line x1="220" y1="120" x2="220" y2="350" stroke="#2c241c" stroke-width="7"/>
        <line x1="110" y1="235" x2="330" y2="235" stroke="#2c241c" stroke-width="7"/>
        <!-- the window's light falls as a slanted shaft + moving shadows in the FX layer -->
      </g>
      <!-- portrait: hung facing the wall -->
      <g id="v_portrait">
        ${flipped
          ? `<rect x="700" y="176" width="96" height="126" fill="#221a12" stroke="#4a3826" stroke-width="5"/><rect x="710" y="186" width="76" height="106" fill="#cfc4a8"/>`
          : `<rect x="700" y="176" width="96" height="126" fill="#8a7454" stroke="#5d4a35" stroke-width="4"/><line x1="700" y1="176" x2="796" y2="302" stroke="#5d4a35" stroke-width="2" opacity="0.6"/><line x1="796" y1="176" x2="700" y2="302" stroke="#5d4a35" stroke-width="2" opacity="0.6"/><path d="M712,184 q36,26 72,0" stroke="#3a2f22" stroke-width="2.4" fill="none"/>`}
      </g>
      <!-- hanging lamp -->
      <line x1="640" y1="0" x2="640" y2="96" stroke="#241c13" stroke-width="5"/>
      <path d="M604,96 L676,96 L656,126 L624,126 Z" fill="#3a2c1e"/>
      <ellipse cx="640" cy="130" rx="17" ry="8" fill="#e8c87a" opacity="0.9"/>
      <!-- doorframe to the kitchen, height marks pencilled on it -->
      <g id="v_marks">
        <rect x="1196" y="150" width="20" height="400" fill="#3a2c1e"/>
        ${[236, 288, 332, 368].map((y, i) => `<line x1="1198" y1="${y}" x2="1214" y2="${y}" stroke="#c9bb9b" stroke-width="2.4" opacity="0.7"/>`).join("")}
        <line x1="1198" y1="452" x2="1214" y2="452" stroke="#c9bb9b" stroke-width="2.4" opacity="0.7"/>
        <path d="M1196,444 L1216,460 M1216,444 L1196,460" stroke="#a5503c" stroke-width="3" opacity="0.8"/>
      </g>
      <!-- the kitchen exit lives in the side arrow; no door drawn here -->
      ${archive ? `
      <!-- THE ARCHIVE: the house filed a room here -->
      <g id="v_chalk">
        <rect x="380" y="560" width="560" height="130" fill="none" stroke="#8f8778" stroke-width="3" stroke-dasharray="10 8" opacity="0.4"/>
        <text x="660" y="648" data-roomlabel="1" text-anchor="middle" font-family="Georgia" font-size="14" fill="#6b6154" font-style="italic" opacity="0.8">something stood here</text>
      </g>
      <g id="v_shelves">
        <rect x="380" y="270" width="560" height="16" fill="#3a2c1e"/>
        <rect x="380" y="400" width="560" height="16" fill="#3a2c1e"/>
        <rect x="392" y="286" width="20" height="114" fill="#33261a"/>
        <rect x="908" y="286" width="20" height="114" fill="#33261a"/>
        ${[430, 540, 650, 760].map((x, i) => `<rect x="${x}" y="${316 - (i % 2) * 6}" width="86" height="${84 + (i % 2) * 6}" fill="#4a3a28" stroke="#241a11" stroke-width="3"/><rect x="${x + 16}" y="${336 - (i % 2) * 6}" width="54" height="18" fill="#c9bb9b" opacity="0.85"/>`).join("")}
        <rect x="430" y="440" width="86" height="90" fill="#4a3a28" stroke="#241a11" stroke-width="3"/>
        <rect x="446" y="458" width="54" height="18" fill="#c9bb9b" opacity="0.85"/>
        <circle cx="500" cy="452" r="4" fill="#c9a35f" opacity="0.7"/>
      </g>
      <g id="v_mbox2">
        <rect x="620" y="354" width="74" height="46" rx="5" fill="#7a5a72" stroke="#241a11" stroke-width="3"/>
        <circle cx="657" cy="348" r="7" fill="#c9a35f"/>
        <rect x="655" y="332" width="4" height="16" fill="#c9a35f"/>
      </g>` : `
      <!-- the long table, laid for five, plates for four -->
      <g id="v_smallchair" transform="translate(${moved ? -258 : 0},0)">
        <rect x="840" y="474" width="64" height="8" rx="4" fill="#4a3826"/>
        <rect x="846" y="482" width="7" height="46" rx="3" fill="#3a2c1e"/>
        <rect x="889" y="482" width="7" height="46" rx="3" fill="#3a2c1e"/>
        <rect x="836" y="560" width="9" height="120" fill="#3a2c1e"/>
        <rect x="892" y="560" width="9" height="120" fill="#3a2c1e"/>
        <circle cx="840" cy="557" r="4.5" fill="#4a3826"/>
        <circle cx="896" cy="557" r="4.5" fill="#4a3826"/>
        <rect x="844" y="572" width="50" height="8" rx="3" fill="#4a3826"/>
        <polygon points="834,600 902,600 908,616 828,616" fill="#4a3826"/>
        <rect x="836" y="604" width="64" height="9" rx="3" fill="#a5503c" opacity="0.75"/>
      </g>
      ${[420, 560, 700].map(x => `
      <g transform="translate(${x},0)">
        <rect x="6" y="470" width="68" height="9" rx="4" fill="#4a3826"/>
        <rect x="12" y="479" width="7" height="50" rx="3" fill="#3a2c1e"/>
        <rect x="61" y="479" width="7" height="50" rx="3" fill="#3a2c1e"/>
        <rect x="0" y="536" width="10" height="150" fill="#3a2c1e"/>
        <rect x="70" y="536" width="10" height="150" fill="#3a2c1e"/>
        <circle cx="5" cy="533" r="5" fill="#4a3826"/>
        <circle cx="75" cy="533" r="5" fill="#4a3826"/>
        <rect x="8" y="548" width="64" height="9" rx="3" fill="#4a3826"/>
        <polygon points="-2,596 82,596 90,614 -10,614" fill="#4a3826"/>
        <polygon points="-2,596 82,596 88,608 -8,608" fill="#5d4a35"/>
      </g>`).join("")}
      <g id="v_dtable">
        <ellipse cx="660" cy="700" rx="360" ry="16" fill="#0d0a08" opacity="0.4"/>
        <polygon points="360,614 960,614 1010,668 310,668" fill="url(#woodg)"/>
        <polygon points="360,614 960,614 1010,668 310,668" fill="#4a3826" opacity="0.55"/>
        <path d="M360,614 L960,614 M346,632 L974,632 M334,650 L988,650" stroke="#33261a" stroke-width="1.4" opacity="0.45"/>
        <polygon points="470,614 850,614 880,656 440,656" fill="#8a7454" opacity="0.9"/>
        <path d="M470,614 L440,656 M850,614 L880,656" stroke="#6b5544" stroke-width="1.4" opacity="0.5"/>
        <polygon points="310,668 1010,668 1010,680 310,680" fill="#33261a"/>
        <rect x="330" y="680" width="14" height="40" fill="#2c2115"/>
        <rect x="976" y="680" width="14" height="40" fill="#2c2115"/>
        <rect x="430" y="680" width="12" height="34" fill="#2c2115"/>
        <rect x="878" y="680" width="12" height="34" fill="#2c2115"/>
        <ellipse cx="337" cy="721" rx="12" ry="4" fill="#0d0a08" opacity="0.5"/>
        <ellipse cx="982" cy="721" rx="12" ry="4" fill="#0d0a08" opacity="0.5"/>
        ${[430, 560, 690, 820].map(x => `<ellipse cx="${x}" cy="${638}" rx="30" ry="9" fill="#cfc4a8"/><ellipse cx="${x}" cy="${637}" rx="22" ry="6.5" fill="#ded4bb"/>`).join("")}
        <rect x="906" y="630" width="52" height="14" rx="3" fill="#6b5544"/>
        <path d="M918,628 l0,-10 M926,628 l0,-10" stroke="#8f8778" stroke-width="2"/>
        <ellipse cx="946" cy="628" rx="9" ry="5" fill="#cfc4a8"/>
      </g>
      <g id="v_dcake">
        <ellipse cx="640" cy="612" rx="52" ry="12" fill="#8a7454"/>
        <path d="M600,610 q0,-44 40,-44 q40,0 40,44" fill="#b8c4c9" opacity="0.35" stroke="#9aa3ad" stroke-width="2"/>
        <rect x="612" y="588" width="56" height="20" rx="4" fill="#c9a878"/>
        <rect x="612" y="584" width="56" height="8" rx="4" fill="#e0d5c0"/>
        ${act2 ? [...Array(17)].map((_, i) => `<line x1="${615 + i * 3.2}" y1="580" x2="${615 + i * 3.2}" y2="574" stroke="#a5503c" stroke-width="1.6"/>`).join("") : ""}
        <rect x="674" y="606" width="34" height="5" rx="2" fill="#8f9691"/>
      </g>
      <!-- the feast: food the house keeps impossibly fresh -->
      <g id="v_feast">
        <ellipse cx="500" cy="612" rx="44" ry="11" fill="#6b5544"/>
        <ellipse cx="500" cy="610" rx="40" ry="9" fill="#c9a878"/>
        <path d="M470,606 q30,-24 60,0 q-26,8 -60,0 Z" fill="#a5673c"/>
        <path d="M478,600 q22,-16 44,0" fill="none" stroke="#d8a25c" stroke-width="3" opacity="0.7"/>
        <line x1="532" y1="608" x2="546" y2="602" stroke="#e8e0d0" stroke-width="3" stroke-linecap="round"/>
        <path d="M586,606 q24,16 0,24 q-24,-8 0,-24 Z" fill="#4a6a4a"/>
        <path d="M588,608 q8,-10 16,-4 q4,10 -6,12 q-8,0 -10,-8 Z" fill="#6f9a54"/>
        <path d="M606,608 q8,-8 14,-2 q2,8 -8,10 Z" fill="#8ab45e"/>
        <circle cx="700" cy="616" r="9" fill="#c99a58"/>
        <circle cx="720" cy="614" r="8" fill="#d3a563"/>
        <circle cx="738" cy="616" r="9" fill="#c99a58"/>
        <path d="M700,610 l0,3 M700,615 l0,3 M720,608 l0,3 M720,613 l0,3 M738,610 l0,3 M738,615 l0,3" stroke="#8a6238" stroke-width="1.6"/>
        <path d="M808,600 q-2,-22 12,-24 q14,2 12,24 Z" fill="#c9d4d8" opacity="0.9"/>
        <path d="M806,606 q-4,8 2,10" stroke="#c9d4d8" stroke-width="3" fill="none"/>
        <path d="M812,580 q14,-4 26,0" stroke="#a8b8c0" stroke-width="3" fill="none"/>
        <rect x="812" y="578" width="3" height="22" fill="#e4ecef" opacity="0.6"/>
        <rect x="378" y="588" width="7" height="20" rx="2" fill="#e8e4d8"/>
        <path d="M381.5,584 q0,-7 3,-4 q3,3 0,6 q-2,1 -3,-2 Z" fill="#e8913f"/>
        <rect x="878" y="588" width="7" height="20" rx="2" fill="#e8e4d8"/>
        <path d="M881.5,584 q0,-7 3,-4 q3,3 0,6 q-2,1 -3,-2 Z" fill="#e8913f"/>
      </g>
      ${State.flag("diningTidied") ? "" : `
      <!-- the plate gone bad: what the house did not bother keeping -->
      <g id="v_spoilt">
        <ellipse cx="368" cy="612" rx="34" ry="9" fill="#5a5648"/>
        <path d="M350,608 q10,-10 20,-4 q8,6 6,10 q-14,8 -26,-6 Z" fill="#7a8a5e"/>
        <path d="M356,604 q4,-6 10,-4 q4,4 2,8 q-8,4 -12,-4 Z" fill="#9aa888" opacity="0.8"/>
        <path d="M368,606 q3,-5 8,-3 q3,3 1,7 q-6,3 -9,-4 Z" fill="#6b7a52"/>
        <path d="M352,602 q2,-5 6,-6 M362,600 q3,-4 7,-4 M372,602 q2,-4 6,-5" stroke="#b8c4a8" stroke-width="1.6" fill="none" opacity="0.8"/>
        <path d="M420,614 l-4,-14 l8,0 Z" fill="#9fb6c0" opacity="0.5" transform="rotate(28 420 606)"/>
        <ellipse cx="428" cy="614" rx="7" ry="3" fill="#5a3a34" opacity="0.7"/>
        <circle cx="400" cy="618" r="6" fill="#6a4a32"/>
        <path d="M400,612 q2,-4 5,-2" stroke="#8a6a4a" stroke-width="1.6" fill="none"/>
        <path d="M397,620 q3,2 6,0" stroke="#3a2a1e" stroke-width="1.4" fill="none" opacity="0.7"/>
      </g>
      <!-- the rubbish the house is still deciding what to do with -->
      <g id="v_garbage">
        <ellipse cx="1120" cy="640" rx="66" ry="10" fill="#0d0a08" opacity="0.45"/>
        <path d="M1070,640 q0,-44 26,-46 q30,2 24,46 q-24,20 -50,0 Z" fill="#171410"/>
        <path d="M1076,636 q-2,-34 16,-34 q16,0 12,34 q-16,18 -28,0 Z" fill="#23201c" opacity="0.8"/>
        <path d="M1078,600 q-6,-8 -2,-14 q6,4 4,14 Z" fill="#171410"/>
        <path d="M1118,640 q0,-38 22,-40 q26,2 20,40 q-20,18 -42,0 Z" fill="#14110e"/>
        <path d="M1126,636 q-2,-28 14,-28 q14,0 10,28 q-14,16 -24,0 Z" fill="#1f1c18" opacity="0.85"/>
        <path d="M1126,600 q-5,-7 -2,-12 q5,3 4,12 Z" fill="#14110e"/>
        <path d="M1080,600 q2,12 8,22" stroke="#3a3a36" stroke-width="2" fill="none" opacity="0.6"/>
        <path d="M1128,600 q2,10 6,20" stroke="#2f2f2b" stroke-width="2" fill="none" opacity="0.6"/>
      </g>`}`}
      <!-- conservatory: a glass door to the left, mist on the far side -->
      <g id="v_consdoor">
        <rect x="36" y="352" width="140" height="148" fill="#0d1a22" stroke="#1a130d" stroke-width="6"/>
        <rect x="48" y="364" width="54" height="124" fill="#1d2e38" stroke="#0c141a" stroke-width="3"/>
        <rect x="110" y="364" width="54" height="124" fill="#1d2e38" stroke="#0c141a" stroke-width="3"/>
        <line x1="75" y1="364" x2="75" y2="488" stroke="#0c141a" stroke-width="2" opacity="0.6"/>
        <line x1="137" y1="364" x2="137" y2="488" stroke="#0c141a" stroke-width="2" opacity="0.6"/>
        <line x1="48" y1="426" x2="102" y2="426" stroke="#0c141a" stroke-width="2" opacity="0.6"/>
        <line x1="110" y1="426" x2="164" y2="426" stroke="#0c141a" stroke-width="2" opacity="0.6"/>
        <line x1="58" y1="380" x2="56" y2="414" stroke="#9fc0d0" stroke-width="1.6" opacity="0.25"/>
        <line x1="120" y1="396" x2="118" y2="432" stroke="#9fc0d0" stroke-width="1.6" opacity="0.25"/>
        <!-- plants beyond the glass, deep green and blurred by distance -->
        <g opacity="0.5">
          <path d="M60,488 q10,-30 0,-52 M84,488 q8,-26 2,-48 M140,488 q-10,-30 0,-52 M116,488 q-8,-26 -2,-48" stroke="#2f4a30" stroke-width="5" fill="none" stroke-linecap="round"/>
        </g>
        <!-- cool light spilling under the door, slanted across the boards -->
        <polygon points="36,500 176,500 212,562 18,562" fill="#9cc3dc" opacity="0.08"/>
        <rect x="162" y="400" width="6" height="14" rx="2" fill="#8a7148"/>
        <path d="M36,352 L176,352" stroke="#2c2117" stroke-width="8"/>
      </g>
      <!-- sideboard -->
      <g id="v_sideboard">
        <rect x="1000" y="404" width="180" height="120" rx="4" fill="#3a2c1e" stroke="#241a11" stroke-width="4"/>
        <rect x="1014" y="418" width="152" height="34" rx="3" fill="#33261a" stroke="#241a11" stroke-width="3"/>
        <rect x="1076" y="430" width="28" height="7" rx="3" fill="#8a7148"/>
        ${sbOpen ? `
        <rect x="1006" y="456" width="168" height="40" rx="3" fill="#241a11"/>
        <rect x="1020" y="466" width="60" height="20" fill="#cfc4a8" opacity="0.9"/>
        <circle cx="1108" cy="476" r="9" fill="none" stroke="#c9a35f" stroke-width="4"/>
        ${State.flag("pageEaten") && !State.hasItem("pen") && !State.flag("pageRewritten") ? `<g id="v_pen"><rect x="1024" y="486" width="52" height="6" rx="3" fill="#c9a35f" transform="rotate(-8 1050 489)"/><polygon points="1074,480 1084,483 1074,487" fill="#8a7148" transform="rotate(-8 1050 489)"/></g>` : ""}
        ${State.flag("atticTruth") && !State.flag("tookLetter") ? `<rect x="1128" y="466" width="38" height="24" fill="#d8c9a8"/><path d="M1128,466 l19,13 l19,-13" stroke="#8a7148" stroke-width="2" fill="none"/>` : ""}` : ""}
        <rect x="1008" y="524" width="12" height="30" fill="#241a11"/>
        <rect x="1160" y="524" width="12" height="30" fill="#241a11"/>
        <ellipse cx="1042" cy="398" rx="26" ry="7" fill="#cfc4a8"/>
        <ellipse cx="1042" cy="392" rx="26" ry="7" fill="#cfc4a8"/>
        <ellipse cx="1130" cy="396" rx="18" ry="6" fill="#8f9691"/>
      </g>
    </g>
    <g id="layer-mid"></g>
    <g id="layer-front"></g>
    <g id="hotspots">
      ${hs("dwin", 98, 108, 244, 254, "The window", "v_dwin")}
      ${hs("portrait", 688, 164, 120, 150, "A picture, hung facing the wall", "v_portrait")}
      ${hs("marks", 1186, 220, 40, 250, "Pencil marks on the doorframe", "v_marks")}
      ${State.flag("sbOpen") && State.flag("pageEaten") && !State.hasItem("pen") && !State.flag("pageRewritten") ? hs("pen", 1016, 478, 74, 22, "A fountain pen", "v_pen") : ""}
      ${hs("sideboard", 990, 392, 200, 165, "The sideboard", "v_sideboard")}
      ${State.flag("atticTruth") && State.flag("sbOpen") && !State.flag("tookLetter") ? hs("letter", 1122, 458, 50, 38, "An envelope", "") : ""}
      ${archive ? `
      ${hs("shelves", 380, 270, 560, 150, "Shelves of labeled boxes", "v_shelves")}
      ${hs("mbox2", 608, 324, 98, 84, "A music box, out of place", "v_mbox2")}
      ${hs("chalk", 380, 556, 560, 138, "A chalk outline on the floor", "v_chalk")}` : `
      ${hs("dtable", 340, 600, 620, 90, "The table, laid for dinner", "v_dtable")}
      ${hs("dcake", 592, 556, 120, 64, "A cake under glass", "v_dcake")}
      ${hs("feast", 460, 552, 300, 70, "Dinner, still warm", "v_feast")}
      ${State.flag("diningTidied") ? "" : hs("spoilt", 336, 556, 116, 62, "A plate gone bad", "v_spoilt")}
      ${State.flag("diningTidied") ? "" : hs("garbage", 1048, 540, 160, 112, "Rubbish bags", "v_garbage")}
      ${hs("smallchair", moved ? 570 : 820, 548, 96, 140, "A small chair with a cushion", "v_smallchair")}`}
      ${hs("dconservatory", 18, 320, 182, 214, "Through to the conservatory", "v_consdoor")}
      ${hs("dback", 1210, 140, 70, 420, "Back to the kitchen", "")}
    </g>
    </svg>`;
  }

  /* =====================================================================
     CONSERVATORY — a glasshouse the house keeps half drowned in mist
  ===================================================================== */
  function svgConservatory() {
    const reduced = Settings.get("reducedMotion");
    /* one fern frond: a stem of thin curved leaves */
    const frond = (x, y, s, flip) => {
      const d = flip ? -1 : 1;
      let out = `<path d="M${x},${y} q${d * 6 * s},${-24 * s} ${d * 13 * s},${-38 * s}" stroke="#2f4a30" stroke-width="${2.6 * s}" fill="none" stroke-linecap="round"/>`;
      for (let i = 0; i < 5; i++) {
        const a = -38 * s * (0.35 + i * 0.16);
        out += `<path d="M${x + d * (2 + i * 1.6) * s},${y + a} q${d * 8 * s},${-7 * s} ${d * 13 * s},${-9 * s}" stroke="#3f5f40" stroke-width="${1.8 * s}" fill="none" stroke-linecap="round"/>`;
      }
      return out;
    };
    const fernBunch = (x, y, s) => frond(x, y, s, false) + frond(x, y, s, true) + frond(x - 7 * s, y + 3, s * 0.78, true) + frond(x + 7 * s, y + 3, s * 0.78, false);
    return `<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    <defs>
      <linearGradient id="consky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0d1720"/><stop offset="1" stop-color="#1b2a33"/>
      </linearGradient>
      <linearGradient id="conglass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#243a46"/><stop offset="1" stop-color="#152530"/>
      </linearGradient>
      <linearGradient id="confloor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1c2624"/><stop offset="1" stop-color="#111a17"/>
      </linearGradient>
    </defs>
    <g id="layer-back">
      <rect width="1280" height="720" fill="url(#consky)"/>
      <!-- moon, high and small, through the glass -->
      <circle cx="985" cy="84" r="30" fill="#d8dce0" opacity="0.8"/>
      <circle cx="972" cy="76" r="26" fill="#141d26"/>
      <!-- a treeline far away, seen through the mist -->
      <path d="M0,236 q60,-34 120,0 q60,-30 120,0 q60,-30 120,0 q60,-30 120,0 q60,-30 120,0 q60,-30 120,0 q60,-30 120,0 q60,-28 120,0 q60,-30 120,0 q60,-30 120,0 q60,-28 120,0 l0,80 l-1280,0 Z" fill="#0e1a20" opacity="0.9"/>
      <!-- glass roof: a ridge at top, panes sloping to the eave -->
      <g id="v_conroof">
        <polygon points="0,150 640,34 640,80 0,196" fill="url(#conglass)" opacity="0.95"/>
        <polygon points="640,34 1280,150 1280,196 640,80" fill="#172731" opacity="0.95"/>
        ${(() => {
          let s = "";
          for (let i = 1; i < 12; i++) {
            const t = i / 12;
            s += `<line x1="${640 * t}" y1="${34 + (150 - 34) * t}" x2="${640 * t}" y2="${80 + (196 - 80) * t}" stroke="#0c141a" stroke-width="4" opacity="0.6"/>`;
          }
          return s;
        })()}
        <line x1="0" y1="150" x2="640" y2="34" stroke="#2c424e" stroke-width="5" opacity="0.6"/>
        <line x1="640" y1="34" x2="1280" y2="150" stroke="#2c424e" stroke-width="5" opacity="0.6"/>
      </g>
      <!-- glass side walls: muntins, panes, and honest condensation -->
      ${[...Array(9)].map((_, i) => `<line x1="${40 + i * 150}" y1="196" x2="${40 + i * 150}" y2="520" stroke="#0c141a" stroke-width="5" opacity="0.5"/>`).join("")}
      ${[...Array(8)].map((_, i) => `<rect x="${44 + i * 150}" y="200" width="146" height="316" fill="#1c2e38" opacity="0.13"/>`).join("")}
      ${[...Array(16)].map((_, i) => `<line x1="${64 + i * 82}" y1="${212 + (i % 5) * 58}" x2="${60 + i * 82}" y2="${302 + (i % 6) * 46}" stroke="#9fc0d0" stroke-width="2" opacity="0.16"/>`).join("")}
      <!-- damp stone floor -->
      <rect x="0" y="520" width="1280" height="200" fill="url(#confloor)"/>
      ${[...Array(7)].map((_, i) => `<line x1="${i * 200}" y1="520" x2="${i * 200 + 90}" y2="720" stroke="#0a120f" stroke-width="2" opacity="0.5"/>`).join("")}
      ${[...Array(4)].map((_, i) => `<line x1="0" y1="${520 + i * 50}" x2="1280" y2="${520 + i * 50}" stroke="#0a120f" stroke-width="2" opacity="0.4"/>`).join("")}
      <polygon points="150,600 330,600 350,622 128,622" fill="#27404a" opacity="0.3"/>
      <polygon points="760,640 960,640 980,664 738,664" fill="#27404a" opacity="0.26"/>
    </g>
    <g id="layer-mid">
      <!-- planter boxes along the left wall -->
      <g id="v_planterL">
        <rect x="60" y="430" width="190" height="92" rx="6" fill="#2c2117" stroke="#1a130d" stroke-width="4"/>
        <rect x="70" y="440" width="170" height="12" fill="#241a10"/>
        ${fernBunch(110, 436, 1.6)}${fernBunch(158, 442, 1.35)}${fernBunch(214, 434, 1.5)}
      </g>
      <!-- planter boxes along the right wall -->
      <g id="v_planterR">
        <rect x="1030" y="430" width="190" height="92" rx="6" fill="#2c2117" stroke="#1a130d" stroke-width="4"/>
        <rect x="1040" y="440" width="170" height="12" fill="#241a10"/>
        ${fernBunch(1080, 438, 1.55)}${fernBunch(1126, 444, 1.3)}${fernBunch(1180, 436, 1.45)}
      </g>
      <!-- a tall potted palm, leaning toward the moon -->
      <g id="v_palm">
        <path d="M198,560 L182,330" stroke="#241a10" stroke-width="12" stroke-linecap="round"/>
        ${[0, 1, 2, 3, 4].map(i => `<path d="M${184},${352 + i * 30} q${(i % 2 ? -1 : 1) * 66},-${34 + (i % 3) * 10} ${(i % 2 ? -1 : 1) * 108},${-8 - i * 6}" stroke="#3f5f40" stroke-width="${9 - i}" fill="none" stroke-linecap="round"/>`).join("")}
        <path d="M168,566 L228,566 L222,606 L174,606 Z" fill="#4a3a2a"/>
        <ellipse cx="198" cy="566" rx="30" ry="7" fill="#33261a"/>
      </g>
      <!-- hanging baskets trailing from the roof -->
      <g id="v_hang">
        <line x1="380" y1="120" x2="380" y2="170" stroke="#241a10" stroke-width="3"/>
        <path d="M350,170 q30,26 60,0 Z" fill="#2c2117"/>
        ${fernBunch(368, 196, 0.9)}${fernBunch(398, 200, 0.8)}
        <path d="M360,214 q10,40 26,74 M396,216 q-6,44 -16,78" stroke="#3a5a3c" stroke-width="3" fill="none" stroke-linecap="round"/>
        <line x1="900" y1="120" x2="900" y2="170" stroke="#241a10" stroke-width="3"/>
        <path d="M870,170 q30,26 60,0 Z" fill="#2c2117"/>
        ${fernBunch(888, 196, 0.9)}${fernBunch(918, 200, 0.8)}
        <path d="M880,214 q10,40 26,74 M916,216 q-6,44 -16,78" stroke="#3a5a3c" stroke-width="3" fill="none" stroke-linecap="round"/>
      </g>
      <!-- a wrought iron bench, dew on every bar -->
      <g id="v_bench">
        <ellipse cx="640" cy="640" rx="220" ry="10" fill="#0a120f" opacity="0.5"/>
        ${[-150, -110, -70, -30, 10, 50, 90, 130].map(dx => `<line x1="${640 + dx}" y1="606" x2="${640 + dx}" y2="648" stroke="#0f1516" stroke-width="5"/>`).join("")}
        <path d="M470,560 q170,-34 340,0" stroke="#0f1516" stroke-width="10" fill="none" stroke-linecap="round"/>
        <path d="M480,600 q160,-20 320,0" stroke="#0f1516" stroke-width="6" fill="none" stroke-linecap="round"/>
        ${[0, 1, 2, 3, 4].map(i => `<circle cx="${480 + i * 80}" cy="578" r="2.2" fill="#9fc0d0" opacity="0.5"/>`).join("")}
      </g>
      <!-- a small table with the gramophone: the song that will not end -->
      <g id="v_gramophone">
        <ellipse cx="1120" cy="612" rx="86" ry="9" fill="#0a120f" opacity="0.5"/>
        <rect x="1052" y="566" width="136" height="10" rx="4" fill="#241a10"/>
        <rect x="1062" y="576" width="10" height="40" fill="#1a130d"/><rect x="1168" y="576" width="10" height="40" fill="#1a130d"/>
        <rect x="1056" y="606" width="128" height="8" rx="3" fill="#1a130d"/>
        <circle cx="1120" cy="556" r="34" fill="#2b241d" stroke="#0f1416" stroke-width="3"/>
        <circle cx="1120" cy="556" r="26" fill="#3a3128"/>
        <circle cx="1120" cy="556" r="9" fill="#0f1416"/>
        <circle cx="1120" cy="556" r="3" fill="#8a7148"/>
        <path d="M1188,556 q0,-16 16,-16 q16,0 16,16 q0,12 -8,16 l-8,6 q-8,-6 -16,-22 Z" fill="#8a7148"/>
        <path d="M1196,546 q14,-10 24,0" stroke="#c9a35f" stroke-width="3" fill="none"/>
        <rect x="1186" y="566" width="8" height="18" rx="3" fill="#5d4a35"/>
        <rect x="1148" y="566" width="8" height="10" rx="3" fill="#5d4a35"/>
        ${reduced ? "" : `<circle cx="1120" cy="556" r="38" fill="none" stroke="#8a7148" stroke-width="1.4" opacity="0.35"><animate attributeName="opacity" values="0.35;0.12;0.35" dur="7s" repeatCount="indefinite"/></circle>`}
      </g>
      <!-- a watering can, left where someone set it down -->
      <g id="v_wcan">
        <ellipse cx="560" cy="662" rx="24" ry="5" fill="#0a120f" opacity="0.5"/>
        <path d="M540,642 L588,642 L584,666 L544,666 Z" fill="#4a5550"/>
        <path d="M584,646 q16,-4 18,2 l-4,6 q-14,-2 -16,-4 Z" fill="#4a5550"/>
        <path d="M544,646 q-14,6 -10,20 q6,10 18,6" fill="none" stroke="#4a5550" stroke-width="4"/>
      </g>
    </g>
    <g id="layer-front">
      <!-- static mist, low and slow: the engine adds the living fog on top -->
      <ellipse cx="340" cy="600" rx="300" ry="26" fill="#6f8a84" opacity="0.08" filter="url(#fxblur8)">
        ${reduced ? "" : `<animateTransform attributeName="transform" type="translate" values="-160,0;240,0;-160,0" dur="110s" repeatCount="indefinite"/>`}
      </ellipse>
      <ellipse cx="960" cy="640" rx="320" ry="28" fill="#6f8a84" opacity="0.07" filter="url(#fxblur8)">
        ${reduced ? "" : `<animateTransform attributeName="transform" type="translate" values="200,0;-220,0;200,0" dur="130s" repeatCount="indefinite"/>`}
      </ellipse>
      <!-- a foreground frond, near the lens -->
      <g id="v_nearleaf" opacity="0.92">
        ${fernBunch(52, 712, 2.4)}
        ${fernBunch(1236, 714, 2.2)}
      </g>
    </g>
    <g id="hotspots">
      ${hs("cback", 0, 150, 60, 430, "Back to the dining room", "")}
      ${hs("gramophone", 1080, 500, 150, 120, "A gramophone", "v_gramophone")}
      ${hs("bench", 460, 540, 360, 130, "A wrought iron bench", "v_bench")}
      ${hs("planterL", 50, 420, 210, 110, "Ferns in a wooden planter", "v_planterL")}
      ${hs("planterR", 1020, 420, 210, 110, "Ferns in a wooden planter", "v_planterR")}
      ${hs("palm", 140, 320, 120, 250, "A tall palm", "v_palm")}
      ${hs("hang", 340, 160, 140, 130, "Hanging baskets", "v_hang")}
      ${hs("hang2", 860, 160, 140, 130, "Hanging baskets", "v_hang")}
      ${hs("wcan", 528, 634, 88, 44, "A watering can", "v_wcan")}
      ${hs("cwin", 1210, 150, 60, 430, "The glass", "")}
    </g>
    </svg>`;
  }

  /* =====================================================================
     PORCH
  ===================================================================== */
  function svgPorch() {
    const hasKey = State.hasItem("houseKey");
    const reducedMotion = Settings.get("reducedMotion");
    return `<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    <defs>
      <filter id="blurf"><feGaussianBlur stdDeviation="3"/></filter>
      <linearGradient id="eaveshadow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#060505" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#060505" stop-opacity="0"/>
      </linearGradient>
      <clipPath id="roofclip"><polygon points="150,124 640,30 1130,124"/></clipPath>
      <linearGradient id="forestfog" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8a97a6" stop-opacity="0"/>
        <stop offset="0.5" stop-color="#8a97a6" stop-opacity="0.16"/>
        <stop offset="1" stop-color="#8a97a6" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g id="layer-back">
      <rect width="1280" height="720" fill="url(#nightg)"/>
      ${[...Array(26)].map((_, i) => `<circle cx="${(i * 137 + 40) % 1280}" cy="${(i * 61) % 200 + 12}" r="${i % 3 === 0 ? 1.6 : 1}" fill="#cfd8e0" opacity="${0.25 + (i % 5) * 0.1}"/>`).join("")}
      ${reducedMotion ? "" : `
      <!-- an occasional shooting star, gone almost before it is seen -->
      <g transform="translate(310,120)">
        <g opacity="0">
          <animate attributeName="opacity" values="0;0;0.9;0.9;0;0" keyTimes="0;0.90;0.905;0.925;0.93;1" dur="19s" repeatCount="indefinite"/>
          <g>
            <animateTransform attributeName="transform" type="translate" values="0,0;0,0;150,90;150,90;0,0" keyTimes="0;0.90;0.905;0.925;0.93;1" dur="19s" repeatCount="indefinite"/>
            <line x1="0" y1="0" x2="-34" y2="16" stroke="#c9d8e6" stroke-width="2" stroke-linecap="round"/>
            <line x1="0" y1="0" x2="-20" y2="9" stroke="#eaf2f8" stroke-width="1.2" opacity="0.8"/>
            <circle cx="0" cy="0" r="1.8" fill="#ffffff"/>
          </g>
        </g>
      </g>
      <g transform="translate(840,70)">
        <g opacity="0">
          <animate attributeName="opacity" values="0;0;0.85;0.85;0;0" keyTimes="0;0.86;0.87;0.89;0.895;1" dur="27s" repeatCount="indefinite"/>
          <g>
            <animateTransform attributeName="transform" type="translate" values="0,0;0,0;120,80;120,80;0,0" keyTimes="0;0.86;0.87;0.89;0.895;1" dur="27s" repeatCount="indefinite"/>
            <line x1="0" y1="0" x2="-30" y2="14" stroke="#c9d8e6" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="0" cy="0" r="1.6" fill="#ffffff"/>
          </g>
        </g>
      </g>`}
      <circle cx="1120" cy="90" r="34" fill="#d8dce0" opacity="0.85"/>
      <circle cx="1108" cy="82" r="30" fill="#1d2733"/>
      <!-- generated forest: far treeline, drifting fog, then the near trees whose branches wave -->
      <g id="v_forest">
        ${forestFar()}
        ${forestFog()}
        ${forestNear()}
        ${bird(96, 330)}
        ${bird(132, 356)}
        ${bird(1152, 336)}
        ${bird(1190, 360)}
      </g>
      <rect x="0" y="540" width="1280" height="180" fill="#12161c"/>
      <rect x="0" y="536" width="1280" height="6" fill="#0c0f13"/>
      <!-- packed dirt path from the step, widening toward the viewer -->
      <polygon points="600,574 680,574 830,720 452,720" fill="#1a1e27" opacity="0.92"/>
      <polygon points="600,574 680,574 812,720 470,720" fill="#151923" opacity="0.6"/>
      <!-- stepping stones down the path -->
      <ellipse cx="640" cy="600" rx="34" ry="9" fill="#23272f"/>
      <ellipse cx="640" cy="603" rx="34" ry="9" fill="none" stroke="#10131a" stroke-width="2" opacity="0.6"/>
      <ellipse cx="626" cy="636" rx="40" ry="10" fill="#1f232b"/>
      <ellipse cx="626" cy="639" rx="40" ry="10" fill="none" stroke="#10131a" stroke-width="2" opacity="0.6"/>
      <ellipse cx="658" cy="674" rx="46" ry="11" fill="#23272f"/>
      <ellipse cx="658" cy="677" rx="46" ry="11" fill="none" stroke="#10131a" stroke-width="2" opacity="0.6"/>
      <ellipse cx="636" cy="710" rx="52" ry="12" fill="#1f232b"/>
    </g>
    <g id="layer-mid">
      <!-- house facade -->
      <rect x="180" y="120" width="920" height="430" fill="url(#wallg)"/>
      ${[...Array(15)].map((_, i) => `<line x1="180" y1="${148 + i * 28}" x2="1100" y2="${148 + i * 28}" stroke="#241d16" stroke-width="2" opacity="0.5"/>`).join("")}
      <!-- roof: gabled, shingled, the right slope catching the moon -->
      <g id="v_roof">
        <g clip-path="url(#roofclip)">
          <rect x="150" y="30" width="980" height="94" fill="#221c16"/>
          <polygon points="640,30 1130,124 640,124" fill="#26201a"/>
          <polygon points="150,124 640,30 640,124" fill="#191410" opacity="0.6"/>
          <!-- shingle courses: each side follows its own slope and stops at the
               ridge and the eave, so no line ever crosses off the roof -->
          ${(() => {
            const ridge = 640, top = 30, eave = 124, run = 490;
            const xL = y => ridge - run * (y - top) / (eave - top);
            const xR = y => ridge + run * (y - top) / (eave - top);
            let s = "";
            for (let y = 36; y <= 122; y += 7) {
              s += `<line x1="${xL(y).toFixed(1)}" y1="${y}" x2="${ridge}" y2="${y}" stroke="#0e0c0a" stroke-width="1.3" opacity="0.45"/>`;
              s += `<line x1="${ridge}" y1="${y}" x2="${xR(y).toFixed(1)}" y2="${y}" stroke="#2c251e" stroke-width="1.3" opacity="0.55"/>`;
            }
            return s;
          })()}
          <!-- soft shingle texture: blurred courses so the roof reads as weathered -->
          <g filter="url(#blurf)" opacity="0.5">
            ${(() => {
              const ridge = 640, top = 30, eave = 124, run = 490;
              const xL = y => ridge - run * (y - top) / (eave - top);
              const xR = y => ridge + run * (y - top) / (eave - top);
              let s = "";
              for (let y = 40; y <= 118; y += 14) {
                s += `<line x1="${xL(y).toFixed(1)}" y1="${y}" x2="${ridge}" y2="${y}" stroke="#080604" stroke-width="3" opacity="0.4"/>`;
                s += `<line x1="${ridge}" y1="${y}" x2="${xR(y).toFixed(1)}" y2="${y}" stroke="#0c0a08" stroke-width="3" opacity="0.5"/>`;
              }
              return s;
            })()}
          </g>
          <line x1="644" y1="34" x2="1126" y2="122" stroke="#8aa2bc" stroke-width="3" opacity="0.18" filter="url(#blurf)"/>
          <line x1="640" y1="30" x2="1130" y2="124" stroke="#6b86a3" stroke-width="1.4" opacity="0.4"/>
          <line x1="150" y1="124" x2="640" y2="30" stroke="#0e0c0a" stroke-width="2" opacity="0.6"/>
        </g>
        <polygon points="150,124 640,30 1130,124" fill="none" stroke="#171310" stroke-width="5"/>
        <polygon points="150,124 640,30 1130,124" fill="none" stroke="#241d16" stroke-width="2" opacity="0.8"/>
        <!-- the shadow the eaves cast across the wall below -->
        <rect x="150" y="124" width="980" height="12" fill="url(#eaveshadow)"/>
        <!-- chimney, its moonward face picked out -->
        <g id="v_chimney">
          <rect x="336" y="42" width="32" height="46" fill="#191512"/>
          <rect x="336" y="38" width="32" height="8" fill="#241d16"/>
          <rect x="364" y="44" width="3" height="44" fill="#3a3128" opacity="0.5"/>
          <rect x="338" y="44" width="3" height="44" fill="#0e0c0a" opacity="0.6"/>
        </g>
      </g>
      <!-- dark windows -->
      <g id="v_win1"><rect x="270" y="210" width="120" height="150" fill="#0d1015" stroke="#171310" stroke-width="7"/><line x1="330" y1="210" x2="330" y2="360" stroke="#171310" stroke-width="5"/><line x1="270" y1="285" x2="390" y2="285" stroke="#171310" stroke-width="5"/></g>
      <g id="v_win2"><rect x="900" y="210" width="120" height="150" fill="#0d1015" stroke="#171310" stroke-width="7"/><line x1="960" y1="210" x2="960" y2="360" stroke="#171310" stroke-width="5"/><line x1="900" y1="285" x2="1020" y2="285" stroke="#171310" stroke-width="5"/>
        <rect x="962" y="287" width="56" height="71" fill="#e8a04c" opacity="0.12"><animate attributeName="opacity" values="0.12;0.12;0.04;0.12" dur="9s" repeatCount="indefinite"/></rect></g>
      <!-- door -->
      <g id="v_door">
        <rect x="560" y="250" width="160" height="300" fill="#33261a" stroke="#1c1510" stroke-width="6"/>
        <rect x="578" y="275" width="52" height="90" fill="#291e14" stroke="#1c1510" stroke-width="3"/>
        <rect x="650" y="275" width="52" height="90" fill="#291e14" stroke="#1c1510" stroke-width="3"/>
        <rect x="578" y="390" width="52" height="120" fill="#291e14" stroke="#1c1510" stroke-width="3"/>
        <rect x="650" y="390" width="52" height="120" fill="#291e14" stroke="#1c1510" stroke-width="3"/>
        <circle cx="700" cy="410" r="8" fill="#8a7148"/>
        <rect x="614" y="216" width="52" height="26" rx="3" fill="#463825"/>
        <text x="640" y="236" text-anchor="middle" font-family="Georgia" font-size="19" fill="#c9a35f">17</text>
      </g>
      <!-- note pinned on door -->
      <g id="v_note">
        <rect x="596" y="300" width="46" height="58" fill="#d8c9a8" transform="rotate(-4 619 329)"/>
        <line x1="602" y1="315" x2="632" y2="313" stroke="#6b5b45" stroke-width="2"/>
        <line x1="602" y1="325" x2="634" y2="323" stroke="#6b5b45" stroke-width="2"/>
        <line x1="602" y1="335" x2="628" y2="333" stroke="#6b5b45" stroke-width="2"/>
        <circle cx="619" cy="303" r="3" fill="#8a4a3a"/>
      </g>
      <!-- porch light: fixture only; the beam and pool come from the FX light layer -->
      <g id="v_plight">
        <rect x="440" y="270" width="10" height="26" fill="#2c241c"/>
        <path d="M430,296 L460,296 L452,326 L438,326 Z" fill="#3a2f22"/>
        <polygon points="437,324 453,324 449,332 441,332" fill="#f0c884"><animate attributeName="opacity" values="1;1;0.75;1" dur="6s" repeatCount="indefinite"/></polygon>
      </g>
      <!-- porch floor -->
      <rect x="180" y="548" width="920" height="26" fill="#2b211a"/>
      <!-- the overgrown front yard: bushes flank the step, stones line the path -->
      <g id="v_yard" filter="url(#blurf)">
        <circle cx="222" cy="556" r="30" fill="#141a12"/><circle cx="250" cy="564" r="24" fill="#141a12"/><circle cx="196" cy="566" r="22" fill="#10160f"/>
        <circle cx="1056" cy="556" r="32" fill="#141a12"/><circle cx="1026" cy="566" r="24" fill="#141a12"/><circle cx="1084" cy="564" r="22" fill="#10160f"/>
      </g>
      <!-- stones lining the path and half sunk in the lawn -->
      <g id="v_stones">
        <ellipse cx="300" cy="580" rx="13" ry="6" fill="#2a2f36"/>
        <ellipse cx="332" cy="586" rx="10" ry="5" fill="#232830"/>
        <ellipse cx="922" cy="584" rx="11" ry="5" fill="#2a2f36"/>
        <ellipse cx="952" cy="578" rx="14" ry="6" fill="#232830"/>
        <ellipse cx="1120" cy="590" rx="9" ry="4" fill="#262b32"/>
        <ellipse cx="238" cy="600" rx="9" ry="4" fill="#262b32"/>
        <ellipse cx="1010" cy="600" rx="10" ry="5" fill="#232830"/>
        <ellipse cx="470" cy="616" rx="11" ry="5" fill="#262b32"/>
        <ellipse cx="806" cy="620" rx="9" ry="4" fill="#232830"/>
        <ellipse cx="560" cy="648" rx="8" ry="3.6" fill="#262b32"/>
        <ellipse cx="726" cy="652" rx="9" ry="4" fill="#232830"/>
      </g>
      <!-- grass tufts creeping over the lawn and path edges -->
      <g id="v_grass">
        ${tuft(250, 586)}
        ${tuft(283, 596, "#1b241d")}
        ${tuft(1014, 582)}
        ${tuft(1048, 592, "#1b241d")}
        ${tuft(392, 606)}
        ${tuft(452, 640, "#1b241d")}
        ${tuft(828, 604)}
        ${tuft(756, 646, "#1b241d")}
        ${tuft(500, 666, "#162019")}
        ${tuft(700, 668)}
        ${tuft(560, 700, "#1b241d")}
        ${tuft(734, 706)}
      </g>
      <!-- fallen leaves: a drift of them under each tree, a few blown onto the path -->
      <g id="v_leaves">
        ${leaf(52, 566, 4, 20)}
        ${leaf(70, 574, 3.4, -30, "#23271e")}
        ${leaf(96, 570, 3.6, 60, "#2b1f16")}
        ${leaf(128, 580, 4, -12)}
        ${leaf(150, 588, 3, 40, "#23271e")}
        ${leaf(86, 590, 3, 8, "#2b1f16")}
        ${leaf(1122, 566, 4, -20)}
        ${leaf(1150, 576, 3.4, 30, "#23271e")}
        ${leaf(1180, 570, 3.6, -55, "#2b1f16")}
        ${leaf(1214, 582, 4, 12)}
        ${leaf(1236, 592, 3, -35, "#23271e")}
        ${leaf(1166, 592, 3, 5, "#2b1f16")}
        ${leaf(600, 622, 3, 30, "#23271e")}
        ${leaf(662, 656, 3.4, -20, "#2b1f16")}
        ${leaf(648, 700, 3, 14, "#23271e")}
        ${leaf(704, 692, 2.8, -40)}
      </g>
      <!-- pots: two in the light, one in shadow right of door -->
      <g id="v_pot0"><path d="M356,520 L394,520 L388,556 L362,556 Z" fill="#7a4a34"/><ellipse cx="375" cy="520" rx="19" ry="5" fill="#8a5a40"/><path d="M375,506 q-11,8 -3,14 q9,-2 3,-14" fill="#5d6b4a"/></g>
      <g id="v_pot1"><path d="M436,516 L480,516 L473,558 L443,558 Z" fill="#7a4a34"/><ellipse cx="458" cy="516" rx="22" ry="6" fill="#8a5a40"/><path d="M458,498 q-13,10 -4,18 q11,-3 4,-18" fill="#5d6b4a"/><path d="M462,500 q10,9 1,16" fill="none" stroke="#5d6b4a" stroke-width="3"/></g>
      <g id="v_pot2" ${hasKey ? 'transform="translate(0,-4) rotate(-7 880 540)"' : ""}>
        <path d="M858,518 L902,518 L895,558 L865,558 Z" fill="#5d3a2a"/><ellipse cx="880" cy="518" rx="22" ry="6" fill="#6b4430"/>
        <path d="M880,502 q-12,9 -4,16 q10,-2 4,-16" fill="#46503a"/>
      </g>
      ${hasKey ? `<ellipse cx="880" cy="560" rx="26" ry="5" fill="#0b0d10"/>` : ""}
      <!-- doormat -->
      <g id="v_mat"><rect x="576" y="556" width="128" height="22" rx="3" fill="#4a3a2a"/><rect x="584" y="560" width="112" height="14" rx="2" fill="none" stroke="#5d4a35" stroke-width="2"/></g>
    </g>
    <g id="layer-front">
      <!-- ground fog: slow thin wisps breathing across the yard -->
      <ellipse cx="420" cy="620" rx="260" ry="22" fill="#7a8492" opacity="0.09" filter="url(#blurf)">
        <animateTransform attributeName="transform" type="translate" values="-180,0;360,0;-180,0" dur="96s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.09;0.14;0.09" dur="41s" repeatCount="indefinite"/>
      </ellipse>
      <ellipse cx="900" cy="636" rx="300" ry="24" fill="#7a8492" opacity="0.07" filter="url(#blurf)">
        <animateTransform attributeName="transform" type="translate" values="260,0;-200,0;260,0" dur="120s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.07;0.11;0.07" dur="53s" repeatCount="indefinite"/>
      </ellipse>
      <rect x="0" y="690" width="1280" height="30" fill="#0b0d10"/>
      <path d="M0,700 Q120,660 200,706 L0,720 Z" fill="#0e1116"/>
      <path d="M1280,700 Q1150,656 1080,708 L1280,720 Z" fill="#0e1116"/>
      <!-- foreground framing: two huge dark trees at the very edges, near the lens -->
      <g id="v_near" opacity="0.96">
        <ellipse cx="50" cy="712" rx="120" ry="16" fill="#04060a" opacity="0.6"/>
        ${pixTree(TREE_OAK, 8, -46, 712, { pivotCol: 11, branches: true, swayDur: 8, swayAmt: 0.7 })}
        <ellipse cx="1236" cy="720" rx="120" ry="16" fill="#04060a" opacity="0.6"/>
        ${pixTree(TREE_DEAD, 8, 1206, 720, { pivotCol: 11, flip: true, swayDur: 11, swayAmt: 0.7 })}
      </g>
      ${reducedMotion ? "" : `
      <!-- wind: streaks so faint they are more felt than seen -->
      <g id="v_wind" pointer-events="none" opacity="0.06">
        <line x1="0" y1="150" x2="320" y2="150" stroke="#c9d8e6" stroke-width="2" stroke-dasharray="70 130 46 150">
          <animateTransform attributeName="transform" type="translate" values="-340,0;1420,0" dur="16s" repeatCount="indefinite"/>
        </line>
        <line x1="0" y1="260" x2="400" y2="260" stroke="#9fb0c2" stroke-width="1.6" stroke-dasharray="46 110 80 96">
          <animateTransform attributeName="transform" type="translate" values="-420,0;1360,0" dur="22s" repeatCount="indefinite"/>
        </line>
        <line x1="0" y1="410" x2="280" y2="410" stroke="#c9d8e6" stroke-width="1.4" stroke-dasharray="56 96 36 120">
          <animateTransform attributeName="transform" type="translate" values="-300,0;1400,0" dur="19s" repeatCount="indefinite"/>
        </line>
      </g>
      <!-- leaves torn off the trees, carried sideways by the wind -->
      <g id="v_blow" pointer-events="none">
        ${blowLeaf(210, 13, 1, "#3a352c")}
        ${blowLeaf(300, 18, 0.8, "#455060")}
        ${blowLeaf(360, 15, 1.1, "#3a352c")}
        ${blowLeaf(250, 21, 0.7, "#4a5240")}
      </g>`}
    </g>
    <g id="hotspots">
      ${hs("note", 580, 288, 76, 82, "A note, pinned to the door", "v_note")}
      ${hs("door", 556, 240, 168, 316, hasKey ? "Unlock the door" : "The front door", "v_door")}
      ${hs("pot0", 340, 496, 70, 70, "A flowerpot in the lamplight", "v_pot0")}
      ${hs("pot1", 424, 490, 70, 76, "A flowerpot in the lamplight", "v_pot1")}
      ${hs("pot2", 846, 492, 70, 74, "A flowerpot in the dark", "v_pot2")}
      ${hs("mat", 566, 548, 148, 36, "The doormat", "v_mat")}
      ${hs("plight", 420, 258, 52, 76, "The porch light", "v_plight")}
      ${hs("plate", 606, 208, 68, 40, "The number plate", "v_door")}
      ${hs("win", 890, 200, 140, 168, "An upstairs window", "v_win2")}
    </g>
    </svg>`;
  }

  /* =====================================================================
     HALLWAY (hub)
  ===================================================================== */
  function svgHallway() {
    const act2 = State.flag("act2");
    const hallLampOn = State.flag("hallLampOn") === true; // default off
    const reducedMotion = Settings.get("reducedMotion");
    return `<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    <defs>
      <filter id="blurf"><feGaussianBlur stdDeviation="2.6"/></filter>
      <filter id="fogblur"><feGaussianBlur stdDeviation="8"/></filter>
      <filter id="mirrorblur"><feGaussianBlur stdDeviation="2.4"/></filter>
      <clipPath id="kdoorclip"><polygon points="66,176 234,176 234,494 66,494"/></clipPath>
      <clipPath id="mirrorclip"><ellipse cx="720" cy="256" rx="58" ry="82"/></clipPath>
      <linearGradient id="mirrorglass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1b2731"/><stop offset="0.45" stop-color="#243541"/>
        <stop offset="0.75" stop-color="#33495a"/><stop offset="1" stop-color="#1a2730"/>
      </linearGradient>
      <linearGradient id="mirrorglass-lit" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#42596a"/><stop offset="0.45" stop-color="#5c7687"/>
        <stop offset="0.75" stop-color="#6d8798"/><stop offset="1" stop-color="#3c5262"/>
      </linearGradient>
      <linearGradient id="mirrorreflect" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e8a04c" stop-opacity="0"/>
        <stop offset="0.55" stop-color="#e8a04c" stop-opacity="0.10"/>
        <stop offset="1" stop-color="#e8a04c" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="mirrorstreak" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d2e6f0" stop-opacity="0"/>
        <stop offset="0.48" stop-color="#d2e6f0" stop-opacity="0.13"/>
        <stop offset="0.6" stop-color="#d2e6f0" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="mirrorvig" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#000000" stop-opacity="0"/>
        <stop offset="0.72" stop-color="#000000" stop-opacity="0.08"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.52"/>
      </radialGradient>
      <linearGradient id="peekdark" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0b0806" stop-opacity="0.6"/>
        <stop offset="0.55" stop-color="#0b0806" stop-opacity="0.34"/>
        <stop offset="1" stop-color="#0b0806" stop-opacity="0.5"/>
      </linearGradient>
      <linearGradient id="peekdeep" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#0b0806" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#0b0806" stop-opacity="0.18"/>
      </linearGradient>
    </defs>
    <g id="layer-back">
      <rect width="1280" height="500" fill="url(#wallg)"/>
      <rect x="0" y="500" width="1280" height="220" fill="url(#floorg)"/>
      ${[...Array(9)].map((_, i) => `<polygon points="${i*150},500 ${i*150+150},500 ${i*150+190},720 ${i*150+30},720" fill="none" stroke="#100c09" stroke-width="2" opacity="0.5"/>`).join("")}
      <rect x="0" y="490" width="1280" height="12" fill="#1c1610"/>
      <rect x="0" y="90" width="1280" height="8" fill="#241d16"/>
      <!-- wallpaper stripes -->
      ${[...Array(32)].map((_, i) => `<line x1="${i * 40}" y1="98" x2="${i * 40}" y2="490" stroke="#352c23" stroke-width="12" opacity="0.35"/>`).join("")}
      <!-- ceiling fog: slow thin wisps that breathe and drift -->
      <g id="v_fog" pointer-events="none">
        <ellipse cx="250" cy="86" rx="180" ry="15" fill="#8f8778" opacity="0.07" filter="url(#fogblur)">
          ${reducedMotion ? "" : `<animateTransform attributeName="transform" type="translate" values="-240,0;540,0;-240,0" dur="86s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.07;0.1;0.07" dur="37s" repeatCount="indefinite"/>`}
        </ellipse>
        <ellipse cx="640" cy="72" rx="230" ry="17" fill="#8f8778" opacity="0.06" filter="url(#fogblur)">
          ${reducedMotion ? "" : `<animateTransform attributeName="transform" type="translate" values="420,0;-280,0;420,0" dur="104s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.06;0.09;0.06" dur="43s" repeatCount="indefinite"/>`}
        </ellipse>
        <ellipse cx="1040" cy="92" rx="170" ry="13" fill="#9a9385" opacity="0.05" filter="url(#fogblur)">
          ${reducedMotion ? "" : `<animateTransform attributeName="transform" type="translate" values="-180,0;320,0;-180,0" dur="128s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.05;0.08;0.05" dur="53s" repeatCount="indefinite"/>`}
        </ellipse>
      </g>
    </g>
    <g id="layer-mid">
      <!-- kitchen doorway (left): open, showing the kitchen through the opening -->
      <g id="v_kdoor">
        <rect x="60" y="170" width="180" height="330" fill="#171310"/>
        <rect x="60" y="170" width="180" height="330" fill="none" stroke="#3f342a" stroke-width="10"/>
        <!-- the kitchen, masked by the doorway so only what the eye could see shows -->
        <g clip-path="url(#kdoorclip)">
          <!-- far wall with the window over the sink, receding to the left -->
          <rect x="66" y="176" width="168" height="150" fill="#26251f"/>
          <rect x="82" y="200" width="34" height="26" fill="#1d1c16" stroke="#14130e" stroke-width="3"/>
          <rect x="122" y="200" width="34" height="26" fill="#1d1c16" stroke="#14130e" stroke-width="3"/>
          <rect x="82" y="234" width="96" height="66" fill="#10151d" stroke="#1a140f" stroke-width="5"/>
          <line x1="130" y1="234" x2="130" y2="300" stroke="#1a140f" stroke-width="4"/>
          <line x1="82" y1="266" x2="178" y2="266" stroke="#1a140f" stroke-width="4"/>
          <circle cx="160" cy="250" r="6" fill="#cfd8e0" opacity="0.5"/>
          ${State.flag("falseKitchen") ? `<rect x="82" y="234" width="96" height="66" fill="#2a1f2e" opacity="0.5"/>` : ""}
          <!-- the kitchen lamp, far off to the left: a slanted shaft, never an oval -->
          <polygon points="96,256 150,242 212,472 58,472" fill="url(#lampglow)" opacity="0.26">
            ${reducedMotion ? "" : `<animate attributeName="opacity" values="0.26;0.18;0.24;0.26" dur="7s" repeatCount="indefinite"/>`}
          </polygon>
          <!-- receding floor -->
          <polygon points="66,494 234,494 234,330 66,368" fill="url(#floorg)"/>
          <path d="M104,368 L102,494 M150,348 L151,494 M198,332 L200,494" stroke="#100c09" stroke-width="2" opacity="0.5"/>
          <!-- counter run along the far wall: top surface, then cabinet fronts -->
          <polygon points="66,366 200,328 200,338 66,378" fill="#4a3826"/>
          <polygon points="66,378 200,338 200,394 66,434" fill="#33261a"/>
          <line x1="70" y1="394" x2="196" y2="360" stroke="#241a11" stroke-width="3"/>
          <rect x="92" y="356" width="58" height="6" rx="3" fill="#7a817c"/>
          <!-- stove at the far left end of the run -->
          <rect x="66" y="398" width="30" height="74" fill="#4a4e52" stroke="#22262a" stroke-width="3"/>
          <rect x="72" y="434" width="18" height="24" rx="2" fill="#15181b"/>
          <!-- fridge beside the door, close to us on the right, in shadow -->
          <rect x="198" y="252" width="40" height="242" fill="#565b56"/>
          <line x1="198" y1="252" x2="198" y2="494" stroke="#3d413d" stroke-width="4"/>
          <line x1="216" y1="258" x2="216" y2="490" stroke="#6a706b" stroke-width="3" opacity="0.7"/>
          <!-- the little darkness: deeper toward the far wall and the far corner -->
          <rect x="66" y="176" width="168" height="318" fill="url(#peekdark)"/>
          <rect x="66" y="176" width="168" height="318" fill="url(#peekdeep)"/>
          <!-- hallway lamplight spilling over the threshold -->
          <polygon points="66,494 234,494 234,472 66,486" fill="#e8a04c" opacity="0.08"/>
        </g>
        <!-- inner reveal of the opening -->
        <polygon points="66,176 234,176 234,494 66,494" fill="none" stroke="#1c1510" stroke-width="6" opacity="0.85"/>
        <line x1="70" y1="179" x2="230" y2="179" stroke="#4a3826" stroke-width="4" opacity="0.5"/>
      </g>
      <!-- the way out is the left side arrow; no door drawn for it -->
      <!-- grandfather clock: pendulum visibly swings -->
      <g id="v_gclock">
        <rect x="300" y="200" width="86" height="310" rx="6" fill="url(#woodg)" stroke="#221a12" stroke-width="4"/>
        <rect x="312" y="330" width="62" height="160" fill="#241a11"/>
        <g transform="translate(343,340)">
          <g>
            ${Settings.get("reducedMotion") ? "" : `<animateTransform attributeName="transform" type="rotate" values="-7 0 0;7 0 0;-7 0 0" dur="2.4s" repeatCount="indefinite"/>`}
            <line x1="0" y1="4" x2="0" y2="100" stroke="#8a7148" stroke-width="3"/>
            <circle cx="0" cy="108" r="12" fill="#8a7148" opacity="0.9"/>
          </g>
        </g>
        ${CLOCK_817(343, 260, 34)}
        <polygon points="296,200 343,178 390,200" fill="#33261a"/>
      </g>
      <!-- family photo -->
      <g id="v_photo">
        <rect x="470" y="200" width="150" height="110" fill="#221a12" stroke="#4a3826" stroke-width="7"/>
        <rect x="482" y="211" width="126" height="88" fill="#c9bb9b"/>
        ${person(510, 292, 52, "#5a4a3a")}${person(545, 292, 50, "#6b5544")}${person(575, 294, 38, "#4a5568")}${person(596, 296, 30, "#7a5a50")}
        ${act2 ? person(492, 293, 46, "#8f8778", true) : ""}
      </g>
      ${State.flag("mirrorBlood") ? `
      <!-- the wall writes back: STOP, covering a third of the plaster -->
      <g id="v_blood">
        <g filter="url(#mirrorblur)" opacity="0.5">
          <text x="500" y="320" text-anchor="middle" font-family="Georgia" font-size="150" letter-spacing="10" fill="#5a120c" transform="rotate(-6 500 300)">STOP</text>
        </g>
        <text x="500" y="320" text-anchor="middle" font-family="Georgia" font-size="150" letter-spacing="10" fill="#7a1f16" transform="rotate(-6 500 300)">STOP</text>
        <path d="M416,330 q6,46 -2,84 M470,346 q4,52 2,96 M540,338 q-4,58 2,102 M596,332 q-6,40 -4,80" stroke="#7a1f16" stroke-width="7" fill="none" opacity="0.8"/>
        <path d="M470,346 q4,52 2,96 M540,338 q-4,58 2,102" stroke="#5a120c" stroke-width="3" fill="none" opacity="0.6"/>
        <ellipse cx="430" cy="318" rx="26" ry="9" fill="#3a1a10" opacity="0.7" transform="rotate(-14 430 318)"/>
        <ellipse cx="566" cy="330" rx="30" ry="10" fill="#2a130a" opacity="0.7" transform="rotate(10 566 330)"/>
        <path d="M470,426 q30,-8 56,4 q24,12 52,2" stroke="#2a130a" stroke-width="5" fill="none" opacity="0.5"/>
      </g>` : ""}
      ${State.flag("mirrorMoved") ? `<rect x="660" y="160" width="120" height="196" fill="none" stroke="#5d4f3e" stroke-width="2" stroke-dasharray="5 6" opacity="0.25"/>` : ""}
      <!-- mirror -->
      <g id="v_mirror" ${State.flag("mirrorMoved") === 1 ? 'transform="translate(46,-10)"' : State.flag("mirrorMoved") === 2 ? 'transform="translate(-74,-18) rotate(-3 720 256)"' : ""}>
        <!-- soft wall shadow behind the frame: small and tight, hugging the bottom
             rim so the mirror sits on the wall instead of hanging off it -->
        <ellipse cx="720" cy="346" rx="30" ry="5" fill="#0d0a08" opacity="0.45"/>
        <!-- frame: blurred outer shadow, dark body, warm ring, lit inner rim -->
        <ellipse cx="720" cy="256" rx="66" ry="90" fill="none" stroke="#120c09" stroke-width="20" filter="url(#blurf)" opacity="0.5"/>
        <ellipse cx="720" cy="256" rx="64" ry="88" fill="none" stroke="#241a12" stroke-width="16"/>
        <ellipse cx="720" cy="256" rx="64" ry="88" fill="none" stroke="#38251b" stroke-width="10"/>
        <ellipse cx="720" cy="256" rx="58" ry="82" fill="none" stroke="#644431" stroke-width="2.5" opacity="0.6"/>
        ${State.flag("mirrorShattered") ? `
        <!-- the hollow behind the glass -->
        <g clip-path="url(#mirrorclip)">
          <ellipse cx="720" cy="256" rx="58" ry="82" fill="#0b0f13"/>
          <!-- the shadow behind the glass: body, neck, head, shoulders, blurred -->
          <g filter="url(#mirrorblur)" opacity="0.85">
            <ellipse cx="720" cy="326" rx="30" ry="46" fill="#070b0f"/>
            <rect x="710" y="264" width="20" height="30" fill="#070b0f"/>
            <ellipse cx="720" cy="228" rx="24" ry="30" fill="#070b0f"/>
            <path d="M689,302 Q668,319 665,350 L775,350 Q772,319 751,302 Z" fill="#070b0f"/>
          </g>
          <!-- two points of lamplight at child height, sharp, so they read as eyes -->
          <circle cx="711" cy="226" r="2.6" fill="#ebb365"/>
          <circle cx="729" cy="226" r="2.6" fill="#ebb365"/>
          <circle cx="711" cy="226" r="6.5" fill="#ebb365" opacity="0.16"/>
          <circle cx="729" cy="226" r="6.5" fill="#ebb365" opacity="0.16"/>
          <!-- smoke, blurred, drifting up out of the hollow -->
          <g filter="url(#mirrorblur)">
            <ellipse cx="712" cy="312" rx="11" ry="6" fill="#0f171e" opacity="0.5">
              ${reducedMotion ? "" : `<animate attributeName="cy" values="312;272;244" dur="7s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.5;0" dur="7s" repeatCount="indefinite"/>`}
            </ellipse>
            <ellipse cx="730" cy="318" rx="9" ry="5" fill="#0f171e" opacity="0.4">
              ${reducedMotion ? "" : `<animate attributeName="cy" values="318;282;254" dur="9s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.4;0" dur="9s" repeatCount="indefinite"/>`}
            </ellipse>
          </g>
          <ellipse cx="720" cy="256" rx="58" ry="82" fill="url(#mirrorvig)"/>
        </g>
        <!-- glass on the floor below, done falling -->
        <polygon points="688,514 702,498 710,516" fill="#2d3f50"/>
        <polygon points="722,520 734,504 744,522" fill="#1f2d3a"/>
        <polygon points="754,512 762,500 772,514" fill="#2d3f50"/>
        <polygon points="706,528 716,518 726,530" fill="#1f2d3a"/>
        <polygon points="736,534 744,526 752,538" fill="#24323f"/>
        <ellipse cx="728" cy="530" rx="52" ry="6" fill="#0d0a08" opacity="0.3"/>` : `
        <!-- the glass: black and deep when dark, clear when the lamp is on -->
        <g clip-path="url(#mirrorclip)">
          <ellipse cx="720" cy="256" rx="58" ry="82" fill="${hallLampOn ? "url(#mirrorglass-lit)" : "url(#mirrorglass)"}"/>
          <rect x="662" y="174" width="116" height="164" fill="url(#mirrorreflect)"/>
          <path d="M662,326 L702,204 L730,214 L690,338 Z" fill="url(#mirrorstreak)"/>
          <path d="M700,200 L720,206 L708,330 Z" fill="url(#mirrorstreak)" opacity="0.6"/>
          ${act2 && !State.flag("mirrorCracked") ? `<text x="720" y="264" text-anchor="middle" font-family="Georgia" font-size="17" fill="#c9bb9b" opacity="0.6" transform="matrix(-1,0,0,1,1440,0)">LOOK AGAIN</text>` : ""}
          ${State.flag("mirrorCracked") ? `
          <g fill="none" stroke="#0d0e10" stroke-width="2.4" opacity="0.35">
            <path d="M720,256 L695,242 L665,248 L649,229"/>
            <path d="M720,256 L751,273 L769,254 L791,263"/>
            <path d="M720,256 L708,305 L683,342"/>
            <path d="M720,256 L739,208 L726,164"/>
            <path d="M695,242 L739,208 L751,273 L708,305 L695,242"/>
            <path d="M751,273 L778,287"/>
            <path d="M708,305 L732,320"/>
          </g>
          <g fill="none" stroke="#c8dcf0" stroke-width="1.6" opacity="0.8">
            <path d="M720,256 L695,242 L665,248 L649,229"/>
            <path d="M720,256 L751,273 L769,254 L791,263"/>
            <path d="M720,256 L708,305 L683,342"/>
            <path d="M720,256 L739,208 L726,164"/>
            <path d="M695,242 L739,208 L751,273 L708,305 L695,242"/>
            <path d="M751,273 L778,287"/>
            <path d="M708,305 L732,320"/>
          </g>` : ""}
          ${hallLampOn
            ? `<ellipse cx="720" cy="256" rx="58" ry="82" fill="url(#mirrorreflect)" opacity="0.55"/>
               <ellipse cx="706" cy="238" rx="20" ry="34" fill="#dceaf4" opacity="0.10"/>`
            : `<ellipse cx="720" cy="256" rx="58" ry="82" fill="url(#mirrorvig)"/>`}
        </g>`}
      </g>
      <!-- side table + lamp -->
      <g id="v_stable">
        <rect x="660" y="420" width="120" height="12" fill="#3f2f20"/><rect x="672" y="432" width="10" height="70" fill="#33261a"/><rect x="758" y="432" width="10" height="70" fill="#33261a"/>
        <path d="M700,372 L740,372 L732,398 L708,398 Z" fill="${hallLampOn ? "#c9a35f" : "#4a3d2c"}" opacity="0.9"/>
        <rect x="717" y="398" width="6" height="22" fill="#2c241c"/>
      </g>
      <!-- staircase pushed further right so its foot clears the hatch; the flight runs off the frame edge -->
      <g id="v_stairs">
        <ellipse cx="1122" cy="566" rx="212" ry="7" fill="#0d0a08" opacity="0.35"/>
        <!-- solid under stair mass: one consistent side profile -->
        <polygon points="938,568 1310,256 1310,568" fill="#241a11"/>
        <polygon points="938,568 1310,256 1310,270 952,568" fill="#33261a"/>
        <!-- twelve steps: riser face + tread top, all converging the same way -->
        ${[...Array(12)].map((_, i) => {
          const x = 938 + i * 31, y = 568 - (i + 1) * 26;
          return `<rect x="${x}" y="${y}" width="31" height="26" fill="#3a2c1e"/><polygon points="${x},${y} ${x + 31},${y} ${x + 41},${y - 7} ${x + 10},${y - 7}" fill="#4a3826"/><line x1="${x}" y1="${y}" x2="${x + 31}" y2="${y}" stroke="#5d4a35" stroke-width="2"/>`;
        }).join("")}
        <!-- balusters, foot on tread, head on the rail line -->
        ${[...Array(10)].map((_, i) => {
          const bx = 974 + i * 34;
          const railY = Math.round(452 - (bx - 960) * 0.84);
          const stepIdx = Math.min(11, Math.floor((bx - 938) / 31));
          const stepY = 568 - (stepIdx + 1) * 26 - 6;
          return `<line x1="${bx}" y1="${railY}" x2="${bx}" y2="${stepY}" stroke="#33261a" stroke-width="5"/>`;
        }).join("")}
        <!-- handrail on the vanishing slope, easing level as it leaves the frame -->
        <path d="M960,452 L1246,212 Q1288,177 1310,170" fill="none" stroke="#4a3826" stroke-width="9"/>
        <path d="M960,452 L1246,212 Q1288,177 1310,170" fill="none" stroke="#5d4a35" stroke-width="2.5"/>
        <rect x="948" y="452" width="14" height="116" fill="#3a2c1e"/>
        <circle cx="955" cy="445" r="9" fill="#4a3826"/>
      </g>
      <!-- basement entrance: a hatch lying flat in the floor, lowered so it sits clear of the staircase -->
      <g id="v_udoor">
        <ellipse cx="949" cy="662" rx="126" ry="15" fill="#0d0a08" opacity="0.4"/>
        <polygon points="874,584 1024,584 1062,654 836,654" fill="url(#woodg)"/>
        <polygon points="874,584 1024,584 1062,654 836,654" fill="#0b0806" opacity="0.25"/>
        <path d="M912,584 L890,654 M950,584 L948,654 M988,584 L1006,654" stroke="#191309" stroke-width="2.5" opacity="0.8"/>
        <polygon points="874,584 1024,584 1062,654 836,654" fill="none" stroke="#191309" stroke-width="5"/>
        <polygon points="836,654 1062,654 1062,665 836,665" fill="#171008"/>
        <rect x="896" y="579" width="26" height="8" rx="2" fill="#3a3e42"/>
        <rect x="978" y="579" width="26" height="8" rx="2" fill="#3a3e42"/>
        <circle cx="949" cy="632" r="11" fill="none" stroke="#565b60" stroke-width="5"/>
        <rect x="941" y="618" width="16" height="7" rx="3" fill="#3a3e42"/>
        ${act2
          ? `<rect x="914" y="598" width="26" height="16" rx="3" fill="#0d0a07" stroke="#8a7148" stroke-width="2.5"><animate attributeName="stroke-opacity" values="1;0.4;1" dur="3s" repeatCount="indefinite"/></rect><circle cx="927" cy="606" r="3" fill="#191309"/>`
          : `<rect x="914" y="598" width="26" height="16" rx="3" fill="#12100c"/>`}
      </g>
      <!-- coat rack -->
      <g id="v_rack">
        <rect x="418" y="330" width="8" height="176" fill="#33261a"/>
        <line x1="392" y1="348" x2="452" y2="348" stroke="#33261a" stroke-width="7" stroke-linecap="round"/>
        <path d="M398,350 q-9,60 8,104 q12,10 20,0 q13,-48 2,-104 Z" fill="#42392c"/>
      </g>
      <!-- rug -->
      <ellipse cx="560" cy="600" rx="240" ry="46" fill="#4a2f24" opacity="0.85"/>
      <ellipse cx="560" cy="600" rx="200" ry="36" fill="none" stroke="#5d4a35" stroke-width="3" opacity="0.7"/>
    </g>
    <g id="layer-front">
      <rect x="0" y="0" width="1280" height="720" fill="#0b0806" opacity="${act2 ? "0.14" : "0.05"}"/>
      ${hallLampOn ? "" : `<rect x="0" y="0" width="1280" height="720" fill="#0b0d12" opacity="0.22"/>`}
    </g>
    <g id="hotspots">
      ${hs("gokitchen", 52, 160, 196, 350, "Go to the kitchen", "v_kdoor")}
      ${hs("photo", 458, 188, 174, 134, "Family photograph", "v_photo")}
      ${hs("gclock", 288, 188, 110, 336, "Grandfather clock", "v_gclock")}
      ${hs("mirror", 650, 166, 140, 182, "An old mirror", "v_mirror")}
      ${hs("udoor", 824, 574, 250, 100, act2 ? "A hatch in the floor" : "An outline in the floorboards", "v_udoor")}
      ${hs("goup", 938, 230, 342, 338, "Up the stairs", "v_stairs")}
      ${hs("rack", 384, 322, 84, 190, "A coat that stayed", "v_rack")}
      ${hs("leave", 0, 140, 44, 380, "The way out", "")}
      ${hs("hlamp", 648, 356, 144, 90, "A small lamp", "v_stable")}
    </g>
    </svg>`;
  }

  /* =====================================================================
     KITCHEN
  ===================================================================== */
  function svgKitchen() {
    const act2 = State.flag("act2");
    const drawerOpen = State.flag("drawerOpen");
    const boxOpen = State.flag("lockboxOpen");
    const fridgeOpen = State.flag("fridgeOpen");
    const tapOn = State.flag("tapOn");
    const stoveOn = State.flag("stoveOn");
    const tapOverflow = State.flag("tapOverflow");
    const wetFloor = State.flag("wetFloor");
    const tapHouseOff = State.flag("tapHouseOff");
    const tapFloodFast = State.flag("tapFloodFast");
    const tapDrained = State.flag("tapDrained");
    const tapMoist = State.flag("tapMoist");
    const falseK = State.flag("falseKitchen");
    const C = (State.get().counts) || { milk: 3, bread: 1, apples: 4, batteries: 2, code: "3142" };
    const drawerHitH = drawerOpen ? 104 : 56;
    const chairHitX = act2 ? 278 : 214;
    return `<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    <g id="layer-back">
      <rect width="1280" height="480" fill="#3b3a2f"/>
      ${[...Array(20)].map((_, i) => `<rect x="${i * 64}" y="90" width="60" height="120" fill="#434235" opacity="0.55"/>`).join("")}
      ${[...Array(20)].map((_, i) => `<rect x="${(i * 64) + 32}" y="214" width="60" height="120" fill="#403f31" opacity="0.5"/>`).join("")}
      <rect x="0" y="480" width="1280" height="240" fill="url(#floorg)"/>
      ${[...Array(8)].map((_, i) => `<line x1="${i * 170}" y1="480" x2="${i * 170 + 60}" y2="720" stroke="#100c09" stroke-width="2" opacity="0.5"/>`).join("")}
      <!-- window over sink -->
      <g id="v_kwin">
        <rect x="520" y="120" width="240" height="180" fill="url(#nightg)" stroke="#2c241c" stroke-width="10"/>
        <line x1="640" y1="120" x2="640" y2="300" stroke="#2c241c" stroke-width="7"/>
        <line x1="520" y1="210" x2="760" y2="210" stroke="#2c241c" stroke-width="7"/>
        ${falseK ? `<rect x="525" y="125" width="230" height="170" fill="#2a1f2e" opacity="0.55"/>` : `<circle cx="700" cy="160" r="14" fill="#d8dce0" opacity="0.7"/>`}
        <path d="M530,290 q40,-26 80,0 q30,-20 60,0 q40,-24 80,0 Z" fill="#232d3a" opacity="0.8"/>
      </g>
      <!-- hanging lamp: fixture only; the beam and pool come from the FX light layer -->
      <line x1="640" y1="0" x2="640" y2="66" stroke="#1c1610" stroke-width="4"/>
      <path d="M612,66 L668,66 L654,92 L626,92 Z" fill="#3a2f22"/>
      <ellipse cx="640" cy="96" rx="14" ry="8" fill="#f0c884"><animate attributeName="opacity" values="1;0.85;1;1" dur="7s" repeatCount="indefinite"/></ellipse>
    </g>
    <g id="layer-mid">
      <!-- wall clock 8:17 -->
      <!-- the left and right edges are exits handled by the side arrows; no door drawn -->
      <g id="v_kclock">${falseK ? clockFace(180, 190, 46, 217, 84) : CLOCK_817(180, 190, 46)}</g>
      <!-- fridge: closed by default, door swings open on click -->
      <g id="v_fridge">
        <ellipse cx="1075" cy="549" rx="96" ry="10" fill="#0d0a08" opacity="0.5"/>
        <rect x="990" y="180" width="170" height="360" rx="8" fill="#8f9691" stroke="#5d635f" stroke-width="4"/>
        <rect x="1004" y="540" width="14" height="9" fill="#5d635f"/><rect x="1132" y="540" width="14" height="9" fill="#5d635f"/>
        <line x1="990" y1="300" x2="1160" y2="300" stroke="#5d635f" stroke-width="4"/>
        <rect x="1000" y="220" width="8" height="56" rx="4" fill="#5d635f"/>
        ${fridgeOpen ? `
          <rect x="996" y="308" width="158" height="226" fill="#20262a"/>
          <rect x="996" y="308" width="158" height="226" fill="url(#lampglow)" opacity="0.4"/>
          <rect x="1000" y="420" width="150" height="6" fill="#39434c"/>
          <rect x="1000" y="486" width="150" height="6" fill="#39434c"/>
          <rect x="1044" y="446" width="52" height="40" rx="4" fill="#5a6a48" opacity="0.85"/>
          <rect x="1106" y="452" width="36" height="34" rx="3" fill="#8a6a4a" opacity="0.8"/>
          <g id="v_milk">
          ${(() => {
            const n = C.milk, gone = act2 && State.flag("lockboxOpen");
            const sp = n <= 3 ? 42 : (n === 4 ? 33 : 27), w = n <= 3 ? 24 : 18;
            const idxs = [...Array(n).keys()].filter(i => !(gone && i === 1));
            return idxs.map(i => `<g><rect x="${1012 + i * sp}" y="372" width="${w}" height="48" rx="5" fill="#e6e9e4"/><rect x="${1012 + i * sp + (w - 10) / 2}" y="362" width="10" height="14" fill="#e6e9e4"/><rect x="${1012 + i * sp + (w - 10) / 2}" y="360" width="10" height="5" fill="#c9a35f"/></g>`).join("");
          })()}
          </g>
          <polygon points="990,300 920,336 920,570 990,540" fill="#7a817c" stroke="#5d635f" stroke-width="3"/>
          <polygon points="928,436 984,414 984,426 928,448" fill="#6a716c"/>
          <polygon points="950,336 1046,336 1080,540 918,540" fill="url(#lampglow)" opacity="0.2"/>
        ` : `
          <rect x="1000" y="320" width="8" height="90" rx="4" fill="#5d635f"/>
        `}
      </g>
      <!-- shopping list on fridge -->
      <g id="v_list">
        <rect x="1030" y="216" width="66" height="76" fill="#d8c9a8" transform="rotate(3 1063 254)"/>
        ${[0, 1, 2, 3].map(i => `<line x1="1040" y1="${234 + i * 14}" x2="${1082 - i * 4}" y2="${233 + i * 14}" stroke="#6b5b45" stroke-width="2.4" transform="rotate(3 1063 254)"/>`).join("")}
        <circle cx="1063" cy="222" r="4" fill="#8a4a3a" transform="rotate(3 1063 254)"/>
      </g>
      <!-- counter run -->
      <rect x="60" y="430" width="860" height="22" fill="#4a3826"/>
      <rect x="60" y="452" width="860" height="120" fill="url(#woodg)"/>
      ${[1, 2, 3, 4].map(i => `<rect x="${80 + i * 170}" y="466" width="150" height="92" rx="3" fill="#33261a" stroke="#241a11" stroke-width="3"/>`).join("")}
      <!-- stove: burner knob turns the flame on and off -->
      <g id="v_stove">
        <ellipse cx="155" cy="576" rx="90" ry="9" fill="#0d0a08" opacity="0.5"/>
        <rect x="76" y="426" width="158" height="146" rx="4" fill="#4a4e52" stroke="#22262a" stroke-width="3"/>
        <rect x="76" y="426" width="158" height="20" rx="4" fill="#2b2f33"/>
        <ellipse cx="155" cy="437" rx="36" ry="7" fill="#1a1d20" stroke="#565b60" stroke-width="2"/>
        <line x1="123" y1="437" x2="187" y2="437" stroke="#565b60" stroke-width="2" opacity="0.6"/>
        ${stoveOn ? `
          <polygon points="102,420 208,418 220,472 92,476" fill="url(#lampglow)" opacity="0.42">
            <animate attributeName="opacity" values="0.42;0.26;0.38;0.42" dur="0.9s" repeatCount="indefinite"/>
          </polygon>
          <g>
            ${[126, 138, 168, 180].map((fx, i) => `
              <path d="M${fx},438 q${i % 2 ? 4 : -4},-${9 + (i % 3) * 3} ${i % 2 ? 7 : -1},0 z" fill="#e8913f" opacity="0.9"/>
              <path d="M${fx + 1},438 q2,-5 4,0 z" fill="#8fb4e0" opacity="0.85"/>`).join("")}
            <animate attributeName="opacity" values="1;0.55;0.9;1" dur="0.45s" repeatCount="indefinite"/>
          </g>` : ""}
        <!-- kettle sitting on the burner -->
        <g id="v_kettle">
          <path d="M126,433 q0,-37 29,-37 q29,0 29,37 Z" fill="#7a817c" stroke="#565b60" stroke-width="2"/>
          <path d="M136,400 q19,-18 38,0" fill="none" stroke="#565b60" stroke-width="4.5"/>
          <circle cx="155" cy="394" r="4" fill="#565b60"/>
          <polygon points="181,412 196,400 199,406 186,420" fill="#7a817c"/>
        </g>
        <!-- knobs: the left one is the burner -->
        <circle cx="104" cy="458" r="7.5" fill="${stoveOn ? "#c9a35f" : "#767b80"}"/>
        <rect x="102.4" y="450" width="3.2" height="8" rx="1.5" fill="#22262a" ${stoveOn ? 'transform="rotate(90 104 458)"' : ""}/>
        <circle cx="130" cy="458" r="7.5" fill="#767b80"/><rect x="128.4" y="450" width="3.2" height="8" rx="1.5" fill="#22262a"/>
        <circle cx="182" cy="458" r="7.5" fill="#767b80"/><rect x="180.4" y="450" width="3.2" height="8" rx="1.5" fill="#22262a"/>
        <circle cx="208" cy="458" r="7.5" fill="#767b80"/><rect x="206.4" y="450" width="3.2" height="8" rx="1.5" fill="#22262a"/>
        <!-- oven door -->
        <rect x="90" y="476" width="130" height="82" rx="4" fill="#3a3e42" stroke="#22262a" stroke-width="3"/>
        <rect x="100" y="490" width="110" height="38" rx="3" fill="#15181b"/>
        ${stoveOn ? `<rect x="100" y="490" width="110" height="38" rx="3" fill="#e8913f" opacity="0.06"/>` : ""}
        <rect x="96" y="470" width="118" height="6" rx="3" fill="#767b80"/>
      </g>
      <!-- sink + tap under window -->
      <g id="v_tap">
        <rect x="560" y="436" width="160" height="12" rx="4" fill="#7a817c"/>
        <rect x="592" y="440" width="104" height="5" rx="2.5" fill="#565b60"/>
        <path d="M600,436 q0,-30 26,-30 q20,0 20,18" fill="none" stroke="#7a817c" stroke-width="7"/>
        <rect x="585" y="416" width="16" height="8" rx="3" fill="${tapOn ? "#c9a35f" : "#8f9691"}" ${tapOn ? 'transform="rotate(-28 593 420)"' : ""}/>
        ${tapOn && !tapHouseOff ? `
          <rect x="642" y="424" width="7" height="21" rx="1.5" fill="#a8c8da" opacity="0.7">
            <animate attributeName="opacity" values="0.7;0.5;0.7" dur="0.5s" repeatCount="indefinite"/>
          </rect>
          <line x1="645.5" y1="424" x2="645.5" y2="445" stroke="#e4f0f6" stroke-width="2" stroke-dasharray="3 5" opacity="0.8">
            <animate attributeName="stroke-dashoffset" values="0;-16" dur="0.35s" repeatCount="indefinite"/>
          </line>
          <ellipse cx="646" cy="446" rx="12" ry="3.4" fill="#a8c8da" opacity="0.5">
            <animate attributeName="rx" values="9;14;9" dur="0.7s" repeatCount="indefinite"/>
          </ellipse>` : ""}
        ${tapOverflow && !tapDrained ? `
          <rect x="598" y="446" width="94" height="5" rx="2" fill="#a8c8da" opacity="0.5"/>
          <path d="M602,450 q3,60 -1,120 M690,450 q5,62 8,122" stroke="#a8c8da" stroke-width="5" fill="none" opacity="0.4">
            <animate attributeName="opacity" values="0.4;0.25;0.4" dur="0.6s" repeatCount="indefinite"/>
          </path>
          <g fill="#bfdcee">
            <circle cx="606" cy="480" r="3">
              <animate attributeName="cy" values="470;645" dur="0.5s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.9;0.1" dur="0.5s" repeatCount="indefinite"/>
            </circle>
            <circle cx="668" cy="500" r="2.6">
              <animate attributeName="cy" values="470;650" dur="0.64s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.9;0.1" dur="0.64s" repeatCount="indefinite"/>
            </circle>
            <circle cx="632" cy="492" r="2.4">
              <animate attributeName="cy" values="470;642" dur="0.57s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.9;0.1" dur="0.57s" repeatCount="indefinite"/>
            </circle>
          </g>` : ""}
      </g>
      ${wetFloor && !tapMoist ? `
      <g id="v_puddle">
        <path d="M560,664 q80,-26 176,-8 q66,12 148,-4 q56,-10 104,2 q28,8 8,22 q-64,30 -178,28 q-130,-2 -220,-10 q-46,-4 -38,-30 Z" fill="#7fa8c9" opacity="0.26" filter="url(#fxblur2)"/>
        ${tapFloodFast ? `
          <g stroke="#cfe6f2" fill="none" opacity="0.55">
            <ellipse cx="700" cy="650" rx="30" ry="8">
              <animate attributeName="rx" values="20;120" dur="0.7s" repeatCount="indefinite"/>
              <animate attributeName="ry" values="6;26" dur="0.7s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.6;0" dur="0.7s" repeatCount="indefinite"/>
            </ellipse>
            <ellipse cx="760" cy="654" rx="20" ry="6">
              <animate attributeName="rx" values="16;90" dur="0.9s" repeatCount="indefinite"/>
              <animate attributeName="ry" values="5;20" dur="0.9s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.5;0" dur="0.9s" repeatCount="indefinite"/>
            </ellipse>
          </g>` : `
          <path d="M620,650 q30,-8 66,-6 q30,2 56,0" stroke="#d8ecf6" stroke-width="2.4" fill="none" opacity="0.4">
            <animateTransform attributeName="transform" type="translate" values="0,0;10,0;0,0" dur="9s" repeatCount="indefinite"/>
          </path>
          <path d="M740,656 q24,-6 50,-4" stroke="#d8ecf6" stroke-width="2" fill="none" opacity="0.3">
            <animateTransform attributeName="transform" type="translate" values="0,0;-8,0;0,0" dur="11s" repeatCount="indefinite"/>
          </path>`}
      </g>` : ""}
      ${tapMoist ? `
      <g id="v_moist">
        <path d="M560,664 q80,-26 176,-8 q66,12 148,-4 q56,-10 104,2 q28,8 8,22 q-64,30 -178,28 q-130,-2 -220,-10 q-46,-4 -38,-30 Z" fill="#8a9aa0" opacity="0.28" filter="url(#fxblur4)"/>
        <path d="M600,658 q60,-18 130,-8 q50,8 100,-2" stroke="#aab8bc" stroke-width="1.6" fill="none" opacity="0.4"/>
        ${[...Array(10)].map((_, i) => `<circle cx="${600 + i * 26}" cy="${656 + (i % 3) * 8}" r="1.4" fill="#9fb0b4" opacity="0.5"/>`).join("")}
      </g>` : ""}
      <!-- bread board + 1 loaf -->
      <g id="v_bread">
        <ellipse cx="330" cy="432" rx="70" ry="12" fill="#5d4a35"/>
        ${(() => {
          const n = C.bread, hw = n === 1 ? 35 : (n === 2 ? 27 : 21);
          return [...Array(n)].map((_, i) => {
            const cx = 330 + (i - (n - 1) / 2) * (hw * 2 + 6);
            return `<path d="M${cx - hw},422 q${hw},${-hw * 0.85} ${hw * 2},0 q-6,10 -${hw},10 q-${hw - 6},0 -${hw},-10" fill="#b98d54"/><path d="M${cx - hw * 0.5},${414 - hw * 0.1} q5,-5 9,-1 M${cx + hw * 0.2},${412 - hw * 0.1} q5,-5 9,-1" stroke="#8a6238" stroke-width="2.4" fill="none"/>`;
          }).join("");
        })()}
      </g>
      <!-- drawer with batteries (opens) -->
      <g id="v_drawer">
        <rect x="420" y="466" width="150" height="40" rx="3" fill="#3a2c1e" stroke="#241a11" stroke-width="3"/>
        <rect x="482" y="482" width="28" height="7" rx="3" fill="#8a7148"/>
        ${drawerOpen ? `
          <rect x="412" y="508" width="166" height="46" rx="3" fill="#241a11" stroke="#33261a" stroke-width="3"/>
          ${(() => {
            const n = C.batteries, bw = n >= 4 ? 28 : 34;
            return [...Array(n)].map((_, i) => {
              const x = 424 + i * (bw + 4), rot = i % 2 === 1 ? ` transform="rotate(7 ${x + bw / 2} 529)"` : "";
              return `<rect x="${x}" y="${522 + (i % 2) * 2}" width="${bw}" height="15" rx="3" fill="#b8b0a0"${rot}/><rect x="${x + bw - 2}" y="${525 + (i % 2) * 2}" width="5" height="9" fill="#8a8378"${rot}/>`;
            }).join("");
          })()}
        ` : ""}
      </g>
      <!-- lockbox -->
      <g id="v_lockbox">
        <rect x="780" y="384" width="118" height="52" rx="5" fill="url(#metalg)" stroke="#22262a" stroke-width="3"/>
        ${boxOpen
          ? `<rect x="780" y="352" width="118" height="34" rx="5" fill="#3a3e42" transform="rotate(-24 780 386)"/><rect x="792" y="396" width="94" height="30" fill="#15181b"/>${State.hasItem("studyKey") ? "" : `<g id="v_skey"><circle cx="826" cy="412" r="8" fill="none" stroke="#c9a35f" stroke-width="4"/><rect x="832" y="409" width="26" height="5" fill="#c9a35f"/><rect x="850" y="413" width="4" height="6" fill="#c9a35f"/><rect x="843" y="413" width="4" height="5" fill="#c9a35f"/></g>`}`
          : `<rect x="826" y="400" width="26" height="18" rx="2" fill="#15181b"/><circle cx="839" cy="407" r="3.4" fill="#c9a35f"/>`}
      </g>
      <!-- chairs sit BEHIND the table: drawn first, table covers them -->
      <g id="v_chair1" transform="translate(110,0)${act2 ? ' translate(64,10) rotate(9 170 650)' : ''}">
        <ellipse cx="161" cy="701" rx="60" ry="7" fill="#0d0a08" opacity="0.45"/>
        <rect x="118" y="540" width="10" height="160" fill="#3a2c1e"/>
        <rect x="194" y="540" width="10" height="160" fill="#3a2c1e"/>
        <circle cx="123" cy="537" r="5" fill="#4a3826"/>
        <circle cx="199" cy="537" r="5" fill="#4a3826"/>
        <rect x="128" y="552" width="66" height="9" rx="3" fill="#4a3826"/>
        <rect x="128" y="574" width="66" height="8" rx="3" fill="#4a3826"/>
        <polygon points="116,586 206,586 214,606 108,606" fill="#4a3826"/>
        <polygon points="108,606 214,606 214,613 108,613" fill="#33261a"/>
        <rect x="108" y="613" width="10" height="87" fill="#33261a"/>
        <rect x="204" y="613" width="10" height="87" fill="#33261a"/>
        <rect x="118" y="662" width="86" height="6" fill="#2c2115"/>
      </g>
      <g id="v_chair2" transform="translate(502,0)">
        <ellipse cx="161" cy="701" rx="60" ry="7" fill="#0d0a08" opacity="0.45"/>
        <rect x="118" y="540" width="10" height="160" fill="#3a2c1e"/>
        <rect x="194" y="540" width="10" height="160" fill="#3a2c1e"/>
        <circle cx="123" cy="537" r="5" fill="#4a3826"/>
        <circle cx="199" cy="537" r="5" fill="#4a3826"/>
        <rect x="128" y="552" width="66" height="9" rx="3" fill="#4a3826"/>
        <rect x="128" y="574" width="66" height="8" rx="3" fill="#4a3826"/>
        <polygon points="116,586 206,586 214,606 108,606" fill="#4a3826"/>
        <polygon points="108,606 214,606 214,613 108,613" fill="#33261a"/>
        <rect x="108" y="613" width="10" height="87" fill="#33261a"/>
        <rect x="204" y="613" width="10" height="87" fill="#33261a"/>
        <rect x="118" y="662" width="86" height="6" fill="#2c2115"/>
      </g>
      ${falseK ? `
      <!-- a chair that was never there -->
      <g id="v_chair3" transform="translate(760,6)">
        <ellipse cx="161" cy="701" rx="60" ry="7" fill="#0d0a08" opacity="0.45"/>
        <rect x="118" y="540" width="10" height="160" fill="#332619"/>
        <rect x="194" y="540" width="10" height="160" fill="#332619"/>
        <circle cx="123" cy="537" r="5" fill="#413021"/>
        <circle cx="199" cy="537" r="5" fill="#413021"/>
        <rect x="128" y="552" width="66" height="9" rx="3" fill="#413021"/>
        <rect x="112" y="586" width="98" height="14" rx="3" fill="#413021"/>
        <rect x="118" y="600" width="10" height="100" fill="#332619"/>
        <rect x="194" y="600" width="10" height="100" fill="#332619"/>
      </g>` : ""}
      <!-- table: perspective top, apron, four legs, contact shadows -->
      <g id="v_table">
        <ellipse cx="472" cy="706" rx="190" ry="11" fill="#0d0a08" opacity="0.45"/>
        <polygon points="348,646 360,646 356,690 346,690" fill="#241a11"/>
        <polygon points="584,646 596,646 600,690 590,690" fill="#241a11"/>
        <polygon points="322,584 622,584 654,646 290,646" fill="#4a3826"/>
        <polygon points="322,584 622,584 654,646 290,646" fill="url(#woodg)" opacity="0.3"/>
        <path d="M338,598 L630,598 M330,614 L640,614 M318,632 L650,632" stroke="#33261a" stroke-width="1.6" opacity="0.5"/>
        <polygon points="290,646 654,646 654,660 290,660" fill="#33261a"/>
        <polygon points="302,660 318,660 314,704 298,704" fill="#33261a"/>
        <polygon points="626,660 642,660 646,704 630,704" fill="#33261a"/>
        <ellipse cx="306" cy="705" rx="12" ry="3" fill="#0d0a08" opacity="0.55"/>
        <ellipse cx="638" cy="705" rx="12" ry="3" fill="#0d0a08" opacity="0.55"/>
      </g>
      
      <!-- fruit bowl: 4 apples, clearly separated (counting puzzle: must be unambiguous) -->
      <g id="v_bowl">
        <path d="M392,592 q86,38 172,0 q-16,36 -86,36 q-70,0 -86,-36" fill="#6b5544"/>
        ${(() => {
          const n = C.apples, r = n > 4 ? 11 : 14;
          return [...Array(n)].map((_, i) => {
            const x = n === 1 ? 478 : Math.round(414 + i * (128 / (n - 1)));
            const y = i % 2 === 0 ? 585 : 578;
            return `<circle cx="${x}" cy="${y}" r="${r}" fill="#a5503c"/><path d="M${x},${y - r + 1} q3,-7 7,-8" stroke="#46503a" stroke-width="3" fill="none"/>`;
          }).join("");
        })()}
      </g>
      <!-- teacup, still steaming -->
      <g id="v_cup">
        <path d="M558,588 L592,588 L587,610 L563,610 Z" fill="#d8c9a8"/>
        <path d="M592,592 q14,3 0,13" fill="none" stroke="#d8c9a8" stroke-width="4"/>
        <path d="M568,580 q4,-10 -2,-16 M580,580 q4,-10 -2,-16" stroke="#b8ab92" stroke-width="2.5" fill="none" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="3s" repeatCount="indefinite"/>
        </path>
      </g>
      <!-- the right edge exit is the side arrow; no door drawn -->
    </g>
    <g id="layer-front">${falseK ? `<rect width="1280" height="720" fill="#4a2a3a" opacity="0.08"/>` : ""}</g>
    <g id="hotspots">
      ${hs("list", 1018, 204, 92, 100, "A shopping list", "v_list")}
      ${fridgeOpen ? hs("milk", 1004, 340, 148, 100, "Bottles of milk", "v_milk") : ""}
      ${hs("fridge", fridgeOpen ? 912 : 984, fridgeOpen ? 294 : 174, fridgeOpen ? 254 : 182, fridgeOpen ? 282 : 372, "The refrigerator", "v_fridge")}
      ${hs("stove", 64, 378, 180, 200, "The stove", "v_stove")}
      ${hs("godining", 0, 156, 66, 406, "Through to the dining room", "")}
      ${hs("tap", 552, 392, 176, 64, "The tap", "v_tap")}
      ${hs("bread", 276, 392, 120, 56, "The bread board", "v_bread")}
      ${hs("bowl", 392, 556, 158, 64, "A bowl of apples", "v_bowl")}
      ${hs("drawer", 408, 458, 174, drawerHitH, "A kitchen drawer", "v_drawer")}
      ${hs("lockbox", 766, 344, 146, 100, "A small steel lockbox", "v_lockbox")}
      ${hs("kclock", 122, 132, 118, 118, "The kitchen clock", "v_kclock")}
      ${hs("cup", 546, 556, 62, 62, "A teacup", "v_cup")}
      ${hs("kwin", 508, 108, 264, 204, "The window", "v_kwin")}
      ${hs("chair1", chairHitX, 528, 116, 178, "A chair", "v_chair1")}
      ${wetFloor ? hs("puddle", 600, 624, 300, 60, "Water on the floor", "v_puddle") : ""}
      ${hs("goback", 1204, 160, 76, 400, "Back to the hallway", "")}
    </g>
    </svg>`;
  }

  /* =====================================================================
     UPSTAIRS LANDING: window shows the wrong time of day, closet hides
     the torch, attic hatch waits in the ceiling
  ===================================================================== */
  function svgLanding() {
    const act2 = State.flag("act2");
    const hasTorch = State.hasItem("torch");
    const closetOpen = State.flag("closetOpen");
    const childGone = State.flag("roomDeleted_child");
    const studyOpen = State.flag("studyUnlocked");
    return `<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    <defs>
      <linearGradient id="dayg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#b8cede"/><stop offset="0.7" stop-color="#d8cfae"/><stop offset="1" stop-color="#e0c98f"/>
      </linearGradient>
    </defs>
    <g id="layer-back">
      <rect width="1280" height="490" fill="url(#wallg)"/>
      ${[...Array(32)].map((_, i) => `<line x1="${i * 40}" y1="98" x2="${i * 40}" y2="480" stroke="#352c23" stroke-width="12" opacity="0.3"/>`).join("")}
      <rect x="0" y="90" width="1280" height="8" fill="#241d16"/>
      <rect x="0" y="480" width="1280" height="12" fill="#1c1610"/>
      <rect x="0" y="492" width="1280" height="228" fill="url(#floorg)"/>
      ${[...Array(9)].map((_, i) => `<line x1="${i * 160}" y1="492" x2="${i * 160 + 50}" y2="720" stroke="#100c09" stroke-width="2" opacity="0.5"/>`).join("")}
      <!-- runner rug -->
      <polygon points="380,540 900,540 960,700 320,700" fill="#4a2f24" opacity="0.85"/>
      <polygon points="410,556 870,556 916,684 364,684" fill="none" stroke="#5d4a35" stroke-width="3" opacity="0.7"/>
      <!-- the wrong window: full daylight while the rest of the house is night -->
      <g id="v_lwin">
        <rect x="540" y="130" width="220" height="180" fill="url(#dayg)" stroke="#2c241c" stroke-width="10"/>
        <line x1="650" y1="130" x2="650" y2="310" stroke="#2c241c" stroke-width="7"/>
        <line x1="540" y1="216" x2="760" y2="216" stroke="#2c241c" stroke-width="7"/>
        <circle cx="600" cy="172" r="20" fill="#f2e3b8" opacity="0.95"/>
        <path d="M548,300 q46,-20 90,0 q40,-16 76,0 q26,-10 40,0 Z" fill="#8a915f" opacity="0.75"/>
      </g>
    </g>
    <g id="layer-mid">
      <!-- child room door, ajar, crayon marks low on the wood; the house can take this room away -->
      ${childGone ? `
      <g id="v_cdoor">
        <rect x="112" y="142" width="166" height="356" fill="url(#wallg)"/>
        ${[...Array(5)].map((_, i) => `<line x1="${128 + i * 32}" y1="142" x2="${128 + i * 32}" y2="498" stroke="#352c23" stroke-width="12" opacity="0.35"/>`).join("")}
        <rect x="120" y="150" width="150" height="340" fill="none" stroke="#2c241c" stroke-width="2" opacity="0.35" stroke-dasharray="6 10"/>
        <path d="M150,430 q14,-10 24,2" stroke="#a5503c" stroke-width="2" fill="none" opacity="0.2"/>
        <text x="195" y="640" data-roomlabel="1" text-anchor="middle" font-family="Georgia" font-size="15" fill="#5d5347" font-style="italic">there was a room here</text>
      </g>` : `
      <g id="v_cdoor">
        <rect x="120" y="150" width="150" height="340" fill="#3a2c1e" stroke="#1c1510" stroke-width="6"/>
        <rect x="132" y="162" width="126" height="316" fill="#2c211a"/>
        <rect x="234" y="162" width="24" height="316" fill="#0f0c09"/>
        <circle cx="146" cy="330" r="6" fill="#8a7148"/>
        <path d="M150,430 q14,-10 24,2 M180,438 q10,-14 22,-2 M154,452 q20,-8 34,4" stroke="#a5503c" stroke-width="3" fill="none" opacity="0.7"/>
        <text x="195" y="640" data-roomlabel="1" text-anchor="middle" font-family="Georgia" font-size="15" fill="#6b5d4a" font-style="italic">a small room</text>
      </g>`}
      <!-- THE STUDY: a destination, not a menu button -->
      <g id="v_sdoor">
        <ellipse cx="843" cy="496" rx="80" ry="8" fill="#0d0a08" opacity="0.4"/>
        <rect x="770" y="146" width="146" height="348" fill="#241c13"/>
        <rect x="778" y="154" width="130" height="340" fill="#3a2c1e" stroke="#1c1510" stroke-width="5"/>
        <rect x="792" y="176" width="102" height="112" fill="#2c211a" stroke="#1c1510" stroke-width="3"/>
        <rect x="792" y="304" width="102" height="150" fill="#2c211a" stroke="#1c1510" stroke-width="3"/>
        <circle cx="794" cy="342" r="7" fill="#8a7148"/>
        ${studyOpen ? "" : `<rect x="784" y="356" width="18" height="22" rx="2" fill="#171310" stroke="#4a3826" stroke-width="2"/><circle cx="793" cy="364" r="3" fill="#0d0a08"/>`}
        <text x="843" y="640" data-roomlabel="1" text-anchor="middle" font-family="Georgia" font-size="15" fill="#6b5d4a" font-style="italic">the study</text>
      </g>
      <!-- linen closet -->
      <g id="v_closet">
        <rect x="950" y="180" width="120" height="310" fill="#3a2c1e" stroke="#1c1510" stroke-width="6"/>
        ${closetOpen ? `
          <rect x="958" y="188" width="104" height="294" fill="#171310"/>
          <rect x="964" y="240" width="92" height="10" fill="#33261a"/>
          <rect x="964" y="330" width="92" height="10" fill="#33261a"/>
          <rect x="970" y="200" width="80" height="38" rx="4" fill="#8f8778" opacity="0.85"/>
          <rect x="970" y="252" width="80" height="34" rx="4" fill="#7a7264" opacity="0.8"/>
          ${hasTorch ? "" : `<g id="v_torch"><rect x="986" y="346" width="52" height="14" rx="7" fill="#565b60"/><circle cx="1040" cy="353" r="9" fill="#3a3e42"/><circle cx="1042" cy="353" r="4" fill="#c9a35f" opacity="0.7"/></g>`}
          <rect x="946" y="176" width="12" height="318" fill="#2c211a" transform="rotate(-18 950 490)"/>
        ` : `
          <line x1="1010" y1="180" x2="1010" y2="490" stroke="#1c1510" stroke-width="4"/>
          <circle cx="998" cy="340" r="5" fill="#8a7148"/><circle cx="1022" cy="340" r="5" fill="#8a7148"/>
        `}
        <text x="1010" y="640" data-roomlabel="1" text-anchor="middle" font-family="Georgia" font-size="14" fill="#6b5d4a" font-style="italic">closet</text>
      </g>
      <!-- attic hatch in the ceiling with a pull cord -->
      <g id="v_ahatch">
        <rect x="360" y="8" width="190" height="70" fill="#33261a" stroke="#191309" stroke-width="5"/>
        <path d="M378,20 L532,20 M378,40 L532,40 M378,60 L532,60" stroke="#241a11" stroke-width="3"/>
        <line x1="455" y1="78" x2="455" y2="150" stroke="#8a7148" stroke-width="2.5"/>
        <circle cx="455" cy="156" r="6" fill="#8a7148"/>
      </g>
      <!-- three frames: the middle one is empty -->
      <g id="v_frames" transform="translate(-470,0)">
        <rect x="800" y="180" width="64" height="80" fill="#221a12" stroke="#4a3826" stroke-width="5"/>
        <rect x="808" y="188" width="48" height="64" fill="#c9bb9b"/>${person(832, 246, 34, "#5a4a3a")}
        <rect x="800" y="286" width="64" height="80" fill="#221a12" stroke="#4a3826" stroke-width="5"/>
        <rect x="808" y="294" width="48" height="64" fill="${act2 ? "#171310" : "#c9bb9b"}"/>
        ${act2 ? "" : person(832, 352, 32, "#6b5544")}
        <rect x="800" y="392" width="64" height="80" fill="#221a12" stroke="#4a3826" stroke-width="5"/>
        <rect x="808" y="400" width="48" height="64" fill="#c9bb9b"/>${person(832, 458, 30, "#4a5568")}
      </g>
      <!-- a small scratch in the skirting board -->
      <g id="v_scratch" transform="translate(-88,0)">
        <path d="M690,486 l6,-14 M700,486 l0,-14 M704,472 l8,0 M708,472 l0,14" stroke="#8f8778" stroke-width="2" fill="none" opacity="0.55"/>
      </g>
      <!-- the stairs down are behind the player: the right arrow carries the exit -->
    </g>
    <g id="layer-front">
      <rect width="1280" height="720" fill="#0b0806" opacity="${act2 ? "0.16" : "0.07"}"/>
    </g>
    <g id="hotspots">
      ${childGone ? hs("chwall", 108, 140, 175, 360, "A wall that remembers being a door", "v_cdoor") : hs("gochild", 108, 140, 175, 360, "A small door with crayon marks", "v_cdoor")}
      ${State.flag("closetOpen") && !hasTorch ? hs("torch", 975, 335, 84, 36, "Something metal", "v_torch") : ""}
      ${hs("closet", 938, 168, 144, 335, "The linen closet", "v_closet")}
      ${hs("ahatch", 348, 0, 214, 170, "A hatch in the ceiling", "v_ahatch")}
      ${hs("lwin", 528, 118, 244, 204, "The window", "v_lwin")}
      ${hs("gostudy", 758, 140, 170, 366, studyOpen ? "The study" : "A locked door", "v_sdoor")}
      ${hs("frames", 318, 172, 88, 312, "Three small frames", "v_frames")}
      ${hs("scratch", 588, 458, 48, 40, "A scratch in the skirting", "v_scratch")}
      ${hs("godown", 1168, 140, 112, 440, "Back downstairs", "")}
    </g>
    </svg>`;
  }

  /* =====================================================================
     CHILD ROOM: too neat, too preserved. Nobody ever lived here.
  ===================================================================== */
  function svgChildroom() {
    const act2 = State.flag("act2");
    return `<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    <g id="layer-back">
      <rect width="1280" height="500" fill="#3b3348"/>
      ${[...Array(16)].map((_, i) => `<circle cx="${60 + i * 80}" cy="${140 + (i % 3) * 120}" r="10" fill="#4a415c" opacity="0.5"/>`).join("")}
      <rect x="0" y="500" width="1280" height="220" fill="url(#floorg)"/>
      <ellipse cx="500" cy="620" rx="260" ry="46" fill="#5d5a7a" opacity="0.35"/>
      <!-- rain window: live rain is drawn by the FX layer, plus one honest crack -->
      <g id="v_cwin">
        <rect x="900" y="120" width="220" height="190" fill="url(#nightg)" stroke="#2c241c" stroke-width="10"/>
        <line x1="1010" y1="120" x2="1010" y2="310" stroke="#2c241c" stroke-width="7"/>
        <line x1="900" y1="215" x2="1120" y2="215" stroke="#2c241c" stroke-width="7"/>
        <!-- a little crack, low in the left pane -->
        <g stroke="#bfe0f2" stroke-width="1.4" fill="none" opacity="0.55">
          <path d="M934,290 L956,272 L968,282 L986,258"/>
          <path d="M956,272 L948,254 L958,242"/>
          <path d="M968,282 L984,292"/>
        </g>
        <circle cx="934" cy="290" r="2" fill="#bfe0f2" opacity="0.6"/>
      </g>
    </g>
    <g id="layer-mid">
      <!-- bed, blanket folded with impossible neatness -->
      <g id="v_bed">
        <ellipse cx="330" cy="700" rx="230" ry="12" fill="#0d0a08" opacity="0.45"/>
        <rect x="130" y="380" width="60" height="290" rx="6" fill="#3a2c1e"/>
        <rect x="480" y="430" width="50" height="240" rx="6" fill="#3a2c1e"/>
        <rect x="150" y="500" width="360" height="120" rx="10" fill="#6a6284"/>
        <rect x="150" y="500" width="360" height="34" rx="10" fill="#8f8aa8"/>
        <rect x="170" y="452" width="120" height="54" rx="14" fill="#d8d3c4"/>
        <path d="M150,560 L510,560" stroke="#4a4462" stroke-width="3" opacity="0.7"/>
      </g>
      <!-- toy blocks: they spell 17 -->
      <g id="v_blocks">
        <rect x="600" y="600" width="34" height="34" rx="4" fill="#a5503c"/><text x="617" y="625" text-anchor="middle" font-family="Georgia" font-size="22" fill="#e8dcc0">1</text>
        <rect x="642" y="600" width="34" height="34" rx="4" fill="#5d7a5a"/><text x="659" y="625" text-anchor="middle" font-family="Georgia" font-size="22" fill="#e8dcc0">7</text>
        <rect x="622" y="562" width="34" height="34" rx="4" fill="#8a7148" transform="rotate(12 639 579)"/>
        <ellipse cx="640" cy="640" rx="60" ry="7" fill="#0d0a08" opacity="0.4"/>
      </g>
      <!-- drawings taped to the wall -->
      <g id="v_cdrawings">
        ${[[560, 170, -4], [660, 200, 3], [760, 160, -2]].map(p => `
          <rect x="${p[0]}" y="${p[1]}" width="78" height="96" fill="#d8c9a8" transform="rotate(${p[2]} ${p[0] + 39} ${p[1] + 48})"/>
          <rect x="${p[0] + 30}" y="${p[1] - 6}" width="18" height="12" fill="#b8ab92" opacity="0.8" transform="rotate(${p[2]} ${p[0] + 39} ${p[1] + 48})"/>`).join("")}
        <path d="M580,220 l20,-22 l20,22 Z M584,220 l32,0 l0,26 l-32,0 Z" fill="none" stroke="#8a4a3a" stroke-width="2.5" transform="rotate(-4 599 218)"/>
        ${[0, 1, 2, 3, act2 ? -1 : 4].filter(i => i >= 0).map(i => `<g transform="translate(${672 + i * 12},252)"><circle r="4" fill="none" stroke="#4a5568" stroke-width="2"/><line x1="0" y1="4" x2="0" y2="16" stroke="#4a5568" stroke-width="2"/></g>`).join("")}
        ${act2 ? `<g transform="translate(788,236)"><circle r="4" fill="none" stroke="#8a4a3a" stroke-width="2"/><line x1="0" y1="4" x2="0" y2="16" stroke="#8a4a3a" stroke-width="2"/></g>` : ""}
      </g>
      <!-- music box on the dresser -->
      <g id="v_musicbox">
        <rect x="880" y="430" width="230" height="180" fill="url(#woodg)" stroke="#221a12" stroke-width="4"/>
        <rect x="896" y="450" width="198" height="40" rx="3" fill="#33261a"/><rect x="896" y="500" width="198" height="40" rx="3" fill="#33261a"/>
        <rect x="940" y="392" width="80" height="40" rx="6" fill="#8a6a4a" stroke="#5d4a35" stroke-width="3"/>
        <circle cx="1032" cy="412" r="7" fill="none" stroke="#c9a35f" stroke-width="3"/>
        <rect x="1039" y="410" width="12" height="4" fill="#c9a35f"/>
        <ellipse cx="995" cy="618" rx="120" ry="9" fill="#0d0a08" opacity="0.45"/>
      </g>
      <!-- shelf of unread books -->
      <g id="v_cbooks">
        <rect x="70" y="180" width="200" height="14" fill="#33261a"/>
        ${[...Array(8)].map((_, i) => `<rect x="${82 + i * 22}" y="${132 + (i % 2) * 6}" width="16" height="${48 - (i % 2) * 6}" fill="${["#5d4a35", "#4a5568", "#6b5544", "#46503a"][i % 4]}"/>`).join("")}
      </g>
    </g>
    <g id="layer-front">
      <rect width="1280" height="720" fill="#0b0806" opacity="${act2 ? "0.18" : "0.08"}"/>
    </g>
    <g id="hotspots">
      ${hs("blocks", 588, 550, 104, 96, "Toy blocks", "v_blocks")}
      ${hs("cdrawings", 548, 148, 300, 164, "Drawings taped to the wall", "v_cdrawings")}
      ${hs("musicbox", 928, 380, 104, 60, "A small music box", "v_musicbox")}
      ${hs("cbooks", 58, 120, 224, 80, "A shelf of books", "v_cbooks")}
      ${hs("bed", 118, 370, 424, 260, "The bed", "v_bed")}
      ${hs("cwin", 888, 108, 244, 214, "The window", "v_cwin")}
      ${hs("cback", 1180, 340, 100, 380, "Back to the corridor", "")}
    </g>
    </svg>`;
  }

  /* =====================================================================
     ATTIC: dark. The torch carves out the only visible circle.
  ===================================================================== */
  function svgAttic() {
    const trunkOpen = State.flag("atticTruth");
    const torchOn = State.hasItem("torch") && State.flag("torchOn") === true;
    return `<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    <defs>
      <radialGradient id="torchfade" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#000000"/><stop offset="0.65" stop-color="#3a3a3a"/><stop offset="1" stop-color="#ffffff"/>
      </radialGradient>
      <mask id="torchmask">
        <rect width="1280" height="720" fill="#ffffff"/>
        <circle id="torch-hole" cx="640" cy="400" r="190" fill="url(#torchfade)"/>
      </mask>
    </defs>
    <g id="layer-back">
      <rect width="1280" height="720" fill="#181410"/>
      <!-- roof beams -->
      <polygon points="0,240 640,40 1280,240 1280,270 640,80 0,270" fill="#241a11"/>
      ${[...Array(5)].map((_, i) => `<rect x="${140 + i * 240}" y="${170 - Math.abs(2 - i) * -20}" width="18" height="${420 + Math.abs(2 - i) * 30}" fill="#2b1f14" transform="skewX(${(i - 2) * 2})"/>`).join("")}
      <rect x="0" y="600" width="1280" height="120" fill="#100c09"/>
      ${[...Array(7)].map((_, i) => `<line x1="${i * 200}" y1="620" x2="${i * 200 + 90}" y2="720" stroke="#000" stroke-width="2" opacity="0.5"/>`).join("")}
      <!-- tiny round window: a coin of moonlight -->
      <circle cx="640" cy="180" r="42" fill="url(#nightg)" stroke="#2c241c" stroke-width="8"/>
      <line x1="640" y1="140" x2="640" y2="220" stroke="#2c241c" stroke-width="5"/>
      <line x1="600" y1="180" x2="680" y2="180" stroke="#2c241c" stroke-width="5"/>
    </g>
    <g id="layer-mid">
      <!-- stacked boxes -->
      <g id="v_boxes">
        <rect x="150" y="470" width="150" height="130" fill="#3f2f20" stroke="#241a11" stroke-width="4"/>
        <rect x="180" y="380" width="110" height="90" fill="#4a3826" stroke="#241a11" stroke-width="4"/>
        <rect x="330" y="500" width="120" height="100" fill="#3a2c1e" stroke="#241a11" stroke-width="4"/>
        <text x="238" y="545" text-anchor="middle" font-family="Georgia" font-size="16" fill="#6b5d4a">NOV</text>
      </g>
      <!-- THE FIFTH CHAIR: identical to the kitchen chairs -->
      <g id="v_fifthchair">
        <ellipse cx="880" cy="612" rx="58" ry="7" fill="#000" opacity="0.5"/>
        <rect x="838" y="380" width="10" height="230" fill="#3a2c1e"/>
        <rect x="912" y="380" width="10" height="230" fill="#3a2c1e"/>
        <rect x="848" y="396" width="64" height="10" rx="3" fill="#4a3826"/>
        <rect x="848" y="420" width="64" height="8" rx="3" fill="#4a3826"/>
        <rect x="848" y="442" width="64" height="8" rx="3" fill="#4a3826"/>
        <polygon points="836,504 926,504 934,524 828,524" fill="#4a3826"/>
        <polygon points="828,524 934,524 934,531 828,531" fill="#33261a"/>
        <rect x="828" y="531" width="10" height="80" fill="#33261a"/>
        <rect x="924" y="531" width="10" height="80" fill="#33261a"/>
        <rect x="864" y="360" width="14" height="18" fill="#d8c9a8" opacity="0.5" transform="rotate(6 871 369)"/>
      </g>
      <!-- the trunk -->
      <g id="v_trunk">
        <ellipse cx="590" cy="622" rx="130" ry="10" fill="#000" opacity="0.5"/>
        <rect x="480" y="500" width="220" height="118" rx="8" fill="#4a3222" stroke="#241a11" stroke-width="5"/>
        ${trunkOpen
          ? `<rect x="480" y="440" width="220" height="66" rx="8" fill="#3a2818" transform="rotate(-28 480 506)"/><rect x="492" y="512" width="196" height="20" fill="#15100b"/><rect x="540" y="520" width="120" height="86" fill="#d8c9a8" transform="rotate(-3 600 563)"/>`
          : `<rect x="480" y="482" width="220" height="26" rx="8" fill="#3a2818" stroke="#241a11" stroke-width="5"/><rect x="576" y="494" width="28" height="24" rx="3" fill="#8a7148"/><circle cx="590" cy="506" r="4" fill="#191309"/>`}
        <path d="M500,500 L500,618 M680,500 L680,618" stroke="#241a11" stroke-width="6"/>
      </g>
      <!-- tally marks scratched on a beam -->
      <g id="v_tally">
        <path d="${[...Array(17)].map((_, i) => `M${360 + i * 9 + (i % 5 === 4 ? -38 : 0)},${300 + (i % 5 === 4 ? -4 : 0)} l${i % 5 === 4 ? 40 : 0},${i % 5 === 4 ? 16 : 22}`).join(" ")}" stroke="#8f8778" stroke-width="2.4" fill="none" opacity="0.6"/>
      </g>
    </g>
    <g id="layer-front">
      ${torchOn ? `
      <!-- torch on: the dark with the beam cut out of it -->
      <rect width="1280" height="720" fill="#040302" opacity="0.965" mask="url(#torchmask)"/>
      <rect width="1280" height="720" fill="#040302" opacity="0"><animate attributeName="opacity" values="0;0;0.12;0" dur="6s" repeatCount="indefinite"/></rect>` : `
      <!-- torch off: total dark, save one coin of moonlight at the window -->
      <rect width="1280" height="720" fill="#040302" opacity="0.99"/>
      <circle cx="640" cy="180" r="46" fill="#a8c8da" opacity="0.07" filter="url(#fxblur8)"/>`}
    </g>
    <g id="hotspots">
      ${hs("trunk", 466, 430, 250, 200, "An old trunk", "v_trunk")}
      ${hs("fifthchair", 816, 350, 130, 270, "A chair, up here alone", "v_fifthchair")}
      ${hs("tally", 344, 280, 190, 60, "Marks on the beam", "v_tally")}
      ${hs("boxes", 138, 368, 320, 240, "Stacked boxes", "v_boxes")}
      ${hs("awin", 586, 128, 110, 110, "A round window", "v_boxes")}
      ${hs("aback", 1150, 400, 130, 320, "Climb back down", "")}
    </g>
    </svg>`;
  }

  /* =====================================================================
     STUDY
  ===================================================================== */
  function svgStudy() {
    const lampOn = State.flag("studyLampOn") !== false; // default on
    const nbOpen = State.flag("notebookOpen");
    return `<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    <g id="layer-back">
      <rect width="1280" height="500" fill="#38291f"/>
      ${[...Array(26)].map((_, i) => `<line x1="${i * 50}" y1="70" x2="${i * 50}" y2="500" stroke="#412f24" stroke-width="16" opacity="0.3"/>`).join("")}
      <rect x="0" y="500" width="1280" height="220" fill="url(#floorg)"/>
      ${[...Array(7)].map((_, i) => `<line x1="0" y1="${520 + i * 30}" x2="1280" y2="${520 + i * 30}" stroke="#100c09" stroke-width="2" opacity="0.4"/>`).join("")}
      <!-- window -->
      <g id="v_swin">
        <rect x="960" y="110" width="220" height="260" fill="url(#nightg)" stroke="#2c241c" stroke-width="10"/>
        <line x1="1070" y1="110" x2="1070" y2="370" stroke="#2c241c" stroke-width="7"/>
        <line x1="960" y1="240" x2="1180" y2="240" stroke="#2c241c" stroke-width="7"/>
        <circle cx="1140" cy="150" r="12" fill="#d8dce0" opacity="0.7"/>
        <path d="M965,360 q30,-30 60,0 q30,-24 60,0 q40,-30 90,0 Z" fill="#232d3a" opacity="0.85"/>
      </g>
    </g>
    <g id="layer-mid">
      <!-- bookshelf -->
      <g id="v_shelf">
        <rect x="60" y="110" width="250" height="400" fill="url(#woodg)" stroke="#221a12" stroke-width="5"/>
        ${[0, 1, 2, 3].map(r => `<rect x="72" y="${128 + r * 96}" width="226" height="10" fill="#241a11"/>`).join("")}
        ${[0, 1, 2, 3].map(r => [...Array(9)].map((_, i) => {
          const cols = ["#6b3f33", "#4a5568", "#5d6b4a", "#8a6238", "#46503a", "#7a5a50"];
          const h = 58 + ((i * 13 + r * 7) % 22);
          const yb = 138 + r * 96 + 76 - h;
          const tilt = ((i + r * 3) % 7 === 0) ? `transform="rotate(-7 ${90 + i * 24} ${138 + r * 96 + 70})"` : "";
          return `<rect x="${80 + i * 24}" y="${yb}" width="20" height="${h}" fill="${cols[(i + r) % 6]}" ${tilt}/>`;
        }).join("")).join("")}
      </g>
      <!-- three photographs above desk -->
      <g id="v_photoA">
        <rect x="430" y="140" width="110" height="86" fill="#1e1710" stroke="#4a3826" stroke-width="6"/>
        <rect x="440" y="149" width="90" height="68" fill="#c9bb9b"/>
        ${person(470, 210, 40, "#5a4a3a")}
        <rect x="500" y="164" width="22" height="34" fill="#6b3f33"/>
        ${clockFace(514, 158, 8, 248, 102)}
      </g>
      <g id="v_photoB">
        <rect x="570" y="132" width="110" height="86" fill="#1e1710" stroke="#4a3826" stroke-width="6"/>
        <rect x="580" y="141" width="90" height="68" fill="#c9bb9b"/>
        ${person(636, 202, 38, "#6b5544")}
        <rect x="590" y="150" width="26" height="30" fill="#39434c"/>
        ${clockFace(600, 192, 8, 251, 138)}
      </g>
      <g id="v_photoC">
        <rect x="710" y="142" width="110" height="86" fill="#1e1710" stroke="#4a3826" stroke-width="6"/>
        <rect x="720" y="151" width="90" height="68" fill="#c9bb9b"/>
        ${person(750, 212, 32, "#4a5568")}${person(772, 212, 28, "#7a5a50")}
        ${clockFace(800, 164, 8, 255, 186)}
      </g>
      <!-- desk -->
      <g id="v_desk">
        <rect x="380" y="400" width="480" height="24" fill="#4a3826"/>
        <rect x="396" y="424" width="120" height="150" fill="url(#woodg)"/>
        <rect x="724" y="424" width="120" height="150" fill="url(#woodg)"/>
        <rect x="404" y="438" width="104" height="30" rx="3" fill="#33261a" stroke="#241a11" stroke-width="2"/>
        <rect x="404" y="476" width="104" height="30" rx="3" fill="#33261a" stroke="#241a11" stroke-width="2"/>
      </g>
      ${State.flag("act2") && !State.flag("hasBag") ? `
      <!-- a child's school satchel, pushed into the desk's knee space -->
      <g id="v_satchel">
        <ellipse cx="618" cy="572" rx="62" ry="8" fill="#0d0a08" opacity="0.4"/>
        <rect x="562" y="498" width="112" height="72" rx="10" fill="#5d4a35" stroke="#33261a" stroke-width="4"/>
        <path d="M562,516 q56,26 112,0 l0,-8 q-56,24 -112,0 Z" fill="#4a3826"/>
        <rect x="586" y="524" width="14" height="20" rx="3" fill="#8a7148"/>
        <rect x="636" y="524" width="14" height="20" rx="3" fill="#8a7148"/>
        <path d="M566,502 q52,-20 104,0" stroke="#33261a" stroke-width="5" fill="none"/>
        <rect x="600" y="556" width="36" height="6" rx="3" fill="#c9bb9b" opacity="0.6"/>
      </g>` : ""}
      <!-- red notebook on desk -->
      <g id="v_notebook" ${nbOpen ? 'opacity="0.55"' : ""}>
        <rect x="560" y="368" width="96" height="30" rx="3" fill="#8a3a2c" transform="rotate(-5 608 383)"/>
        <rect x="560" y="368" width="14" height="30" fill="#6b2c22" transform="rotate(-5 608 383)"/>
        ${nbOpen ? "" : `<rect x="640" y="374" width="12" height="16" rx="2" fill="#c9a35f" transform="rotate(-5 646 382)"/>`}
      </g>
      <!-- typewriter -->
      <g id="v_type">
        <rect x="700" y="358" width="120" height="44" rx="7" fill="#2e3134"/>
        <rect x="712" y="346" width="96" height="18" rx="4" fill="#3c4043"/>
        <rect x="726" y="332" width="68" height="20" fill="#d8c9a8"/>
        ${[...Array(9)].map((_, i) => `<circle cx="${714 + i * 12}" cy="${390}" r="4" fill="#4a4d50"/>`).join("")}
      </g>
      <!-- desk lamp: fixture only; the beam and pool come from the FX light layer -->
      <g id="v_slamp">
        <rect x="452" y="380" width="8" height="22" fill="#2c241c"/>
        <path d="M436,364 L478,364 L468,384 L446,384 Z" fill="${lampOn ? "#c9a35f" : "#4a3d2c"}"/>
      </g>
      <!-- side table with tape recorder -->
      <g id="v_tape">
        <rect x="900" y="440" width="150" height="14" fill="#3f2f20"/><rect x="912" y="454" width="10" height="90" fill="#33261a"/><rect x="1030" y="454" width="10" height="90" fill="#33261a"/>
        <rect x="916" y="396" width="118" height="46" rx="5" fill="#3c4043" stroke="#22262a" stroke-width="3"/>
        <circle cx="948" cy="414" r="13" fill="#22262a" stroke="#8a8378" stroke-width="3"/>
        <circle cx="1000" cy="414" r="13" fill="#22262a" stroke="#8a8378" stroke-width="3"/>
        <rect x="962" y="428" width="24" height="8" rx="2" fill="#a5503c"/>
      </g>
      <!-- small framed photo on desk (secret) -->
      <g id="v_oldphoto">
        <rect x="806" y="372" width="34" height="28" fill="#221a12" stroke="#4a3826" stroke-width="3" transform="rotate(7 823 386)"/>
        <rect x="811" y="376" width="24" height="19" fill="#c9bb9b" transform="rotate(7 823 386)"/>
      </g>
      <!-- a surveyor's lens, forgotten at the edge of the desk -->
      ${State.hasItem("lens") ? "" : `<g id="v_lens">
        <ellipse cx="852" cy="404" rx="13" ry="4" fill="#0d0a08" opacity="0.35"/>
        <ellipse cx="852" cy="398" rx="11" ry="11" fill="none" stroke="#8a7148" stroke-width="3"/>
        <ellipse cx="852" cy="398" rx="7.5" ry="7.5" fill="#6a86a8" opacity="0.55"/>
        <path d="M843,392 q9,-6 18,0" stroke="#c9d8e6" stroke-width="2.5" fill="none" opacity="0.5"/>
        <rect x="849" y="407" width="6" height="8" fill="#8a7148"/>
      </g>`}
      <!-- rug; the hallway exit lives in the side arrow -->
      <ellipse cx="620" cy="640" rx="230" ry="40" fill="#3f3428" opacity="0.9"/>
    </g>
    <g id="layer-front">
      ${lampOn ? "" : `<rect width="1280" height="720" fill="#0b0d12" opacity="0.42"/>`}
    </g>
    <g id="hotspots">
      ${hs("notebook", 548, 348, 122, 62, "The red notebook", "v_notebook")}
      ${hs("photoA", 418, 128, 134, 110, "Photograph: the fireplace", "v_photoA")}
      ${hs("photoB", 558, 120, 134, 110, "Photograph: the window seat", "v_photoB")}
      ${hs("photoC", 698, 130, 134, 110, "Photograph: the staircase", "v_photoC")}
      ${hs("tape", 902, 384, 146, 72, "A reel tape recorder", "v_tape")}
      ${hs("shelf", 52, 100, 266, 416, "The bookshelf", "v_shelf")}
      ${hs("slamp", 428, 350, 62, 56, "The desk lamp", "v_slamp")}
      ${hs("type", 690, 322, 140, 88, "A typewriter", "v_type")}
      ${hs("oldphoto", 796, 360, 56, 48, "A small framed photo", "v_oldphoto")}
      ${State.hasItem("lens") ? "" : hs("lens", 830, 382, 44, 34, "A small brass lens", "v_lens")}
      ${hs("swin", 948, 98, 244, 286, "The window", "v_swin")}
      ${hs("drawer1", 396, 430, 120, 84, "Desk drawers", "v_desk")}
      ${State.flag("act2") && !State.flag("hasBag") ? hs("satchel", 552, 488, 132, 94, "A small satchel under the desk", "v_satchel") : ""}
      ${hs("sback", 0, 160, 60, 400, "Back to the hallway", "")}
    </g>
    </svg>`;
  }

  /* =====================================================================
     BASEMENT
  ===================================================================== */
  function svgBasement() {
    const power = State.flag("basementPower");
    const kpOk = State.flag("keypadSolved");
    return `<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    <defs><linearGradient id="doorlight" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#c8d2da" stop-opacity="0.10"/>
      <stop offset="0.45" stop-color="#c8d2da" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.22"/>
    </linearGradient></defs>
    <g id="layer-back">
      <rect width="1280" height="720" fill="#141210"/>
      <rect width="1280" height="500" fill="#232019"/>
      ${[...Array(16)].map((_, i) => [...Array(7)].map((_, j) => `<rect x="${i * 82 + (j % 2) * 40}" y="${70 + j * 62}" width="78" height="58" fill="none" stroke="#191612" stroke-width="3"/>`).join("")).join("")}
      <rect x="0" y="500" width="1280" height="220" fill="#151210"/>
      <!-- pipes -->
      <rect x="0" y="46" width="1280" height="16" fill="#3c4043"/>
      <rect x="0" y="70" width="1280" height="8" fill="#33363a"/>
      <circle cx="300" cy="54" r="14" fill="#4a4d50"/><circle cx="880" cy="54" r="14" fill="#4a4d50"/>
      <line x1="640" y1="62" x2="640" y2="120" stroke="#1c1610" stroke-width="4"/>
      <ellipse cx="640" cy="126" rx="12" ry="7" fill="${power ? "#f0c884" : "#3a3428"}">${power ? '<animate attributeName="opacity" values="1;0.7;1;0.9;1" dur="4s" repeatCount="indefinite"/>' : ""}</ellipse>
    </g>
    <g id="layer-mid" ${power ? "" : 'opacity="0.35"'}>
      <!-- boiler -->
      <g id="v_boiler">
        <rect x="70" y="220" width="150" height="300" rx="16" fill="url(#metalg)" stroke="#1c1e20" stroke-width="4"/>
        <circle cx="145" cy="300" r="30" fill="#22262a" stroke="#4a4d50" stroke-width="5"/>
        <line x1="145" y1="300" x2="160" y2="284" stroke="#a5503c" stroke-width="4"/>
        <rect x="100" y="520" width="12" height="40" fill="#33363a"/><rect x="180" y="520" width="12" height="40" fill="#33363a"/>
        <path d="M145,220 L145,120" stroke="#3c4043" stroke-width="12"/>
      </g>
      <!-- monitor desk -->
      <rect x="330" y="400" width="560" height="20" fill="#3f2f20"/>
      <rect x="350" y="420" width="18" height="160" fill="#2c211a"/><rect x="852" y="420" width="18" height="160" fill="#2c211a"/>
      <!-- 4 CRT monitors -->
      ${[
        { x: 350, cam: "01", t: "6:52", room: "PORCH" },
        { x: 486, cam: "02", t: "7:46", room: "KITCHEN" },
        { x: 622, cam: "03", t: "8:17", room: "HALLWAY" },
        { x: 758, cam: "04", t: "9:03", room: "STUDY" },
      ].map((m, i) => `
      <g id="v_mon${i}">
        <rect x="${m.x}" y="290" width="120" height="100" rx="8" fill="#3c4043" stroke="#22262a" stroke-width="4"/>
        <rect x="${m.x + 10}" y="300" width="100" height="72" rx="3" fill="${power ? "#1a2b22" : "#0d0f0e"}"/>
        ${power ? `
          <rect x="${m.x + 10}" y="300" width="100" height="72" fill="#7fa89a" opacity="0.07">
            <animate attributeName="opacity" values="0.07;0.12;0.07" dur="${2 + i * 0.7}s" repeatCount="indefinite"/></rect>
          ${[...Array(4)].map((_, l) => `<line x1="${m.x + 10}" y1="${306 + l * 18}" x2="${m.x + 110}" y2="${306 + l * 18}" stroke="#7fa89a" stroke-width="1" opacity="0.12"/>`).join("")}
          <text x="${m.x + 16}" y="${314}" font-family="monospace" font-size="10" fill="#9ec7a8">CAM ${m.cam}</text>
          <text x="${m.x + 104}" y="${366}" text-anchor="end" font-family="monospace" font-size="12" fill="#9ec7a8">${m.t}</text>
          ${i === 2 ? person(m.x + 60, 368, 34, "#233028") : ""}
        ` : ""}
        <rect x="${m.x + 46}" y="390" width="28" height="12" fill="#33363a"/>
      </g>`).join("")}
      <!-- fifth monitor, unplugged, on floor -->
      <g id="v_mon5">
        <rect x="920" y="540" width="110" height="92" rx="8" fill="#33363a" stroke="#202326" stroke-width="4" transform="rotate(-6 975 586)"/>
        <rect x="930" y="550" width="88" height="64" rx="3" fill="#0d0f0e" transform="rotate(-6 975 586)"/>
        <path d="M985,634 q40,18 66,4" stroke="#22262a" stroke-width="5" fill="none"/>
        <rect x="1048" y="630" width="16" height="10" fill="#22262a"/>
      </g>
      <!-- breaker box -->
      <g id="v_breaker">
        <rect x="248" y="160" width="64" height="96" rx="4" fill="#4a4d50" stroke="#26282b" stroke-width="4"/>
        <rect x="262" y="${power ? 178 : 208}" width="36" height="30" rx="4" fill="${power ? "#9ec7a8" : "#a5503c"}"/>
        <circle cx="280" cy="172" r="4" fill="${power ? "#9ec7a8" : "#5d3a34"}">${power ? "" : '<animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite"/>'}</circle>
      </g>
      <!-- metal door + keypad + knocker: framed, recessed, seated on the floor line -->
      <g id="v_mdoor">
        <!-- contact shadow + threshold so the door sits ON the floor, not in it -->
        <ellipse cx="1160" cy="506" rx="104" ry="9" fill="#000000" opacity="0.4"/>
        <rect x="1068" y="497" width="184" height="9" rx="2" fill="#26282b"/>
        <rect x="1068" y="497" width="184" height="3" fill="#4a4d50"/>
        <!-- steel frame: lit on top/left, shadowed on bottom/right -->
        <rect x="1072" y="150" width="176" height="350" fill="#33363a" stroke="#1c1e20" stroke-width="4"/>
        <polygon points="1072,150 1248,150 1240,158 1080,158" fill="#4d5257"/>
        <polygon points="1072,150 1080,158 1080,500 1072,500" fill="#45494e"/>
        <polygon points="1248,150 1248,500 1240,500 1240,158" fill="#17191b"/>
        <!-- dark reveal: the gap the leaf sits back into -->
        <rect x="1082" y="160" width="156" height="340" fill="#0d0e10"/>
        <!-- the leaf itself, set back into the reveal -->
        <rect x="1088" y="166" width="144" height="334" fill="url(#metalg)" stroke="#1c1e20" stroke-width="3"/>
        <!-- directional falloff: the one bulb hangs far to the left -->
        <rect x="1088" y="166" width="144" height="334" fill="url(#doorlight)"/>
        <line x1="1091" y1="168" x2="1091" y2="498" stroke="#5a6066" stroke-width="2" opacity="0.7"/>
        <line x1="1090" y1="169" x2="1230" y2="169" stroke="#5a6066" stroke-width="2" opacity="0.6"/>
        <line x1="1229" y1="170" x2="1229" y2="498" stroke="#101214" stroke-width="3" opacity="0.8"/>
        <line x1="1090" y1="497" x2="1230" y2="497" stroke="#101214" stroke-width="3" opacity="0.8"/>
        <!-- recessed center panel: dark top/left lip, light bottom/right lip -->
        <rect x="1106" y="202" width="108" height="238" fill="#2e3134"/>
        <rect x="1106" y="202" width="108" height="18" fill="#0d0e10" opacity="0.35"/>
        <rect x="1106" y="202" width="10" height="238" fill="#0d0e10" opacity="0.22"/>
        <polyline points="1106,440 1106,202 1214,202" fill="none" stroke="#17191b" stroke-width="3"/>
        <polyline points="1214,202 1214,440 1106,440" fill="none" stroke="#4d5257" stroke-width="2"/>
        <!-- bolts, each catching the bulb light from the upper left -->
        ${[...Array(4)].map((_, i) => `<circle cx="1098" cy="${186 + i * 100}" r="5" fill="#26282b"/><circle cx="1096.6" cy="${184.6 + i * 100}" r="1.8" fill="#565b60"/><circle cx="1222" cy="${186 + i * 100}" r="5" fill="#26282b"/><circle cx="1220.6" cy="${184.6 + i * 100}" r="1.8" fill="#565b60"/>`).join("")}
        <!-- handle bar with its own shadow and lit top edge -->
        <rect x="1132" y="333" width="60" height="14" rx="7" fill="#101214" opacity="0.6"/>
        <rect x="1130" y="330" width="60" height="14" rx="7" fill="#26282b"/>
        <line x1="1136" y1="333" x2="1184" y2="333" stroke="#565b60" stroke-width="2" stroke-linecap="round"/>
        <!-- knocker, lifted off the leaf by a soft shadow -->
        <ellipse cx="1163" cy="274" rx="21" ry="20" fill="#000000" opacity="${kpOk ? 0.35 : 0.15}"/>
        <circle cx="1160" cy="270" r="20" fill="none" stroke="#8a7148" stroke-width="7" opacity="${kpOk ? 1 : 0.35}"/>
        <path d="M1146,256 A20,20 0 0 1 1174,256" fill="none" stroke="#b39662" stroke-width="2.5" opacity="${kpOk ? 0.9 : 0.3}"/>
        <circle cx="1160" cy="252" r="6" fill="#8a7148" opacity="${kpOk ? 1 : 0.35}"/>
        <circle cx="1158.4" cy="250.4" r="2" fill="#b39662" opacity="${kpOk ? 0.9 : 0.3}"/>
      </g>
      <g id="v_keypad">
        <rect x="1026" y="304" width="46" height="64" rx="4" fill="#000000" opacity="0.35"/>
        <path d="M1068,332 q10,-2 14,0" stroke="#26282b" stroke-width="4" fill="none"/>
        <rect x="1022" y="300" width="46" height="64" rx="4" fill="#2e3134" stroke="#1c1e20" stroke-width="3"/>
        <line x1="1025" y1="303" x2="1065" y2="303" stroke="#565b60" stroke-width="2"/>
        <line x1="1025" y1="303" x2="1025" y2="361" stroke="#4d5257" stroke-width="2"/>
        ${[...Array(6)].map((_, i) => `<rect x="${1031 + (i % 2) * 16}" y="${309 + Math.floor(i / 2) * 16}" width="12" height="11" rx="2" fill="#17191b" opacity="0.7"/><rect x="${1030 + (i % 2) * 16}" y="${308 + Math.floor(i / 2) * 16}" width="12" height="11" rx="2" fill="${kpOk ? "#3a4a40" : "#4a4d50"}"/><line x1="${1031 + (i % 2) * 16}" y1="${309 + Math.floor(i / 2) * 16}" x2="${1040 + (i % 2) * 16}" y2="${309 + Math.floor(i / 2) * 16}" stroke="#6a7076" stroke-width="1" opacity="0.6"/>`).join("")}
        <circle cx="1045" cy="358" r="3.4" fill="${kpOk ? "#9ec7a8" : "#a5503c"}"/>
      </g>
      <!-- the way up is the open hatch: a shaft of light falls down from above,
           drawn by the FX layer with drifting motes so you know which way is out -->
    </g>
    <g id="layer-front">
      ${power ? "" : `<rect width="1280" height="720" fill="#060505" opacity="0.55"/>`}
    </g>
    <g id="hotspots">
      ${hs("breaker", 236, 148, 90, 122, power ? "The breaker box" : "A breaker box, a red light blinks", "v_breaker")}
      ${power ? `
        ${hs("mon0", 338, 278, 144, 126, "CAM 01 · 6:52", "v_mon0")}
        ${hs("mon1", 474, 278, 144, 126, "CAM 02 · 7:46", "v_mon1")}
        ${hs("mon2", 610, 278, 144, 126, "CAM 03 · 8:17", "v_mon2")}
        ${hs("mon3", 746, 278, 144, 126, "CAM 04 · 9:03", "v_mon3")}
        ${hs("mon5", 906, 528, 150, 118, "A fifth monitor, unplugged", "v_mon5")}
        ${hs("keypad", 1008, 288, 74, 90, "A keypad", "v_keypad")}
        ${hs("mdoor", 1064, 140, 192, 372, kpOk ? "The knocker" : "A sealed metal door", "v_mdoor")}
        ${hs("boiler", 58, 208, 176, 326, "The boiler", "v_boiler")}
      ` : ""}
      ${hs("goup", 0, 460, 160, 220, "Back up the stairs", "")}
    </g>
    </svg>`;
  }

  /* =====================================================================
     MEMORY (fifth room)
  ===================================================================== */
  function svgMemory() {
    return `<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    ${DEFS}
    <defs><filter id="blurf2"><feGaussianBlur stdDeviation="5"/></filter></defs>
    <g id="layer-back">
      <rect width="1280" height="720" fill="#0e0c0a"/>
      <rect width="1280" height="500" fill="#171410"/>
      <line x1="640" y1="0" x2="640" y2="150" stroke="#1c1610" stroke-width="4"/>
      <ellipse cx="640" cy="158" rx="13" ry="8" fill="#f0c884">
        <animate attributeName="opacity" values="1;0.8;1;0.65;1" dur="5s" repeatCount="indefinite"/>
      </ellipse>
      <!-- faint figure at the back -->
      <g id="v_figure" filter="url(#blurf2)" opacity="0.28">
        ${person(1050, 470, 120, "#8f8778")}
      </g>
    </g>
    <g id="layer-mid">
      <!-- child's bed -->
      <rect x="90" y="430" width="240" height="70" rx="6" fill="#33261a"/>
      <rect x="96" y="404" width="228" height="34" rx="8" fill="#4a4234"/>
      <rect x="102" y="410" width="70" height="22" rx="6" fill="#6b6252"/>
      <rect x="82" y="380" width="14" height="130" fill="#2c211a"/><rect x="324" y="380" width="14" height="130" fill="#2c211a"/>
      <!-- table with reel machine -->
      <g id="v_machine">
        <rect x="500" y="430" width="300" height="18" fill="#3f2f20"/>
        <rect x="520" y="448" width="14" height="120" fill="#2c211a"/><rect x="766" y="448" width="14" height="120" fill="#2c211a"/>
        <rect x="540" y="350" width="220" height="82" rx="8" fill="#3c4043" stroke="#22262a" stroke-width="4"/>
        <circle cx="600" cy="384" r="24" fill="#22262a" stroke="#8a8378" stroke-width="4"/>
        <circle cx="600" cy="384" r="9" fill="#15181b"/>
        <circle cx="700" cy="384" r="24" fill="#22262a" stroke="#8a8378" stroke-width="4"/>
        <circle cx="700" cy="384" r="9" fill="#15181b"/>
        <path d="M600,360 q50,-16 100,0" stroke="#8a7148" stroke-width="3" fill="none"/>
        <rect x="632" y="408" width="18" height="12" rx="2" fill="#9ec7a8"/>
        <rect x="656" y="408" width="18" height="12" rx="2" fill="#a5503c"/>
        <text x="650" y="344" text-anchor="middle" font-family="monospace" font-size="12" fill="#6b6252">NOV 14 · MASTER</text>
      </g>
      <!-- desk + child drawings on wall -->
      <g id="v_drawings">
        <rect x="880" y="180" width="80" height="60" fill="#d8c9a8" transform="rotate(-4 920 210)"/>
        <rect x="975" y="190" width="80" height="60" fill="#d8c9a8" transform="rotate(3 1015 220)"/>
        <path d="M900,225 l14,-18 l14,18 Z M932,225 h-46" stroke="#6b5b45" stroke-width="2.5" fill="none" transform="rotate(-4 920 210)"/>
        ${[0,1,2,3,4].map(i => `<line x1="${988 + i * 12}" y1="238" x2="${988 + i * 12}" y2="222" stroke="#6b5b45" stroke-width="2.5" transform="rotate(3 1015 220)"/><circle cx="${988 + i * 12}" cy="217" r="3.4" fill="none" stroke="#6b5b45" stroke-width="2" transform="rotate(3 1015 220)"/>`).join("")}
      </g>
      <!-- small camera in corner -->
      <g id="v_smallcam">
        <rect x="180" y="120" width="44" height="28" rx="5" fill="#3c4043" transform="rotate(18 202 134)"/>
        <circle cx="222" cy="142" r="7" fill="#15181b" stroke="#8a8378" stroke-width="2"/>
        <circle cx="222" cy="142" r="2.4" fill="#a5503c"><animate attributeName="opacity" values="1;0.2;1" dur="2.4s" repeatCount="indefinite"/></circle>
      </g>
    </g>
    <g id="layer-front"></g>
    <g id="hotspots">
      ${hs("machine", 520, 330, 260, 122, "The master recording", "v_machine")}
      ${hs("figure", 990, 330, 130, 170, "Someone at the edge of the light", "v_figure")}
      ${hs("drawings", 866, 168, 210, 100, "Children's drawings", "v_drawings")}
      ${hs("smallcam", 168, 106, 76, 60, "A small camera. It is on.", "v_smallcam")}
      ${hs("bed", 78, 368, 272, 142, "A small bed", "")}
    </g>
    </svg>`;
  }

  const builders = { porch: svgPorch, hallway: svgHallway, kitchen: svgKitchen, study: svgStudy, basement: svgBasement, memory: svgMemory, landing: svgLanding, childroom: svgChildroom, attic: svgAttic, diningroom: svgDining, conservatory: svgConservatory };

  /* ---------- render + wiring ---------- */
  function render() {
    const room = State.get().room;
    const holder = document.getElementById("scene-holder");
    holder.innerHTML = builders[room]();
    wireHotspots(holder, room);
    wireParallax(holder);
    if (room === "attic") wireTorch(holder);
    updateNavArrows(holder, room);
    if (typeof FX !== "undefined" && FX.apply) FX.apply(holder, room);
    if (typeof Fog !== "undefined" && Fog.apply) Fog.apply(holder, room);
    // object loops only sound while you are in the room with them;
    // once the house shuts the tap, the full flow dies and only drips remain
    AudioM.syncLoops({
      water: room === "kitchen" && !!State.flag("tapOn") && !State.flag("tapHouseOff"),
      fire: room === "kitchen" && !!State.flag("stoveOn"),
    });
    if (AudioM.dripLoop) AudioM.dripLoop(room === "kitchen" && !!State.flag("tapOverflow") && !State.flag("tapDrained"));
  }

  /* edge arrows: shown only when that direction is a real, currently
     existing exit of this room (deleted doors take the arrow with them) */
  let navBound = false;
  function updateNavArrows(holder, room) {
    const map = (typeof NAV_ARROWS !== "undefined" && NAV_ARROWS[room]) || {};
    [["left", "nav-left"], ["right", "nav-right"]].forEach(([dir, id]) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const hsId = map[dir];
      const exists = hsId && holder.querySelector(`.hotspot[data-hs="${hsId}"]`);
      btn.hidden = !exists;
      btn.dataset.hs = exists ? hsId : "";
    });
    if (!navBound) {
      navBound = true;
      ["nav-left", "nav-right"].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener("click", () => {
          const cur = State.get().room;
          const hsId = btn.dataset.hs;
          const acts = (typeof RoomActions !== "undefined") ? RoomActions : null;
          const fn = hsId && acts && acts[cur] && acts[cur][hsId];
          if (fn) { AudioM.click(); fn(); }
        });
      });
    }
  }

  /* torch beam follows the pointer in the attic */
  function wireTorch(holder) {
    const svg = holder.querySelector("svg");
    const hole = holder.querySelector("#torch-hole");
    if (!svg || !hole) return;
    svg.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect();
      hole.setAttribute("cx", Math.round((e.clientX - r.left) / r.width * 1280));
      hole.setAttribute("cy", Math.round((e.clientY - r.top) / r.height * 720));
    }, { passive: true });
  }

  function wireHotspots(holder, room) {
    // interaction priority: smaller hotspots must sit ABOVE larger overlapping ones,
    // so re-append in descending area order (last-in-DOM = topmost in SVG)
    const group = holder.querySelector("#hotspots");
    if (group) {
      const dim = (el, attr) => {
        const v = el[attr];
        if (v && v.baseVal) return v.baseVal.value;
        return parseFloat(el.getAttribute(attr)) || 0;
      };
      [...group.querySelectorAll(".hotspot")]
        .sort((a, b) => (dim(b, "width") * dim(b, "height")) - (dim(a, "width") * dim(a, "height")))
        .forEach(el => group.appendChild(el));
    }
    holder.querySelectorAll(".hotspot").forEach(el => {
      const targetId = el.dataset.target;
      const target = targetId ? holder.querySelector("#" + targetId) : null;
      el.addEventListener("pointerenter", () => { if (target) target.classList.add("lit"); });
      el.addEventListener("pointerleave", () => { if (target) target.classList.remove("lit"); });
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        AudioM.click();
        if (typeof Game !== "undefined" && Game.noteClick) Game.noteClick();
        const acts = (typeof RoomActions !== "undefined") ? RoomActions : null;
        const fn = acts && acts[room] && acts[room][el.dataset.hs];
        if (fn) fn();
      });
    });
  }

  let paraBound = false;
  function wireParallax(holder) {
    if (!GAME_CONFIG.parallax.enabled) return;
    if (paraBound) return;
    paraBound = true;
    const stage = document.getElementById("stage");
    stage.addEventListener("pointermove", (e) => {
      if (Settings.get("reducedMotion") || !Settings.get("parallax")) return;
      const r = stage.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      const h = document.getElementById("scene-holder");
      const back = h.querySelector("#layer-back"), mid = h.querySelector("#layer-mid"), front = h.querySelector("#layer-front");
      if (back) back.setAttribute("transform", `translate(${-nx * GAME_CONFIG.parallax.back},${-ny * GAME_CONFIG.parallax.back * 0.5})`);
      if (mid) mid.setAttribute("transform", `translate(${-nx * GAME_CONFIG.parallax.mid},${-ny * GAME_CONFIG.parallax.mid * 0.5})`);
      if (front) front.setAttribute("transform", `translate(${-nx * GAME_CONFIG.parallax.front},${-ny * GAME_CONFIG.parallax.front * 0.5})`);
    }, { passive: true });
  }

  function goto(room, msg) {
    Dialogue.clear();
    fadeTransition(() => {
      State.setRoom(room);
      render();
      /* the fog surges in from the doorway as the room settles */
      if (typeof Fog !== "undefined" && Fog.gustNow) Fog.gustNow(0.8);
      if (msg) Dialogue.say(msg);
      /* the house gets one chance to act every time a room is entered */
      if (typeof HouseTricks !== "undefined") HouseTricks.onEnter(room);
      /* the shattered mirror, if the house has quietly put it back, is noticed now */
      if (room === "hallway" && State.flag("mirrorReturned") && !State.flag("mirrorReturnSeen")) {
        State.setFlag("mirrorReturnSeen");
        const lines = (typeof Mirror !== "undefined" && Mirror.returnLines) ? Mirror.returnLines() : [
          "What? No. I broke this mirror.",
          "It hangs where it always hung. Cracked, watching the hallway, as if it never came apart.",
        ];
        Dialogue.say(lines);
      }
      AudioM.randomCreak();
    });
  }

  return { render, goto };
})();
