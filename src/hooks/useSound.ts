import { useCallback, useEffect, useState } from 'react';

export type SoundType =
  | 'nav' | 'click'
  | 'hit' | 'crit' | 'magic' | 'miss' | 'counter'
  | 'levelup' | 'lootbox' | 'loot'
  | 'victory' | 'defeat'
  | 'vs' | 'scan' | 'scanTick' | 'create'
  | 'equip' | 'purchase' | 'reroll'
  | 'salvage' | 'forge' | 'upgrade' | 'fusion'
  | 'achievement' | 'streak' | 'offline' | 'notification'
  | 'error' | 'spawn';

interface Voice {
  type: OscillatorType;
  freq: number;
  gain: number;
  detune?: number;
}

interface ArpStep {
  voice: number;
  dur: number;
  delay: number;
}

interface SoundConfig {
  voices: Voice[];
  drone?: Voice[];
  arp?: ArpStep[];
  decay: number;
  gain: number;
  noise?: { gain: number; dur: number };
  reverb?: number;
  pitchVar?: number;
}

const SOUND_DEFINITIONS: Record<SoundType, SoundConfig> = {
  // ── UI ──
  // click: soft retro tick — never piercing, slight pitch variation per tap
  click: {
    voices: [
      { type: 'sine', freq: 780, gain: 0.14 },
      { type: 'triangle', freq: 1180, gain: 0.05 },
    ],
    decay: 24, gain: 1, reverb: 0, pitchVar: 8,
  },
  // nav: gentle low blip for menu/tab navigation
  nav: {
    voices: [{ type: 'sine', freq: 560, gain: 0.16 }],
    decay: 22, gain: 1, reverb: 0, pitchVar: 6,
  },
  scanTick: {
    voices: [{ type: 'triangle', freq: 1047, gain: 0.14 }],
    decay: 18, gain: 1, reverb: 0, pitchVar: 12,
  },

  // ── COMBAT ──
  // hit: short low thud — attacker lands a blow
  hit: {
    voices: [
      { type: 'triangle', freq: 80, gain: 0.35 },
      { type: 'triangle', freq: 150, gain: 0.2 },
    ],
    decay: 55, gain: 0.7,
    noise: { gain: 0.12, dur: 0.03 },
    reverb: 0.15, pitchVar: 15,
  },
  // crit: bright high shimmer — big damage
  crit: {
    voices: [
      { type: 'triangle', freq: 100, gain: 0.35 },
      { type: 'triangle', freq: 200, gain: 0.2 },
      { type: 'sine', freq: 1400, gain: 0.1 },
      { type: 'sine', freq: 2000, gain: 0.06 },
    ],
    decay: 70, gain: 0.75,
    noise: { gain: 0.18, dur: 0.04 },
    reverb: 0.2, pitchVar: 10,
  },
  // magic: ethereal rising sweep — mystical attack
  magic: {
    voices: [
      { type: 'sine', freq: 280, gain: 0.2 },
      { type: 'sine', freq: 560, gain: 0.12 },
      { type: 'triangle', freq: 840, gain: 0.08 },
    ],
    decay: 100, gain: 0.65,
    reverb: 0.45, pitchVar: 5,
  },
  // miss: short sad puff — attacker whiffs
  miss: {
    voices: [{ type: 'sine', freq: 200, gain: 0.12 }],
    decay: 20, gain: 0.5,
    noise: { gain: 0.03, dur: 0.015 },
    reverb: 0.1, pitchVar: 25,
  },
  // counter: sharp aggressive snap — reversal
  counter: {
    voices: [
      { type: 'triangle', freq: 500, gain: 0.25 },
      { type: 'triangle', freq: 300, gain: 0.15 },
      { type: 'sine', freq: 1100, gain: 0.08 },
    ],
    decay: 40, gain: 0.75,
    noise: { gain: 0.1, dur: 0.02 },
    reverb: 0.12, pitchVar: 8,
  },
  // vs: dramatic chord — opponent reveal
  vs: {
    voices: [
      { type: 'triangle', freq: 440, gain: 0.25 },
      { type: 'triangle', freq: 554, gain: 0.2 },
      { type: 'triangle', freq: 659, gain: 0.15 },
      { type: 'triangle', freq: 880, gain: 0.12 },
      { type: 'sine', freq: 110, gain: 0.1 },
    ],
    decay: 200, gain: 0.7,
    noise: { gain: 0.1, dur: 0.05 },
    reverb: 0.25,
  },
  // scan: jackpot ding — opponent locked
  scan: {
    voices: [
      { type: 'triangle', freq: 1047, gain: 0.25 },
      { type: 'triangle', freq: 1319, gain: 0.2 },
      { type: 'triangle', freq: 1568, gain: 0.15 },
      { type: 'sine', freq: 523, gain: 0.08 },
    ],
    arp: [
      { voice: 0, dur: 40, delay: 0 },
      { voice: 1, dur: 40, delay: 40 },
      { voice: 2, dur: 200, delay: 80 },
    ],
    decay: 220, gain: 0.65,
    noise: { gain: 0.12, dur: 0.06 },
    reverb: 0.2,
  },

  // ── FEEDBACK ──
  // levelup: magical sparkling ascent C5-E5-G5-C6-E6
  levelup: {
    voices: [
      { type: 'triangle', freq: 523, gain: 0.3 },
      { type: 'triangle', freq: 659, gain: 0.25 },
      { type: 'triangle', freq: 784, gain: 0.2 },
      { type: 'triangle', freq: 1047, gain: 0.15 },
      { type: 'triangle', freq: 1319, gain: 0.1 },
    ],
    arp: [
      { voice: 0, dur: 50, delay: 0 },
      { voice: 1, dur: 50, delay: 60 },
      { voice: 2, dur: 50, delay: 120 },
      { voice: 3, dur: 60, delay: 180 },
      { voice: 4, dur: 200, delay: 250 },
    ],
    decay: 300, gain: 0.75,
    reverb: 0.3,
  },
  // lootbox: slot-machine anticipation C-D-E-F-G-A ascending scale
  lootbox: {
    voices: [
      { type: 'triangle', freq: 262, gain: 0.22 },
      { type: 'triangle', freq: 294, gain: 0.2 },
      { type: 'triangle', freq: 330, gain: 0.18 },
      { type: 'triangle', freq: 349, gain: 0.16 },
      { type: 'triangle', freq: 392, gain: 0.14 },
      { type: 'triangle', freq: 440, gain: 0.12 },
    ],
    arp: [
      { voice: 0, dur: 40, delay: 0 },
      { voice: 1, dur: 40, delay: 45 },
      { voice: 2, dur: 40, delay: 90 },
      { voice: 3, dur: 40, delay: 135 },
      { voice: 4, dur: 40, delay: 180 },
      { voice: 5, dur: 180, delay: 225 },
    ],
    decay: 250, gain: 0.75,
    noise: { gain: 0.1, dur: 0.04 },
    reverb: 0.25,
  },
  // loot: warm reward chime G4-B4-D5-G5
  loot: {
    voices: [
      { type: 'triangle', freq: 784, gain: 0.25 },
      { type: 'sine', freq: 988, gain: 0.15 },
      { type: 'triangle', freq: 1175, gain: 0.12 },
      { type: 'sine', freq: 1568, gain: 0.08 },
    ],
    arp: [
      { voice: 0, dur: 50, delay: 0 },
      { voice: 1, dur: 50, delay: 50 },
      { voice: 2, dur: 60, delay: 100 },
      { voice: 3, dur: 220, delay: 160 },
    ],
    decay: 300, gain: 0.75,
    reverb: 0.2,
  },
  // create: bright optimistic G-major arpeggio G4-B4-D5-G5-B5-D6
  create: {
    voices: [
      { type: 'sine', freq: 784, gain: 0.28 },
      { type: 'sine', freq: 988, gain: 0.22 },
      { type: 'sine', freq: 1175, gain: 0.18 },
      { type: 'sine', freq: 1568, gain: 0.14 },
      { type: 'sine', freq: 1976, gain: 0.1 },
      { type: 'sine', freq: 2349, gain: 0.07 },
    ],
    arp: [
      { voice: 0, dur: 45, delay: 0 },
      { voice: 1, dur: 45, delay: 55 },
      { voice: 2, dur: 45, delay: 110 },
      { voice: 3, dur: 50, delay: 165 },
      { voice: 4, dur: 60, delay: 220 },
      { voice: 5, dur: 200, delay: 280 },
    ],
    decay: 300, gain: 0.75,
    reverb: 0.25,
  },

  // ── ACTIONS & FORGE ──
  // equip: soft metallic slot — gear attaches
  equip: {
    voices: [
      { type: 'square', freq: 660, gain: 0.12 },
      { type: 'sine', freq: 990, gain: 0.08 },
    ],
    decay: 40, gain: 1,
    noise: { gain: 0.05, dur: 0.02 },
    reverb: 0.12, pitchVar: 5,
  },
  // purchase: coin jingle — shop buy
  purchase: {
    voices: [
      { type: 'sine', freq: 988, gain: 0.14 },
      { type: 'sine', freq: 1319, gain: 0.12 },
      { type: 'sine', freq: 1976, gain: 0.08 },
    ],
    arp: [
      { voice: 0, dur: 30, delay: 0 },
      { voice: 1, dur: 30, delay: 40 },
      { voice: 2, dur: 130, delay: 80 },
    ],
    decay: 170, gain: 1,
    noise: { gain: 0.05, dur: 0.02 },
    reverb: 0.2, pitchVar: 4,
  },
  // reroll: shuffle — shop offers refresh
  reroll: {
    voices: [
      { type: 'triangle', freq: 587, gain: 0.12 },
      { type: 'triangle', freq: 494, gain: 0.1 },
    ],
    arp: [
      { voice: 0, dur: 30, delay: 0 },
      { voice: 1, dur: 30, delay: 45 },
      { voice: 0, dur: 30, delay: 90 },
      { voice: 1, dur: 120, delay: 135 },
    ],
    decay: 160, gain: 1,
    noise: { gain: 0.08, dur: 0.04 },
    reverb: 0.15, pitchVar: 6,
  },
  // salvage: crunch — items broken down into essence
  salvage: {
    voices: [
      { type: 'square', freq: 180, gain: 0.16 },
      { type: 'sine', freq: 90, gain: 0.16 },
    ],
    decay: 60, gain: 1,
    noise: { gain: 0.14, dur: 0.08 },
    reverb: 0.15, pitchVar: 12,
  },
  // forge: hammer — single smith thud
  forge: {
    voices: [
      { type: 'triangle', freq: 130, gain: 0.22 },
      { type: 'triangle', freq: 392, gain: 0.1 },
    ],
    decay: 70, gain: 1,
    noise: { gain: 0.12, dur: 0.04 },
    reverb: 0.12, pitchVar: 8,
  },
  // upgrade: success ding — item enhanced
  upgrade: {
    voices: [
      { type: 'triangle', freq: 659, gain: 0.16 },
      { type: 'sine', freq: 880, gain: 0.1 },
      { type: 'sine', freq: 1319, gain: 0.06 },
    ],
    arp: [
      { voice: 0, dur: 40, delay: 0 },
      { voice: 1, dur: 60, delay: 40 },
      { voice: 2, dur: 200, delay: 90 },
    ],
    decay: 220, gain: 1,
    reverb: 0.2, pitchVar: 3,
  },
  // fusion: rising mystical arp — items unite
  fusion: {
    voices: [
      { type: 'sine', freq: 440, gain: 0.14 },
      { type: 'sine', freq: 554, gain: 0.12 },
      { type: 'sine', freq: 659, gain: 0.1 },
      { type: 'sine', freq: 880, gain: 0.08 },
    ],
    arp: [
      { voice: 0, dur: 60, delay: 0 },
      { voice: 1, dur: 60, delay: 70 },
      { voice: 2, dur: 60, delay: 140 },
      { voice: 3, dur: 240, delay: 210 },
    ],
    decay: 260, gain: 1,
    noise: { gain: 0.04, dur: 0.05 },
    reverb: 0.4, pitchVar: 3,
  },

  // ── SYSTEM FEEDBACK ──
  // achievement: medal unlock fanfare — bright, distinct from levelup
  achievement: {
    voices: [
      { type: 'triangle', freq: 880, gain: 0.18 },
      { type: 'triangle', freq: 1109, gain: 0.15 },
      { type: 'triangle', freq: 1319, gain: 0.12 },
      { type: 'sine', freq: 1760, gain: 0.06 },
    ],
    arp: [
      { voice: 0, dur: 50, delay: 0 },
      { voice: 1, dur: 50, delay: 50 },
      { voice: 2, dur: 80, delay: 100 },
      { voice: 3, dur: 300, delay: 160 },
    ],
    decay: 320, gain: 1,
    reverb: 0.25, pitchVar: 2,
  },
  // streak: combo milestone — punchy power-chord strike
  streak: {
    voices: [
      { type: 'triangle', freq: 392, gain: 0.2 },
      { type: 'sawtooth', freq: 196, gain: 0.08 },
      { type: 'triangle', freq: 466, gain: 0.14 },
      { type: 'sine', freq: 784, gain: 0.06 },
    ],
    decay: 120, gain: 1,
    noise: { gain: 0.08, dur: 0.03 },
    reverb: 0.2, pitchVar: 4,
  },
  // offline: welcome-back chime — gentle major arpeggio
  offline: {
    voices: [
      { type: 'sine', freq: 523, gain: 0.14 },
      { type: 'sine', freq: 659, gain: 0.12 },
      { type: 'sine', freq: 784, gain: 0.1 },
      { type: 'sine', freq: 1047, gain: 0.08 },
    ],
    arp: [
      { voice: 0, dur: 60, delay: 0 },
      { voice: 1, dur: 60, delay: 90 },
      { voice: 2, dur: 60, delay: 180 },
      { voice: 3, dur: 260, delay: 270 },
    ],
    decay: 320, gain: 1,
    reverb: 0.3, pitchVar: 3,
  },
  // notification: soft double blip — toast / reminder
  notification: {
    voices: [
      { type: 'sine', freq: 880, gain: 0.1 },
      { type: 'sine', freq: 1175, gain: 0.08 },
    ],
    arp: [
      { voice: 0, dur: 30, delay: 0 },
      { voice: 1, dur: 90, delay: 60 },
    ],
    decay: 130, gain: 1,
    reverb: 0.15, pitchVar: 4,
  },
  // error: denied buzz — low dual tone for blocked actions
  error: {
    voices: [
      { type: 'square', freq: 220, gain: 0.1 },
      { type: 'square', freq: 160, gain: 0.08 },
    ],
    decay: 120, gain: 1,
    reverb: 0.1, pitchVar: 0,
  },
  // spawn: monster growl — foe appears (idle PvE)
  spawn: {
    voices: [
      { type: 'sawtooth', freq: 70, gain: 0.14 },
      { type: 'sine', freq: 110, gain: 0.1 },
      { type: 'sawtooth', freq: 233, gain: 0.04 },
    ],
    decay: 150, gain: 1,
    noise: { gain: 0.06, dur: 0.05 },
    reverb: 0.3, pitchVar: 12,
  },
  // victory: triumphant brass fanfare C4-E4-G4-C5-E5-G5-C6
  victory: {
    voices: [
      { type: 'triangle', freq: 523, gain: 0.3 },
      { type: 'triangle', freq: 659, gain: 0.25 },
      { type: 'triangle', freq: 784, gain: 0.2 },
      { type: 'triangle', freq: 1047, gain: 0.16 },
      { type: 'triangle', freq: 1319, gain: 0.12 },
      { type: 'triangle', freq: 1568, gain: 0.08 },
    ],
    drone: [
      { type: 'sawtooth', freq: 262, gain: 0.08 },
      { type: 'sine', freq: 131, gain: 0.15 },
      { type: 'sine', freq: 65, gain: 0.08 },
    ],
    arp: [
      { voice: 0, dur: 100, delay: 0 },
      { voice: 1, dur: 100, delay: 100 },
      { voice: 2, dur: 100, delay: 200 },
      { voice: 3, dur: 100, delay: 300 },
      { voice: 4, dur: 120, delay: 400 },
      { voice: 5, dur: 400, delay: 520 },
    ],
    decay: 550, gain: 0.9,
    reverb: 0.3,
  },
  // defeat: dark minor descent A4-G4-F4-E4-D4-A3
  defeat: {
    voices: [
      { type: 'triangle', freq: 440, gain: 0.25, detune: -5 },
      { type: 'triangle', freq: 392, gain: 0.22, detune: -5 },
      { type: 'triangle', freq: 349, gain: 0.2, detune: -5 },
      { type: 'triangle', freq: 330, gain: 0.18, detune: -5 },
      { type: 'triangle', freq: 294, gain: 0.15, detune: -5 },
      { type: 'triangle', freq: 220, gain: 0.12, detune: -5 },
    ],
    drone: [
      { type: 'sine', freq: 110, gain: 0.1 },
    ],
    arp: [
      { voice: 0, dur: 120, delay: 0 },
      { voice: 1, dur: 120, delay: 120 },
      { voice: 2, dur: 120, delay: 240 },
      { voice: 3, dur: 140, delay: 360 },
      { voice: 4, dur: 160, delay: 500 },
      { voice: 5, dur: 400, delay: 660 },
    ],
    decay: 550, gain: 0.85,
    reverb: 0.35,
  },
};

