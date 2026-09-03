/* HOUSE 17 — QA break-it harness: spam, refresh, nested popups, wrong answers, restart. */
"use strict";
const { chromium } = require("playwright-core");
const URL = "http://localhost:3000";

async function hit(page, id) {
  const el = page.locator(`.hotspot[data-hs="${id}"]`);
  const box = await el.boundingBox();
  if (!box) return false;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { window.__QA__ = true; });
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push("PAGEERROR: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  await page.goto(URL); await page.waitForTimeout(500);

  // 1. rapid menu clicking
  for (let i = 0; i < 6; i++) { await page.click("#btn-how"); await page.keyboard.press("Escape"); }
  console.log("1. menu spam ok");

  // 2. new game, spam-click hotspots wildly
  await page.click("#btn-new"); await page.waitForTimeout(600);
  for (let i = 0; i < 12; i++) {
    await page.mouse.click(200 + Math.random() * 900, 200 + Math.random() * 400);
    await page.waitForTimeout(30);
  }
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  console.log("2. wild clicking ok");

  // 3. pot spam (repeat responses shouldn't repeat immediately / crash)
  for (let i = 0; i < 6; i++) await hit(page, "pot0");
  await hit(page, "pot2"); await hit(page, "pot2"); await hit(page, "pot2");
  console.log("3. hotspot spam ok, inv:", await page.evaluate(() => JSON.stringify(State.get().inventory)));

  // 4. enter house, then REFRESH — save should restore hallway
  await hit(page, "door"); await page.waitForTimeout(900);
  const roomBefore = await page.evaluate(() => State.get().room);
  await page.reload(); await page.waitForTimeout(500);
  const contDisabled = await page.locator("#btn-continue").isDisabled();
  await page.click("#btn-continue"); await page.waitForTimeout(700);
  const roomAfter = await page.evaluate(() => State.get().room);
  console.log("4. refresh/continue:", roomBefore, "->", roomAfter, "continue disabled?", contDisabled);
  if (roomBefore !== roomAfter) errors.push("SAVE RESTORE MISMATCH");

  // 5. nested popups: pause -> settings -> erase-confirm (3 layers), check z order
  await page.click("#btn-menu"); await page.waitForTimeout(200);
  await page.click(".popup-foot button:nth-child(2)"); await page.waitForTimeout(250); // Settings
  await page.click("#snext"); await page.click("#snext"); await page.waitForTimeout(150);
  await page.click("#wipe"); await page.waitForTimeout(250);
  const zs = await page.evaluate(() => [...document.querySelectorAll(".popup-overlay")].map(o => +o.style.zIndex));
  console.log("5. nested z-indexes:", zs.join(","));
  if (!(zs.length === 3 && zs[0] < zs[1] && zs[1] < zs[2])) errors.push("Z-ORDER WRONG: " + zs.join(","));
  await page.screenshot({ path: __dirname + "/../../artifacts/visual-qa/27-nested-popups.png" });
  // esc unwinds one at a time
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const left = await page.evaluate(() => document.querySelectorAll(".popup-overlay").length);
  console.log("5b. overlays after 3x Esc:", left);
  if (left !== 0) errors.push("POPUPS NOT CLEANED");

  // 6. wrong knock patterns + wrong keypad codes repeatedly (already in-game at hallway)
  await page.evaluate(() => { State.setFlag("act2"); State.setFlag("basementUnlocked"); State.setFlag("basementPower"); State.setRoom("basement"); Rooms.render(); });
  await page.waitForTimeout(300);
  await hit(page, "keypad"); await page.waitForTimeout(250);
  for (const code of ["000", "999", "123"]) {
    for (const c of code) await page.click(`.kbtn[data-k="${c}"]`);
    await page.click('.kbtn[data-k="OK"]'); await page.waitForTimeout(750);
  }
  for (const c of "817") await page.click(`.kbtn[data-k="${c}"]`);
  await page.click('.kbtn[data-k="OK"]'); await page.waitForTimeout(700);
  console.log("6pre. keypadSolved:", await page.evaluate(() => !!State.flag("keypadSolved")),
    "room:", await page.evaluate(() => State.get().room),
    "display:", await page.evaluate(() => (document.querySelector("#kd") || {}).textContent));
  await hit(page, "mdoor"); await page.waitForTimeout(400);
  console.log("6a. overlays before knocks:", await page.evaluate(() => [...document.querySelectorAll(".popup-overlay")].map(o => (o.querySelector("h2") || {}).textContent)));
  for (let i = 0; i < 2; i++) { // wrong patterns
    await page.click('.knock-btn[data-t="long"]');
    await page.click('.knock-btn[data-t="short"]');
    await page.click('.knock-btn[data-t="short"]');
    await page.waitForTimeout(600);
  }
  console.log("6. wrong answers survived");
  await page.keyboard.press("Escape");

  // 7. restart via pause menu (nested confirm)
  await page.click("#btn-menu"); await page.waitForTimeout(200);
  await page.click(".popup-foot button:nth-child(3)"); await page.waitForTimeout(250); // Restart game
  await page.click("#popup-root .popup-overlay:last-child .popup-foot .btn.danger"); await page.waitForTimeout(800); // Yes, restart (topmost popup)
  const room7 = await page.evaluate(() => State.get().room);
  console.log("7. restart -> room:", room7);
  if (room7 !== "porch") errors.push("RESTART DID NOT RESET");

  // 8. resize during play
  await page.setViewportSize({ width: 700, height: 500 }); await page.waitForTimeout(200);
  await page.setViewportSize({ width: 1600, height: 1000 }); await page.waitForTimeout(200);
  await hit(page, "note"); await page.waitForTimeout(200);
  const noteOpen = await page.evaluate(() => document.querySelectorAll(".popup-overlay").length);
  console.log("8. resize + interact, popup open:", noteOpen);
  if (!noteOpen) errors.push("HOTSPOT BROKEN AFTER RESIZE");
  await page.keyboard.press("Escape");

  // 9. localStorage blocked simulation (private-mode-ish): ensure no crash on save
  await page.evaluate(() => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error("QuotaExceeded"); }; State.setFlag("stressTest"); Storage.prototype.setItem = orig; });
  console.log("9. storage failure tolerated");

  // 10. REGRESSION: dialogue spam must never bank future narration (v2 spec §15).
  //     Spam a talky hotspot 20x fast, stop, then watch the dialogue box: with the
  //     replace-queue state machine we must see at most 2 distinct lines afterwards,
  //     and the box must eventually hide. A buffering queue would keep cycling lines.
  for (let i = 0; i < 20; i++) { await hit(page, "pot0"); await page.waitForTimeout(40); }
  await page.waitForTimeout(800); // settle: last line may still be typing
  const seen = new Set();
  const tEnd = Date.now() + 7000;
  while (Date.now() < tEnd) {
    const s = await page.evaluate(() => {
      const b = document.getElementById("dialogue");
      if (!b || b.classList.contains("hidden")) return null;
      const el = document.getElementById("dialogue-text");
      return el && el.dataset ? el.textContent : null;
    });
    if (s) seen.add(s);
    await page.waitForTimeout(350);
  }
  // collapse partial typewriter frames: keep only strings that are not prefixes of longer ones
  const lines = [...seen].filter(a => ![...seen].some(b => b !== a && b.startsWith(a)));
  const hiddenAtEnd = await page.evaluate(() => document.getElementById("dialogue").classList.contains("hidden"));
  if (lines.length > 2) errors.push("DIALOGUE BUFFERED SPAM: " + lines.length + " lines played after clicking stopped: " + JSON.stringify(lines));
  if (!hiddenAtEnd) errors.push("DIALOGUE NEVER WENT QUIET AFTER SPAM");
  console.log("10. dialogue spam regression: distinct lines after stop =", lines.length, "| hidden at end:", hiddenAtEnd);

  console.log("\n--- errors:", errors.length);
  errors.forEach(e => console.log(e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error("HARNESS FAIL:", e.message); process.exit(2); });
