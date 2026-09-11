/* HOUSE 17 — wave-2 visual QA: fridge dual doors, bin, tap ramp, puddle
   growth, bathroom tub/steam/towel, dining left arrow (no door). */
"use strict";
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "../../artifacts/visual-qa");
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { window.__QA__ = true; });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + ".png") });

  await page.goto("http://localhost:3000");
  await page.waitForTimeout(500);
  await page.click("#btn-new");
  await page.waitForTimeout(700);

  // straight into the kitchen for the fridge/bin/tap work
  await page.evaluate(() => { State.setRoom("kitchen"); Rooms.render(); });
  await page.waitForTimeout(400);
  await shot("40-kitchen-fridge-closed");

  await page.evaluate(() => { State.setFlag("freezerOpen"); Rooms.render(); });
  await page.waitForTimeout(300);
  await shot("41-kitchen-freezer-open");

  await page.evaluate(() => { State.setFlag("fridgeOpen"); Rooms.render(); });
  await page.waitForTimeout(300);
  await shot("42-kitchen-both-open");

  await page.evaluate(() => { State.setFlag("freezerOpen", false); Rooms.render(); });
  await page.waitForTimeout(250);

  // the tap: catch the pour ramping in (small trickle -> stream)
  await page.evaluate(() => { State.setFlag("tapOn"); Rooms.render(); });
  await page.waitForTimeout(450);
  await shot("43-kitchen-tap-ramp-early");
  await page.waitForTimeout(1600);
  await shot("44-kitchen-tap-full");

  // puddle: wetFloor just set (small) vs after the 8s growth
  await page.evaluate(() => { State.setFlag("wetFloor"); Rooms.render(); });
  await page.waitForTimeout(600);
  await shot("45-puddle-small");
  await page.waitForTimeout(8400);
  await shot("46-puddle-grown");

  await page.evaluate(() => {
    State.setFlag("tapOn", false); State.setFlag("wetFloor", false);
    State.setFlag("fridgeOpen", false);
    State.setRoom("diningroom"); Rooms.render();
  });
  await page.waitForTimeout(400);
  await shot("47-dining-no-door-left-arrow");

  await page.evaluate(() => { State.setRoom("bathroom"); Rooms.render(); });
  await page.waitForTimeout(500);
  await shot("48-bathroom");
  // swing the towel and catch it mid-swing
  await page.evaluate(() => { const t = document.getElementById("towelsway"); if (t) t.beginElement(); });
  await page.waitForTimeout(700);
  await shot("49-bathroom-towel-swing");

  console.log("errors:", errs.length ? errs.slice(0, 5) : "none");
  await browser.close();
  if (errs.length) process.exit(1);
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