// ── Engine ──
const STORAGE_KEY = 'bitbrawler_sound';

interface SoundSettings { enabled: boolean; volume: number; }
const defaultSettings: SoundSettings = { enabled: true, volume: 0.5 };

let settings: SoundSettings = { ...defaultSettings };
let listeners: Array<(s: SoundSettings) => void> = [];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let conv: ConvolverNode | null = null;
let dryBus: GainNode | null = null;

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    settings = {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      volume: typeof parsed.volume === 'number' ? parsed.volume : 0.5,
    };
  }
} catch { /* ignore */ }

function persistSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}
function notifyListeners() { listeners.forEach(fn => fn(settings)); }

function buildIR(buf: AudioBuffer) {
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    }
  }
}

function init() {
  if (ctx) return;
  const Ctor = typeof AudioContext !== 'undefined' ? AudioContext : (window as any)?.webkitAudioContext;
  if (!Ctor) return;
  const c = new Ctor();
  ctx = c;

  const _comp = c.createDynamicsCompressor();
  _comp.threshold.setValueAtTime(-18, c.currentTime);
  _comp.knee.setValueAtTime(12, c.currentTime);
  _comp.ratio.setValueAtTime(4, c.currentTime);
  _comp.attack.setValueAtTime(0.005, c.currentTime);
  _comp.release.setValueAtTime(0.2, c.currentTime);

  const _master = c.createGain();
  _master.gain.setValueAtTime(settings.volume, c.currentTime);
  master = _master;

  const _conv = c.createConvolver();
  const ir = c.createBuffer(2, c.sampleRate * 0.35, c.sampleRate);
  buildIR(ir);
  _conv.buffer = ir;
  conv = _conv;

  const _reverb = c.createGain();
  _reverb.gain.setValueAtTime(0.4, c.currentTime);

  const _dry = c.createGain();
  _dry.gain.setValueAtTime(1, c.currentTime);
  dryBus = _dry;

  _conv.connect(_reverb);
  _reverb.connect(_comp);
  _dry.connect(_comp);
  _comp.connect(_master);
  _master.connect(c.destination);
}

