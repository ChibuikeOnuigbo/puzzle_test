/* QUALITY TIER MATRIX
 * Renders each touched room at high / medium / low and asserts the tiers are
 * VISIBLY different scenes (pixel-diff threshold), not blur/opacity tricks.
 * Writes the stills to artifacts/visual-qa/<room>-<tier>.png.
 * Run: node scripts/qa/quality_matrix.js [room ...]   (default: key rooms)
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const sharp = require(path.join(root, "node_modules", "sharp"));

const rooms = process.argv.slice(2).length ? process.argv.slice(2)
  : ["hallway", "kitchen", "diningroom", "sittingroom", "landing", "childroom", "basement"];
const tiers = ["high", "medium", "low"];

(async () => {
  const fail = [];
  const check = (n, c) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fail.push(n); };

  async function diffPct(a, b) {
    const [ia, ib] = await Promise.all([a, b].map(f => sharp(f).raw().toBuffer({ resolveWithObject: true })));
    if (ia.info.width !== ib.info.width || ia.info.channels !== ib.info.channels) return 100;
    let diff = 0, tot = 0;
    for (let i = 0; i < ia.data.length; i += ia.info.channels) {
      tot++;
      const dr = Math.max(
        Math.abs(ia.data[i] - ib.data[i]),
        Math.abs(ia.data[i + 1] - ib.data[i + 1]),
        Math.abs(ia.data[i + 2] - ib.data[i + 2]));
      if (dr > 10) diff++;
    }
    return 100 * diff / tot;
  }

  for (const room of rooms) {
    for (const tier of tiers) {
      const out = path.join(root, "artifacts", "visual-qa", `${room}-${tier}.png`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      execFileSync(process.execPath, [
        path.join(root, "scripts/qa/render_still.mjs"), room, out,
        `Settings.set('quality','${tier}')`, "400",
      ], { stdio: "pipe" });
    }
    const dHM = await diffPct(
      path.join(root, "artifacts/visual-qa", `${room}-high.png`),
      path.join(root, "artifacts/visual-qa", `${room}-medium.png`));
    const dML = await diffPct(
      path.join(root, "artifacts/visual-qa", `${room}-medium.png`),
      path.join(root, "artifacts/visual-qa", `${room}-low.png`));
    console.log(`  ${room}: high-vs-medium ${dHM.toFixed(2)}% pixels differ; medium-vs-low ${dML.toFixed(2)}%`);
    check(`${room}: high != medium (>=0.4% pixels)`, dHM >= 0.4);
    check(`${room}: medium != low (>=0.4% pixels)`, dML >= 0.4);
  }
  console.log(fail.length ? `\n${fail.length} FAILURES` : "\nQUALITY MATRIX PASSED");
  process.exit(fail.length ? 1 : 0);
})();
