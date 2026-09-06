/* HOUSE 17 — QA screenshot & playtest harness (Playwright).
   Usage: node scripts/qa/shoot.js [scenario]
   Scenarios: menu, porch, playthrough (default: all) */
"use strict";
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "../../artifacts/visual-qa");
fs.mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:3000";

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + ".png") });
  console.log("shot:", name);
}
async function clickHotspot(page, id) {
  // hotspots are SVG rects; click their center via bounding box
  const el = page.locator(`.hotspot[data-hs="${id}"]`);
  await el.waitFor({ state: "attached", timeout: 5000 });
  const box = await el.boundingBox();
  if (!box) throw new Error("no box for hotspot " + id);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(250);
}
async function closeTopPopup(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}
async function keypadEnter(page, code) {
  for (const c of code) await page.click(`.kbtn[data-k="${c}"]`);
  await page.click('.kbtn[data-k="OK"]');
  await page.waitForTimeout(700);
}
async function waitFade(page) { await page.waitForTimeout(700); }

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
  await shot(page, "01-menu");

  // settings popup + nested popup z-order
  await page.click("#btn-settings");
  await page.waitForTimeout(300);
  await shot(page, "02-settings");
  await page.click("#snext"); await page.waitForTimeout(200);
  await shot(page, "03-settings-page2");
  await page.keyboard.press("Escape"); await page.waitForTimeout(250);

  // new game
  await page.click("#btn-new");
  await page.waitForTimeout(900);
  await shot(page, "04-porch");

  // porch: read note, wrong pot, right pot, mat secret, enter
  await clickHotspot(page, "note"); await shot(page, "05-note"); await closeTopPopup(page);
  await clickHotspot(page, "pot0");
  await clickHotspot(page, "pot2"); await page.waitForTimeout(400);
  await shot(page, "06-key-found");
  await clickHotspot(page, "mat"); await shot(page, "07-secret-drawing"); await closeTopPopup(page);
  await clickHotspot(page, "door"); await waitFade(page);
  await shot(page, "08-hallway");

  // edge arrows: fast travel along real graph edges
  await page.click("#nav-right"); await waitFade(page);   // stairs up
  await shot(page, "08b-arrow-landing");
  await page.click("#nav-right"); await waitFade(page);   // back down

  // hallway pokes
  await clickHotspot(page, "photo"); await shot(page, "09-photo"); await closeTopPopup(page);
  await clickHotspot(page, "gclock"); await clickHotspot(page, "gclock"); await closeTopPopup(page);
  await page.waitForTimeout(300);
  // discover the locked study on the landing BEFORE the key exists
  await clickHotspot(page, "goup"); await waitFade(page);
  await clickHotspot(page, "gostudy"); // locked
  await page.waitForTimeout(300);
  await clickHotspot(page, "godown"); await waitFade(page);

  // kitchen
  await clickHotspot(page, "gokitchen"); await waitFade(page);
  await shot(page, "10-kitchen");
  await clickHotspot(page, "list"); await shot(page, "11-list"); await closeTopPopup(page);
  await clickHotspot(page, "fridge"); await page.waitForTimeout(250); // door opens
  await shot(page, "11b-fridge-open");
  await clickHotspot(page, "milk");  // milk only countable while open
  await clickHotspot(page, "stove"); // burner on: flame + glow
  await clickHotspot(page, "tap");   // water on
  await page.waitForTimeout(300);
  await shot(page, "11c-kitchen-toggles-on");
  await clickHotspot(page, "tap");   // water off
  await clickHotspot(page, "stove"); // flame off
  await clickHotspot(page, "fridge"); await page.waitForTimeout(250); // door closes
  await clickHotspot(page, "bread");
  await clickHotspot(page, "bowl");
  await clickHotspot(page, "drawer");
  await clickHotspot(page, "cup");

  // dining room: lore wing + arrow return
  await clickHotspot(page, "godining"); await waitFade(page);
  await shot(page, "11d-dining");
  await clickHotspot(page, "dtable");
  await clickHotspot(page, "dcake");
  await clickHotspot(page, "marks");
  await clickHotspot(page, "portrait"); await clickHotspot(page, "portrait"); await page.waitForTimeout(300);
  await shot(page, "11e-dining-portrait");
  await clickHotspot(page, "sideboard"); await page.waitForTimeout(250);
  await clickHotspot(page, "sideboard"); // everything that opens closes
  await clickHotspot(page, "smallchair");
  await clickHotspot(page, "dwin");
  await page.click("#nav-right"); await waitFade(page); // arrow back to kitchen

  await clickHotspot(page, "lockbox"); await page.waitForTimeout(300);
  await shot(page, "12-lockbox");
  // wrong code first (failure path)
  await keypadEnter(page, "1111");
  const boxCode = await page.evaluate(() => State.get().counts.code);
  await keypadEnter(page, boxCode);
  await page.waitForTimeout(400);
  await shot(page, "13-lockbox-open");
  await clickHotspot(page, "lockbox"); // take key
  await page.waitForTimeout(300);
  await clickHotspot(page, "goback"); await waitFade(page);

  // NEW WING: upstairs corridor, child room, attic (torch required)
  await clickHotspot(page, "goup"); await waitFade(page);
  await shot(page, "13b-landing");
  await clickHotspot(page, "lwin");          // wrong daylight anomaly
  await clickHotspot(page, "ahatch");        // refused: no torch yet
  await clickHotspot(page, "closet");        // opens, reveals torch
  await page.waitForTimeout(300);
  await clickHotspot(page, "torch");         // take torch
  await page.waitForTimeout(300);
  await shot(page, "13c-closet-torch");
  await clickHotspot(page, "gochild"); await waitFade(page);
  await shot(page, "13d-childroom");
  await clickHotspot(page, "cdrawings"); await shot(page, "13e-drawings"); await closeTopPopup(page);
  await clickHotspot(page, "musicbox");      // knock rhythm hint
  await clickHotspot(page, "blocks");
  await clickHotspot(page, "bed");
  await clickHotspot(page, "cbooks");        // completes the fake realization set
  await page.waitForTimeout(400);
  await clickHotspot(page, "cback"); await waitFade(page);
  await clickHotspot(page, "ahatch"); await waitFade(page); // now with torch
  await shot(page, "13f-attic-dark");
  await clickHotspot(page, "tally");
  await clickHotspot(page, "fifthchair");
  await clickHotspot(page, "trunk"); await page.waitForTimeout(300);
  await shot(page, "13g-attic-photo"); await closeTopPopup(page);
  await clickHotspot(page, "aback"); await waitFade(page);

  // THE BACK LANDING: the left arrow, and the two doors that make no sense
  await page.click("#nav-left"); await waitFade(page);
  await shot(page, "13h-gallery");
  await clickHotspot(page, "gphoto");
  await clickHotspot(page, "gwin");
  await clickHotspot(page, "gcons"); await waitFade(page);
  await shot(page, "13i-conservatory");
  await clickHotspot(page, "gramophone"); await page.waitForTimeout(300);
  await shot(page, "13i2-gramophone"); await closeTopPopup(page);
  await page.click("#nav-left"); await waitFade(page);   // back to the gallery
  await clickHotspot(page, "gbath"); await waitFade(page);
  await shot(page, "13j-bathroom");
  await clickHotspot(page, "bbath"); await page.waitForTimeout(300);
  await shot(page, "13j2-bath-warm"); await closeTopPopup(page);
  await clickHotspot(page, "bwin"); await page.waitForTimeout(300);
  await closeTopPopup(page);
  await page.click("#nav-left"); await waitFade(page);   // bback: the gallery again
  await page.click("#nav-right"); await waitFade(page);  // gback: the corridor again

  // study: unlocked from the landing, where its door actually is
  await clickHotspot(page, "gostudy"); await page.waitForTimeout(400); // unlock
  await clickHotspot(page, "gostudy"); await waitFade(page);
  await shot(page, "14-study");
  await clickHotspot(page, "photoA"); await closeTopPopup(page);
  await clickHotspot(page, "photoB"); await closeTopPopup(page);
  await clickHotspot(page, "photoC"); await closeTopPopup(page);
  await clickHotspot(page, "tape"); await shot(page, "15-tape"); await closeTopPopup(page);
  await clickHotspot(page, "oldphoto"); await closeTopPopup(page);
  await clickHotspot(page, "notebook"); await page.waitForTimeout(300);
  await shot(page, "16-dial");
  // set dials: sun(0), star(1), moon(2) — press down arrows
  await page.click('button[data-d="1"][data-dir="1"]');
  await page.click('button[data-d="2"][data-dir="1"]'); await page.click('button[data-d="2"][data-dir="1"]');
  await page.click("#tryOpen"); await page.waitForTimeout(400);
  await shot(page, "17-notebook-open"); await closeTopPopup(page);
  await page.waitForTimeout(600);

  // THE SATCHEL QUEST: forced note storage -> the house eats it -> pen -> paper -> rewrite
  await clickHotspot(page, "satchel"); await page.waitForTimeout(400);
  await shot(page, "17b-loose-page"); await closeTopPopup(page);
  await clickHotspot(page, "sback"); await waitFade(page);   // transition 1
  await clickHotspot(page, "godown"); await waitFade(page);  // transition 2: page eaten
  await page.waitForTimeout(500);
  await page.click("#bag-btn"); await page.waitForTimeout(400);
  await shot(page, "17c-satchel-stain"); await closeTopPopup(page);
  // pen from the dining sideboard
  await clickHotspot(page, "gokitchen"); await waitFade(page);
  await clickHotspot(page, "godining"); await waitFade(page);
  await clickHotspot(page, "sideboard"); await page.waitForTimeout(300);
  await shot(page, "17d-pen-drawer");
  await clickHotspot(page, "pen"); await page.waitForTimeout(250);
  await clickHotspot(page, "sideboard"); // close it again
  await page.click("#nav-right"); await waitFade(page);      // arrow to kitchen
  await clickHotspot(page, "goback"); await waitFade(page);
  // paper from the child's room drawing stack
  await clickHotspot(page, "goup"); await waitFade(page);
  await clickHotspot(page, "gochild"); await waitFade(page);
  await clickHotspot(page, "cdrawings"); await page.waitForTimeout(300);
  await clickHotspot(page, "cback"); await waitFade(page);
  await clickHotspot(page, "godown"); await waitFade(page);
  // rewrite from memory inside the satchel view
  await page.click("#bag-btn"); await page.waitForTimeout(400);
  await page.click("#rewriteBtn"); await page.waitForTimeout(500);
  await shot(page, "17e-rewritten"); await closeTopPopup(page);

  await shot(page, "18-hallway-act2");

  // the mirror's one way ledger: look, look, crack, shatter
  await clickHotspot(page, "mirror"); await clickHotspot(page, "mirror");
  await clickHotspot(page, "mirror"); await page.waitForTimeout(300); // cracks
  await shot(page, "18b-mirror-cracked");
  await clickHotspot(page, "mirror"); await page.waitForTimeout(300); // opens
  await shot(page, "18c-mirror-open");

  // the house repairs the glass, but only while the player is elsewhere
  const mcad = await page.evaluate(() => MirrorReturn.cadence);
  if (mcad !== 17000) errors.push("MirrorReturn cadence wrong: " + mcad);
  const inHall = await page.evaluate(() => MirrorReturn.attempt());
  if (inHall) errors.push("MirrorReturn: returned while the player was still in the hallway");
  await clickHotspot(page, "gokitchen"); await waitFade(page); // leave the hallway
  const cameBack = await page.evaluate(() => MirrorReturn.attempt());
  if (!cameBack) errors.push("MirrorReturn: did not return while the player was away");
  const mflags = await page.evaluate(() => ({
    shattered: State.flag("mirrorShattered"), cracked: State.flag("mirrorCracked"), returned: State.flag("mirrorReturned"),
  }));
  if (!mflags.returned || !mflags.cracked || mflags.shattered) errors.push("MirrorReturn flags wrong: " + JSON.stringify(mflags));
  await clickHotspot(page, "goback"); await waitFade(page); // come back: the surprise fires
  await page.waitForTimeout(500);
  await shot(page, "18d-mirror-returned");

  // basement
  await clickHotspot(page, "udoor"); await waitFade(page);
  await shot(page, "19-basement-dark");
  await clickHotspot(page, "breaker"); await waitFade(page);
  await shot(page, "20-basement-on");
  await clickHotspot(page, "mon2"); await shot(page, "21-cam3"); await closeTopPopup(page);
  await clickHotspot(page, "mon5"); await closeTopPopup(page);
  await clickHotspot(page, "keypad"); await page.waitForTimeout(300);
  await keypadEnter(page, "817");
  await page.waitForTimeout(300);
  await clickHotspot(page, "mdoor"); await page.waitForTimeout(300);
  await shot(page, "22-knock");
  await page.click('.knock-btn[data-t="short"]');
  await page.click('.knock-btn[data-t="short"]');
  await page.click('.knock-btn[data-t="long"]');
  await page.waitForTimeout(1000); await waitFade(page);
  await shot(page, "23-memory");

  // memory + secret check + ending
  await clickHotspot(page, "figure");
  await clickHotspot(page, "machine"); await page.waitForTimeout(300);
  await shot(page, "24-choice");
  await page.click(".popup-foot .btn.primary"); // remember
  await page.waitForTimeout(900);
  await shot(page, "25-ending");

  // mobile viewport spot-check
  const mp = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await mp.goto(URL); await mp.waitForTimeout(700);
  await mp.screenshot({ path: path.join(OUT, "26-mobile-menu.png") });
  console.log("shot: 26-mobile-menu");

  console.log("\n--- errors captured:", errors.length);
  errors.slice(0, 20).forEach(e => console.log(e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error("HARNESS FAIL:", e.message); process.exit(2); });
