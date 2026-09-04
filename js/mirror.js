/* HOUSE 17 — the mirror arc: the glass the house keeps bringing back.
   Whole → cracked → shattered → returned (healed, needs 5 hits) → ...
   A complete 150 entry dictionary covers the player who keeps breaking it. */
"use strict";

const Mirror = (() => {
  const HANDBREAK = 9;   // shatter count after which the hand comes out
  const MOVEBREAK = 3;   // shatter count after which the mirror starts moving
  const BLOODBREAK = 6;  // shatter count after which the wall bleeds STOP

  function capword(n) { const w = (typeof numword !== "undefined" ? numword(n) : String(n)); return w.charAt(0).toUpperCase() + w.slice(1); }
  function nw(n) { return (typeof numword !== "undefined" ? numword(n) : String(n)); }

  /* ---- the full dictionary: up to 150 distinct reactions ---- */
  const MIRROR_DICT = (() => {
    const hand = [
      "It broke! The whole glass let go at once. Not outward. Inward, like something inhaled it.",
      "Behind it there is no wall. A small dark hollow, and two points of lamplight at child height, looking back.",
      "The house did not break the mirror. It opened it.",
      "Again? It shattered the instant I touched it. I barely pressed.",
      "The glass folded in on itself. My ears are still ringing from a crash that made no sound.",
      "It does not fall. It is pulled. Every shard lands inside, not out.",
      "I keep expecting the pieces to stay broken. The house keeps filing them back into a mirror.",
      "Broken again. And behind the glass, the hollow is a little wider than last time. I am sure of it.",
      "The sound it makes is less like breaking and more like a door finally opening.",
      "Seventeen shards, give or take. I counted before they vanished. The house noticed me counting.",
      "It shatters like it has been holding its breath, waiting for me to come back.",
      "The frame broke too this time. Wood and glass, and still the hollow behind it hangs in place.",
      "I am not sweeping up. Let the house tidy its own tantrums.",
      "Every time it shatters, the eyes in the hollow are closer to the glass.",
      "The dark behind the mirror smells like a room. A room with a bed in it, I think.",
      "This mirror is a doorway that only opens when it breaks. I wish I could stop testing that theory.",
      "Broken. And somewhere very far behind it, something shifted its weight.",
      "I heard a child's breath in the glass this time. I am choosing to believe it was my own.",
      "The cracks did not start where I touched. They started where my reflection's eyes would be.",
      "It came apart like a held breath. Slowly, then all at once, then inward.",
      "Again. The house is not angry. It is patient, and it is teaching me a shape I do not want to learn.",
      "The glass is gone. The frame is splintered. The hollow is waiting. It is always waiting.",
      "I should stop. I should absolutely stop. And yet here I am, and here it is, open again.",
      "That is the glass giving way. It gets easier for it each time. It has practice now.",
      "The mirror broke before I finished reaching for it. It knows what I came to do.",
    ];
    const arr = hand.slice();
    const T = [
      (n) => `${capword(n)} times. I have stopped calling it breaking. It is more like the glass exhaling.`,
      (n) => `${capword(n)}. The house brings the mirror back and I keep breaking it. We are in a loop and only one of us is bored.`,
      (n) => `${capword(n)} shatters now. The hollow behind the glass has stopped pretending to be a wall.`,
      (n) => `That makes ${nw(n)}. I am keeping count. So is the house. Its count is better than mine.`,
      (n) => `${capword(n)} times, and the eyes in the dark have not blinked once.`,
      (n) => `I could stop at ${nw(n)}. I could walk away. The house is betting I will not.`,
      (n) => `${capword(n)}. Each time it comes back a little better, and each time it breaks a little more willingly.`,
      (n) => `Number ${nw(n)}. The mirror is back and I am the one who cannot leave well enough alone.`,
      (n) => `${capword(n)} times I have opened this thing. For a man who hates what is behind it, I am very devoted to checking.`,
      (n) => `Seventeen would be a coincidence. ${capword(n)} is a habit. The house has habits.`,
    ];
    for (let i = hand.length; i < 150; i++) arr.push(T[(i - hand.length) % T.length](i + 1));
    return arr;
  })();

  function dictLine(n) { return MIRROR_DICT[Math.max(0, Math.min(149, n - 1))]; }

  const HOLLOW_POOL = [
    "The hollow behind the frame is empty now. Or it is very good at being looked at.",
    "Two points of lamplight, child height, far too far back for the depth of that wall.",
    "I am not sweeping up the glass. The house can file its own breakage.",
    "No wall behind the glass. Eleven years I would have called that impossible. It is not even the strangest thing on this corridor.",
    "The darkness behind the mirror is warm. Rooms behind mirrors should not be warm.",
  ];
  const HEAL_HITS = [
    "The glass is whole again. Polished. Somebody, something, hung it back and wiped it clean.",
    "It does not even look cracked. Better than new. I hit it. Hard. And it came back nicer.",
    "Whole. The frame is dusted. It wants me to notice how well it has been cared for.",
  ];
  const HIT_LINES = (hits) => [
    `I tap the glass. Nothing. It is solid again. ${hits} of 5. I am keeping score with a mirror.`,
    `A knock, and the glass answers like ordinary glass for once. ${hits} of 5.`,
    `Still whole. It is letting me build up to it. ${hits} of 5.`,
    `The glass holds. ${hits} of 5. It wants five. I do not know why I know that.`,
  ];

  /* ---------------- state helpers ---------------- */
  const breaks = () => State.flag("mirrorBreaks") || 0;

  function shatter() {
    State.setFlag("mirrorShattered", true);
    State.setFlag("mirrorCracked", false);
    const b = breaks() + 1;
    State.setFlag("mirrorBreaks", b);
    State.addAware(4);
    try { AudioM.error(); AudioM.dread(); } catch (e) {}
    Rooms.render();
    if (typeof MirrorReturn !== "undefined") MirrorReturn.start();
    Dialogue.say([dictLine(b), mirrorMovedLine()]);
    if (b >= HANDBREAK && !State.flag("mirrorHandDone")) {
      State.setFlag("mirrorHandDone", true);
      setTimeout(() => handGrab(), 2600);
    }
  }

  function mirrorMovedLine() {
    const m = State.flag("mirrorMoved") || 0;
    if (m === 1 && !State.flag("sawMove1")) { State.setFlag("sawMove1"); return "Wait. The mirror is not where it hung. It has shifted toward the stairs. Not much. Enough."; }
    if (m === 2 && !State.flag("sawMove2")) { State.setFlag("sawMove2"); return "It moved again. Lower this time, and turned a few degrees, like it is trying to watch me better."; }
    return "";
  }

  /* what the house does while you are gone: heal the glass, move it, bleed */
  function heal() {
    if (!State.flag("mirrorShattered") || State.flag("mirrorReturned")) return;
    State.setFlag("mirrorShattered", false);
    State.setFlag("mirrorCracked", false);
    State.setFlag("mirrorHealed", true);
    State.setFlag("mirrorHits", 0);
    State.setFlag("mirrorReturned", true);
    const b = breaks();
    if (b >= MOVEBREAK && !State.flag("mirrorMoved")) State.setFlag("mirrorMoved", 1);
    else if (b >= BLOODBREAK && State.flag("mirrorMoved") === 1) State.setFlag("mirrorMoved", 2);
    if (b >= BLOODBREAK) State.setFlag("mirrorBlood", true);
    try { AudioM.whisperTone(); } catch (e) {}
  }

  /* the returned-mirror notice, fired when the player re enters the hallway */
  function returnLines() {
    const b = breaks();
    const m = State.flag("mirrorMoved") || 0;
    const base = ["What? No. I broke this mirror."];
    if (m >= 1) base.push("It hangs where it always hung. Only not quite. It has moved. It is whole. Nothing in this house stays broken, and nothing in this house stays put.");
    else base.push("It hangs where it always hung. Whole, polished, watching the hallway, as if it never came apart.");
    if (State.flag("mirrorBlood") && !State.flag("sawBlood")) {
      State.setFlag("sawBlood");
      base.push("And the wall behind it. I did not write that. I did not write STOP on the wall.");
      base.push("It is not paint. It is not rust. It is warm. The wall is warm where the word is.");
    }
    base.push(b >= HANDBREAK ? "And the mirror is patient. It knows I will break it again. It is counting on it." : "Nothing in this house stays broken for long. Or nothing in this house was ever really broken.");
    return base;
  }

  /* ---------------- the tap handler ---------------- */
  function tap() {
    const act2 = State.flag("act2");
    if (State.flag("mirrorShattered")) {
      State.addAware(1);
      Dialogue.say(Dialogue.pick("mirror4", HOLLOW_POOL));
      return;
    }
    if (State.flag("mirrorCracked")) { shatter(); return; }
    if (!act2) {
      Dialogue.say(Dialogue.pick("mirror1", [
        "My reflection is black in this glass. Not shadowed. Black, like the mirror opens onto nothing.",
        "Every mirror should show me standing here. This one keeps only the black, and I cannot decide if that is better.",
        "An old mirror in an old hallway, and no reflection in it. The room behind me is not in there either. Just black.",
        "The glass is clean. Cleaner than anything else here. Someone uses this mirror, and it still shows nobody.",
      ]));
      return;
    }
    if (State.flag("mirrorHealed")) {
      const hits = (State.flag("mirrorHits") || 0) + 1;
      State.setFlag("mirrorHits", hits);
      State.addAware(1);
      if (hits >= 5) {
        State.setFlag("mirrorCracked", true);
        State.setFlag("mirrorHealed", false);
        State.setFlag("mirrorHits", 0);
        try { AudioM.error(); } catch (e) {}
        Rooms.render();
        Dialogue.say(["Crack. Five hits. The glass gives exactly on five, like it was never anything but a lock I had to knock on."]);
      } else {
        Dialogue.say(Dialogue.pick("mirror_hits", HIT_LINES(hits)));
      }
      return;
    }
    const n = State.bumpClick("mirror_act2");
    if (n >= 3) {
      State.setFlag("mirrorCracked", true);
      try { AudioM.error(); } catch (e) {}
      State.addAware(2);
      Rooms.render();
      Dialogue.say([
        "What?! A crack ran through the glass while I watched. Nothing touched it.",
        "It starts exactly where my face was, and branches, like the glass is keeping notes on me.",
      ]);
      return;
    }
    Dialogue.say(Dialogue.pick("mirror2", [
      "Writing on the glass, reversed: LOOK AGAIN. The notebook said the same thing.",
      "LOOK AGAIN. Backwards, so only the mirror can read it properly. My reflection has not come back into the glass.",
      "The mirror wants me to look again. At the photograph? At everything? The glass stays black where my face should be.",
    ]));
  }

  /* ---------------- the hand ---------------- */
  function handGrab() {
    if (State.flag("mirrorHandPlayed")) return;
    State.setFlag("mirrorHandPlayed", true);
    try { AudioM.riser(5); } catch (e) {}

    const stage = document.getElementById("scene-holder");
    const overlay = document.createElement("div");
    overlay.id = "mirror-hand";
    overlay.innerHTML = `
      <div class="mh-vignette"></div>
      <svg viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice">
        <g class="mh-hand">
          <path class="mh-arm" d="M640,760 C 636,640 624,560 596,500 C 574,452 566,420 574,388 C 620,392 640,420 640,470 Z"/>
          <path class="mh-palm" d="M574,388 C 566,352 574,318 596,296 C 610,322 618,352 618,384 Z"/>
          <path class="mh-finger mh-f1" d="M596,296 C 588,252 588,222 600,204 C 610,230 614,258 614,288 Z"/>
          <path class="mh-finger mh-f2" d="M612,286 C 610,240 614,208 628,190 C 632,220 632,252 630,284 Z"/>
          <path class="mh-finger mh-f3" d="M628,288 C 632,244 640,214 656,200 C 652,230 650,260 646,290 Z"/>
          <path class="mh-finger mh-f4" d="M644,292 C 654,252 666,226 684,216 C 672,244 666,272 662,298 Z"/>
          <path class="mh-thumb" d="M574,380 C 552,376 534,384 524,400 C 540,402 556,396 570,388 Z"/>
        </g>
      </svg>`;
    document.getElementById("app").appendChild(overlay);

    stage.classList.add("shake");
    setTimeout(() => {
      stage.classList.remove("shake");
      overlay.remove();
      if (State.hasItem("torch")) hiddenRoom();
      else die();
    }, 1900);
  }

  function die() {
    AudioM.dread();
    fadeTransition(() => {
      const cp = State.get().checkpoint;
      if (cp) {
        State.setRoom(cp.room);
        State.setObjective(cp.objective);
        Rooms.render();
        Dialogue.say([
          "Everything went dark. The hand. The hollow. The word on the wall. All of it.",
          "I am not in the hallway anymore. I am back where I last stood on my own two feet.",
          "A checkpoint. The house lets me keep those. It would rather I was awake, and afraid, and counting.",
        ]);
      } else {
        State.setRoom("hallway");
        State.setObjective("find_study");
        Rooms.render();
        Dialogue.say([
          "Darkness. Then the hallway, and the mirror, whole, watching. I think it put me back.",
          "I should carry a light. Whatever lives behind that glass does not care for the ones who come unprepared.",
        ]);
      }
      State.addAware(10);
    });
  }

  function hiddenRoom() {
    AudioM.footsteps(6);
    const el = document.createElement("div");
    el.innerHTML = `
      <p>Your torch is on. The hand flinches back from the beam, and the hollow opens wide, and the hallway tilts, and you are through.</p>
      <p class="congrats">Congratulations. You found the room behind the mirror. The house did not plan for you to find it. It planned for you to be eaten.</p>
      <p class="dim">Footsteps, soft and bare, somewhere off in the dark. They are not coming toward you. They are waiting for you to follow.</p>
      <p class="dim">Solve the room to leave. The torch is the only honest thing in here.</p>`;
    Popups.open({
      title: "THE HIDDEN ROOM",
      bodyEl: el,
      buttons: [
        { label: "Shine the torch at the hand", cls: "primary", close: false, onClick: (h) => { Popups.close(h); escapeStep1(); } },
      ],
    });
  }

  function escapeStep1() {
    AudioM.flicker();
    const el = document.createElement("div");
    el.innerHTML = `
      <p>The beam lands on the hand and it lets go, melting back into the wall like a shadow under a door.</p>
      <p class="dim">The footsteps stop. Then they start again, three knocks' worth of steps. Short, short, long. The room knows the password.</p>
      <p class="dim">A small chest sits under the empty frame. Its lid is set with three notches, waiting to be knocked.</p>`;
    Popups.open({
      title: "THE HIDDEN ROOM",
      bodyEl: el,
      buttons: [
        { label: "Knock: short, short, long", cls: "primary", close: false, onClick: (h) => { Popups.close(h); escapeStep2(); } },
      ],
    });
  }

  function escapeStep2() {
    AudioM.unlock();
    const el = document.createElement("div");
    el.innerHTML = `
      <p>The chest opens. Inside, wrapped in a handkerchief that is not dusty, a small book and a sliver of black glass.</p>
      <p style="font-style:italic">The book is a ledger. One line is circled, dated the year the house went quiet: "the visitor came for the notebook. he left through the mirror. he did not remember leaving."</p>
      <p class="small-note">The shard is cold even through the cloth. You keep it. It is a gift, and a reminder that the house keeps its own doors.</p>`;
    State.addItem("shard");
    State.addAware(6);
    State.setCheckpoint("The room behind the mirror. I came out with a shard of it.");
    Popups.open({
      title: "A GIFT FROM THE HOUSE",
      bodyEl: el,
      buttons: [{ label: "Follow the light back", cls: "primary", onClick: (h) => { Popups.close(h); Rooms.goto("hallway"); } }],
    });
    if (typeof Game !== "undefined") Game.refreshHUD();
  }

  return { tap, heal, returnLines, dict: MIRROR_DICT };
})();
