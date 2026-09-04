/* HOUSE 17 — puzzles + room actions. All puzzle state is real state (flags), never just animation. */
"use strict";

/* ---------------- close-up puzzle popups ---------------- */
const Puzzles = (() => {

  /* generic keypad */
  function keypad({ title, prompt, code, onSolve, maxLen }) {
    maxLen = maxLen || code.length;
    let entry = "";
    const el = document.createElement("div");
    el.innerHTML = `
      <p class="dim" style="text-align:center;margin-bottom:10px">${prompt}</p>
      <div class="kdisplay" id="kd">&nbsp;</div>
      <div class="keypad">
        ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="kbtn" data-k="${n}">${n}</button>`).join("")}
        <button class="kbtn" data-k="C">C</button>
        <button class="kbtn" data-k="0">0</button>
        <button class="kbtn" data-k="OK">✓</button>
      </div>`;
    const kd = () => el.querySelector("#kd");
    const paint = () => { kd().textContent = entry.length ? entry : "\u00A0"; kd().classList.remove("err", "ok"); };
    el.querySelectorAll(".kbtn").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.k;
      AudioM.click();
      if (k === "C") { entry = ""; paint(); return; }
      if (k === "OK") {
        if (entry === code) {
          kd().classList.add("ok"); AudioM.unlock();
          setTimeout(() => { Popups.close(handle); onSolve(); }, 450);
        } else {
          kd().classList.add("err"); AudioM.error();
          entry = ""; // reset immediately; red display clears on next input
          Dialogue.say(Dialogue.pick("kp_fail", [
            "Nothing. The mechanism doesn't even hesitate.",
            "Wrong. The house seems almost disappointed.",
            "No. But the numbers are in this house somewhere. I am sure of that.",
            "Not that. Guessing feels rude in here.",
          ]));
          setTimeout(() => paint(), 550);
        }
        return;
      }
      if (entry.length < maxLen) { entry += k; kd().classList.remove("err", "ok"); kd().textContent = entry; }
    }));
    const handle = Popups.open({ title, bodyEl: el });
    return handle;
  }

  /* symbol dial lock for the notebook */
  const SYMBOLS = {
    sun:  `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="8" fill="#c9a35f"/>${[...Array(8)].map((_,i)=>`<line x1="${20+Math.cos(i*Math.PI/4)*12}" y1="${20+Math.sin(i*Math.PI/4)*12}" x2="${20+Math.cos(i*Math.PI/4)*17}" y2="${20+Math.sin(i*Math.PI/4)*17}" stroke="#c9a35f" stroke-width="2.6"/>`).join("")}</svg>`,
    star: `<svg viewBox="0 0 40 40"><path d="M20,4 L24,15 L36,15 L26,22 L30,34 L20,26 L10,34 L14,22 L4,15 L16,15 Z" fill="#c9a35f"/></svg>`,
    moon: `<svg viewBox="0 0 40 40"><path d="M27,4 A15,15 0 1,0 27,36 A12,12 0 1,1 27,4 Z" fill="#c9a35f"/></svg>`,
  };
  const ORDER = ["sun", "star", "moon"];

  function notebookDial() {
    const idx = [0, 0, 0];
    const el = document.createElement("div");
    el.innerHTML = `
      <p class="dim" style="text-align:center">Three brass dials. Beneath them, engraved in tiny letters:</p>
      <p style="text-align:center;font-style:italic;margin-top:4px">“as the evening passed”</p>
      <div class="dials">
        ${[0,1,2].map(i => `
          <div class="dial">
            <button data-d="${i}" data-dir="-1">▲</button>
            <div class="face" id="face${i}">${SYMBOLS[ORDER[0]]}</div>
            <button data-d="${i}" data-dir="1">▼</button>
          </div>`).join("")}
      </div>
      <div style="text-align:center;margin-top:10px"><button class="btn small primary" id="tryOpen">Try the clasp</button></div>`;
    el.querySelectorAll("button[data-d]").forEach(b => b.addEventListener("click", () => {
      const d = +b.dataset.d, dir = +b.dataset.dir;
      idx[d] = (idx[d] + dir + 3) % 3;
      const face = el.querySelector("#face" + d);
      face.innerHTML = SYMBOLS[ORDER[idx[d]]];
      face.style.transform = "scale(1.12)";
      setTimeout(() => face.style.transform = "", 130);
      AudioM.click();
    }));
    el.querySelector("#tryOpen").addEventListener("click", () => {
      const chosen = idx.map(i => ORDER[i]);
      if (chosen.join() === PUZZLE_CONFIG.notebook.order.join()) {
        AudioM.unlock();
        Popups.close(handle);
        Game.notebookOpened();
      } else {
        AudioM.error();
        Dialogue.say(Dialogue.pick("nb_fail", [
          "The clasp holds. The symbols must mean something to this family.",
          "No. Three symbols… I've seen symbols like these somewhere in this room.",
          "Still locked. “As the evening passed.” Evenings are measured in what, exactly?",
          "The clasp doesn't move. The photographs above the desk keep drawing my eye.",
        ]));
      }
    });
    const handle = Popups.open({ title: "THE RED NOTEBOOK", bodyEl: el });
  }

  /* knock pattern door */
  function knockDoor() {
    let seq = [];
    const el = document.createElement("div");
    el.innerHTML = `
      <p class="dim" style="text-align:center">A brass knocker on a steel door. Someone has scratched beside it:<br><em style="color:#d8c9a8">“knock like he did”</em></p>
      <div class="knock-seq" id="kseq"></div>
      <div class="knock-row">
        <button class="knock-btn" data-t="short">KNOCK</button>
        <button class="knock-btn" data-t="long">KNOOOCK</button>
      </div>
      <p class="small-note" style="text-align:center">Three knocks make an attempt.</p>`;
    const paint = () => {
      el.querySelector("#kseq").innerHTML = seq.map(t => t === "short" ? "<span>●</span>" : "<span>━</span>").join("");
    };
    el.querySelectorAll(".knock-btn").forEach(b => b.addEventListener("click", () => {
      const t = b.dataset.t;
      if (t === "short") AudioM.knockShort(); else AudioM.knockLong();
      seq.push(t); paint();
      if (seq.length === 3) {
        setTimeout(() => {
          if (seq.join() === PUZZLE_CONFIG.knock.pattern.join()) {
            AudioM.unlock();
            Popups.close(handle);
            Game.finalDoorOpened();
          } else {
            AudioM.error();
            seq = []; paint();
            Dialogue.say(Dialogue.pick("knock_fail", [
              "Silence. That wasn't the rhythm.",
              "Nothing. The tape upstairs knew the rhythm. Two of one kind, one of the other.",
              "The door ignores me. On the tape it went: quick, quick… slow.",
              "No. I should knock the way the recording ended.",
            ]));
          }
        }, 350);
      }
    }));
    const handle = Popups.open({ title: "THE SEALED DOOR", bodyEl: el });
  }

  /* paper / photo viewers */
  function paperPopup(title, html) {
    Popups.open({ title, bodyHTML: html });
  }

  return { keypad, notebookDial, knockDoor, paperPopup };
})();

/* =====================================================================
   HOUSE TRICKS: the house acts on rooms as the player enters them.
   Small tamperings escalate in count (one, three, four... seventeen),
   a false copy of the kitchen can appear, and one room can be deleted
   from the architecture and knocked back into existence.
   All randomness is disabled when window.__QA__ is set.
===================================================================== */
const HouseTricks = (() => {
  let falseTimer = null;
  const QA = () => (typeof window !== "undefined" && !!window.__QA__);

  function trickLine(what, tc) {
    const countLine =
      tc === 1 ? "That is the first time this house has done something while I watched. I am counting now."
      : tc === 17 ? "Seventeen. Seventeen times it has moved something the moment I walked in. It was counting too. Of course it was counting."
      : tc < 5 ? `That is ${numword(tc)} times now. I am keeping count.`
      : tc < 10 ? `${capword(tc)} times. It is not hiding anymore.`
      : `${capword(tc)}. The number is climbing toward something.`;
    Dialogue.say([what, countLine]);
  }

  function tamper(room) {
    const tc = (State.flag("trickCount") || 0) + 1;
    if (room === "kitchen" && !State.flag("tapOn")) {
      State.setFlag("tapOn", true); State.setFlag("tapThin", false);
      armTapTimers(); AudioM.tapSqueak(); Rooms.render();
      State.setFlag("trickCount", tc); State.addAware(2);
      trickLine("The tap is running. It was off when I left this room. I have not touched it.", tc);
      return true;
    }
    if (room === "kitchen" && !State.flag("fridgeOpen")) {
      State.setFlag("fridgeOpen", true); AudioM.open(); Rooms.render();
      State.setFlag("trickCount", tc); State.addAware(2);
      trickLine("The fridge is standing open. The light is on and the cold is pouring out like it was waiting for me.", tc);
      return true;
    }
    if (room === "landing" && !State.flag("closetOpen")) {
      State.setFlag("closetOpen", true); AudioM.creakDoor(); Rooms.render();
      State.setFlag("trickCount", tc); State.addAware(2);
      trickLine("The linen closet is open. I closed that door. I remember the click.", tc);
      return true;
    }
    if (room === "hallway" && State.flag("hallLampOn") !== false) {
      State.setFlag("hallLampOn", false); AudioM.flicker(); Rooms.render();
      State.setFlag("trickCount", tc); State.addAware(2);
      trickLine("The lamp went out the second I stepped in. Not a flicker. A choice.", tc);
      return true;
    }
    if (room === "diningroom" && !State.flag("roomDeleted_child") && !State.flag("smallChairMoved")) {
      State.setFlag("smallChairMoved", true); AudioM.creakDoor(); Rooms.render();
      State.setFlag("trickCount", tc); State.addAware(2);
      trickLine("The small chair is at the head of the table now. It was at the side, at the setting with no plate. Nothing else has moved.", tc);
      return true;
    }
    if (room === "childroom") {
      AudioM.whisperTone();
      State.setFlag("trickCount", tc); State.addAware(2);
      trickLine("The music box turned, once. A single note, then it thought better of it.", tc);
      return true;
    }
    return false;
  }

  function startFalseKitchen() {
    State.setFlag("falseKitchen", true);
    State.setFlag("lastFalseK", Date.now());
    State.addAware(2);
    Rooms.render();
    AudioM.riser(11);
    Dialogue.say([
      "Something is wrong in here. The moon has gone from the window, and the clock has changed its mind about the time.",
      "There is a third chair at the table. This is not my kitchen. It is a copy, and not a careful one.",
    ]);
    clearTimeout(falseTimer);
    falseTimer = setTimeout(() => {
      if (!State.flag("falseKitchen")) return;
      State.setFlag("falseKitchen", false);
      State.addAware(5);
      AudioM.dread();
      Rooms.goto("hallway", [
        "The room came apart at the corners, quietly, like a set being struck.",
        "I am in the hallway. My heart is somewhere back in that copy of a kitchen.",
        "I have to look before I trust a room now. The clock. The window. The chairs.",
      ]);
    }, 12000);
  }

  function onEnter(room) {
    /* the satchel is the house's pocket: paper stored in it gets eaten */
    if (State.flag("pageInBag")) {
      const n = (State.flag("bagRooms") || 0) + 1;
      State.setFlag("bagRooms", n);
      if (n >= 2) {
        State.setFlag("pageInBag", false);
        State.bagTake("notePage");
        State.setFlag("pageEaten", true);
        State.setFlag("prevObj", State.get().objective);
        State.setObjective("page_gone");
        AudioM.whisperTone();
        State.addAware(3);
        Dialogue.say([
          "The satchel just got lighter. By exactly one page.",
          "I did not open it. Nothing fell out. The weight simply left, between one room and the next.",
          "Never let it hold the paper. The page told me that, and I posted it straight into the house's own pocket.",
          "I read it. I still have the words. I need a pen, and something blank to put them on.",
        ]);
        return;
      }
    }
    /* leaving a false kitchen early is the correct move */
    if (room !== "kitchen" && State.flag("falseKitchen")) {
      clearTimeout(falseTimer);
      State.setFlag("falseKitchen", false);
    }
    /* the house shut the tap off while the player was elsewhere */
    if (room === "kitchen" && State.flag("tapAutoOffPending")) {
      State.setFlag("tapAutoOffPending", false);
      State.addAware(3);
      Dialogue.say([
        "The tap is off. I left it running. The basin is drained and the steel is wiped almost dry.",
        "The house did not want the water running. I keep thinking about how gently it must have turned the handle.",
      ]);
      return;
    }
    /* the house shut the closet while the player was elsewhere */
    if (room === "landing" && State.flag("closetAutoClosed")) {
      State.setFlag("closetAutoClosed", false);
      State.addAware(2);
      Dialogue.say([
        "The linen closet is shut. I left it open. The house closed it while I was gone, like a host straightening a room I should not have been in.",
      ]);
      return;
    }
    /* the child's room can be unwritten from the corridor */
    if (room === "landing" && State.flag("act2") && State.flag("visitedChild")
        && !State.flag("roomDeleted_child") && !State.flag("childRestored") && !QA()) {
      const n = (State.flag("landingAct2") || 0) + 1;
      State.setFlag("landingAct2", n);
      if (n === 1) {
        AudioM.whisperTone();
        Dialogue.say([
          "The crayon marks on the small door have changed. There is a new drawing. A house, with one room scratched out in heavy black lines.",
          "The scratched room has a window and a small bed. I know which room that is. It was not crossed out before.",
        ]);
        State.addAware(2);
        return;
      }
      if (n >= 2) {
        State.setFlag("roomDeleted_child", true);
        AudioM.dread();
        Rooms.render();
        State.addAware(6);
        Dialogue.say([
          "The door is gone.",
          "Not locked. Not boarded. Gone. There is wallpaper where the child's door stood, and the wallpaper is old, faded, as if it had always been there.",
          "The faint outline of a frame is still pressed into the wall. The house is a bad liar in exactly one way.",
        ]);
        return;
      }
    }
    /* a false kitchen may be waiting */
    if (room === "kitchen" && State.flag("act2") && !State.flag("falseKitchen") && !QA()) {
      const last = State.flag("lastFalseK") || 0;
      if (Date.now() - last > 180000 && Math.random() < 0.18) {
        startFalseKitchen();
        return;
      }
    }
    /* small tamperings, more often as the house grows aware */
    if (State.flag("act2") && !QA()) {
      const p = Math.min(0.35, 0.08 + State.aware() / 150);
      if (Math.random() < p) tamper(room);
    }
  }

  return { onEnter };
})();

/* ---------------- room hotspot actions ---------------- */
/* ---------- shared horror helpers ---------- */
let tapT0 = null, tapT1 = null, tapT2 = null, tapT3 = null, atticT1 = null, atticT2 = null, closetT = null;

const NUMWORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
function numword(n) { return NUMWORDS[n] || String(n); }
function capword(n) { const w = numword(n); return w.charAt(0).toUpperCase() + w.slice(1); }

function armTapTimers() {
  clearTimeout(tapT0); clearTimeout(tapT1); clearTimeout(tapT2); clearTimeout(tapT3);
  tapT0 = setTimeout(() => {
    if (!State.flag("tapOn")) return;
    State.setFlag("tapThin", true);
    if (State.get().room === "kitchen") {
      Rooms.render();
      Dialogue.say(Dialogue.pick("tapthin", [
        "The stream has gone thin. The pressure is falling away, like a hand is slowly pinching the pipe shut somewhere inside the wall.",
        "The water is thinner now. It was a proper stream a minute ago. Pipes do not change their mind.",
      ]));
    }
  }, 20000);
  tapT1 = setTimeout(() => {
    if (!State.flag("tapOn")) return;
    State.setFlag("tapOverflow");
    State.setFlag("tapThin", false);
    State.addAware(3);
    if (State.get().room === "kitchen") {
      Rooms.render();
      Dialogue.say(Dialogue.pick("overflow", [
        "The sink is full. The water keeps coming. It is not draining anymore.",
        "The basin brims over the edge in a thin, patient sheet.",
      ]));
    }
  }, 38000);
  tapT2 = setTimeout(() => {
    if (!State.flag("tapOn")) return;
    State.setFlag("wetFloor");
    State.addAware(4);
    if (State.get().room === "kitchen") {
      Rooms.render();
      Dialogue.say([
        "Water on the floor now, spreading in a slow dark tongue.",
        "There is a reflection in it. The ceiling has no one on it.",
      ]);
    }
  }, 68000);
  tapT3 = setTimeout(() => {
    if (!State.flag("tapOn")) return;
    State.setFlag("tapOn", false);
    State.setFlag("tapThin", false);
    State.setFlag("tapOverflow", false);
    State.addAware(6);
    const tc = (State.flag("trickCount") || 0) + 1;
    State.setFlag("trickCount", tc);
    if (State.get().room === "kitchen") {
      AudioM.tapSqueak();
      AudioM.dread();
      Rooms.render();
      Dialogue.say([
        "The handle just moved. On its own. Gently, the way you turn a tap so it does not squeal, and the water died to nothing.",
        "I was standing right here. The house heard the leak and the house turned it off.",
        "It is tidying up around me. Like I am the mess.",
      ]);
    } else {
      State.setFlag("tapAutoOffPending", true);
    }
  }, 95000);
}
function disarmTapTimers() { clearTimeout(tapT0); clearTimeout(tapT1); clearTimeout(tapT2); clearTimeout(tapT3); }

/* the house is live: leave the linen closet open and it will quietly shut it */
function armClosetTimer() {
  clearTimeout(closetT);
  closetT = setTimeout(() => {
    if (!State.flag("closetOpen")) return;
    State.setFlag("closetOpen", false);
    State.setFlag("closetAutoClosed", true);
    State.addAware(2);
    if (State.get().room === "landing") {
      State.setFlag("closetAutoClosed", false);
      try { AudioM.creakDoor(); } catch (e) {}
      Rooms.render();
      Dialogue.say([
        "The closet door just closed by itself. Gently. With a click I felt in my teeth.",
        "I left it open. The house does not like its cupboards left ajar. Noted. Deeply noted.",
      ]);
    }
  }, 45000);
}
function disarmClosetTimer() { clearTimeout(closetT); }

function stopAtticTimers() { clearTimeout(atticT1); clearTimeout(atticT2); }
function startAtticTimers() {
  stopAtticTimers();
  atticT1 = setTimeout(() => {
    if (State.get().room !== "attic" || State.flag("atticTruth")) return;
    AudioM.flicker();
    Dialogue.say("The torch stutters. It does not like this room. I should be quick.");
  }, 55000);
  atticT2 = setTimeout(() => {
    if (State.get().room !== "attic" || State.flag("atticTruth")) return;
    AudioM.dread();
    State.addAware(8);
    Rooms.goto("landing", [
      "The torch died for four full seconds.",
      "When it came back I was on the corridor floor, facing the stairs. I did not climb down.",
    ]);
  }, 80000);
}

/* the house notices the player noticing seventeen */
function seventeenSense() {
  const n = State.bumpClick("seventeen");
  if (n === 7) { AudioM.whisperTone(); Dialogue.say(['From somewhere below, in no voice at all: "You keep looking for seventeen."']); State.addAware(6); }
  else if (n === 12) { AudioM.whisperTone(); Dialogue.say(['"You taught me to count."']); State.addAware(6); }
}

/* the child room realization: signs of a life, no evidence of a person */
function maybeFakeRealization() {
  if (State.flag("fakeReal")) return;
  if (State.flag("sawCBed") && State.flag("sawCBooks") && State.flag("sawCDrawings")) {
    State.setFlag("fakeReal");
    State.addAware(8);
    AudioM.dread();
    Dialogue.say([
      "Wait. A made bed nobody slept in. Books nobody opened. Drawings with no fingerprints.",
      "This has to be fake. It is a set dressed for a childhood.",
      "There are signs of someone living here everywhere, and no evidence that person ever existed.",
    ]);
  }
}

const RoomActions = {

  /* ============ PORCH ============ */
  porch: {
    note() {
      Puzzles.paperPopup("A NOTE, HANDWRITTEN", `
        <p style="font-style:italic;font-size:17px;line-height:2">
        “Study. Red notebook. <u>Nothing else.</u><br>
        Don't stay after dark. Don't answer anything.<br>
        The key is where the light doesn't reach.<br>
        M.”</p>
        <p class="small-note">The paper is new. The handwriting is shaking.</p>`);
      if (State.get().objective === "find_key") { /* stays */ }
    },
    door() {
      if (State.hasItem("houseKey")) {
        State.setFlag("entered");
        State.removeItem("houseKey");
        AudioM.creakDoor();
        State.setObjective("find_study");
        State.setCheckpoint("Inside House 17. The house has begun its evening.");
        Rooms.goto("hallway", [
          "The door opens before I finish turning the key. As if it was pulled.",
          "Eleven years empty. Then why is there no dust in the air?",
        ]);
      } else {
        Dialogue.say(Dialogue.pick("porch_door", [
          "Locked. The note said the key is “where the light doesn't reach.”",
          "Still locked. The porch light only reaches so far…",
          "I could force it. I won't. Something about this house rewards politeness.",
          "Locked. The light falls on two of the flowerpots. Not the third.",
        ]));
      }
    },
    pot0() {
      Dialogue.say(Dialogue.pick("pot0", [
        "The soil is warm from the lamp. Nothing underneath.",
        "Just a pot in the light. The note said the key hides from light.",
        "Nothing. This pot has been sitting in the lamplight all night.",
      ]));
    },
    pot1() {
      Dialogue.say(Dialogue.pick("pot1", [
        "Warm soil, dead plant, no key.",
        "Nothing under this one either. It sits right in the lamp's circle.",
        "The lamplight touches this pot all night long. Not here.",
      ]));
    },
    pot2() {
      if (State.hasItem("houseKey") || State.flag("entered")) {
        Dialogue.say("Just the pot, tipped where I left it.");
        return;
      }
      State.addItem("houseKey");
      AudioM.pickup();
      State.setCheckpoint("The house key. Cold. The door has one use in mind.");
      Dialogue.say([
        "This pot sits in the dark, out of the lamp's reach. And underneath…",
        "A house key. Cold. Colder than the night is.",
      ]);
      Rooms.render();
    },
    mat() {
      if (State.foundSecret("drawing")) {
        AudioM.discover();
        toast("Discovery · A child's drawing");
        Puzzles.paperPopup("UNDER THE DOORMAT", `
          <p>A child's drawing, folded eight times. A house with a big <b>17</b> on it. Five stick figures stand in front of it.</p>
          <p>Four hold hands. The fifth stands apart, drawn smaller, near the edge of the paper.</p>
          <p class="dim" style="margin-top:8px">Under the fifth figure, in pencil: <em>“the visitor”</em>.</p>`);
      } else {
        Dialogue.say("Just the drawing's empty hiding place now.");
      }
    },
    plight() {
      Dialogue.say(Dialogue.pick("plight", [
        "The porch light hums. It draws a neat circle of light, and leaves the rest alone.",
        "Moths should be circling it. There are no moths.",
        "It flickers, but never fully dies. Like it's making a point.",
      ]));
    },
    plate() {
      Dialogue.say(Dialogue.pick("plate", [
        "Seventeen. The brass is polished. Someone still cares about this one detail.",
        "House 17. The other houses on this street don't have numbers at all. I just noticed that.",
      ]));
    },
    win() {
      Dialogue.say(Dialogue.pick("porchwin", [
        "A faint light upstairs. It could be a reflection. It could be.",
        "The upstairs window glows, very slightly. The house is supposed to be empty.",
        "The light in that window just moved. Or I blinked. One of the two.",
      ]));
    },
  },

  /* ============ HALLWAY ============ */
  hallway: {
    gokitchen() { Rooms.goto("kitchen", State.flag("visitedKitchen") ? null : ["The kitchen. Someone was interrupted here. Years ago, or minutes ago."]); State.setFlag("visitedKitchen"); if (State.flag("tapOn")) armTapTimers(); },
    photo() {
      if (State.flag("act2")) {
        Puzzles.paperPopup("THE FAMILY PHOTOGRAPH", `
          <p>Four people: parents, a boy, a little girl. In front of this very staircase.</p>
          <p style="color:#a5503c">And now a fifth. Standing at the left edge. Blurred, as if it moved during the exposure.</p>
          <p class="dim">There were four people in this photograph when I arrived. I counted. I know I counted.</p>`);
        Dialogue.say(Dialogue.pick("photo2", [
          "Five. There are five people in it now.",
          "The fifth figure is a little clearer than the last time I looked.",
          "I could take it off the wall. I could turn it around. I'm not going to.",
        ]));
      } else {
        Puzzles.paperPopup("THE FAMILY PHOTOGRAPH", `
          <p>Four people in front of this staircase. Parents, a boy of maybe twelve, a little girl.</p>
          <p>They are smiling. The little girl is looking away from the lens, at something to the photographer's left.</p>
          <p class="dim">The frame is the only thing in this hallway without dust.</p>`);
      }
    },
    gclock() {
      seventeenSense();
      const n = State.bumpClick("gclock");
      if (n >= 2 && State.foundSecret("gclock")) {
        AudioM.discover();
        toast("Discovery · An engraving");
        Puzzles.paperPopup("THE GRANDFATHER CLOCK", `
          <p>Stopped at <b>8:17</b>. But the pendulum is still swinging, patient as breathing.</p>
          <p>The hands do not move. The pendulum does. One of them is lying.</p>
          <p>Inside the case, an engraving in the wood:</p>
          <p style="font-style:italic;text-align:center;margin-top:6px">“for the evenings we keep”</p>`);
      } else {
        Dialogue.say(Dialogue.pick("gclock_d", [
          "Stopped at 8:17. Not broken, stopped. There's a difference, and this clock knows it.",
          "The pendulum swings. The hands don't move. What exactly is it keeping time for?",
          "8:17. I have a feeling I'll be seeing that time again.",
          "Tick. Tick. The sound is right. The time never changes. The mechanism is a heartbeat, not a clock.",
        ]));
      }
    },
    mirror() {
      if (typeof Mirror !== "undefined" && Mirror.tap) { Mirror.tap(); return; }
      Dialogue.say("The mirror is dark. It keeps whatever it reflects.");
    },
    udoor() {
      if (State.flag("act2")) {
        if (State.hasItem("ironKey")) {
          State.removeItem("ironKey");
          State.setFlag("basementUnlocked");
          AudioM.creakDoor();
          State.setObjective("basement");
          Rooms.goto("basement", [
            "The iron key turns three times. Three separate locks, one keyhole, flat in the floor.",
            "The hatch swings up on its own weight. Stairs, going down. The air coming up is warm. Basements aren't warm.",
          ]);
        } else if (State.flag("basementUnlocked")) {
          Rooms.goto("basement");
        } else {
          Dialogue.say("The hatch has a keyhole now. It definitely didn't have one before.");
        }
      } else {
        Dialogue.say(Dialogue.pick("udoor1", [
          "A rectangle in the floorboards near the stairs. Hinges on one side, a ring on the other. No keyhole.",
          "A hatch, lying flat in the floor. I pull the ring. It holds like it's nailed from underneath.",
          "The boards around it are worn pale. People stepped around this hatch for years. Never on it.",
        ]));
      }
    },
    goup() {
      const first = !State.flag("visitedUp");
      State.setFlag("visitedUp");
      Rooms.goto("landing", first ? [
        "The stairs complain in order, like keys on an instrument.",
        "An upstairs corridor. More house than the outside of the house has room for.",
      ] : null);
    },
    rack() {
      Dialogue.say(Dialogue.pick("rack", [
        "One coat, left behind. A child's size.",
        "The coat is dry. It rained this evening. Fine. It's been inside for eleven years. Obviously.",
        "There are four hooks and one coat. The other three hooks are worn shiny.",
      ]));
    },
    leave() {
      if (State.flag("act2")) {
        Dialogue.say(Dialogue.pick("leave2", [
          "I could leave right now. But I'd be leaving with the wrong half of the story.",
          "The front door is right there. The rest of me is already down those basement stairs.",
          "Not yet. It knows my face now. Better to finish this.",
        ]));
      } else {
        Dialogue.say(Dialogue.pick("leave1", [
          "One notebook. Then I never see this street again. That was the deal I made with myself.",
          "Leave without the notebook? M. paid in advance. And M. sounded scared.",
          "Not without the notebook.",
        ]));
      }
    },
    hlamp() {
      const on = State.flag("hallLampOn") !== false;
      if (on) {
        State.setFlag("hallLampOn", false);
        AudioM.close();
        Dialogue.say(Dialogue.pick("hlampOff", [
          "Click. The hallway leans into shadow. I am not sure the dark here is empty.",
          "Off. The house does not seem to mind. That bothers me more than it should.",
        ]));
      } else {
        State.setFlag("hallLampOn", true);
        AudioM.open();
        Dialogue.say(Dialogue.pick("hlampOn", [
          "Click. Warm light again. Someone chose this bulb to be gentle.",
          "The lamp comes back without a flicker. Steadiest thing in this house, including me.",
          "Two flies drift up to the shade the moment it warms. This hallway is so clean it makes them look like intruders.",
        ]));
      }
      Rooms.render();
    },
  },

  /* ============ KITCHEN ============ */
  kitchen: {
    goback() {
      const wasFalse = State.flag("falseKitchen");
      Rooms.goto("hallway", wasFalse ? [
        "Out. The real hallway. When I glanced back, the kitchen light was already the wrong color.",
        "I am not going back in there until it is mine again.",
      ] : null);
    },
    godining() {
      const archive = State.flag("roomDeleted_child");
      let msg = null;
      if (archive && !State.flag("sawArchive")) {
        State.setFlag("sawArchive");
        msg = [
          "The dining room is gone.",
          "The room is still here. The dining room is not. The table, the chairs, the cake, all of it, replaced by shelves of labeled boxes.",
          "The house did not delete that other room upstairs. It filed it. In here.",
        ];
      } else if (!State.flag("visitedDining")) {
        msg = [
          "A dining room. A long table laid with care, and eleven years of dust lying on the care.",
          "Five chairs. This family kept counting to five when they thought no one was watching.",
        ];
      }
      State.setFlag("visitedDining");
      Rooms.goto("diningroom", msg);
    },
    list() {
      State.setFlag("sawList");
      Puzzles.paperPopup("THE SHOPPING LIST", `
        <p style="font-size:17px;line-height:2.1;font-style:italic">
        milk<br>bread<br>apples<br>batteries</p>
        <p class="small-note">Written in the same shaking hand as the note on the door. The order is underlined. Twice.</p>`);
    },
    fridge() {
      if (!State.flag("fridgeOpen")) {
        State.setFlag("fridgeOpen");
        AudioM.open();
        Dialogue.say(Dialogue.pick("fridgeO", [
          "The door swings open. The light comes on. Cold air, and food that should be eleven years gone.",
          "Open. The fridge light works. Everything in this house works. That is the problem.",
        ]));
      } else {
        State.setFlag("fridgeOpen", false);
        AudioM.close();
        Dialogue.say(Dialogue.pick("fridgeC", [
          "I push the door shut. The hum settles.",
          "Closed. The kitchen feels a degree warmer already.",
        ]));
      }
      Rooms.render();
    },
    milk() {
      const C = State.get().counts || { milk: 3 };
      if (State.flag("act2") && State.flag("lockboxOpen")) {
        const left = C.milk - 1;
        Dialogue.say(Dialogue.pick("milk2", [
          `${capword(left)} bottles. There were ${numword(C.milk)}. The gap between them is exactly bottle shaped.`,
          `I counted ${numword(C.milk)} when counting mattered. Now that it doesn't, there are ${numword(left)}.`,
          `${capword(left)}. I am not counting again. The fridge knows what it did.`,
        ]));
        State.addAware(2);
        return;
      }
      Dialogue.say(Dialogue.pick("milk", [
        `${capword(C.milk)} bottles of milk, standing in a neat row on the shelf. Fresh. I am not smelling them to check.`,
        `${capword(C.milk)} milk bottles. ${capword(C.milk)}.`,
        `Milk, ${numword(C.milk)} bottles, cold and impossibly fresh. ${capword(C.milk)}.`,
      ]));
    },
    stove() {
      if (!State.flag("stoveOn")) {
        State.setFlag("stoveOn");
        AudioM.ignite();
        Dialogue.say(Dialogue.pick("stoveO", [
          "I turn the knob. The burner catches with a soft pop, and a ring of small flames wraps the kettle.",
          "The gas still works. A crown of little flames, steady and blue at the root. The kettle remembers its job.",
        ]));
      } else {
        State.setFlag("stoveOn", false);
        AudioM.close();
        Dialogue.say(Dialogue.pick("stoveC", [
          "Off. The flames shrink and vanish. The kettle ticks as it cools.",
          "I turn it off. The kitchen holds the warmth for a moment, then lets it go.",
        ]));
      }
      Rooms.render();
    },
    tap() {
      if (!State.flag("tapOn")) {
        State.setFlag("tapOn");
        State.setFlag("tapThin", false);
        AudioM.tapSqueak();
        armTapTimers();
        Dialogue.say(Dialogue.pick("tapO", [
          "The tap coughs once, then runs clear. Eleven empty years and the water never doubted anyone would come back.",
          "Water, cold and clean, drumming on the steel. The pipes do not even knock.",
        ]));
      } else {
        const wasOver = State.flag("tapOverflow");
        State.setFlag("tapOn", false);
        State.setFlag("tapOverflow", false);
        State.setFlag("tapThin", false);
        disarmTapTimers();
        AudioM.tapSqueak();
        Dialogue.say(wasOver
          ? ["Off. The flood sighs back down the drain, reluctantly.", State.flag("wetFloor") ? "The floor keeps its dark stain. The house is in no hurry to forget the water." : "The basin empties like nothing happened."]
          : Dialogue.pick("tapC", [
            "I shut it off. The last drops count themselves down the drain.",
            "Off. The silence afterward is a little too complete.",
          ]));
      }
      Rooms.render();
    },
    puddle() {
      Dialogue.say(Dialogue.pick("puddle", [
        "A sheet of water on the floorboards. It has not soaked in. It is just waiting.",
        "My face looks back from the water. It blinks a half second late.",
        "The puddle has not moved or dried. Water obeys different rules here.",
      ]));
      State.addAware(1);
    },
    bread() {
      const C = State.get().counts || { bread: 1 };
      Dialogue.say(C.bread === 1 ? Dialogue.pick("bread", [
        "One loaf on the board. Scored on top, never cut. One.",
        "A single loaf. It should be a fossil by now. It isn't.",
        "One loaf of bread, waiting for a dinner that never happened.",
      ]) : Dialogue.pick("bread", [
        `${capword(C.bread)} loaves on the board. Scored on top, never cut. ${capword(C.bread)}.`,
        `${capword(C.bread)} loaves. They should be fossils by now. They aren't.`,
        `${capword(C.bread)} loaves of bread, waiting for a dinner that never happened.`,
      ]));
    },
    bowl() {
      const C = State.get().counts || { apples: 4 };
      Dialogue.say(Dialogue.pick("bowl", [
        `${capword(C.apples)} apples in the bowl. Red, polished, arranged. ${capword(C.apples)}.`,
        `${capword(C.apples)} apples. Whoever left them turned every stem to face the window.`,
        `I count ${numword(C.apples)} apples. I count them again. Still ${numword(C.apples)}. Good.`,
      ]));
    },
    drawer() {
      const C = State.get().counts || { batteries: 2 };
      if (!State.flag("drawerOpen")) {
        State.setFlag("drawerOpen");
        AudioM.open();
        Dialogue.say(`The drawer slides open. ${capword(C.batteries)} batteries inside, rolling to a stop. ${capword(C.batteries)}.`);
        Rooms.render();
      } else {
        Dialogue.say(Dialogue.pick("drawer2", [
          `${capword(C.batteries)} batteries. For what? Every clock in this house stopped by choice.`,
          `Still ${numword(C.batteries)} batteries. Still no idea what they were for.`,
        ]));
      }
    },
    lockbox() {
      if (State.flag("lockboxOpen")) {
        if (!State.hasItem("studyKey") && !State.flag("studyUnlocked") && !State.flag("tookStudyKey")) {
          State.addItem("studyKey");
          State.setFlag("tookStudyKey");
          AudioM.pickup();
          Dialogue.say("The study key. Small, brass, and warm, like someone just put it down.");
          Rooms.render();
        } else {
          Dialogue.say("The lockbox sits open and empty.");
        }
        return;
      }
      if (!State.flag("sawList")) {
        Dialogue.say(Dialogue.pick("box_early", [
          "A lock with four digits, chosen by someone who lived here, and lived by lists.",
          "A steel lockbox. Four digits. The kitchen is full of things worth counting.",
        ]));
        // still allow trying
      }
      const C = State.get().counts || { milk: 3, bread: 1, apples: 4, batteries: 2, code: "3142" };
      Puzzles.keypad({
        title: "THE STEEL LOCKBOX",
        prompt: "Four digits. The dial clicks like it wants to be solved.",
        code: C.code,
        onSolve() {
          State.setFlag("lockboxOpen");
          State.setCheckpoint("The lockbox. The house knows I can count now.");
          Dialogue.say([
            `Milk, bread, apples, batteries. ${capword(C.milk)}, ${numword(C.bread)}, ${numword(C.apples)}, ${numword(C.batteries)}.`,
            "The list wasn't a list. It was the combination, hiding in plain sight for eleven years.",
          ]);
          Rooms.render();
        },
      });
    },
    kclock() {
      if (State.flag("falseKitchen")) {
        Dialogue.say([
          "The clock says a quarter past seven. Every clock in this house says 8:17. Every single one.",
          "This kitchen got the time wrong. It is not my kitchen. I should not be in here.",
        ]);
        State.addAware(2);
        return;
      }
      seventeenSense();
      Dialogue.say(Dialogue.pick("kclock", [
        "8:17. Same as the clock in the hallway. Clocks don't collude. Usually.",
        "Stopped at 8:17. I'd call it a coincidence if the hallway hadn't already used that excuse.",
        "8:17 again. The house keeps underlining it.",
      ]));
    },
    cup() {
      if (State.foundSecret("teacup")) {
        AudioM.discover();
        toast("Discovery · The teacup");
        Dialogue.say([
          "The teacup is warm.",
          "The house has been empty for eleven years, and this cup of tea is warm.",
        ]);
      } else {
        Dialogue.say(Dialogue.pick("cup2", [
          "Still warm. I keep touching it hoping it won't be.",
          "I'm leaving the tea question alone now.",
        ]));
      }
    },
    kwin() {
      if (State.flag("falseKitchen")) {
        Dialogue.say([
          "There is no moon in this window. There was a moon. I watched clouds cross it.",
          "The glass is showing a sky that belongs to some other house.",
        ]);
        State.addAware(2);
        return;
      }
      Dialogue.say(Dialogue.pick("kwin", [
        "The garden outside is overgrown. Except one path of flattened grass, from the back door to the fence.",
        "Clouds crossing the moon. For a second the reflection in the glass showed this kitchen with the lights off.",
        "Nothing out there. The window is more interested in reflecting this room than showing me the garden.",
        "A few flies are gathered by the hanging lamp, orbiting the bulb like it owes them something.",
        "This kitchen is the one room the house has not bothered to keep. Everything else is spotless. Here, the house just gave up, or got hungry.",
      ]));
    },
    chair1() {
      if (State.flag("atticTruth")) {
        Dialogue.say(Dialogue.pick("chair3", [
          "Four chairs down here. One in the attic. Five. The table was set for five.",
          "I keep recounting. Four here, one upstairs in the dark. Why do I need there to be five?",
          "I think the house wants me to remember five.",
        ]));
        return;
      }
      if (State.flag("act2")) {
        Dialogue.say(Dialogue.pick("chair2", [
          "The chair has moved. It's pulled out from the table now, angled toward the door. I didn't do that.",
          "It's positioned like someone stood up in a hurry.",
          "I pushed no chairs. The house is setting its own table.",
          "Two chairs, and the certainty that there used to be more. Where does a house keep its spare chairs?",
        ]));
      } else {
        Dialogue.say(Dialogue.pick("chair1", [
          "A kitchen chair, tucked in neatly.",
          "Two chairs for a family of four. The photograph had four people. Where are the other chairs?",
          "The seat is worn pale in the middle. Sat in a thousand times, or made to look that way.",
        ]));
      }
    },
  },

  /* ============ DINING ROOM / ARCHIVE ============ */
  diningroom: {
    dback() { Rooms.goto("kitchen", null); },
    dwin() {
      State.addAware(1);
      const n = State.bumpClick("dwin");
      Dialogue.say(n === 1 ? [
        "Gray dawn through the glass. Thin light, low mist, a morning with no intention of continuing.",
        "That makes four skies. Night at the porch. Night in the kitchen. Sunset over the stairs. And in here, a dawn that never warms.",
      ] : Dialogue.pick("dwin2", [
        "Still dawn. The mist outside has not moved. Not drifted, not thinned. A photograph of weather.",
        "Four windows, four skies. There is no outside. There are only pictures of outsides, hung where windows should be.",
        "I used to think houses kept the weather out. This one keeps its own in.",
      ]));
    },
    dtable() {
      Dialogue.say(Dialogue.pick("dtable", [
        "The table is laid for five. Four plates. The fifth place has a mat, a fork, a cup, and no plate. Set for someone who was invited but not expected to eat.",
        "Nobody has touched this table in eleven years, and nobody has cleared it either. Some dinners refuse to end.",
        "Four plates, five settings. The arithmetic of this family never comes out even.",
      ]));
    },
    dcake() {
      if (State.flag("act2")) {
        seventeenSense();
        Dialogue.say(Dialogue.pick("dcake2", [
          "Someone has pushed seventeen candles into the cake. They were not there when I first looked. None of them have ever been lit.",
          "Seventeen candles now. I counted twice. The house is decorating.",
        ]));
        State.addAware(2);
      } else {
        Dialogue.say(Dialogue.pick("dcake", [
          "A cake under a glass dome. Eleven years old and not a crumb out of place. The knife beside it was never used.",
          "A birthday cake, I think. Waiting under glass. Whose birthday never came?",
        ]));
      }
    },
    smallchair() {
      if (State.flag("smallChairMoved")) {
        Dialogue.say(Dialogue.pick("schair2", [
          "The small chair sits at the head of the table now. The place of honor. I did not move it.",
          "It was at the side, at the plateless setting. Now it faces the whole table, like a guest being celebrated.",
        ]));
        State.addAware(1);
        return;
      }
      Dialogue.say(Dialogue.pick("schair", [
        "A small chair with a cushion tied on, to boost a little guest up to table height. It does not match the other four.",
        "The cushion still holds a shallow dent. Someone small sat here, at the place with no plate.",
      ]));
    },
    portrait() {
      const n = State.bumpClick("portrait");
      if (!State.flag("portraitFlipped")) {
        if (n === 1) {
          Dialogue.say([
            "A framed picture, hung facing the wall. The hanging wire is furred with dust, except two clean prints where thumbs gripped the frame.",
            "Somebody turned this around on purpose, and then kept living in the room with it.",
          ]);
          return;
        }
        State.setFlag("portraitFlipped");
        AudioM.creakDoor();
        Rooms.render();
        Dialogue.say([
          "I turned it around.",
          "The canvas is blank. Primed, stretched, framed, hung, and blank.",
          "They commissioned a portrait and could not put anyone in it. Or they did, and the house took the likeness back.",
        ]);
        State.addAware(3);
        return;
      }
      Dialogue.say(Dialogue.pick("portrait2", [
        "Blank canvas. If I stare long enough my eyes start suggesting a shape. I stop staring.",
        "I should turn it back to the wall. They had a reason.",
      ]));
    },
    marks() {
      const n = State.bumpClick("marks");
      Dialogue.say(n === 1 ? [
        "Height marks pencilled up the doorframe. Four heights, four sets of initials, climbing year by year.",
        "And a fifth mark, lower than all of them, scratched out with something sharp.",
      ] : Dialogue.pick("marks2", [
        "The scratched mark has a date beside it. November. The year is gouged away.",
        "Four children measured with pride. One measured once, and then unmeasured.",
        "The gouge is deeper than the pencil ever was. Erasing takes more force than writing.",
      ]));
      State.addAware(1);
    },
    sideboard() {
      if (!State.flag("sbOpen")) {
        State.setFlag("sbOpen");
        AudioM.open();
        Rooms.render();
        if (State.flag("pageEaten") && !State.hasItem("pen") && !State.flag("pageRewritten")) {
          Dialogue.say([
            "The drawer slides out. Napkins, the fifth ring, and a fountain pen lying where a pen has no reason to be.",
            "The house eats words. It also leaves me a pen. It wants to see what I remember.",
          ]);
          return;
        }
        Dialogue.say(State.flag("atticTruth") && !State.flag("tookLetter")
          ? ["The drawer slides out. Folded napkins, a spare napkin ring, and an envelope that was never posted.",
             "The envelope was not in here the first time. Or I could not see it yet. With this house, both are true."]
          : Dialogue.pick("sbO", [
            "The drawer slides out. Folded napkins, pressed and ready. A fifth napkin ring, plainer than the others.",
            "Napkins for five. The set of four matches. The fifth ring is newer, bought separately, bought later.",
          ]));
      } else {
        State.setFlag("sbOpen", false);
        AudioM.close();
        Rooms.render();
        Dialogue.say(Dialogue.pick("sbC", [
          "I slide the drawer shut. It closes on a soft cushion of air, like it was built by someone careful.",
          "Closed. In this house I close things behind me now. It feels important.",
        ]));
      }
    },
    pen() {
      State.addItem("pen");
      AudioM.pickup();
      Rooms.render();
      Dialogue.say([
        "The good pen. Heavy, gold nibbed, still full of ink after eleven years.",
        "Now paper. Blank paper, in a house where every sheet is already somebody's confession.",
      ]);
    },
    letter() {
      State.setFlag("tookLetter");
      AudioM.discover();
      Rooms.render();
      Puzzles.paperPopup("A LETTER, NEVER SENT", `
        <p style="font-style:italic;line-height:2">To the house on Wren Street.</p>
        <p style="font-style:italic;line-height:2">Your boy left his coat. I am sorry. We tell ourselves it was nobody's fault, and the telling gets easier every year, and that is the part I cannot forgive.</p>
        <p style="font-style:italic;line-height:2">We still set his place at dinner. Four plates and his mat. My husband says the house remembers harder than we do. He means it kindly. He is wrong to mean it kindly.</p>
        <p style="font-style:italic;line-height:2">Do not write back. It answers.</p>
        <p class="small-note">No stamp. No address beyond the first line. It was never going anywhere. It was a confession, dressed as a letter.</p>`);
      Dialogue.say([
        "The coat on the rack downstairs. A child's size. His.",
        "Do not write back. It answers. She knew. Years before the end, the mother knew what the house was.",
      ]);
      State.addAware(3);
    },
    shelves() {
      if (State.flag("pageEaten") && !State.flag("pageRewritten") && !State.hasItem("paper") && State.flag("roomDeleted_child")) {
        if (State.hasItem("pen")) {
          State.addItem("paper");
          AudioM.pickup();
          Dialogue.say([
            "The NOV box holds the child's room in miniature. Blocks, drawings, and one blank sheet, filed like evidence.",
            "The house archived my paper supply along with everything else. I am taking a sheet back.",
          ]);
          return;
        }
        Dialogue.say("There is blank paper filed in the NOV box. It can wait until I am holding a pen.");
        return;
      }
      Dialogue.say(Dialogue.pick("shelves", [
        "Boxes with paper labels in careful adult handwriting. Years, climbing one by one along the shelf.",
        "The last box is labeled only NOV. It is the size of a room's worth of small things.",
        "The boxes are not dusty. The house dusts its archive.",
      ]));
      State.addAware(1);
    },
    mbox2() {
      Dialogue.say(Dialogue.pick("mbox2", [
        "The music box from the child's room. Filed on a shelf between the years, wound tight and waiting.",
        "It is really here. Which means the room upstairs was really there. I am keeping this fact where the house cannot reach it.",
        "If I knock the room back into the wall upstairs, I think this goes home too.",
      ]));
      State.addAware(1);
    },
    chalk() {
      Dialogue.say(Dialogue.pick("chalk", [
        "A chalk line on the floor in the shape of the table. Drawn around something that is no longer standing there.",
        "The house rearranged this room to make space for its filing. It even marked where the furniture used to live.",
      ]));
    },
  },

  /* ============ UPSTAIRS LANDING ============ */
  landing: {
    godown() { Rooms.goto("hallway"); },
    gostudy() {
      if (State.flag("studyUnlocked")) {
        Rooms.goto("study", State.flag("visitedStudy") ? null : ["The study. The air is warmer in here. Like a room that was just left."]);
        State.setFlag("visitedStudy");
      } else if (State.hasItem("studyKey")) {
        State.setFlag("studyUnlocked");
        State.removeItem("studyKey");
        if (State.get().objective === "study_locked") State.setObjective("find_study");
        AudioM.unlock();
        State.setCheckpoint("The study is open. The errand is one room away.");
        Dialogue.say("The study key fits. The lock turns like it was oiled yesterday. All that way down and back up for one small brass turn.");
        Rooms.render();
      } else {
        if (State.get().objective === "find_study") State.setObjective("study_locked");
        Dialogue.say(Dialogue.pick("sdoor_locked", [
          "Locked. Of course. The one room I was sent up here to find.",
          "The study needs a key. A family that hides its study key hides it somewhere they would remember. Somewhere they used every day.",
          "Locked tight. The kitchen looked like the most loved room in this house. If I were hiding a key, I would hide it among things I counted.",
          "Still locked. The keyhole is warm. I'm choosing not to think about that.",
        ]));
      }
    },
    chwall() {
      const n = State.bumpClick("chwall");
      if (n === 1) {
        AudioM.distantKnock();
        Dialogue.say([
          "The wall is warm where the door used to be. And from somewhere behind the wallpaper, very faint, a knock answered my hand.",
          "Knock like he did. That is what the basement door said. Maybe walls speak the same language.",
        ]);
        return;
      }
      let seq = [];
      const el = document.createElement("div");
      el.innerHTML = `
        <p class="dim" style="text-align:center">A wall where a door used to be. The outline of the frame is still pressed into the wallpaper.<br><em style="color:#d8c9a8">Something behind it is listening.</em></p>
        <div class="knock-seq" id="wseq"></div>
        <div class="knock-row">
          <button class="knock-btn" data-t="short">KNOCK</button>
          <button class="knock-btn" data-t="long">KNOOOCK</button>
        </div>
        <p class="small-note" style="text-align:center">Three knocks make an attempt.</p>`;
      const paint = () => {
        el.querySelector("#wseq").innerHTML = seq.map(t => t === "short" ? "<span>●</span>" : "<span>━</span>").join("");
      };
      el.querySelectorAll(".knock-btn").forEach(b => b.addEventListener("click", () => {
        const t = b.dataset.t;
        if (t === "short") AudioM.knockShort(); else AudioM.knockLong();
        seq.push(t); paint();
        if (seq.length === 3) {
          setTimeout(() => {
            if (seq.join() === PUZZLE_CONFIG.knock.pattern.join()) {
              AudioM.unlock();
              Popups.close(handle);
              State.setFlag("roomDeleted_child", false);
              State.setFlag("childRestored", true);
              State.addAware(4);
              Rooms.render();
              Dialogue.say([
                "The wallpaper split along a seam of light, and the seam remembered how to be a door.",
                "The crayon marks are back. Every one of them, exactly where they were. The room behind it will be exactly as I left it too. The house keeps what it steals.",
                State.flag("sawArchive") ? "And the shelves downstairs will be gone, and the long table back under its dust. The archive returns what it files. If you know how to ask." : "",
              ].filter(Boolean));
            } else {
              AudioM.error();
              seq = []; paint();
              Dialogue.say(Dialogue.pick("wall_fail", [
                "The wall soaked the knocks up. Wrong rhythm.",
                "Nothing. The rhythm from the tape. Two of one kind, one of the other.",
                "The wall waits. On the recording it went: quick, quick… slow.",
              ]));
            }
          }, 350);
        }
      }));
      const handle = Popups.open({ title: "THE WALL THAT WAS A DOOR", bodyEl: el });
    },
    gochild() {
      const first = !State.flag("visitedChild");
      State.setFlag("visitedChild");
      Rooms.goto("childroom", first ? [
        "A child's room. The door was already open a hand's width, like an invitation.",
        "It smells of nothing. Not dust, not toys, not sleep. Nothing.",
      ] : null);
    },
    closet() {
      if (!State.flag("closetOpen")) {
        State.setFlag("closetOpen");
        AudioM.open();
        armClosetTimer();
        Dialogue.say([
          "Sheets and blankets, folded once and never touched again. Cobwebs in the corners, and a small spider, very still, minding its own business.",
          "Something metal glints on the bottom shelf.",
        ]);
        Rooms.render();
      } else {
        State.setFlag("closetOpen", false);
        AudioM.close();
        disarmClosetTimer();
        Dialogue.say(Dialogue.pick("closetC", [
          "I shut the closet. The spider did not object. It is the only thing in this house that has not moved.",
          "Closed. I leave it shut. Some doors in this house are happier that way.",
          "I close it properly this time. The house notices. The house always notices.",
        ]));
        Rooms.render();
      }
    },
    torch() {
      if (State.hasItem("torch")) return;
      State.addItem("torch");
      AudioM.pickup();
      toast("Taken · A heavy steel torch");
      Dialogue.say([
        "A torch, heavy as a hammer. The battery should be dead after eleven years.",
        "I click it once. It works. Of course it works. Everything in this house works.",
      ]);
      Rooms.render();
    },
    ahatch() {
      if (!State.hasItem("torch")) {
        Dialogue.say(Dialogue.pick("ahatchNo", [
          "I pull the cord. The hatch folds down onto solid black. The air that falls out is colder than the corridor.",
          "There is a ladder and there is darkness and I am not putting one inside the other without a light.",
          "Not without a torch. The dark up there is the kind that has a texture.",
        ]));
        return;
      }
      const first = !State.flag("visitedAttic");
      State.setFlag("visitedAttic");
      Rooms.goto("attic", first ? [
        "The torch cuts a circle out of the attic dark. Everything outside the circle is a rumor.",
        "Something up here is arranged. Not stored. Arranged.",
      ] : ["Up the ladder again. The dark has not moved."]);
      startAtticTimers();
    },
    lwin() {
      State.addAware(2);
      Dialogue.say(Dialogue.pick("lwin", [
        "Daylight. Warm, honest, afternoon daylight. Every other window in this house says night.",
        "I checked the porch an hour ago. It was night. This window disagrees, and it sounds very sure of itself.",
        "Is it actually night? I realize I no longer know which window is telling the truth.",
        "The sun through this glass casts no light into the corridor. The daylight stops at the sill.",
      ]));
    },
    frames() {
      if (State.flag("act2")) {
        State.addAware(3);
        Dialogue.say(Dialogue.pick("frames2", [
          "The middle frame is empty now. Not faded. Empty, like the photograph stepped out.",
          "Three frames, two photographs. I did not imagine the third. I refuse to have imagined it.",
          "Whoever was in the middle frame, the house has taken them somewhere else.",
        ]));
      } else {
        Dialogue.say(Dialogue.pick("frames1", [
          "Three small photographs. A man, a woman, a child squinting at the camera.",
          "The frames are dusted. In an abandoned house, somebody dusts.",
        ]));
      }
    },
    scratch() {
      seventeenSense();
      Dialogue.say(Dialogue.pick("scratch", [
        "A one and a seven, scratched into the skirting board. Low down. Child height.",
        "Seventeen again, carved small, hidden where only someone crawling would find it.",
      ]));
    },
  },

  /* ============ CHILD ROOM ============ */
  childroom: {
    cback() { Rooms.goto("landing"); },
    bed() {
      State.setFlag("sawCBed");
      Dialogue.say(Dialogue.pick("cbed", [
        "The bed is made with impossible neatness. Hospital corners. On a child's bed.",
        "I press the mattress. It sighs and reforms instantly, like it has never held a shape overnight.",
        "The pillow is cold on both sides. It has always been cold on both sides.",
      ]));
      maybeFakeRealization();
    },
    cbooks() {
      State.setFlag("sawCBooks");
      Dialogue.say(Dialogue.pick("cbooks", [
        "Picture books, lined up by height. Every spine is stiff. Not one of these has ever been opened.",
        "I flip one open. The pages crack apart like they were printed yesterday and glued shut eleven years ago.",
        "Books bought for a child, or books bought to suggest a child.",
      ]));
      maybeFakeRealization();
    },
    cdrawings() {
      if (State.flag("pageEaten") && !State.flag("pageRewritten") && !State.hasItem("paper")) {
        if (State.hasItem("pen")) {
          State.addItem("paper");
          AudioM.pickup();
          Dialogue.say([
            "At the bottom of the drawing stack: one blank sheet. The only page in this room nobody drew a family on.",
            "Pen. Paper. Now somewhere the house is not looking over my shoulder, and I write.",
          ]);
          return;
        }
        Dialogue.say("Blank paper at the bottom of the drawing stack. No use to me until I find something to write with.");
        return;
      }
      
      State.setFlag("sawCDrawings");
      const act2 = State.flag("act2");
      Puzzles.paperPopup("DRAWINGS ON THE WALL", act2 ? `
        <p>The same three drawings. Almost.</p>
        <p>The house. The garden. The family, holding hands in crayon.</p>
        <p><b>Four figures now.</b> There were five. The smallest one has been redrawn <b>outside the house</b>, in a different red.</p>
        <p class="small-note">The tape has not been disturbed. The paper has not been changed. Only the drawing.</p>` : `
        <p>Three drawings in crayon, taped with care.</p>
        <p>A house with a steep roof. A garden with a sun in the corner. A family holding hands: <b>five figures</b>, one much smaller than the rest.</p>
        <p class="small-note">The paper is bright. Crayon fades in a year of daylight. This has not faded.</p>`);
      maybeFakeRealization();
    },
    blocks() {
      seventeenSense();
      Dialogue.say(Dialogue.pick("blocks", [
        "Wooden blocks. Two of them stand apart from the pile: a one and a seven.",
        "I nudge the seven out of line with the one. I already know what I will find when I come back.",
        "Seventeen, spelled in toys. The house is not even being subtle anymore.",
      ]));
    },
    musicbox() {
      if (!State.flag("heardMusicbox")) {
        State.setFlag("heardMusicbox");
        AudioM.tick();
        setTimeout(() => AudioM.knockShort(), 200);
        setTimeout(() => AudioM.knockShort(), 700);
        setTimeout(() => AudioM.knockLong(), 1200);
        Dialogue.say([
          "I wind the little key. Three notes, over and over.",
          "Two short. One long. Two short. One long.",
          "The house has been humming this rhythm since I arrived. Now I know where it learned it.",
        ]);
      } else {
        AudioM.knockShort();
        setTimeout(() => AudioM.knockShort(), 500);
        setTimeout(() => AudioM.knockLong(), 1000);
        Dialogue.say(Dialogue.pick("musicbox2", [
          "Two short, one long. A lullaby, or a password.",
          "The spring never runs down. I have stopped expecting it to.",
        ]));
      }
    },
    cwin() {
      State.addAware(2);
      Dialogue.say(Dialogue.pick("cwin", [
        "Rain on this window. Real rain, falling and running down the glass. And a crack, low in the corner, where a thrown stone would have hit.",
        "The crack is new. Or it was always there and I am only now looking long enough to see it.",
        "It is actually raining on the other side of this glass. Drops land, slide, gather. This room keeps its own weather, and its weather is honest.",
        "Three windows, three different skies. This is the only one honest enough to rain, and to crack.",
      ]));
    },
  },

  /* ============ ATTIC ============ */
  attic: {
    aback() {
      stopAtticTimers();
      Rooms.goto("landing", ["Down the ladder. The corridor light feels like surfacing."]);
    },
    trunk() {
      if (!State.flag("atticTruth")) {
        State.setFlag("atticTruth");
        stopAtticTimers();
        State.addAware(10);
        State.setCheckpoint("The fifth chair. The house's secret photograph.");
        AudioM.open();
        AudioM.discover();
        Puzzles.paperPopup("PHOTOGRAPH: THE KITCHEN TABLE", `
          <p>Inside the trunk, one photograph, face down.</p>
          <p>The kitchen. The table laid for dinner. <b>Five chairs.</b></p>
          <p>Four of them have people in them, blurred with motion, alive. The fifth chair is empty and pulled out, waiting.</p>
          <p class="small-note">On the back, in pencil: tally marks. Seventeen of them. Then the pencil pressed hard enough to tear.</p>`);
        Rooms.render();
      } else {
        Dialogue.say(Dialogue.pick("trunk2", [
          "Empty now, except the smell of old paper and a rectangle of cleaner wood where the photograph waited.",
          "The trunk has nothing left to say.",
        ]));
      }
    },
    fifthchair() {
      State.setFlag("fifthChairSeen");
      Dialogue.say(Dialogue.pick("fifthchair", [
        "A chair. The same make as the kitchen chairs. The exact same.",
        "Who carries one chair up a ladder into the dark? Someone hiding a place setting.",
        "It faces the little round window. Whoever sat here was watching the street.",
        State.flag("atticTruth") ? "The fifth chair. The photograph was set for five. This is where the fifth went." : "Something about this chair feels subtracted, like the room downstairs misses it.",
      ]));
    },
    tally() {
      seventeenSense();
      State.addAware(2);
      Dialogue.say(Dialogue.pick("tally", [
        "Tally marks on the beam. Five, ten, fifteen, two more. Seventeen.",
        "Somebody counted to seventeen up here, in the dark, and then stopped counting.",
      ]));
    },
    boxes() {
      Dialogue.say(Dialogue.pick("aboxes", [
        "Boxes labeled by month. November is on top. November is always on top.",
        "Winter clothes, folded. A kettle identical to the one downstairs. A spare of everything, like the house keeps understudies.",
      ]));
    },
    awin() {
      Dialogue.say(Dialogue.pick("awin", [
        "A coin of moonlight. So at least the attic agrees it is night. Two votes against two.",
        "Through the round glass, the street. My car. And frost on the windshield that was not there when I parked.",
      ]));
    },
  },

  /* ============ STUDY ============ */
  study: {
    sback() { Rooms.goto("landing"); },
    satchel() {
      State.setFlag("hasBag");
      AudioM.pickup();
      Rooms.render();
      if (typeof Game !== "undefined") Game.refreshHUD();
      toast("The satchel · use the bag icon, lower left");
      Puzzles.paperPopup("A LOOSE PAGE", `
        <p class="dim">It was pinned under the satchel. The notebook's handwriting, but hurried:</p>
        <p style="font-style:italic;line-height:2">Entry 17. It knows when I count. It waits for the numbers.</p>
        <p style="font-style:italic;line-height:2">The door under the house answers to what he taped. Two quick, one slow.</p>
        <p style="font-style:italic;line-height:2">Paper is safe. Paper has no voice for it to hear. Unless it holds the paper. Never let it hold the paper.</p>`);
      State.bagPut("notePage");
      State.setFlag("pageInBag");
      State.setFlag("bagRooms", 0);
      Dialogue.say([
        "A school satchel, child sized. Five pockets, five buckles, the leather kept soft by a house that keeps everything.",
        "And a loose page from the notebook, pinned underneath it. Entry seventeen.",
        "The page goes straight into the satchel. Safest place in the house for it.",
      ]);
    },
    notebook() {
      if (State.flag("notebookOpen")) {
        Dialogue.say(Dialogue.pick("nb_after", [
          "“If the house forgets, make it look again.” I have the sentence memorized now.",
          "The notebook lies open. Its one sentence hasn't grown a second one.",
        ]));
        return;
      }
      if (State.get().objective === "study_locked" || State.get().objective === "find_study") {
        State.setObjective("open_notebook");
      }
      Puzzles.notebookDial();
    },
    photoA() {
      Puzzles.paperPopup("PHOTOGRAPH: THE FIREPLACE", `
        <p>The father stands beside the fireplace, caught in the middle of a laugh.</p>
        <p>On the mantel behind him, a clock reads <b>8:17</b>.</p>
        <p style="text-align:center;margin-top:10px">In the corner of the frame, inked small: <b style="font-size:22px;color:#c9a35f">☀</b> <span class="dim">(a sun)</span></p>`);
    },
    photoB() {
      Puzzles.paperPopup("PHOTOGRAPH: THE WINDOW SEAT", `
        <p>The mother reads by the window. She isn't looking at the book. She's looking at the camera. Not smiling.</p>
        <p>The clock on the sill reads <b>8:23</b>.</p>
        <p style="text-align:center;margin-top:10px">In the corner, inked small: <b style="font-size:22px;color:#c9a35f">★</b> <span class="dim">(a star)</span></p>`);
    },
    photoC() {
      Puzzles.paperPopup("PHOTOGRAPH: THE STAIRCASE", `
        <p>The two children on the stairs. The boy is looking up, toward the study. This room.</p>
        <p>The hallway clock behind them reads <b>8:31</b>.</p>
        <p style="text-align:center;margin-top:10px">In the corner, inked small: <b style="font-size:22px;color:#c9a35f">☾</b> <span class="dim">(a moon)</span></p>`);
    },
    tape() {
      State.setFlag("tapePlayed");
      AudioM.tapeStart();
      const el = document.createElement("div");
      el.innerHTML = `
        <p class="dim">The reels turn. Static, then a woman's voice, tired and careful:</p>
        <p style="font-style:italic;margin-top:8px">“…the house is fine. The house is <u>fine</u>. We just have to stop feeding it evenings.”</p>
        <p class="dim" style="margin-top:8px">A long silence. Then, from somewhere behind her, three knocks:</p>
        <p style="text-align:center;font-size:22px;letter-spacing:8px;margin-top:6px">● &nbsp;● &nbsp;━</p>
        <p class="dim" style="text-align:center">short, short, long</p>
        <p style="font-style:italic;margin-top:8px">“…he's doing it again.”</p>
        <p class="dim">The tape ends. The label reads: <b>TAPE 04: 8:17</b>.</p>`;
      Popups.open({ title: "THE TAPE RECORDER", bodyEl: el });
      setTimeout(() => AudioM.knockShort(), 900);
      setTimeout(() => AudioM.knockShort(), 1400);
      setTimeout(() => AudioM.knockLong(), 1950);
    },
    shelf() {
      Dialogue.say(Dialogue.pick("shelf", [
        "Field guides, ledgers, a shelf of diaries with the years scratched off the spines.",
        "One book is shelved upside down: “On the Persistence of Rooms.” I'm leaving it exactly as it is.",
        "The books are arranged by color. Nobody arranges books by color except people hiding a different order.",
        "A gap on the third shelf, exactly one book wide. The dust outline is fresh.",
      ]));
    },
    slamp() {
      const on = State.flag("studyLampOn") !== false;
      State.setFlag("studyLampOn", !on);
      AudioM.click();
      Rooms.render();
      Dialogue.say(!on ? "The lamp warms the desk again." : Dialogue.pick("lampoff", [
        "Dark. The window's cold light takes over the room, and the photographs seem to face it.",
        "With the lamp off, the room rearranges itself into shadows. I put my hand back on the switch.",
      ]));
    },
    type() {
      Dialogue.say(Dialogue.pick("type", [
        "A page still in the typewriter. One line, typed over and over: “November 14. November 14. November 14.”",
        "The ribbon is worn through in exactly eleven places.",
        "The keys are clean except the N, the O, the V. I'm done touching the typewriter.",
      ]));
    },
    lens() {
      State.addItem("lens");
      AudioM.pickup();
      State.logEvent("item", "took the surveyor's lens");
      toast("Taken · A surveyor's lens");
      Dialogue.say([
        "A surveyor's lens, brass and cool, left at the edge of the desk like someone set it down mid thought.",
        "It is not for distance. It is for reading what the house writes on its own walls.",
        "The little labels. A small room. The study. I can switch them on when I want them now. Or leave the walls honest.",
        "The house will not mind either way. It would rather I looked at it, not at its handwriting.",
      ]);
      Rooms.render();
      if (typeof Game !== "undefined") Game.refreshHUD();
    },
    oldphoto() {
      if (State.foundSecret("oldphoto")) {
        AudioM.discover();
        toast("Discovery · The dated photograph");
        Puzzles.paperPopup("A SMALL FRAMED PHOTO", `
          <p>A child stands on the porch of this house, squinting at the sun. Not one of the family. The clothes are wrong, the face is wrong.</p>
          <p>On the back, in pencil: <em>“the visitor, Nov 14”</em>, dated <b>eleven years ago</b>.</p>
          <p style="color:#a5503c;margin-top:8px">I know that face. I see it every morning while brushing my teeth.</p>`);
      } else {
        Dialogue.say("Me. Eleven years younger, on this porch. I still don't remember the sun that day.");
      }
    },
    swin() {
      Dialogue.say(Dialogue.pick("swin", [
        "The street below. My footprints on the path, and beside them a second set I don't remember making.",
        "From up here the porch light's circle looks smaller. The dark around it looks organized.",
        "Rain starting. The drops hit the glass and slide sideways. Sideways.",
      ]));
    },
    drawer1() {
      Dialogue.say(Dialogue.pick("sdrawer", [
        "Pencils, string, a broken watch. The watch says 8:17. Naturally.",
        "Receipts. All groceries, all the same four items, week after week: milk, bread, apples, batteries.",
        "Empty envelopes addressed to “The Visitor.” No street. No stamp.",
      ]));
    },
  },

  /* ============ BASEMENT ============ */
  basement: {
    goup() {
      if (State.flag("finalOpen")) { Dialogue.say("No. It's ahead of me now, not behind."); return; }
      Rooms.goto("hallway");
    },
    breaker() {
      if (!State.flag("basementPower")) {
        State.setFlag("basementPower");
        AudioM.flicker();
        setTimeout(() => AudioM.unlock(), 250);
        Rooms.goto("basement", [
          "The breaker slams up. Fluorescents stutter awake, one by one, like the room is remembering how.",
          "Four monitors fade in. Four rooms. Four different times of the same evening.",
        ]);
      } else {
        Dialogue.say("The breaker hums, warm under my hand. The house drinks quietly.");
      }
    },
    mon0() {
      Puzzles.paperPopup("CAM 01: THE PORCH, 6:52", `
        <p>The porch, in grainy green. Daylight fading. The timestamp reads <b>6:52 PM</b> and never advances.</p>
        <p>A car pulls up. A child gets out. The child waves at someone the camera can't see.</p>
        <p class="dim">The feed loops. The child waves forever.</p>`);
    },
    mon1() {
      Puzzles.paperPopup("CAM 02: THE KITCHEN, 7:46", `
        <p>The kitchen at <b>7:46 PM</b>. The mother sets the table. Four plates. Then, after a pause, she adds a fifth.</p>
        <p>She looks at the fifth plate for a long time.</p>`);
    },
    mon2() {
      Puzzles.paperPopup("CAM 03: THE HALLWAY, 8:17", `
        <p>The hallway at <b>8:17 PM</b>. Every light is on. A small figure stands at the foot of the stairs, perfectly still.</p>
        <p style="color:#a5503c">All the clocks in the frame read 8:17. The feed does not loop. The figure simply stands there. Waiting.</p>
        <p class="dim">8:17. The house has been showing me this number since the kitchen.</p>`);
    },
    mon3() {
      Puzzles.paperPopup("CAM 04: THE STUDY, 9:03", `
        <p>The study at <b>9:03 PM</b>. The father feeds papers into the fireplace that the study does not have.</p>
        <p>He stops. He looks directly into the camera. He mouths two words.</p>
        <p style="text-align:center;font-style:italic;margin-top:6px">“look again”</p>`);
    },
    mon5() {
      if (State.foundSecret("cam05")) {
        AudioM.discover();
        toast("Discovery · CAM 05");
        Puzzles.paperPopup("A FIFTH MONITOR", `
          <p>Unplugged, tilted face down on the floor. Its label: <b>CAM 05: STREET</b>.</p>
          <p>There is no fifth camera anywhere in this house pointing at the street.</p>
          <p class="dim">The plug lies a hand's width from the socket. Deliberately out of reach, or deliberately close.</p>`);
      } else {
        Dialogue.say("CAM 05: STREET. Unplugged. I'm not plugging it in. Probably.");
      }
    },
    keypad() {
      if (State.flag("keypadSolved")) { Dialogue.say("The keypad glows a settled green."); return; }
      Puzzles.keypad({
        title: "THE KEYPAD",
        prompt: "Three digits. Scratched above it: “WHEN DID THE HOUSE STOP?”",
        code: PUZZLE_CONFIG.keypad817.code,
        maxLen: 3,
        onSolve() {
          State.setFlag("keypadSolved");
          State.setObjective("final_door");
          Dialogue.say([
            "8:17. The hour every clock in this house agreed to keep.",
            "Something disengages inside the door. The knocker is waiting.",
          ]);
          Rooms.render();
        },
      });
    },
    mdoor() {
      if (State.flag("keypadSolved")) Puzzles.knockDoor();
      else Dialogue.say(Dialogue.pick("mdoor1", [
        "Sealed steel. The keypad beside it blinks red, politely.",
        "The door is warm. Every locked thing in this house is warm.",
        "Not without the keypad's blessing.",
      ]));
    },
    boiler() {
      Dialogue.say(Dialogue.pick("boiler", [
        "The boiler is cold, but the pipes above it are warm. The heat is coming from somewhere else.",
        "The pressure gauge needle rests at 17. The gauge goes up to 15.",
      ]));
    },
  },

  /* ============ MEMORY ============ */
  memory: {
    machine() {
      const el = document.createElement("div");
      el.innerHTML = `
        <p>The master reel. Eleven years of the house's patient reconstruction, wound onto one spool labelled <b>NOV 14</b>.</p>
        <p class="dim" style="margin-top:6px">Two switches. Green: <b>PLAY</b>, let the house finish remembering the evening, with me in it. Red: <b>ERASE</b>, burn the evening out of the world for good.</p>
        <p style="margin-top:10px;font-style:italic">The figure at the edge of the light hasn't moved. It's waiting for my choice, not for me.</p>`;
      Popups.open({
        title: "THE MASTER RECORDING",
        bodyEl: el,
        buttons: [
          { label: "ERASE the evening", cls: "danger", onClick: () => Game.ending("erase") },
          { label: "PLAY: remember it", cls: "primary", onClick: () => Game.ending("remember") },
        ],
      });
    },
    figure() {
      Dialogue.say(Dialogue.pick("figure", [
        "A child, at the edge of the lamplight. Made of the light's leftovers. It doesn't come closer.",
        "It's the fifth figure from the photograph. From the drawing under the doormat. From eleven years ago.",
        "It's me. The visitor. The part of the evening the family tried hardest to erase, to protect.",
        "It isn't angry. It's been waiting to be finished for eleven years.",
      ]));
    },
    drawings() {
      Dialogue.say(Dialogue.pick("mdraw", [
        "A house. A family of four. And a small fifth figure, added in different pencil. Added later, and carefully.",
        "Five tally marks, counted and circled. The little girl kept better records than her parents.",
      ]));
    },
    smallcam() {
      Dialogue.say(Dialogue.pick("mcam", [
        "A camera, red light blinking. This room has been recording the whole time. Recording me, now.",
        "It's pointed at the bed. It has been pointed at the bed for eleven years.",
      ]));
    },
    bed() {
      Dialogue.say(Dialogue.pick("mbed", [
        "A visitor's bed. Made up fresh. The pillow still holds the shape of a small head.",
        "I slept here. Eleven years ago, one night, November 14th. It's coming back in pieces.",
      ]));
    },
  },
};
