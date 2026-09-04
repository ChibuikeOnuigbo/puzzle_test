/* HOUSE 17 — core systems: state/save, popups (z-managed), cursor, dialogue, hints, stage scaling. */
"use strict";

/* ---------------- Event bus ---------------- */
const EVENTS = (() => {
  const map = {};
  return {
    on(ev, fn) { (map[ev] = map[ev] || []).push(fn); },
    emit(ev, data) { (map[ev] || []).forEach(fn => fn(data)); },
  };
})();

/* ---------------- Settings ---------------- */
const Settings = (() => {
  let s = { ...DEFAULT_SETTINGS };
  function load() {
    try {
      const raw = localStorage.getItem(GAME_CONFIG.settingsKey);
      if (raw) s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {}
    apply();
  }
  function save() { try { localStorage.setItem(GAME_CONFIG.settingsKey, JSON.stringify(s)); } catch (e) {} }
  function apply() {
    document.body.classList.toggle("reduced", !!s.reducedMotion);
    document.documentElement.style.setProperty("--tx", s.textSize);
    AudioM.setVolumes({ master: s.master, sfx: s.sfx, ambient: s.ambient });
  }
  return {
    get: k => s[k],
    set(k, v) { s[k] = v; apply(); save(); },
    all: () => s,
    load,
  };
})();

/* ---------------- Controls: rebindable keys ----------------
   KEYBOARD_KEYS is the gamified list of every key on the keyboard, so the
   settings "Controls" page can render and validate any binding. */
const Controls = (() => {
  function all() {
    return { ...DEFAULT_KEYS, ...(Settings.get("keys") || {}) };
  }
  function get(action) { return all()[action] || DEFAULT_KEYS[action]; }
  function set(action, key) {
    const keys = { ...(Settings.get("keys") || {}) };
    keys[action] = key;
    Settings.set("keys", keys);
  }
  function reset() { Settings.set("keys", {}); }
  function glyph(key) {
    if (typeof KEYBOARD_KEYS === "undefined") return key;
    const k = KEYBOARD_KEYS.find(k => k.key === key);
    return k ? k.glyph : key;
  }
  function label(key) {
    const g = glyph(key);
    if (g === "Space") return "Space";
    if (g.length === 1) return g.toUpperCase();
    return g;
  }
  return { all, get, set, reset, glyph, label };
})();

/* ---------------- Game state + save ---------------- */
const State = (() => {
  const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const fresh = () => ({
    room: "porch",
    objective: "find_key",
    flags: {},            // arbitrary boolean/int flags
    inventory: [],        // item ids
    secrets: [],          // found secret ids
    hintsUsed: 0,
    startedAt: Date.now(),
    playMs: 0,
    clickCounts: {},      // per-hotspot click counters for varied responses
    bag: [],              // the satchel: up to 5 stored item ids
    selected: null,       // the tool currently in hand, used with the E key
    collected: {},        // item id -> timestamp of when it was picked up
    // per-run randomized counting puzzle: the kitchen contains these amounts,
    // and the lockbox code is the counts in shopping list order
    counts: (() => {
      const c = { milk: rnd(2, 5), bread: rnd(1, 3), apples: rnd(3, 6), batteries: rnd(2, 4) };
      c.code = "" + c.milk + c.bread + c.apples + c.batteries;
      return c;
    })(),
    // the house remembers what you said, and what you did
    speechLog: [],      // everything the protagonist says out loud
    monologueCount: 0,  // how much talking the player has done
    chronicle: [],      // speech + events, a running transcript
    checkpoint: null,   // { room, objective } — where the house lets you return
    notes: [],          // mission notes collected at checkpoints
  });
  let st = fresh();
  let lastTick = Date.now();

  function tick() { const n = Date.now(); st.playMs += n - lastTick; lastTick = n; }
  setInterval(tick, 5000);

  function save() {
    tick();
    try { localStorage.setItem(GAME_CONFIG.saveKey, JSON.stringify(st)); } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(GAME_CONFIG.saveKey);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.room) return false;
      st = { ...fresh(), ...data };
      lastTick = Date.now();
      return true;
    } catch (e) { return false; }
  }
  function hasSave() {
    try { return !!localStorage.getItem(GAME_CONFIG.saveKey); } catch (e) { return false; }
  }
  function reset() {
    st = fresh(); lastTick = Date.now();
    try { localStorage.removeItem(GAME_CONFIG.saveKey); } catch (e) {}
  }
  return {
    get: () => st,
    flag: (k) => st.flags[k],
    setFlag(k, v = true) { st.flags[k] = v; save(); },
    /* House awareness: the house learns from how the player behaves */
    addAware(n = 1) { st.flags.aware = (st.flags.aware || 0) + n; save(); },
    aware() { return st.flags.aware || 0; },
    addItem(id) {
      if (!st.inventory.includes(id)) {
        st.inventory.push(id);
        if (!st.collected) st.collected = {};
        st.collected[id] = Date.now();
        if (!st.selected) st.selected = id;   // one thing in hand, by default
        save();
        EVENTS.emit("inventory", id);
      }
    },
    removeItem(id) {
      st.inventory = st.inventory.filter(i => i !== id);
      if (st.selected === id) st.selected = st.inventory.length ? st.inventory[st.inventory.length - 1] : null;
      save();
      EVENTS.emit("inventory", null);
    },
    hasItem: id => st.inventory.includes(id),
    setObjective(o) { st.objective = o; save(); EVENTS.emit("objective", o); },
    setRoom(r) { st.room = r; save(); },
    foundSecret(id) {
      if (st.secrets.includes(id)) return false;
      st.secrets.push(id); save(); EVENTS.emit("secret", id); return true;
    },
    bumpClick(id) { st.clickCounts[id] = (st.clickCounts[id] || 0) + 1; return st.clickCounts[id]; },
    /* the satchel: five pockets, and the house's own rules about paper */
    bagList: () => st.bag || (st.bag = []),
    bagPut(id) { if (!st.bag) st.bag = []; if (st.bag.length >= 5 || st.bag.includes(id)) return false; st.bag.push(id); save(); return true; },
    bagTake(id) { if (!st.bag) return; st.bag = st.bag.filter(i => i !== id); save(); },
    /* selected tool: one thing in hand, used with E or a double click */
    select(id) { st.selected = id; save(); },
    selected: () => st.selected,
    collectedAt: id => (st.collected && st.collected[id]) || null,
    useHint() { st.hintsUsed++; save(); },
    /* speech + events: the house keeps a transcript of everything you say and do */
    logSpeech(text) {
      if (!st.speechLog) st.speechLog = [];
      st.speechLog.push({ t: Date.now(), text });
      if (st.speechLog.length > 250) st.speechLog = st.speechLog.slice(-250);
      st.monologueCount = (st.monologueCount || 0) + 1;
      if (!st.chronicle) st.chronicle = [];
      st.chronicle.push({ t: Date.now(), kind: "say", text });
      if (st.chronicle.length > 500) st.chronicle = st.chronicle.slice(-500);
      // save is intentionally throttled: only every 20 lines to avoid churn
      if (st.monologueCount % 20 === 0) save();
    },
    logEvent(kind, text) {
      if (!st.chronicle) st.chronicle = [];
      st.chronicle.push({ t: Date.now(), kind, text });
      if (st.chronicle.length > 500) st.chronicle = st.chronicle.slice(-500);
      save();
    },
    /* checkpoints: the house lets you keep a foothold after hard tasks */
    setCheckpoint(note) {
      st.checkpoint = { room: st.room, objective: st.objective };
      if (!st.notes) st.notes = [];
      st.notes.push({ t: Date.now(), note, room: st.room });
      save();
      EVENTS.emit("checkpoint", note);
      try { toast("Checkpoint · " + note); } catch (e) {}
      if (typeof Game !== "undefined" && Game.refreshHUD) Game.refreshHUD();
    },
    respawnCheckpoint() {
      if (!st.checkpoint) return false;
      st.room = st.checkpoint.room;
      st.objective = st.checkpoint.objective;
      save();
      return true;
    },
    notesList: () => st.notes || [],
    speechList: () => st.speechLog || [],
    chronicle: () => st.chronicle || [],
    monologue: () => st.monologueCount || 0,
    save, load, hasSave, reset,
    playMinutes: () => { tick(); return Math.max(1, Math.round(st.playMs / 60000)); },
  };
})();

