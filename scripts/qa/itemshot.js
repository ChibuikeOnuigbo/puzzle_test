/* HOUSE 17 — item close-up harness (Playwright).
   Custom itemShot(): boots the game in QA mode, renders a chosen room with
   chosen flags, locates one SVG group by id, and saves a padded close-up
   crop of just that item so its depth/3D read can be reviewed at 1:1.
   Usage: node scripts/qa/itemshot.js */
"use strict";
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "../../artifacts/visual-qa/items");
fs.mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:3000";

/* The custom function: room + flags -> clipped screenshot of #id */
async function itemShot(page, { room, id, name, flags = {}, pad = 36 }) {
  await page.evaluate(([room, flags]) => {
    for (const [k, v] of Object.entries(flags)) State.setFlag(k, v);
    State.setRoom(room);
    Rooms.render();
  }, [room, flags]);
  await page.waitForTimeout(400);

  const el = page.locator(`#${id}`);
  await el.waitFor({ state: "attached", timeout: 5000 });
  const box = await el.boundingBox();
  if (!box) throw new Error("no bounding box for " + id);

  const vp = page.viewportSize();
  const x0 = Math.max(0, box.x - pad);
  const y0 = Math.max(0, box.y - pad);
  const x1 = Math.min(vp.width, box.x + box.width + pad);
  const y1 = Math.min(vp.height, box.y + box.height + pad);
  const clip = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };

  await page.screenshot({ path: path.join(OUT, name + ".png"), clip });
  console.log("itemshot:", name, JSON.stringify(clip));
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.__QA__ = true; });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push("PAGEERROR: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  await page.goto(URL);
  await page.waitForTimeout(800);
  await page.click("#btn-new");
  await page.waitForTimeout(1200);

  await itemShot(page, { room: "basement", id: "v_mdoor", name: "item-mdoor", flags: { basementPower: true } });
  await itemShot(page, { room: "basement", id: "v_mdoor", name: "item-mdoor-knock", flags: { basementPower: true, keypadSolved: true } });
  await itemShot(page, { room: "hallway", id: "v_stairs", name: "item-stairs", pad: 20 });
  await itemShot(page, { room: "hallway", id: "v_udoor", name: "item-hatch", flags: { act2: true } });
  await itemShot(page, { room: "hallway", id: "v_kdoor", name: "item-kdoor-peek", pad: 16 });
  await itemShot(page, { room: "hallway", id: "v_mirror", name: "item-mirror", pad: 22 });
  await itemShot(page, { room: "hallway", id: "v_mirror", name: "item-mirror-act2", flags: { act2: true }, pad: 22 });
  await itemShot(page, { room: "hallway", id: "v_mirror", name: "item-mirror-cracked", flags: { act2: true, mirrorCracked: true }, pad: 22 });
  await itemShot(page, { room: "hallway", id: "v_mirror", name: "item-mirror-open", flags: { act2: true, mirrorShattered: true }, pad: 22 });

  /* separation check: staircase and floor hatch must not touch (SVG geometry units) */
  await page.evaluate((room) => { State.setRoom(room); Rooms.render(); }, "hallway");
  await page.waitForTimeout(300);
  const sep = await page.evaluate(() => {
    const s = document.getElementById("v_stairs").getBBox();
    const h = document.getElementById("v_udoor").getBBox();
    const overlapX = Math.max(0, Math.min(s.x + s.width, h.x + h.width) - Math.max(s.x, h.x));
    const overlapY = Math.max(0, Math.min(s.y + s.height, h.y + h.height) - Math.max(s.y, h.y));
    const gapY = +(Math.max(s.y, h.y) - Math.min(s.y + s.height, h.y + h.height)).toFixed(1);
    return {
      stairs: { x: +s.x.toFixed(1), y: +s.y.toFixed(1), w: +s.width.toFixed(1), h: +s.height.toFixed(1) },
      hatch: { x: +h.x.toFixed(1), y: +h.y.toFixed(1), w: +h.width.toFixed(1), h: +h.height.toFixed(1) },
      overlapX: +overlapX.toFixed(1),
      overlapY: +overlapY.toFixed(1),
      gapY,
    };
  });
  console.log("separation:", JSON.stringify(sep));
  if (sep.overlapX > 1 && sep.overlapY > 1) errors.push("SEPARATION: stairs and hatch still overlap");


  await browser.close();
  console.log("errors:", errors.length, errors);
  process.exit(errors.length ? 1 : 0);
})();
