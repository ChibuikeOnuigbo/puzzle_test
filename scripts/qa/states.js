const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__QA__ = true; });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto("http://localhost:3000"); await page.waitForTimeout(400);
  await page.click("#btn-new"); await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    // force the deep water states + act2 + awareness and re-render every room
    State.setFlag("tapOn"); State.setFlag("tapOverflow"); State.setFlag("wetFloor");
    State.setFlag("act2"); State.setFlag("lockboxOpen"); State.setFlag("fridgeOpen");
    State.setFlag("closetOpen"); State.addAware(30);
    State.setFlag("roomDeleted_child"); State.setFlag("tapThin");
    const out = [];
    for (const room of ["porch","hallway","kitchen","study","basement","memory","landing","childroom","attic","diningroom","gallery","conservatory","bathroom"]) {
      State.setRoom(room); Rooms.render();
      out.push(room + ":" + document.querySelectorAll(".hotspot").length);
    }
    return { rooms: out.join(" "), aware: State.aware() };
  });
  await page.screenshot({ path: "artifacts/visual-qa/29-kitchen-flood.png" }); // last room rendered is attic; go kitchen
  await page.evaluate(() => { State.setRoom("kitchen"); Rooms.render(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "artifacts/visual-qa/29-kitchen-flood.png" });
  // V4 states: landing with the child door deleted + false kitchen copy
  await page.evaluate(() => { State.setRoom("landing"); Rooms.render(); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "artifacts/visual-qa/30-landing-deleted-door.png" });
  const r2 = await page.evaluate(() => {
    State.setFlag("falseKitchen"); State.setFlag("tapOverflow", false); State.setFlag("tapOn", false);
    State.setRoom("kitchen"); Rooms.render();
    return "falseKitchen hotspots:" + document.querySelectorAll(".hotspot").length + " counts:" + JSON.stringify(State.get().counts);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "artifacts/visual-qa/31-false-kitchen.png" });
  console.log(r2);
  // archive (dining replaced) and normal dining with the moved chair
  await page.evaluate(() => { State.setRoom("diningroom"); Rooms.render(); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "artifacts/visual-qa/32-archive.png" });
  await page.evaluate(() => { State.setFlag("roomDeleted_child", false); State.setFlag("smallChairMoved"); State.setFlag("sbOpen"); Rooms.render(); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "artifacts/visual-qa/33-dining.png" });
  console.log(r.rooms, "| aware:", r.aware, "| errors:", errs.length, errs.slice(0,3));
  await browser.close();
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