/* ---------------- Popup manager (strict z-stacking) ---------------- */
const Popups = (() => {
  const root = () => document.getElementById("popup-root");
  const stack = [];
  const BASE_Z = 1000;

  function open(opts) {
    // opts: {title, bodyHTML|bodyEl, buttons:[{label,cls,onClick,close}], closable=true, className, onClose, noHead}
    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";
    overlay.style.zIndex = BASE_Z + stack.length * 10;

    const panel = document.createElement("div");
    panel.className = "popup-panel" + (opts.className ? " " + opts.className : "");

    if (!opts.noHead) {
      const head = document.createElement("div");
      head.className = "popup-head";
      head.innerHTML = `<h2>${opts.title || ""}</h2>`;
      if (opts.closable !== false) {
        const x = document.createElement("button");
        x.className = "popup-close"; x.textContent = "✕"; x.setAttribute("aria-label", "Close");
        x.addEventListener("click", () => close(handle));
        head.appendChild(x);
      }
      panel.appendChild(head);
    }

    const body = document.createElement("div");
    body.className = "popup-body";
    if (opts.bodyEl) body.appendChild(opts.bodyEl);
    else body.innerHTML = opts.bodyHTML || "";
    panel.appendChild(body);

    if (opts.buttons && opts.buttons.length) {
      const foot = document.createElement("div");
      foot.className = "popup-foot";
      opts.buttons.forEach(b => {
        const btn = document.createElement("button");
        btn.className = "btn small" + (b.cls ? " " + b.cls : "");
        btn.textContent = b.label;
        btn.addEventListener("click", () => {
          if (b.onClick) b.onClick(handle);
          if (b.close !== false) close(handle);
        });
        foot.appendChild(btn);
      });
      panel.appendChild(foot);
    }

    overlay.appendChild(panel);
    // click outside closes (topmost only)
    overlay.addEventListener("pointerdown", (e) => {
      if (e.target === overlay && opts.closable !== false && top() === handle) close(handle);
    });
    panel.addEventListener("pointerdown", e => e.stopPropagation());

    root().appendChild(overlay);
    const handle = { overlay, panel, body, opts };
    stack.push(handle);
    AudioM.open();
    return handle;
  }

  function close(handle) {
    const i = stack.indexOf(handle);
    if (i < 0) return;
    stack.splice(i, 1);
    handle.overlay.classList.add("closing");
    AudioM.close();
    setTimeout(() => handle.overlay.remove(), Settings.get("reducedMotion") ? 0 : 160);
    if (handle.opts.onClose) handle.opts.onClose();
  }
  function top() { return stack[stack.length - 1] || null; }
  function closeTop() { const t = top(); if (t && t.opts.closable !== false) close(t); }
  function closeAll() { [...stack].forEach(close); }

  window.addEventListener("keydown", e => { if (e.key === "Escape") closeTop(); });
  return { open, close, closeTop, closeAll, top, count: () => stack.length };
})();

