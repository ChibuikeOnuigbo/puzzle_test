/* HOUSE 17 — main game controller: menus, HUD, hints, settings, act transitions, endings, boot. */
"use strict";

const Game = (() => {

  /* ---------- inventory icons (vector, replaceable via this registry) ---------- */
  const ITEM_DEFS = {
    houseKey: { name: "House key", svg: `<svg viewBox="0 0 40 40"><circle cx="12" cy="20" r="7" fill="none" stroke="#c9a35f" stroke-width="3.4"/><rect x="18" y="18" width="18" height="4" fill="#c9a35f"/><rect x="30" y="22" width="3" height="5" fill="#c9a35f"/><rect x="25" y="22" width="3" height="4" fill="#c9a35f"/></svg>` },
    studyKey: { name: "Study key", svg: `<svg viewBox="0 0 40 40"><circle cx="12" cy="20" r="6" fill="none" stroke="#e8a04c" stroke-width="3"/><rect x="17" y="18.4" width="17" height="3.4" fill="#e8a04c"/><rect x="29" y="21" width="2.6" height="5" fill="#e8a04c"/></svg>` },
    ironKey: { name: "Iron key", svg: `<svg viewBox="0 0 40 40"><circle cx="11" cy="20" r="7" fill="none" stroke="#8f9691" stroke-width="4"/><rect x="17" y="18" width="19" height="4.6" fill="#8f9691"/><rect x="31" y="22" width="3.4" height="6" fill="#8f9691"/><rect x="25" y="22" width="3.4" height="5" fill="#8f9691"/></svg>` },
    torch: { name: "Torch", svg: `<svg viewBox="0 0 40 40"><rect x="6" y="16" width="20" height="8" rx="3" fill="#8f9691"/><rect x="24" y="13" width="8" height="14" rx="2" fill="#6b7370"/><circle cx="34" cy="20" r="4" fill="#e8c87a"/></svg>` },
    pen: { name: "Fountain pen", svg: `<svg viewBox="0 0 40 40"><rect x="6" y="18" width="22" height="5" rx="2.5" fill="#c9a35f" transform="rotate(-18 17 20)"/><polygon points="28,13 35,16 28,19" fill="#8a7148" transform="rotate(-18 17 20)"/></svg>` },
    paper: { name: "Blank sheet", svg: `<svg viewBox="0 0 40 40"><rect x="10" y="7" width="20" height="26" fill="#ded4bb"/><rect x="10" y="7" width="20" height="26" fill="none" stroke="#8f8778" stroke-width="1.4"/></svg>` },
    page17: { name: "The rewritten page", svg: `<svg viewBox="0 0 40 40"><rect x="10" y="7" width="20" height="26" fill="#ded4bb"/><path d="M13,13 h14 M13,18 h14 M13,23 h9" stroke="#5d4a35" stroke-width="1.6"/><text x="24" y="30" font-size="9" fill="#8a3a2c" font-family="Georgia">17</text></svg>` },
    notePage: { name: "The loose page", svg: `<svg viewBox="0 0 40 40"><rect x="11" y="8" width="18" height="24" fill="#d8c9a8" transform="rotate(6 20 20)"/><path d="M14,14 h11 M14,18 h11 M14,22 h7" stroke="#6b5544" stroke-width="1.4" transform="rotate(6 20 20)"/></svg>` },
    lens: { name: "Surveyor's lens", svg: `<svg viewBox="0 0 40 40"><ellipse cx="20" cy="20" rx="12" ry="12" fill="none" stroke="#c9a35f" stroke-width="3.2"/><ellipse cx="20" cy="20" rx="8" ry="8" fill="#6a86a8" opacity="0.65"/><path d="M18,13 q2,-5 5,0" stroke="#c9d8e6" stroke-width="2" fill="none"/><rect x="28" y="28" width="4" height="9" rx="1.6" fill="#c9a35f" transform="rotate(45 30 32)"/></svg>` },
    shard: { name: "A sliver of black glass", svg: `<svg viewBox="0 0 40 40"><polygon points="20,4 32,16 24,34 12,22" fill="#1a2730" stroke="#c9d8e6" stroke-width="1.2"/><polygon points="20,4 24,12 16,14" fill="#3a5266" opacity="0.8"/></svg>` },
  };

  /* ---------- the satchel: five pockets, one appetite ---------- */
  function openBag() {
    const el = document.createElement("div");
    let handle = null;
    const paint = () => {
      const bag = State.bagList();
      const carriable = State.get().inventory.filter(i => ITEM_DEFS[i] && i !== "page17");
      el.innerHTML = `
        <p class="dim" style="text-align:center">A child's school satchel. Five pockets, five buckles.${State.flag("pageEaten") ? "<br><em style='color:#a5503c'>One pocket holds an ink stain shaped like a paragraph.</em>" : ""}</p>
        <div class="bag-slots">
          ${[...Array(5)].map((_, i) => {
            const id = bag[i];
            return id
              ? `<div class="bag-slot full">${ITEM_DEFS[id].svg}<span>${ITEM_DEFS[id].name}</span><button class="bag-btn" data-take="${id}">TAKE OUT</button></div>`
              : `<div class="bag-slot"><span class="dim">empty pocket</span></div>`;
          }).join("")}
        </div>
        <div class="bag-carried">
          ${carriable.length
            ? carriable.map(id => `<button class="bag-btn" data-put="${id}">PUT IN · ${ITEM_DEFS[id].name}</button>`).join("")
            : `<span class="small-note dim">Nothing in hand to store.</span>`}
          ${State.hasItem("page17") ? `<p class="small-note" style="color:#d8c9a8">The rewritten page stays in my coat. Not in anything the house has held.</p>` : ""}
        </div>
        ${State.flag("pageEaten") && !State.flag("pageRewritten") && State.hasItem("pen") && State.hasItem("paper")
          ? `<button class="bag-btn bag-rewrite" id="rewriteBtn">REWRITE THE PAGE FROM MEMORY</button>` : ""}`;
      el.querySelectorAll("[data-take]").forEach(b => b.addEventListener("click", () => {
        State.bagTake(b.dataset.take); State.addItem(b.dataset.take); AudioM.pickup(); paint();
      }));
      el.querySelectorAll("[data-put]").forEach(b => b.addEventListener("click", () => {
        const id = b.dataset.put;
        if (!State.bagPut(id)) { AudioM.error(); toast("The satchel is full"); return; }
        State.removeItem(id); AudioM.close(); paint();
      }));
      const rw = el.querySelector("#rewriteBtn");
      if (rw) rw.addEventListener("click", () => {
        State.removeItem("pen"); State.removeItem("paper");
        State.addItem("page17");
        State.setFlag("pageRewritten");
        if (State.get().objective === "page_gone") State.setObjective(State.flag("prevObj") || "after_notebook");
        State.addAware(3);
        AudioM.discover();
        Popups.close(handle);
        Puzzles.paperPopup("THE PAGE, REWRITTEN", `
          <p style="font-style:italic;line-height:2">Entry 17. It knows when I count. It waits for the numbers.</p>
          <p style="font-style:italic;line-height:2">The door under the house answers to what he taped. Two quick, one slow.</p>
          <p style="font-style:italic;line-height:2">Paper is safe. Paper has no voice for it to hear. Unless it holds the paper. Never let it hold the paper.</p>
          <p class="small-note">My handwriting is shakier than the original. The words are the same. I checked them against my memory twice, and my memory is the one thing in this house I locked the door of.</p>`);
        Dialogue.say([
          "Rewritten. Every line of it, from memory, in borrowed ink.",
          "This copy goes in my coat pocket. The satchel can carry keys and torches. It does not get my words again.",
        ]);
        refreshHUD();
      });
    };
    paint();
    handle = Popups.open({ title: "THE SATCHEL", bodyEl: el });
  }

  /* ---------- HUD ---------- */
  function refreshHUD() {
    const st = State.get();
    document.getElementById("objective-text").innerHTML = OBJECTIVES[st.objective] || "";
    const lensBtn = document.getElementById("btn-lens");
    if (lensBtn) { lensBtn.hidden = !State.hasItem("lens"); lensBtn.classList.toggle("on", !!Settings.get("labelsOn")); }
    const notesBtn = document.getElementById("btn-notes");
    if (notesBtn) notesBtn.hidden = State.notesList().length === 0;
    const inv = document.getElementById("inventory");
    const hasBag = !!State.flag("hasBag");
    if (st.inventory.length === 0 && !hasBag) { inv.classList.add("hidden"); return; }
    inv.classList.remove("hidden");
    inv.innerHTML = "";
    if (hasBag) {
      const el = document.createElement("div");
      el.className = "inv-item inv-bag";
      el.id = "bag-btn";
      el.dataset.label = "The satchel";
      el.innerHTML = `<svg viewBox="0 0 40 40"><rect x="7" y="14" width="26" height="18" rx="4" fill="#5d4a35" stroke="#33261a" stroke-width="2"/><path d="M7,19 q13,6 26,0" stroke="#33261a" stroke-width="2" fill="none"/><rect x="13" y="20" width="4" height="6" rx="1.5" fill="#8a7148"/><rect x="23" y="20" width="4" height="6" rx="1.5" fill="#8a7148"/><path d="M10,15 q10,-8 20,0" stroke="#33261a" stroke-width="2.4" fill="none"/></svg>`;
      el.addEventListener("click", openBag);
      inv.appendChild(el);
    }
    st.inventory.forEach(id => {
      const d = ITEM_DEFS[id]; if (!d) return;
      const el = document.createElement("div");
      el.className = "inv-item";
      el.dataset.label = d.name;
      el.innerHTML = d.svg;
      el.addEventListener("click", () => Dialogue.say(itemLine(id)));
      inv.appendChild(el);
    });
  }
  function itemLine(id) {
    const lines = {
      houseKey: ["A cold house key. It wants to go home.", "The key to House 17. It weighs more than it should."],
      studyKey: ["The study key. Warm brass.", "Small, brass, warm. The study is upstairs."],
      ironKey: ["An iron key with three teeth. The notebook was hollow, and this is what it was hollowed for.", "Iron, old, heavy. Something under the stairs has a new keyhole."],
      torch: ["A heavy torch. The batteries in it are not the ones from the drawer. I checked.", "The torch from the linen closet. It works everywhere except where the house prefers dark."],
      pen: ["A fountain pen from the sideboard. Still full. Ink keeps in a house where nothing is allowed to run out.", "The good pen. Someone bought it for letters that were never sent."],
      paper: ["A blank sheet from the bottom of the drawing stack. It smells faintly of crayon.", "Blank paper. The most dangerous thing in this house, according to this house."],
      page17: ["Entry 17, rewritten in my own hand. It stays in my coat.", "My copy of the page. The house ate the original. It does not get this one."],
      lens: ["The surveyor's lens. It reads what the house writes on itself.", "Through it, the little labels appear when I ask them to. The house has been labeling its rooms the whole time."],
      shard: ["A sliver of black glass from the mirror. Cold through cloth. It is a gift, and a warning that the house keeps its own doors.", "I turn the shard over. My reflection is not in it either. Some habits are hard to break."],
    };
    return Dialogue.pick("item_" + id, lines[id] || ["An object with opinions."]);
  }

  /* ---------- hint system ---------- */
  function openHints() {
    const obj = State.get().objective;
    const tiers = HINTS[obj] || ["Look closer at the room you're in.", "Something here can be counted, read, or compared.", "Try everything that looks touched."];
    const el = document.createElement("div");
    el.innerHTML = tiers.map((t, i) => `
      <div class="hint-tier" id="ht${i}">
        <button data-i="${i}">reveal hint ${i + 1} of 3 ${i === 0 ? "· a nudge" : i === 1 ? "· a direction" : "· nearly the answer"}</button>
        <div class="revealed hidden">${t}</div>
      </div>`).join("") + `<p class="small-note">Hints never cost anything. Curiosity is the whole game.</p>`;
    el.querySelectorAll("button[data-i]").forEach((b, i) => b.addEventListener("click", () => {
      // enforce order: tier n needs tier n-1 revealed
      if (i > 0 && el.querySelector(`#ht${i - 1} .revealed`).classList.contains("hidden")) {
        Dialogue.say("One hint at a time. Read the earlier one first.");
        return;
      }
      el.querySelector(`#ht${i} .revealed`).classList.remove("hidden");
      b.classList.add("hidden");
      State.useHint();
      AudioM.click();
    }));
    Popups.open({ title: "A QUIET WORD", bodyEl: el });
  }

  /* ---------- mission notes: checkpoints the house let you keep ---------- */
  function openNotes() {
    const notes = State.notesList();
    const el = document.createElement("div");
    el.innerHTML = `
      ${notes.length
        ? notes.slice(-12).map(n => `<div class="note-row"><span class="note-t">${n.note}</span><span class="note-room">${ROOM_CONFIG[n.room] ? ROOM_CONFIG[n.room].name : n.room}</span></div>`).join("")
        : `<p class="dim">No notes yet. The house has not given you anything worth writing down.</p>`}
      <p class="small-note">You have spoken ${State.monologue()} lines out loud. The house has written down every one of them.</p>`;
    Popups.open({ title: "MISSION NOTES", bodyEl: el });
  }

  /* ---------- pause menu ---------- */
  function openPause() {
    Popups.open({
      title: "PAUSED",
      bodyHTML: `<p class="dim" style="text-align:center">The house waits. It's good at that.</p>`,
      buttons: [
        { label: "Resume", cls: "primary" },
        { label: "Settings", close: false, onClick: () => openSettings() },
        { label: "Restart game", cls: "danger", close: false, onClick: confirmRestart },
        { label: "Main menu", close: false, onClick: confirmMenu },
      ],
    });
  }
  function confirmRestart() {
    Popups.open({
      title: "RESTART?",
      bodyHTML: `<p>Start over from the porch? Your current progress will be erased.</p>`,
      buttons: [
        { label: "Cancel" },
        { label: "Yes, restart", cls: "danger", onClick: () => { Popups.closeAll(); newGame(); } },
      ],
    });
  }
  function confirmMenu() {
    Popups.open({
      title: "LEAVE TO MENU?",
      bodyHTML: `<p>Your progress is saved automatically. The house will remember where you were. It remembers everything.</p>`,
      buttons: [
        { label: "Stay" },
        { label: "Main menu", cls: "primary", onClick: () => { Popups.closeAll(); toMenu(); } },
      ],
    });
  }

  /* ---------- settings (paged) ---------- */
  const CONTROL_ACTIONS = [
    { id: "skip", name: "Skip dialogue" },
    { id: "left", name: "Left direction" },
    { id: "right", name: "Right direction" },
    { id: "hints", name: "Hints" },
    { id: "pause", name: "Pause menu" },
    { id: "labels", name: "Room labels" },
  ];

  function openSettings() {
    let page = 0;
    const pages = ["SOUND", "MOTION & TEXT", "GAME", "CONTROLS"];
    const el = document.createElement("div");

    const slider = (key, label) => `
      <div class="set-row"><label>${label}</label>
      <input type="range" min="0" max="1" step="0.05" value="${Settings.get(key)}" data-set="${key}"></div>`;
    const tog = (key, label, sub) => `
      <div class="set-row"><label>${label}${sub ? `<span class="sub">${sub}</span>` : ""}</label>
      <button class="toggle ${Settings.get(key) ? "on" : ""}" data-tog="${key}" aria-label="${label}"></button></div>`;

    el.innerHTML = `
      <div class="settings-pages">
        <div class="spage active">
          ${slider("master", "Master volume")}
          ${slider("sfx", "Effects")}
          ${slider("ambient", "Ambience")}
          <p class="small-note">All sound in HOUSE 17 is synthesized live. Nothing was recorded in the house. We checked.</p>
        </div>
        <div class="spage">
          ${tog("reducedMotion", "Reduced motion", "disables parallax, ripples and typewriter text")}
          ${tog("parallax", "Parallax depth")}
          <div class="set-row"><label>Text size</label>
            <div style="display:flex;gap:8px">
              <button class="btn small" data-tx="0.9">A</button>
              <button class="btn small" data-tx="1" style="font-size:16px">A</button>
              <button class="btn small" data-tx="1.15" style="font-size:18px">A</button>
            </div></div>
        </div>
        <div class="spage">
          ${tog("subtitles", "Describe sounds in text", "important audio clues always appear as text")}
          ${tog("tiredness", "Tiredness", "late in the game, staying awake becomes something you do")}
          <div class="set-row"><label>Erase save data<span class="sub">removes progress and discoveries</span></label>
            <button class="btn small danger" id="wipe">Erase</button></div>
        </div>
        <div class="spage">
          ${CONTROL_ACTIONS.map(a => `
            <div class="set-row key-row" data-action="${a.id}">
              <label>${a.name}</label>
              <button class="btn small keybind" data-action="${a.id}"><span class="keycap">${Controls.label(Controls.get(a.id))}</span></button>
            </div>`).join("")}
          <div class="set-row"><label>Restore default keys</label><button class="btn small" id="resetkeys">Reset</button></div>
          <p class="small-note">Click a key to rebind it. Press the new key, or Escape to cancel. Every key on the keyboard is on the table.</p>
        </div>
      </div>
      <div class="spager">
        <button class="btn small" id="sprev">← Back</button>
        <div class="dots">${pages.map((_, i) => `<span class="dot${i === 0 ? " on" : ""}"></span>`).join("")}</div>
        <button class="btn small" id="snext">Next →</button>
      </div>`;

    const paint = () => {
      el.querySelectorAll(".spage").forEach((p, i) => p.classList.toggle("active", i === page));
      el.querySelectorAll(".dot").forEach((d, i) => d.classList.toggle("on", i === page));
      el.querySelector("#sprev").disabled = page === 0;
      el.querySelector("#snext").disabled = page === pages.length - 1;
      handle.panel.querySelector(".popup-head h2").textContent = "SETTINGS · " + pages[page];
    };
    el.querySelector("#sprev").addEventListener("click", () => { page = Math.max(0, page - 1); paint(); });
    el.querySelector("#snext").addEventListener("click", () => { page = Math.min(pages.length - 1, page + 1); paint(); });
    el.querySelectorAll("input[data-set]").forEach(inp => inp.addEventListener("input", () => {
      Settings.set(inp.dataset.set, parseFloat(inp.value));
    }));
    el.querySelectorAll(".toggle").forEach(t => t.addEventListener("click", () => {
      const k = t.dataset.tog;
      Settings.set(k, !Settings.get(k));
      t.classList.toggle("on", Settings.get(k));
    }));
    el.querySelectorAll("button[data-tx]").forEach(b => b.addEventListener("click", () => {
      Settings.set("textSize", parseFloat(b.dataset.tx));
    }));
    el.querySelector("#wipe").addEventListener("click", () => {
      Popups.open({
        title: "ERASE EVERYTHING?",
        bodyHTML: "<p>All progress, all discoveries. The house, however, will still remember you.</p>",
        buttons: [
          { label: "Cancel" },
          { label: "Erase", cls: "danger", onClick: () => { State.reset(); Popups.closeAll(); toMenu(); } },
        ],
      });
    });

    /* controls page: rebind any action to any key */
    const repaintKeys = () => {
      el.querySelectorAll(".keybind").forEach(b => {
        b.querySelector(".keycap").textContent = Controls.label(Controls.get(b.dataset.action));
      });
      if (typeof Dialogue !== "undefined") Dialogue.refreshKeycap();
    };
    const bindKey = (btn) => {
      btn.classList.add("capturing");
      btn.querySelector(".keycap").textContent = "press…";
      const handler = (e) => {
        e.preventDefault(); e.stopPropagation();
        window.removeEventListener("keydown", handler, true);
        btn.classList.remove("capturing");
        if (e.key === "Escape") { repaintKeys(); return; }
        Controls.set(btn.dataset.action, e.key);
        repaintKeys();
      };
      window.addEventListener("keydown", handler, true);
    };
    el.querySelectorAll(".keybind").forEach(b => b.addEventListener("click", () => bindKey(b)));
    el.querySelector("#resetkeys").addEventListener("click", () => { Controls.reset(); repaintKeys(); });

    const handle = Popups.open({ title: "SETTINGS · SOUND", bodyEl: el });
  }

  /* ---------- how to play / credits ---------- */
  function openHow() {
    Popups.open({
      title: "HOW TO PLAY",
      bodyHTML: `
        <p><b style="color:var(--amber)">Look.</b> Move your cursor around a scene. Anything that matters will answer to it.</p>
        <p><b style="color:var(--amber)">Click.</b> Inspect, open, count, read. The house explains itself to people who pay attention.</p>
        <p><b style="color:var(--amber)">Connect.</b> Every code, symbol and rhythm you need is somewhere in the house, usually pretending to be ordinary.</p>
        <p><b style="color:var(--amber)">Stuck?</b> The <b>?</b> button offers three tiers of hints, from a nudge to nearly-the-answer.</p>
        <p class="small-note">Progress saves automatically. Esc closes windows. There are five optional discoveries for the observant.</p>`,
    });
  }
  function openCredits() {
    Popups.open({
      title: "CREDITS",
      bodyHTML: `
        <p><b>HOUSE 17</b>: a small mystery about a house that remembers.</p>
        <p class="dim">Design, art, writing, code & sound: made for you, by hand.</p>
        <p class="dim">All artwork is original vector illustration. All audio is synthesized in your browser as you play. No external assets were used. See ASSET_SOURCES.md.</p>
        <p class="small-note">Inspired by the *structure* of great point and click mysteries such as Forgotten Hill, Rusty Lake, and There Is No Game, while copying none of them.</p>`,
    });
  }

  /* ---------- act transitions ---------- */
  function notebookOpened() {
    State.setFlag("notebookOpen");
    State.addItem("ironKey");
    AudioM.dread();
    const el = document.createElement("div");
    el.innerHTML = `
      <p>The clasp springs. The red notebook holds a single sentence, written hundreds of times, page after page:</p>
      <p style="text-align:center;font-style:italic;font-size:18px;margin:10px 0">“If the house forgets, make it look again.”</p>
      <p>The back cover is thicker than the front. Hollow. Inside the hollow: <b>an iron key</b> with three teeth, older than the notebook by decades.</p>
      <p style="color:#a5503c;margin-top:8px">Downstairs, something clicks. Loudly. Once.</p>`;
    Popups.open({
      title: "THE RED NOTEBOOK",
      bodyEl: el,
      onClose() {
        State.setFlag("act2");
        State.setObjective("after_notebook");
        State.setCheckpoint("The notebook is open. The house noticed.");
        AudioM.flicker();
        Rooms.render();
        Dialogue.say([
          "The lights dip, then recover, like the house swallowed.",
          "I have the notebook. I could leave. The click downstairs says the house has other plans for the evening.",
        ]);
        refreshHUD();
      },
    });
    refreshHUD();
  }

  function finalDoorOpened() {
    State.setFlag("finalOpen");
    State.setObjective("choice");
    AudioM.creakDoor();
    Rooms.goto("memory", [
      "The steel door swings out on silent hinges. Behind it: a small bedroom. A child's bedroom.",
      "This room is not on any floor plan. The house built it out of a memory, and kept it warm.",
    ]);
  }

  /* ---------- endings ---------- */
  function ending(kind) {
    playing = false;
    paintFatigue(0);
    Popups.closeAll();
    Dialogue.clear();
    const secretsFound = State.get().secrets.length;
    const all = Object.keys(SECRETS).length;
    const mins = State.playMinutes();
    const hints = State.get().hintsUsed;
    AudioM.stopAmbient();
    AudioM.swell();

    const endEl = document.getElementById("ending");
    let title, body;
    if (kind === "erase") {
      title = "THE EVENING, LOST";
      body = `The reel burns quickly, like it had been waiting to. Room by room, the house exhales:
        clocks slump past 8:17, the fifth figure fades from the photograph, the tea finally goes cold.<br><br>
        You leave at dawn with a red notebook full of blank pages. M. never asks what happened.
        You never tell them that, for one moment on the basement stairs, a small voice said <em>thank you</em>.`;
    } else {
      title = "THE EVENING, KEPT";
      body = `You press play. The house finishes its sentence of eleven years: the table set for five,
        the knock, short short long, and a visiting child, laughing on the stairs at 8:17, safe and loved for one perfect evening
        before everything after.<br><br>
        The figure at the edge of the light steps into it. You know the face. You've been carrying it all along.<br><br>
        You leave the reel turning. Some houses keep evenings the way people keep photographs, and House 17 has only ever had the one.`;
    }
    let secretHTML = "";
    if (secretsFound === all) {
      secretHTML = `<p class="body" style="color:#9ec7a8;font-size:15px">EPILOGUE. On your way out, the fifth monitor is plugged in.
      CAM 05: STREET. The timestamp reads <b>tomorrow, 6:52 PM</b>. On the screen, a car pulls up outside House 17.
      You watch yourself get out of it, and wave.</p>`;
    }
    endEl.innerHTML = `
      <h2>${title}</h2>
      <p class="body">${body}</p>
      <p class="body" style="color:#8f8778">You walk away up the street, counting gates out of habit. Fifteen. Sixteen. Eighteen.<br>
      There is no seventeen. You stop. You turn around.<br>
      House 17 is still there. Porch light on. Patient.<br><br>
      <em>Which version did you leave?</em></p>
      ${secretHTML}
      <p class="stats">finished in about ${mins} minute${mins === 1 ? "" : "s"} · hints used: ${hints} · discoveries: ${secretsFound} / ${all}${secretsFound < all ? ", the house kept some things from you" : ""}</p>
      <div class="row">
        <button class="btn primary" id="end-again">Play again</button>
        <button class="btn" id="end-menu">Main menu</button>
        <button class="btn" id="end-credits">Credits</button>
      </div>`;
    endEl.classList.remove("hidden");
    document.getElementById("hud").classList.add("hidden");
    Dialogue.hide();
    State.reset(); // completed runs reset the save; discoveries were shown
    endEl.querySelector("#end-again").addEventListener("click", () => { endEl.classList.add("hidden"); newGame(); });
    endEl.querySelector("#end-menu").addEventListener("click", () => { endEl.classList.add("hidden"); toMenu(); });
    endEl.querySelector("#end-credits").addEventListener("click", openCredits);
  }

  /* ---------- the living house: scheduled sounds + tiredness ---------- */
  let playing = false;
  let fatigue = 0, fatStage = 0, lastRiser = 0, lastRoomSeen = null, blackoutBusy = false;

  function paintFatigue(stage) {
    if (stage === fatStage) return;
    fatStage = stage;
    const el = document.getElementById("fatigue");
    if (el) el.className = stage > 0 ? "f" + stage : "";
  }

  function blackout() {
    if (blackoutBusy) return;
    blackoutBusy = true;
    fatigue = 0;
    Popups.closeAll();
    AudioM.dread();
    fadeTransition(() => {
      const dest = State.get().room === "hallway" ? "kitchen" : "hallway";
      State.setRoom(dest);
      Rooms.render();
      State.addAware(12);
      paintFatigue(0);
      Dialogue.say([
        "…I was standing somewhere else a moment ago.",
        "I did not sit down. I did not close my eyes. I lost time anyway.",
        "Something crossed the room while I was gone. The air is still settling behind it.",
        'And on the wall, written small in the dust: "You missed something."',
      ]);
      blackoutBusy = false;
    });
  }

  function houseTick() {
    if (!playing || blackoutBusy) return;
    const st = State.get();
    const aware = State.aware() + (State.flag("act2") ? 15 : 0);

    /* ambient horror: starts near silence, grows bolder as the house learns you */
    const now = Date.now();
    const chance = Math.min(0.5, 0.05 + aware / 240);
    if (Math.random() < chance) {
      const r = Math.random();
      const upstairs = ["landing", "childroom", "attic"].includes(st.room);
      if (r < 0.42) AudioM.randomCreak();
      else if (r < 0.66) AudioM.distantKnock();
      else if (r < 0.88) {
        if (upstairs) { AudioM.randomCreak(); } else { AudioM.footsteps(3 + Math.floor(Math.random() * 3)); }
        if (Settings.get("subtitles") && aware > 25 && Math.random() < 0.4) toast(upstairs ? "· something shifts downstairs ·" : "· footsteps upstairs ·");
      } else if (aware >= 20 && now - lastRiser > 240000) {
        lastRiser = now;
        AudioM.riser(12);
        if (Settings.get("subtitles")) toast("· a sound rising from nowhere ·");
      }
    }

    /* tiredness: only once the house is awake, only if enabled */
    if (!Settings.get("tiredness") || !State.flag("act2")) { fatigue = 0; paintFatigue(0); return; }
    if (st.room !== lastRoomSeen) { lastRoomSeen = st.room; fatigue = Math.max(0, fatigue - 120); }
    fatigue += 10;
    if (fatigue >= 480) { paintFatigue(4); blackout(); return; }
    const stage = fatigue >= 430 ? 4 : fatigue >= 360 ? 3 : fatigue >= 280 ? 2 : fatigue >= 180 ? 1 : 0;
    if (stage > fatStage) {
      if (stage === 1) Dialogue.say("My eyes are heavy. When did I last blink on purpose?");
      if (stage === 3) Dialogue.say("The edges of the room are going soft. I need to move, touch something, run the tap. Anything.");
      if (stage === 4) { AudioM.dread(); Dialogue.say(["Staying awake is becoming a decision I have to keep making.", "And I have the feeling the house is waiting for me to stop making it."]); }
    }
    paintFatigue(stage);
  }

  /* doing things keeps you awake: every deliberate interaction eases fatigue */
  function wireFatigueEase() {
    document.getElementById("stage").addEventListener("pointerdown", () => {
      fatigue = Math.max(0, fatigue - 15);
    }, { passive: true });
  }

  /* ---------- flow ---------- */
  function newGame() {
    State.reset();
    startPlay(true);
  }
  function continueGame() {
    if (!State.load()) { newGame(); return; }
    startPlay(false);
  }
  function startPlay(fresh) {
    playing = true;
    lastRoomSeen = State.get().room;
    fatigue = 0; paintFatigue(0);
    document.getElementById("menu").classList.add("hidden");
    document.getElementById("ending").classList.add("hidden");
    document.getElementById("hud").classList.remove("hidden");
    AudioM.unlockOnGesture();
    AudioM.startAmbient();
    Rooms.render();
    refreshHUD();
    if (fresh) {
      Dialogue.say([
        "House 17. Last house on a street the streetlights gave up on.",
        "One red notebook, from the upstairs study. In and out. Nothing else.",
      ]);
    } else {
      Dialogue.say("The house again. It doesn't look surprised to see me.");
    }
  }
  function toMenu() {
    playing = false;
    paintFatigue(0);
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("ending").classList.add("hidden");
    document.getElementById("menu").classList.remove("hidden");
    document.getElementById("scene-holder").innerHTML = "";
    Dialogue.clear();
    AudioM.stopAmbient();
    document.getElementById("btn-continue").disabled = !State.hasSave();
  }

  /* ---------- boot ---------- */
  function bootLoader() {
    const loader = document.getElementById("loader");
    if (!loader) return;
    const bar = document.getElementById("loader-bar");
    const line = document.getElementById("loader-line");
    const LINES = ["the house is waking up", "dusting the hallway", "checking the locks", "setting your place at the table", "counting to seventeen"];
    let i = 0;
    const lineIv = setInterval(() => { i = (i + 1) % LINES.length; if (line) line.textContent = LINES[i]; }, 720);
    let p = 0;
    const barIv = setInterval(() => { p = Math.min(100, p + 13); if (bar) bar.style.width = p + "%"; if (p >= 100) clearInterval(barIv); }, 190);
    const done = () => {
      clearInterval(lineIv); clearInterval(barIv);
      if (bar) bar.style.width = "100%";
      loader.classList.add("done");
      setTimeout(() => loader.remove(), 700);
    };
    if (document.readyState === "complete") setTimeout(done, 1500);
    else window.addEventListener("load", () => setTimeout(done, 500));
  }

  function boot() {
    Settings.load();
    bootLoader();
    Stage.init();
    Cursor.init();
    Dialogue.initEvents();
    wireFatigueEase();
    setInterval(houseTick, 10000);

    document.getElementById("btn-new").addEventListener("click", () => {
      if (State.hasSave()) {
        Popups.open({
          title: "START OVER?",
          bodyHTML: "<p>A saved visit exists. Starting a new game will erase it.</p>",
          buttons: [
            { label: "Cancel" },
            { label: "New game", cls: "danger", onClick: () => { Popups.closeAll(); newGame(); } },
          ],
        });
      } else newGame();
    });
    document.getElementById("btn-continue").addEventListener("click", continueGame);
    document.getElementById("btn-how").addEventListener("click", openHow);
    document.getElementById("btn-settings").addEventListener("click", openSettings);
    document.getElementById("btn-credits").addEventListener("click", openCredits);
    document.getElementById("btn-hint").addEventListener("click", openHints);
    document.getElementById("btn-menu").addEventListener("click", openPause);
    document.getElementById("btn-lens").addEventListener("click", () => {
      if (typeof FX !== "undefined") FX.labelsOn(!Settings.get("labelsOn"));
      AudioM.click();
      refreshHUD();
    });
    document.getElementById("btn-notes").addEventListener("click", openNotes);
    document.getElementById("btn-continue").disabled = !State.hasSave();

    EVENTS.on("objective", refreshHUD);
    EVENTS.on("inventory", refreshHUD);
    EVENTS.on("secret", () => {});

    if (typeof FX !== "undefined" && FX.trackPointer) FX.trackPointer();

    window.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      const hudHidden = document.getElementById("hud").classList.contains("hidden");
      if (e.key === Controls.get("hints")) { if (!hudHidden) openHints(); }
      if (e.key === Controls.get("pause")) { if (!hudHidden && Popups.count() === 0) openPause(); }
      if (e.key === Controls.get("labels")) { if (!hudHidden && State.hasItem("lens")) { if (typeof FX !== "undefined") FX.labelsOn(!Settings.get("labelsOn")); refreshHUD(); } }
      if (!hudHidden && Popups.count() === 0) {
        if (e.key === Controls.get("left")) {
          const b = document.getElementById("nav-left");
          if (b && !b.hidden) { e.preventDefault(); b.click(); }
        } else if (e.key === Controls.get("right")) {
          const b = document.getElementById("nav-right");
          if (b && !b.hidden) { e.preventDefault(); b.click(); }
        }
      }
    });

    // graceful error fallback — never a blank screen
    window.addEventListener("error", (e) => {
      if (document.getElementById("scene-holder").innerHTML === "" && document.getElementById("menu").classList.contains("hidden")) {
        toMenu();
        Popups.open({ title: "SOMETHING SLIPPED", bodyHTML: "<p>The house dropped a thought. Your progress is saved. Continue from the menu.</p>" });
      }
    });
  }

  return { boot, newGame, continueGame, toMenu, notebookOpened, finalDoorOpened, ending, refreshHUD, openSettings, openHints };
})();

document.addEventListener("DOMContentLoaded", Game.boot);
