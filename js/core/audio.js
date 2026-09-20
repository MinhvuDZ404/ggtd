// ============================================================
// GTDM audio — fully procedural WebAudio music + SFX
// No external files. Chiptune-orchestral hybrid sequencer.
// ============================================================
import { bus } from './util.js';

let AC = null, master = null, musicGain = null, sfxGain = null;
let noiseBuf = null;
let started = false;
export const audioCfg = { music: 0.55, sfx: 0.8, muted: false };

function ensure() {
  if (AC) return AC;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = audioCfg.muted ? 0 : 1; master.connect(AC.destination);
    musicGain = AC.createGain(); musicGain.gain.value = audioCfg.music; musicGain.connect(master);
    sfxGain = AC.createGain(); sfxGain.gain.value = audioCfg.sfx; sfxGain.connect(master);
    // noise buffer
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 1.2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
  return AC;
}
export function audioResume() { const ac = ensure(); if (ac && ac.state === 'suspended') ac.resume(); }
window.addEventListener('pointerdown', () => { audioResume(); if (!started) { started = true; if (pendingTrack) playMusic(pendingTrack, true); } }, { once: false });

export function setVolumes() {
  if (!AC) return;
  musicGain.gain.setTargetAtTime(audioCfg.music, AC.currentTime, 0.05);
  sfxGain.gain.setTargetAtTime(audioCfg.sfx, AC.currentTime, 0.05);
  master.gain.setTargetAtTime(audioCfg.muted ? 0 : 1, AC.currentTime, 0.05);
}

// ---------- one-shot synth voices ----------
function tone(freq, dur, { type = 'sine', vol = 0.3, attack = 0.005, decay = null, slide = 0, dest = null, delay = 0, pan = 0 } = {}) {
  if (!AC) return;
  const t0 = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + (decay ?? dur));
  o.connect(g);
  if (pan && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(dest || sfxGain); }
  else g.connect(dest || sfxGain);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur, { vol = 0.3, filter = 'lowpass', freq = 1200, q = 1, attack = 0.004, slideFreq = 0, delay = 0, dest = null } = {}) {
  if (!AC) return;
  const t0 = AC.currentTime + delay;
  const s = AC.createBufferSource(); s.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = filter; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (slideFreq) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slideFreq), t0 + dur);
  const g = AC.createGain();
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(dest || sfxGain);
  s.start(t0); s.stop(t0 + dur + 0.05);
}

// ---------- SFX library ----------
let lastSfx = {};
function rateLimit(key, ms) { const t = performance.now(); if (lastSfx[key] && t - lastSfx[key] < ms) return false; lastSfx[key] = t; return true; }