/* ---------------- Custom cursor + click ripple ---------------- */
const Cursor = (() => {
  const el = () => document.getElementById("cursor");
  const label = () => document.getElementById("cursor-label");
  let x = -100, y = -100, raf = null;
  const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

  function init() {
    // click ripple + audio unlock work on ALL devices, including touch
    window.addEventListener("pointerdown", (e) => {
      spawnRipple(e.clientX, e.clientY);
      AudioM.unlockOnGesture();
      if (!isTouch) el().classList.add("down");
    });
    if (isTouch) { document.body.classList.add("touch"); return; }
    document.body.classList.add("custom-cursor");
    window.addEventListener("pointermove", (e) => {
      x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    }, { passive: true });
    window.addEventListener("pointerup", () => el().classList.remove("down"));
    document.addEventListener("mouseleave", () => el().classList.add("hidden"));
    document.addEventListener("mouseenter", () => el().classList.remove("hidden"));
    // hover state via delegation
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("button, .hotspot, a, input, .inv-item, [data-hoverable]");
      const lbl = label();
      if (t) {
        el().classList.add("hover");
        const txt = t.dataset && t.dataset.label;
        lbl.textContent = txt || "";
        if (txt) {
          // measure the label, then keep it inside the viewport: flip it to
          // the left of the cursor near the right edge, and above near the bottom
          lbl.style.left = "20px";
          lbl.style.top = "12px";
          lbl.style.display = "block";
          const w = lbl.offsetWidth, h = lbl.offsetHeight;
          const vw = window.innerWidth, vh = window.innerHeight;
          if (x + 20 + w > vw - 8) {
            const leftAligned = -(w + 20);
            lbl.style.left = (x - w - 20 < 0) ? `${8 - x}px` : `${leftAligned}px`;
          }
          if (y + 12 + h > vh - 8) lbl.style.top = `${-(h + 20)}px`;
        } else {
          lbl.style.display = "none";
        }
        if (t.classList.contains("hotspot") || t.tagName === "BUTTON") AudioM.hover();
      } else {
        el().classList.remove("hover");
        lbl.style.display = "none";
      }
    }, true);
  }
  function paint() { raf = null; el().style.transform = `translate(${x}px,${y}px)`; }

  function spawnRipple(cx, cy) {
    if (Settings.get("reducedMotion")) return;
    const roomCfg = ROOM_CONFIG[State.get().room];
    const color = (Popups.count() > 0) ? "#d8c9a8" : (roomCfg ? roomCfg.ripple : "#d8c9a8");
    const wrap = document.createElement("div");
    wrap.className = "ripple";
    wrap.style.transform = `translate(${cx}px,${cy}px)`;
    wrap.innerHTML = `<i style="border-color:${color}"></i><i style="border-color:${color}"></i>`;
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 750);
  }
  return { init };
})();

