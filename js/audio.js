/* HOUSE 17 — AudioManager. All sound is synthesized (WebAudio). No external files, no licenses. */
"use strict";

const AudioM = (() => {
  let ctx = null, master = null, sfxBus = null, ambBus = null;
  let ambientNodes = [];
  let settings = { master: 0.8, sfx: 0.9, ambient: 0.6 };
  let started = false;

  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
      ambBus = ctx.createGain(); ambBus.connect(master);
      applyVolumes();
      return true;
    } catch (e) { return false; }
  }
  function applyVolumes() {
    if (!ctx) return;
    master.gain.value = settings.master;
    sfxBus.gain.value = settings.sfx;
    ambBus.gain.value = settings.ambient;
  }
  function setVolumes(s) { settings = { ...settings, ...s }; applyVolumes(); }

  function env(g, t0, a, peak, d, sustain = 0) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + a + d);
  }
  function tone(freq, type, dur, peak, when = 0, bus = null, slide = null) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    env(g, t0, 0.005, peak, dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noiseBurst(dur, peak, filterFreq, when = 0, q = 1) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = filterFreq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t0, 0.003, peak, dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t0);
  }

  const api = {
    unlockOnGesture() {
      if (started) return; started = true;
      ensure();
    },
    setVolumes,
    /* UI + interaction */
    hover()  { tone(1150, "sine", 0.03, 0.025); },
    click()  { tone(720, "triangle", 0.05, 0.09); noiseBurst(0.03, 0.05, 2400); },
    open()   { tone(320, "sine", 0.14, 0.10, 0, null, 480); },
    close()  { tone(480, "sine", 0.12, 0.08, 0, null, 300); },
    pickup() { tone(560, "sine", 0.09, 0.10); tone(840, "sine", 0.12, 0.09, 0.07); },
    error()  { tone(140, "square", 0.16, 0.07); tone(110, "square", 0.2, 0.06, 0.1); },
    unlock() { tone(420, "sine", 0.1, 0.1); tone(630, "sine", 0.12, 0.1, 0.09); tone(840, "sine", 0.2, 0.09, 0.18); },
    creakDoor(){ tone(90, "sawtooth", 0.5, 0.035, 0, null, 60); noiseBurst(0.35, 0.03, 500, 0, 2); },
    knockShort(){ noiseBurst(0.07, 0.22, 220, 0, 1.4); tone(95, "sine", 0.09, 0.16); },
    knockLong() { noiseBurst(0.16, 0.22, 170, 0, 1.4); tone(70, "sine", 0.3, 0.18); },
    flicker(){ noiseBurst(0.2, 0.05, 3000, 0, 0.6); tone(58, "sawtooth", 0.22, 0.03); },
    tapeStart(){ noiseBurst(0.4, 0.05, 900, 0, 0.5); tone(50, "sine", 0.4, 0.03); },
    discover(){ tone(392, "sine", 0.3, 0.07); tone(494, "sine", 0.32, 0.06, 0.12); tone(587, "sine", 0.5, 0.06, 0.24); },
    dread()   { tone(66, "sine", 1.6, 0.09, 0, null, 55); tone(69, "sine", 1.6, 0.07, 0.05, null, 58); },
    swell()   { tone(196, "sine", 2.2, 0.06); tone(247, "sine", 2.2, 0.05, 0.15); tone(294, "sine", 2.4, 0.05, 0.3); },

    /* Ambient bed: low drone + air. Started once in-game. */
    startAmbient() {
      if (!ensure() || ambientNodes.length) return;
      const mk = (freq, gainV, type) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.value = gainV;
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 0.05 + Math.random() * 0.08;
        lg.gain.value = gainV * 0.5;
        lfo.connect(lg); lg.connect(g.gain);
        o.connect(g); g.connect(ambBus);
        o.start(); lfo.start();
        ambientNodes.push(o, lfo);
      };
      mk(55, 0.05, "sine");
      mk(82.5, 0.02, "sine");
      // filtered noise "air"
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 320;
      const g = ctx.createGain(); g.gain.value = 0.018;
      src.connect(f); f.connect(g); g.connect(ambBus);
      src.start();
      ambientNodes.push(src);
    },
    stopAmbient() {
      ambientNodes.forEach(n => { try { n.stop(); } catch (e) {} });
      ambientNodes = [];
    },
    /* occasional distant creak, subtle */
    randomCreak() {
      if (!ctx || Math.random() > 0.5) return;
      tone(70 + Math.random() * 40, "sawtooth", 0.6, 0.012, 0, ambBus, 50);
    },

    /* toggleable object loops: running tap, stove flame */
    _loops: {},
    startLoop(name) {
      if (!ensure() || this._loops[name]) return;
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      if (name === "water") { f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = 0.7; g.gain.value = 0.05; }
      else if (name === "fire") { f.type = "lowpass"; f.frequency.value = 420; g.gain.value = 0.035; }
      else { f.type = "lowpass"; f.frequency.value = 800; g.gain.value = 0.02; }
      // gentle amplitude wobble so loops feel alive
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = name === "fire" ? 6 + Math.random() * 3 : 2.2;
      lg.gain.value = g.gain.value * 0.5;
      lfo.connect(lg); lg.connect(g.gain);
      src.connect(f); f.connect(g); g.connect(sfxBus);
      src.start(); lfo.start();
      this._loops[name] = [src, lfo];
    },
    stopLoop(name) {
      (this._loops[name] || []).forEach(n => { try { n.stop(); } catch (e) {} });
      delete this._loops[name];
    },
    syncLoops(map) {
      Object.keys(map).forEach(k => map[k] ? this.startLoop(k) : this.stopLoop(k));
    },
    /* a slow, soft drip while the sink overflows or the house has cut the tap */
    _dripIv: null,
    dripLoop(on) {
      if (on && !this._dripIv) {
        this._dripIv = setInterval(() => this.dripPlink(), 820);
      } else if (!on && this._dripIv) {
        clearInterval(this._dripIv); this._dripIv = null;
      }
    },
    dripPlink() {
      if (!ctx) return;
      tone(1500 + Math.random() * 500, "sine", 0.05, 0.014, 0, null, 200);
      tone(900 + Math.random() * 300, "sine", 0.04, 0.012, 0.03, null, 300);
    },
    ignite() { noiseBurst(0.12, 0.1, 900, 0, 0.8); tone(90, "sine", 0.2, 0.06); },
    tapSqueak() { tone(1500, "sine", 0.07, 0.03, 0, null, 900); },

    /* ---- horror layer: sounds that start almost inaudible and rise ---- */
    riser(dur = 12) {
      if (!ensure()) return;
      const t0 = ctx.currentTime;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0004, t0);
      g.gain.exponentialRampToValueAtTime(0.055, t0 + dur * 0.85);
      g.gain.setValueAtTime(0.055, t0 + dur * 0.92);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); // sudden fall to silence
      const f = ctx.createBiquadFilter(); f.type = "lowpass";
      f.frequency.setValueAtTime(110, t0);
      f.frequency.exponentialRampToValueAtTime(760, t0 + dur * 0.9);
      const o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = 46;
      const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = 46.7; // beating detune
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus);
      o1.start(t0); o2.start(t0); o1.stop(t0 + dur + 0.1); o2.stop(t0 + dur + 0.1);
    },
    footsteps(n = 4) {
      if (!ensure()) return;
      for (let i = 0; i < n; i++) {
        const d = i * (0.55 + Math.random() * 0.2);
        noiseBurst(0.09, 0.05 + Math.random() * 0.02, 140, d, 1.6);
        tone(52, "sine", 0.14, 0.05, d);
      }
    },
    distantKnock() { noiseBurst(0.08, 0.07, 180, 0, 1.5); tone(80, "sine", 0.12, 0.05); noiseBurst(0.08, 0.06, 180, 0.5, 1.5); tone(78, "sine", 0.12, 0.045, 0.5); },
    whisperTone() { tone(2400, "sine", 0.5, 0.008, 0, null, 1800); tone(2900, "sine", 0.6, 0.006, 0.15, null, 2200); },
    tick() { tone(1900, "sine", 0.02, 0.02); },
  };
  return api;
})();