export const sfx = {
  click() { if (!rateLimit('click', 40)) return; tone(660, 0.06, { type: 'triangle', vol: 0.16, slide: 220 }); },
  back() { tone(420, 0.08, { type: 'triangle', vol: 0.16, slide: -160 }); },
  error() { tone(160, 0.18, { type: 'sawtooth', vol: 0.16, slide: -60 }); },
  coin() { if (!rateLimit('coin', 45)) return; tone(1318, 0.09, { type: 'square', vol: 0.10 }); tone(1760, 0.14, { type: 'square', vol: 0.10, delay: 0.05 }); },
  bigCoin() { tone(1046, 0.1, { type: 'square', vol: 0.14 }); tone(1318, 0.1, { type: 'square', vol: 0.14, delay: 0.07 }); tone(2093, 0.24, { type: 'square', vol: 0.14, delay: 0.14 }); },
  shoot(pitch = 1) {
    if (!rateLimit('shoot', 30)) return;
    tone(880 * pitch, 0.07, { type: 'triangle', vol: 0.10, slide: -420 * pitch });
  },
  arrow() { if (!rateLimit('arrow', 35)) return; noise(0.09, { vol: 0.08, filter: 'bandpass', freq: 2600, q: 2, slideFreq: -1400 }); },
  magic() { if (!rateLimit('magic', 40)) return; tone(520, 0.16, { type: 'sine', vol: 0.12, slide: 640 }); tone(780, 0.2, { type: 'sine', vol: 0.07, slide: 900, delay: 0.03 }); },
  zap() { if (!rateLimit('zap', 40)) return; noise(0.12, { vol: 0.16, filter: 'highpass', freq: 2200, slideFreq: 1600 }); tone(1500, 0.08, { type: 'sawtooth', vol: 0.07, slide: -900 }); },
  boom(big = false) {
    if (!rateLimit('boom', big ? 60 : 45)) return;
    noise(big ? 0.55 : 0.3, { vol: big ? 0.4 : 0.24, filter: 'lowpass', freq: big ? 900 : 700, slideFreq: -600 });
    tone(big ? 90 : 120, big ? 0.5 : 0.28, { type: 'sine', vol: big ? 0.5 : 0.3, slide: -60 });
  },
  hit() { if (!rateLimit('hit', 30)) return; noise(0.05, { vol: 0.09, filter: 'bandpass', freq: 1100, q: 1.4 }); },
  crit() { if (!rateLimit('crit', 60)) return; tone(1800, 0.1, { type: 'square', vol: 0.12, slide: -700 }); noise(0.12, { vol: 0.14, filter: 'highpass', freq: 3000 }); },
  build() { tone(320, 0.1, { type: 'square', vol: 0.16, slide: 120 }); noise(0.14, { vol: 0.16, filter: 'lowpass', freq: 900, slideFreq: -500, delay: 0.04 }); tone(520, 0.16, { type: 'triangle', vol: 0.14, delay: 0.1 }); },
  upgrade() { tone(523, 0.09, { type: 'triangle', vol: 0.18 }); tone(659, 0.09, { type: 'triangle', vol: 0.18, delay: 0.08 }); tone(880, 0.2, { type: 'triangle', vol: 0.2, delay: 0.16 }); },
  sell() { tone(700, 0.12, { type: 'triangle', vol: 0.14, slide: -320 }); sfx.coin(); },
  freeze() { noise(0.5, { vol: 0.2, filter: 'highpass', freq: 3400, slideFreq: 1800 }); tone(1560, 0.4, { type: 'sine', vol: 0.14, slide: -500 }); tone(2100, 0.5, { type: 'sine', vol: 0.08, slide: -800, delay: 0.1 }); },
  heal() { tone(660, 0.2, { type: 'sine', vol: 0.12 }); tone(880, 0.25, { type: 'sine', vol: 0.12, delay: 0.08 }); tone(1320, 0.35, { type: 'sine', vol: 0.1, delay: 0.16 }); },
  holy() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, { type: 'sine', vol: 0.14, delay: i * 0.07 })); noise(0.7, { vol: 0.1, filter: 'highpass', freq: 4000, delay: 0.1 }); },
  meteor() { noise(0.8, { vol: 0.3, filter: 'lowpass', freq: 400, slideFreq: 2600, attack: 0.3 }); tone(140, 0.9, { type: 'sawtooth', vol: 0.14, slide: -90 }); },
  skill() { tone(440, 0.14, { type: 'sawtooth', vol: 0.12, slide: 440 }); tone(880, 0.22, { type: 'triangle', vol: 0.14, delay: 0.08, slide: 300 }); },
  die() { if (!rateLimit('die', 40)) return; noise(0.16, { vol: 0.1, filter: 'lowpass', freq: 800, slideFreq: -500 }); },
  leak() { tone(220, 0.3, { type: 'sawtooth', vol: 0.2, slide: -120 }); noise(0.25, { vol: 0.12, filter: 'lowpass', freq: 600 }); },
  waveStart() { tone(196, 0.25, { type: 'sawtooth', vol: 0.14 }); tone(262, 0.3, { type: 'sawtooth', vol: 0.14, delay: 0.16 }); noise(0.4, { vol: 0.08, filter: 'bandpass', freq: 400, q: 2 }); },
  bossRoar() {
    tone(70, 1.1, { type: 'sawtooth', vol: 0.4, slide: -25 }); tone(105, 0.9, { type: 'square', vol: 0.16, slide: -40, delay: 0.1 });
    noise(1.0, { vol: 0.24, filter: 'lowpass', freq: 700, slideFreq: -400, attack: 0.15 });
    tone(55, 1.4, { type: 'sine', vol: 0.4, delay: 0.2 });
  },
  fanfare() {
    const n = [523, 659, 784, 1046, 784, 1046, 1318];
    n.forEach((f, i) => { tone(f, i >= 5 ? 0.5 : 0.16, { type: 'triangle', vol: 0.2, delay: i * 0.13 }); tone(f / 2, 0.2, { type: 'square', vol: 0.07, delay: i * 0.13 }); });
    noise(0.5, { vol: 0.1, filter: 'highpass', freq: 5000, delay: 0.8 });
  },
  defeat() {
    const n = [392, 349, 311, 262];
    n.forEach((f, i) => tone(f, 0.4, { type: 'triangle', vol: 0.18, delay: i * 0.22 }));
    tone(131, 1.2, { type: 'sine', vol: 0.2, delay: 0.9 });
  },
  cardFlip() { noise(0.08, { vol: 0.12, filter: 'bandpass', freq: 2200, q: 1.5 }); },
  gachaSpin() { for (let i = 0; i < 8; i++) tone(300 + i * 90, 0.07, { type: 'square', vol: 0.07, delay: i * 0.06 }); },
  legendaryReveal() {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.16, delay: i * 0.09 }));
    tone(130, 1.0, { type: 'sine', vol: 0.3, delay: 0.2 });
    noise(1.2, { vol: 0.12, filter: 'highpass', freq: 3000, delay: 0.3, attack: 0.3 });
  },
  mythicReveal() {
    sfx.legendaryReveal();
    [2093, 2637, 3136].forEach((f, i) => tone(f, 0.8, { type: 'sine', vol: 0.12, delay: 0.6 + i * 0.12 }));
  },
  levelup() { [659, 880, 1174].forEach((f, i) => tone(f, 0.24, { type: 'triangle', vol: 0.16, delay: i * 0.09 })); },
  star() { tone(1568, 0.16, { type: 'sine', vol: 0.18 }); tone(2093, 0.3, { type: 'sine', vol: 0.14, delay: 0.09 }); },
  summonWhoosh() { noise(0.7, { vol: 0.16, filter: 'bandpass', freq: 600, q: 1, slideFreq: 3000 }); },
};

