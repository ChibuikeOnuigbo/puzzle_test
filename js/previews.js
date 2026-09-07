/* HOUSE 17 — DOORWAY CONTINUITY (docs/DOORWAY_CONTINUITY.md)
   ============================================================================
   If an opening has no closed door, the destination room MUST be visible —
   and it must be the SAME world the player enters. Each room registers a
   preview builder derived from its real composition (object identities and
   relative positions match the full renderer); the preview is clipped to
   the doorway aperture and graded by quality tier:

     HIGH   full preview composition + local light
     MEDIUM reduced-detail preview
     LOW    major silhouettes + architecture + lighting blocks

   Previews are STATIC (no second fly simulation, no second bird engine):
   one house, one set of systems.
============================================================================ */
"use strict";

const Previews = (() => {
  const REG = {};
  const register = (room, fn) => { REG[room] = fn; };
  const has = room => !!REG[room];

  /* architectural aperture: frame, inner jambs, reveal shadow, threshold,
     then the clipped destination room, then the opening's inner edge */
  function through(room, ap, opt = {}) {
    const build = REG[room];
    const inner = build ? build(ap, opt) : defaultDark(ap);
    const id = `pv-${room}-${ap.x}-${ap.y}`;
    return `
    <defs><clipPath id="${id}"><rect x="${ap.x}" y="${ap.y}" width="${ap.w}" height="${ap.h}"/></clipPath></defs>
    <g data-doorway-preview="${room}" data-aperture="${ap.x},${ap.y},${ap.w},${ap.h}">
      <rect x="${ap.x}" y="${ap.y}" width="${ap.w}" height="${ap.h}" fill="#0c0906"/>
      <g clip-path="url(#${id})">${inner}</g>
      <!-- inner reveal: jambs + lintel give the opening thickness -->
      <rect x="${ap.x}" y="${ap.y}" width="${Math.min(10, ap.w * 0.06)}" height="${ap.h}" fill="#0b0806" opacity="0.85"/>
      <rect x="${ap.x + ap.w - Math.min(10, ap.w * 0.06)}" y="${ap.y}" width="${Math.min(10, ap.w * 0.06)}" height="${ap.h}" fill="#0b0806" opacity="0.6"/>
      <rect x="${ap.x}" y="${ap.y}" width="${ap.w}" height="${Math.min(9, ap.h * 0.04)}" fill="#0b0806" opacity="0.8"/>
      ${typeof Debug !== "undefined" && Debug.on("doorwayApertures")
        ? `<rect x="${ap.x}" y="${ap.y}" width="${ap.w}" height="${ap.h}" fill="none" stroke="#ff8c00" stroke-width="1.6" stroke-dasharray="6 4"/>` : ""}
    </g>`;
  }

  function defaultDark(ap) {
    return `<rect x="${ap.x}" y="${ap.y}" width="${ap.w}" height="${ap.h}" fill="#120e0a"/>`;
  }

  /* =====================================================================
     KITCHEN seen from the hallway doorway. Matches svgKitchen(): window
     over the sink on the far wall, lamp hanging centre, stove run at the
     far left, counter along the far wall, table mid-floor, fridge near the
     door on the right, floor receding to the left.
  ===================================================================== */
  register("kitchen", (ap, opt = {}) => {
    const q = (typeof Art !== "undefined") ? Art.tier() : "high";
    const { x, y, w, h } = ap;
    const falseK = opt.falseKitchen;
    const u = f => x + w * f, v = f => y + h * f;
    let s = "";
    /* far wall + receding floor */
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.5}" fill="#26251f"/>`;
    s += `<polygon points="${x},${y + h} ${x + w},${y + h} ${x + w},${v(0.5)} ${x},${v(0.62)}" fill="url(#floorg)"/>`;
    s += `<path d="M${u(0.22)},${v(0.62)} L${u(0.2)},${y + h} M${u(0.5)},${v(0.55)} L${u(0.51)},${y + h} M${u(0.78)},${v(0.52)} L${u(0.8)},${y + h}" stroke="#100c09" stroke-width="2" opacity="0.5"/>`;
    /* window over the sink (night; moon + clipped, never escaping) */
    const wg = { x: u(0.28), y: v(0.12), w: w * 0.44, h: h * 0.22 };
    s += `<rect x="${wg.x - 4}" y="${wg.y - 4}" width="${wg.w + 8}" height="${wg.h + 8}" fill="#1a140f"/>`;
    if (typeof Windows !== "undefined") {
      const built = Windows.build("hkwin", wg, {
        scene: "night", moon: { u: 0.7, v: 0.3, r: 6 }, seed: 41, horizon: 0.8,
        birds: { count: 2, scale: 0.45, band: [0.1, 0.6], color: "#0a0e14" },
      });
      s += `<defs>${built.defs}</defs>${built.exterior}`;
    } else {
      s += `<rect x="${wg.x}" y="${wg.y}" width="${wg.w}" height="${wg.h}" fill="#10151d"/>`;
    }
    if (falseK) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#2a1f2e" opacity="0.34"/>`;
    s += `<line x1="${wg.x + wg.w / 2}" y1="${wg.y}" x2="${wg.x + wg.w / 2}" y2="${wg.y + wg.h}" stroke="#1a140f" stroke-width="3"/>`;
    s += `<line x1="${wg.x}" y1="${wg.y + wg.h / 2}" x2="${wg.x + wg.w}" y2="${wg.y + wg.h / 2}" stroke="#1a140f" stroke-width="3"/>`;
    /* hanging lamp shaft, far off */
    s += `<line x1="${u(0.5)}" y1="${y}" x2="${u(0.5)}" y2="${v(0.16)}" stroke="#1c1610" stroke-width="2.4"/>`;
    s += `<polygon points="${u(0.46)},${v(0.16)} ${u(0.54)},${v(0.16)} ${u(0.52)},${v(0.21)} ${u(0.48)},${v(0.21)}" fill="#3a2f22"/>`;
    s += `<polygon points="${u(0.4)},${v(0.24)} ${u(0.6)},${v(0.22)} ${u(0.72)},${v(0.94)} ${u(0.24)},${v(0.94)}" fill="url(#lampglow)" opacity="0.24"/>`;
    /* counter run along the far wall + cabinet fronts */
    s += `<polygon points="${x},${v(0.6)} ${u(0.86)},${v(0.48)} ${u(0.86)},${v(0.52)} ${x},${v(0.65)}" fill="#4a3826"/>`;
    s += `<polygon points="${x},${v(0.65)} ${u(0.86)},${v(0.52)} ${u(0.86)},${v(0.7)} ${x},${v(0.84)}" fill="#33261a"/>`;
    if (q !== "low") s += `<line x1="${u(0.04)}" y1="${v(0.68)}" x2="${u(0.82)}" y2="${v(0.56)}" stroke="#241a11" stroke-width="2.4"/>`;
    /* stove at the far end */
    s += `<rect x="${x}" y="${v(0.66)}" width="${w * 0.14}" height="${h * 0.24}" fill="#4a4e52" stroke="#22262a" stroke-width="2"/>`;
    /* table edge mid-floor */
    s += `<polygon points="${u(0.16)},${v(0.88)} ${u(0.62)},${v(0.88)} ${u(0.68)},${v(0.99)} ${u(0.1)},${v(0.99)}" fill="#3f3020"/>`;
    /* fridge near the door, close to the right jamb, in shadow */
    s += `<rect x="${u(0.8)}" y="${v(0.24)}" width="${w * 0.2}" height="${h * 0.66}" rx="3" fill="#565b56"/>`;
    s += `<line x1="${u(0.8)}" y1="${v(0.24)}" x2="${u(0.8)}" y2="${v(0.9)}" stroke="#3d413d" stroke-width="3"/>`;
    s += `<line x1="${u(0.83)}" y1="${v(0.28)}" x2="${u(0.83)}" y2="${v(0.86)}" stroke="#6a706b" stroke-width="2" opacity="0.7"/>`;
    s += `<line x1="${u(0.8)}" y1="${v(0.44)}" x2="${u(1)}" y2="${v(0.44)}" stroke="#3d413d" stroke-width="2"/>`;
    /* depth grading: darker toward the far wall, lamplight on the threshold */
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#pvkdark)"/>`;
    s += `<defs><linearGradient id="pvkdark" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0b0806" stop-opacity="0.62"/>
      <stop offset="0.55" stop-color="#0b0806" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#0b0806" stop-opacity="0.5"/>
    </linearGradient></defs>`;
    s += `<polygon points="${x},${y + h} ${x + w},${y + h} ${x + w},${y + h * 0.93} ${x},${y + h * 0.97}" fill="#e8a04c" opacity="0.08"/>`;
    return s;
  });

  /* =====================================================================
     SITTING ROOM seen from the dining room doorway. Matches
     svgSittingroom(): fireplace with a live fire on the left, rug,
     armchair, sofa to the right, warm mantel light.
  ===================================================================== */
  register("sittingroom", (ap) => {
    const { x, y, w, h } = ap;
    const u = f => x + w * f, v = f => y + h * f;
    let s = "";
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.66}" fill="#3b3128"/>`;
    s += `<rect x="${x}" y="${v(0.66)}" width="${w}" height="${h * 0.34}" fill="#241b14"/>`;
    /* chimney breast + firebox with live glow */
    s += `<rect x="${u(0.06)}" y="${y}" width="${w * 0.4}" height="${v(0.66) - y}" fill="#463b30"/>`;
    s += `<rect x="${u(0.13)}" y="${v(0.3)}" width="${w * 0.26}" height="${h * 0.3}" rx="2" fill="#0d0906"/>`;
    s += `<ellipse cx="${u(0.26)}" cy="${v(0.58)}" rx="${w * 0.11}" ry="${h * 0.05}" fill="#e8842a" opacity="0.8"/>`;
    s += `<ellipse cx="${u(0.26)}" cy="${v(0.56)}" rx="${w * 0.07}" ry="${h * 0.035}" fill="#f6c96a" opacity="0.9"/>`;
    s += `<rect x="${u(0.04)}" y="${v(0.27)}" width="${w * 0.44}" height="${h * 0.03}" fill="#5d4a35"/>`;
    /* firelight pool on the floor */
    s += `<ellipse cx="${u(0.3)}" cy="${v(0.78)}" rx="${w * 0.26}" ry="${h * 0.09}" fill="#e8842a" opacity="0.14"/>`;
    /* rug + furniture silhouettes */
    s += `<ellipse cx="${u(0.52)}" cy="${v(0.82)}" rx="${w * 0.3}" ry="${h * 0.08}" fill="#5d3a30" opacity="0.9"/>`;
    s += `<rect x="${u(0.62)}" y="${v(0.48)}" width="${w * 0.3}" height="${h * 0.22}" rx="6" fill="#5a3a30"/>`;
    s += `<rect x="${u(0.6)}" y="${v(0.6)}" width="${w * 0.34}" height="${h * 0.1}" rx="4" fill="#422a22"/>`;
    s += `<rect x="${u(0.46)}" y="${v(0.5)}" width="${w * 0.12}" height="${h * 0.2}" rx="5" fill="#4c4a3a"/>`;
    /* warm grading toward the fire, darker at the jambs */
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#pvsitdark)"/>`;
    s += `<defs><linearGradient id="pvsitdark" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e8842a" stop-opacity="0.08"/>
      <stop offset="0.4" stop-color="#0b0806" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#0b0806" stop-opacity="0.55"/>
    </linearGradient></defs>`;
    return s;
  });

  return { register, through, has, _reg: REG };
})();

(typeof window !== "undefined") && (window.Previews = Previews);
if (typeof module !== "undefined") module.exports = { Previews };