function voice(
  vctx: AudioContext, type: OscillatorType, freq: number,
  gain: number, detune: number, decay: number, delay: number, reverb: number,
) {
  const t = vctx.currentTime + delay / 1000;
  const dur = decay / 1000;

  const osc = vctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (detune) osc.detune.setValueAtTime(detune, t);

  const env = vctx.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(env);

  if (reverb > 0 && conv) {
    const dry = vctx.createGain();
    dry.gain.setValueAtTime(1 - reverb, t);
    const wet = vctx.createGain();
    wet.gain.setValueAtTime(reverb, t);
    env.connect(dry);
    env.connect(wet);
    dry.connect(dryBus!);
    wet.connect(conv);
  } else {
    env.connect(dryBus!);
  }

  osc.start(t);
  osc.stop(t + dur + 0.01);
}

function noise(nctx: AudioContext, gain: number, dur: number) {
  const sr = nctx.sampleRate;
  const len = Math.ceil(sr * dur);
  const buf = nctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

  const src = nctx.createBufferSource();
  src.buffer = buf;

  const nGain = nctx.createGain();
  nGain.gain.setValueAtTime(gain * 0.3, nctx.currentTime + 0.002);
  nGain.gain.exponentialRampToValueAtTime(gain, nctx.currentTime + 0.006);
  nGain.gain.exponentialRampToValueAtTime(0.001, nctx.currentTime + dur);

  const filter = nctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(4000, nctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(300, nctx.currentTime + dur);

  src.connect(filter);
  filter.connect(nGain);
  nGain.connect(dryBus!);
  src.start();
}

export function playSound(type: SoundType) {
  if (!settings.enabled || settings.volume <= 0) return;
  init();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const def = SOUND_DEFINITIONS[type];
  const actx = ctx;

  const playAt = (voiceIdx: number, decay: number, delay: number) => {
    const v = def.voices[voiceIdx];
    const detune = (v.detune ?? 0) + (def.pitchVar ? (Math.random() - 0.5) * 2 * def.pitchVar : 0);
    voice(actx, v.type, v.freq, v.gain * def.gain, detune, decay, delay, def.reverb ?? 0);
  };

  if (def.arp) {
    for (const step of def.arp) {
      playAt(step.voice, step.dur, step.delay);
    }
  } else {
    for (let i = 0; i < def.voices.length; i++) {
      playAt(i, def.decay, 0);
    }
  }

  if (def.drone) {
    for (const d of def.drone) {
      voice(actx, d.type, d.freq, d.gain * def.gain, d.detune ?? 0, def.decay, 0, def.reverb ?? 0);
    }
  }

  if (def.noise) {
    noise(ctx, def.noise.gain * def.gain, def.noise.dur);
  }
}

export function setSoundEnabled(v: boolean) { settings = { ...settings, enabled: v }; persistSettings(); notifyListeners(); }
export function setSoundVolume(v: number) {
  settings = { ...settings, volume: v };
  persistSettings();
  notifyListeners();
  if (master && ctx) master.gain.setValueAtTime(v, ctx.currentTime);
}
export function getSoundSettings(): SoundSettings { return { ...settings }; }

// ── Hook ──
function readSettings(): SoundSettings {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || { ...defaultSettings }; } catch { return { ...defaultSettings }; }
}

export function useSound() {
  const [state, setState] = useState<SoundSettings>(readSettings);
  useEffect(() => {
    const fn = (s: SoundSettings) => setState({ ...s });
    listeners.push(fn);
    return () => { listeners = listeners.filter(f => f !== fn); };
  }, []);
  return {
    play: useCallback((s: SoundType) => playSound(s), []),
    enabled: state.enabled, volume: state.volume,
    setEnabled: useCallback((v: boolean) => setSoundEnabled(v), []),
    setVolume: useCallback((v: number) => setSoundVolume(v), []),
  };
}

// ── Global click gate ──
let gateAttached = false;

function handleClickGate(e: MouseEvent) {
  const el = e.target as HTMLElement;
  const btn = el.closest('button, a.button, [role="button"], [data-click-sound]') as HTMLElement | null;
  if (!btn) return;
  // data-click-sound="none" → the action plays its own dedicated sound,
  // so the generic tick is suppressed to avoid double feedback.
  const sound = btn.getAttribute('data-click-sound');
  if (sound === 'none') return;
  playSound((sound || 'click') as SoundType);
}

export function initClickSound() {
  if (gateAttached) return;
  gateAttached = true;
  document.addEventListener('click', handleClickGate, { capture: true });
}