// ============================================================
// MUSIC SEQUENCER
// ============================================================
const NOTE = f => 440 * Math.pow(2, (f - 69) / 12); // midi->hz
let curTrack = null, pendingTrack = null;
let schedTimer = null, step = 0, nextTime = 0;

const TRACKS = {
  lobby: {
    bpm: 84, bars: 8, swing: 0,
    bass: [45, 0, 52, 0, 41, 0, 48, 0, 43, 0, 50, 0, 45, 0, 40, 0], // per bar (midi, 0=rest)
    chord: [[57, 60, 64], [55, 60, 64], [53, 57, 60], [52, 55, 60], [57, 60, 64], [55, 59, 62], [53, 57, 62], [52, 55, 59]],
    arp: [0, 2, 1, 2], // chord tone index per 8th
    lead: [76, 0, 79, 0, 81, 79, 76, 0, 74, 0, 76, 0, 72, 0, 0, 0, 76, 0, 79, 0, 84, 81, 79, 0, 77, 0, 76, 0, 74, 0, 72, 0],
    drums: 'soft', key: 'F#m', vol: 0.8,
  },
  battle: {
    bpm: 128, bars: 8, swing: 0,
    bass: [40, 40, 43, 43, 45, 45, 43, 41],
    chord: [[52, 55, 59], [52, 55, 59], [55, 58, 62], [55, 58, 62], [57, 60, 64], [57, 60, 64], [55, 58, 62], [53, 57, 60]],
    arp: [0, 1, 2, 1],
    lead: [64, 0, 67, 0, 71, 0, 67, 0, 64, 0, 67, 0, 72, 71, 67, 0, 65, 0, 69, 0, 72, 0, 69, 0, 67, 0, 71, 0, 74, 0, 71, 0],
    drums: 'drive', key: 'Em', vol: 0.85,
  },
  boss: {
    bpm: 148, bars: 8, swing: 0,
    bass: [33, 33, 34, 34, 33, 33, 36, 35],
    chord: [[45, 48, 52], [45, 48, 52], [46, 49, 53], [46, 49, 53], [45, 48, 52], [45, 48, 52], [48, 51, 55], [47, 50, 54]],
    arp: [0, 2, 1, 2],
    lead: [57, 60, 57, 63, 57, 60, 64, 63, 58, 61, 58, 64, 58, 61, 65, 64, 57, 60, 57, 63, 66, 64, 63, 60, 60, 63, 66, 67, 66, 63, 62, 59],
    drums: 'hard', key: 'Fm', vol: 0.9,
  },
  proof: {
    bpm: 110, bars: 8, swing: 0.06,
    bass: [38, 0, 41, 0, 43, 0, 41, 0, 38, 0, 45, 0, 43, 0, 41, 0],
    chord: [[50, 53, 57], [50, 53, 57], [53, 57, 60], [52, 55, 59], [50, 53, 57], [55, 58, 62], [53, 57, 60], [52, 55, 58]],
    arp: [0, 1, 2, 1],
    lead: [69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 74, 0, 72, 0, 69, 0, 67, 0, 72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 69, 0, 67, 0],
    drums: 'drive', key: 'Dm', vol: 0.85,
  },
};