/* ---------------- Dialogue (typewriter, state machine — input is NEVER buffered) ----------------
   Rule: a new say() REPLACES whatever is queued. Spam clicking can never bank up
   future lines; when the player stops clicking, the narration stops with them. */
const Dialogue = (() => {
  const box = () => document.getElementById("dialogue");
  const txt = () => document.getElementById("dialogue-text");
  const keycap = () => document.getElementById("dialogue-key");
  let queue = [], typing = false, timer = null, full = "", idx = 0, hideTimer = null;
  let advancing = false; // consume-token: one advance per pointer event

  /* when the protagonist monologues too much, he notices. Affectionately. */
  const META_LINES = [
    "I am narrating out loud again. The house probably enjoys the commentary. I should charge it rent.",
    "Note to self: less dramatic commentary, more leaving. The house is not keeping me for my reviews.",
    "I monologue when I am scared. The house knows this now. I have told it, in detail, out loud.",
    "Some people bite their nails. I talk to an empty house about its wallpaper. We all cope.",
    "I would stop talking to myself, but I am the only witness here, and the house does not take notes.",
    "Three sentences ago I was telling this house my feelings. It did not interrupt. It never interrupts.",
    "I keep a running commentary because the silence in here is worse. The silence is also listening.",
  ];

  function refreshKeycap() {
    const k = keycap();
    if (!k) return;
    const key = (typeof Controls !== "undefined" ? Controls.get("skip") : "Enter");
    k.textContent = (typeof Controls !== "undefined" ? Controls.label(key) : "Enter");
    k.setAttribute("aria-label", "Skip with " + key);
  }

  function say(lines) {
    if (!Array.isArray(lines)) lines = [lines];
    lines = lines.filter(l => l && typeof l === "string" && l.trim());
    // REPLACE the queue — never accumulate stale narration from click spam
    queue = [...lines];
    clearTimeout(timer); clearTimeout(hideTimer);
    typing = false;
    // the house writes down everything you say, and so do you
    lines.forEach(t => { try { State.logSpeech(t); } catch (e) {} });
    // a little fun: after enough monologuing, he catches himself doing it
    const mc = (typeof State !== "undefined" && State.monologue) ? State.monologue() : 0;
    if (mc > 0 && mc % 28 === 0) {
      queue.push(META_LINES[Math.floor(Math.random() * META_LINES.length)]);
    }
    refreshKeycap();
    next();
  }
  function next() {
    clearTimeout(hideTimer);
    if (!queue.length) { hideTimer = setTimeout(hide, 2600); return; }
    full = queue.shift(); idx = 0; typing = true;
    box().classList.remove("hidden");
    txt().textContent = "";
    if (Settings.get("reducedMotion")) { txt().textContent = full; typing = false; hideTimer = setTimeout(() => next(), Math.max(1700, full.length * 34)); return; }
    step();
  }
  function step() {
    if (idx <= full.length) {
      txt().textContent = full.slice(0, idx);
      idx += 1;
      timer = setTimeout(step, GAME_CONFIG.typewriterMs);
    } else {
      typing = false;
      hideTimer = setTimeout(() => next(), Math.max(1500, full.length * 30));
    }
  }
  /* advance right now: completes the typewriter and moves to the next line
     (or hides the box when the queue runs dry). Enter uses this so skipping
     is instant and repeatable; the pointer keeps its one-advance-per-event rule. */
  function advanceNow() {
    clearTimeout(timer); clearTimeout(hideTimer);
    if (typing) { txt().textContent = full; typing = false; }
    if (queue.length) next();
    else hide();
  }
  function skipOrAdvance(fromKey) {
    if (fromKey) {
      const k = keycap();
      if (k) { k.classList.remove("pressed"); void k.offsetWidth; k.classList.add("pressed"); }
      advanceNow();
      return;
    }
    if (advancing) return;           // consume: one advance per pointer event
    advancing = true;
    setTimeout(() => { advancing = false; }, 120);
    if (typing) { clearTimeout(timer); txt().textContent = full; typing = false; hideTimer = setTimeout(() => next(), Math.max(1400, full.length * 26)); }
    else { clearTimeout(hideTimer); next(); }
  }
  function hide() { box().classList.add("hidden"); }
  function clear() { queue = []; clearTimeout(timer); clearTimeout(hideTimer); typing = false; hide(); }
  function initEvents() {
    box().addEventListener("pointerdown", (e) => { e.stopPropagation(); if (Popups.count() > 0) return; skipOrAdvance(false); });
    const k = keycap();
    if (k) k.addEventListener("pointerdown", (e) => { e.stopPropagation(); if (Popups.count() > 0) return; skipOrAdvance(true); });
    refreshKeycap();
    window.addEventListener("keydown", (e) => {
      const key = (typeof Controls !== "undefined" ? Controls.get("skip") : "Enter");
      if (e.key !== key) return;
      if (box().classList.contains("hidden")) return;
      if (Popups.count() > 0) return;
      e.preventDefault();
      skipOrAdvance(true);
    });
  }
  /* Varied response picker. The protagonist notices their own repetition:
     heavy spam earns self aware lines instead of endlessly cycling the pool. */
  const REPEAT_LINES = [
    "Why am I counting these?",
    "That is the fourth time I have checked.",
    "I keep checking the same thing. It has not changed.",
    "What am I doing? It was the same a second ago.",
    "I know what is there. I looked. Twice.",
    "If it changes, it will not be while I am staring at it.",
    "Enough. The house is patient. I should be too.",
  ];
  function pick(id, pool) {
    const n = State.bumpClick(id);
    if (n >= 4) {
      // from the 4th rapid re-check onward, mix in self aware commentary
      if ((n - 4) % 2 === 0) return REPEAT_LINES[Math.floor((n - 4) / 2) % REPEAT_LINES.length];
    }
    return pool[(n - 1) % pool.length];
  }
  return { say, hide, clear, initEvents, pick, refreshKeycap };
})();