function scheduleStep(tr, s, t) {
  const spb = 60 / tr.bpm; // per beat
  const bar = Math.floor(s / 8) % tr.bars;
  const inBar = s % 8; // 8th notes
  const swing = (inBar % 2 === 1) ? tr.swing * spb * 0.5 : 0;
  const tt = t + swing;
  const V = tr.vol;

  // drums
  if (tr.drums === 'drive' || tr.drums === 'hard') {
    if (inBar % 4 === 0) { tone(150, 0.12, { type: 'sine', vol: 0.5 * V, slide: -100, dest: musicGain, delay: tt - AC.currentTime }); } // kick
    if (inBar % 4 === 2) noise(0.1, { vol: (tr.drums === 'hard' ? 0.3 : 0.2) * V, filter: 'bandpass', freq: 1800, q: 1, dest: musicGain, delay: tt - AC.currentTime }); // snare
    if (tr.drums === 'hard' && inBar === 7) noise(0.24, { vol: 0.3 * V, filter: 'lowpass', freq: 1400, slideFreq: -900, dest: musicGain, delay: tt - AC.currentTime });
    noise(0.03, { vol: 0.09 * V, filter: 'highpass', freq: 7000, dest: musicGain, delay: tt - AC.currentTime }); // hat
  } else { // soft
    if (inBar % 4 === 0) tone(140, 0.14, { type: 'sine', vol: 0.34 * V, slide: -80, dest: musicGain, delay: tt - AC.currentTime });
    if (inBar % 2 === 1) noise(0.04, { vol: 0.05 * V, filter: 'highpass', freq: 6500, dest: musicGain, delay: tt - AC.currentTime });
    if (inBar === 4) noise(0.14, { vol: 0.1 * V, filter: 'bandpass', freq: 1300, q: 1.4, dest: musicGain, delay: tt - AC.currentTime });
  }

  // bass (on beats)
  if (inBar % 2 === 0) {
    const bn = tr.bass[(bar * 4 + inBar / 2) % tr.bass.length];
    if (bn) {
      const f = NOTE(bn);
      tone(f, spb * 0.9, { type: curTrack === 'lobby' ? 'triangle' : 'sawtooth', vol: 0.22 * V, dest: musicGain, delay: tt - AC.currentTime, attack: 0.01 });
      tone(f / 2, spb * 0.9, { type: 'sine', vol: 0.16 * V, dest: musicGain, delay: tt - AC.currentTime });
    }
  }

  // chords / pads at bar start
  if (inBar === 0) {
    const ch = tr.chord[bar % tr.chord.length];
    ch.forEach((n, i) => {
      tone(NOTE(n), spb * 7.6, { type: curTrack === 'boss' ? 'sawtooth' : 'triangle', vol: 0.05 * V, dest: musicGain, delay: tt - AC.currentTime, attack: 0.25 });
      if (curTrack === 'lobby' && i === 0) tone(NOTE(n - 12), spb * 7.6, { type: 'sine', vol: 0.07 * V, dest: musicGain, delay: tt - AC.currentTime, attack: 0.4 });
    });
  }

  // arpeggio 16th feel via 8ths (except lobby which is sparse)
  if (!(curTrack === 'lobby' && inBar % 2 === 1)) {
    const ch = tr.chord[bar % tr.chord.length];
    const an = ch[tr.arp[(s % tr.arp.length)]];
    tone(NOTE(an + 12), spb * 0.42, { type: 'square', vol: 0.035 * V, dest: musicGain, delay: tt - AC.currentTime, attack: 0.008 });
  }

  // lead melody (sparse)
  const ln = tr.lead[s % tr.lead.length];
  if (ln && (curTrack !== 'lobby' || s % 2 === 0)) {
    tone(NOTE(ln), spb * 0.8, { type: curTrack === 'boss' ? 'square' : 'triangle', vol: 0.075 * V, dest: musicGain, delay: tt - AC.currentTime, attack: 0.015 });
  }
}

const LOOKAHEAD = 0.35; // seconds
function scheduler() {
  if (!AC || !curTrack) return;
  const tr = TRACKS[curTrack];
  const spb = 60 / tr.bpm;
  const stepDur = spb / 2; // 8th notes
  while (nextTime < AC.currentTime + LOOKAHEAD) {
    scheduleStep(tr, step, nextTime);
    nextTime += stepDur;
    step = (step + 1) % (tr.bars * 8);
  }
}

export function playMusic(track, force = false) {
  if (!AC) { pendingTrack = track; return; }
  if (curTrack === track && !force) return;
  curTrack = track;
  step = 0; nextTime = AC.currentTime + 0.08;
  if (!schedTimer) schedTimer = setInterval(scheduler, 90);
  scheduler();
}
export function stopMusic() { curTrack = null; }
export function getTrack() { return curTrack; }

// duck music briefly (for big hits)
export function duckMusic(amount = 0.5, dur = 0.25) {
  if (!AC) return;
  musicGain.gain.setTargetAtTime(audioCfg.music * amount, AC.currentTime, 0.02);
  musicGain.gain.setTargetAtTime(audioCfg.music, AC.currentTime + dur, 0.08);
}

bus.on('audio:cfg', setVolumes);