/* ---------------- Mirror return: the house repairs the glass ----------------
   Once the mirror is shattered, every 17 seconds the house checks whether
   the player has left the hallway. The moment they are gone, the mirror
   quietly comes back, cracked. One return only: the surprise is in the
   noticing, and the house never repeats a trick it has already landed. */
const MirrorReturn = (() => {
  let iv = null;
  const CADENCE_MS = 17000;
  function attempt() {
    if (!State.flag("mirrorShattered") || State.flag("mirrorReturned")) { stop(); return false; }
    if (State.get().room === "hallway") return false; // the glass waits to be unobserved
    stop();
    if (typeof Mirror !== "undefined" && Mirror.heal) {
      Mirror.heal();
    } else {
      State.setFlag("mirrorShattered", false);
      State.setFlag("mirrorCracked", true);
      State.setFlag("mirrorReturned", true);
    }
    return true;
  }
  function start() {
    if (iv || State.flag("mirrorReturned")) return;
    iv = setInterval(attempt, CADENCE_MS);
  }
  function stop() { if (iv) { clearInterval(iv); iv = null; } }
  return { start, stop, attempt, cadence: CADENCE_MS };
})();

/* ---------------- Stage scaling ---------------- */
const Stage = (() => {
  function fit() {
    const st = document.getElementById("stage");
    const s = Math.min(window.innerWidth / GAME_CONFIG.stage.w, window.innerHeight / GAME_CONFIG.stage.h);
    st.style.transform = `translate(-50%,-50%) scale(${s})`;
    st.style.left = "50%"; st.style.top = "50%";
  }
  function init() { fit(); window.addEventListener("resize", fit); }
  return { init, fit };
})();

/* ---------------- Small helpers ---------------- */
function $(sel) { return document.querySelector(sel); }
function toast(msg) {
  const t = document.createElement("div");
  t.className = "secret-toast"; t.textContent = msg;
  $("#stage").appendChild(t);
  setTimeout(() => t.remove(), 3100);
}
/* an unrecorded mini-mission: a transient nudge to help the player along.
   Never written to objectives or notes, never saved. */
function mission(text) {
  const t = document.createElement("div");
  t.className = "mission-toast";
  const tag = document.createElement("span");
  tag.className = "mission-tag"; tag.textContent = "a small task";
  const msg = document.createElement("span");
  msg.textContent = text;
  t.appendChild(tag); t.appendChild(msg);
  $("#stage").appendChild(t);
  setTimeout(() => t.remove(), 4600);
}
function fadeTransition(fn, dur) {
  const f = $("#fader");
  f.classList.add("on");
  const wait = Settings.get("reducedMotion") ? 130 : (dur || 460);
  setTimeout(() => { fn(); setTimeout(() => f.classList.remove("on"), 60); }, wait);
}
