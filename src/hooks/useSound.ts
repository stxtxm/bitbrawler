import { useCallback, useEffect, useState } from 'react';

export type SoundType =
  | 'nav' | 'click'
  | 'hit' | 'crit' | 'magic' | 'miss' | 'counter'
  | 'levelup' | 'lootbox' | 'loot'
  | 'victory' | 'defeat'
  | 'vs' | 'scan' | 'scanTick' | 'create';

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
  click: {
    voices: [{ type: 'sine', freq: 1000, gain: 0.45 }],
    decay: 10, gain: 1, reverb: 0,
  },
  nav: {
    voices: [{ type: 'sine', freq: 660, gain: 0.35 }],
    decay: 15, gain: 1, reverb: 0,
  },
  scanTick: {
    voices: [{ type: 'triangle', freq: 1047, gain: 0.3 }],
    decay: 15, gain: 1, reverb: 0,
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
  // levelup: magical sparkling ascent
  levelup: {
    voices: [{ type: 'triangle', freq: 660, gain: 0.28 }],
    arp: [
      { voice: 0, dur: 60, delay: 0 },
      { voice: 0, dur: 60, delay: 70 },
      { voice: 0, dur: 60, delay: 140 },
      { voice: 0, dur: 200, delay: 210 },
    ],
    decay: 280, gain: 0.75,
    reverb: 0.3,
  },
  // lootbox: slot-machine anticipation
  lootbox: {
    voices: [
      { type: 'triangle', freq: 262, gain: 0.2 },
      { type: 'triangle', freq: 330, gain: 0.15 },
      { type: 'triangle', freq: 392, gain: 0.12 },
    ],
    arp: [
      { voice: 0, dur: 40, delay: 0 },
      { voice: 1, dur: 40, delay: 50 },
      { voice: 2, dur: 40, delay: 100 },
      { voice: 2, dur: 180, delay: 150 },
    ],
    decay: 220, gain: 0.75,
    noise: { gain: 0.1, dur: 0.04 },
    reverb: 0.25,
  },
  // loot: warm reward chime
  loot: {
    voices: [
      { type: 'triangle', freq: 784, gain: 0.22 },
      { type: 'sine', freq: 988, gain: 0.12 },
    ],
    arp: [
      { voice: 0, dur: 50, delay: 0 },
      { voice: 1, dur: 60, delay: 40 },
      { voice: 0, dur: 200, delay: 100 },
    ],
    decay: 280, gain: 0.75,
    reverb: 0.2,
  },
  // create: bright optimistic G-major arpeggio
  create: {
    voices: [{ type: 'sine', freq: 784, gain: 0.25 }],
    arp: [
      { voice: 0, dur: 50, delay: 0 },
      { voice: 0, dur: 50, delay: 60 },
      { voice: 0, dur: 50, delay: 120 },
      { voice: 0, dur: 200, delay: 180 },
    ],
    decay: 280, gain: 0.75,
    reverb: 0.25,
  },
  // victory: triumphant brass fanfare
  victory: {
    voices: [
      { type: 'triangle', freq: 523, gain: 0.3 },
      { type: 'sawtooth', freq: 262, gain: 0.08 },
    ],
    drone: [
      { type: 'sine', freq: 131, gain: 0.15 },
      { type: 'sine', freq: 65, gain: 0.08 },
    ],
    arp: [
      { voice: 0, dur: 120, delay: 0 },
      { voice: 0, dur: 120, delay: 110 },
      { voice: 0, dur: 120, delay: 220 },
      { voice: 0, dur: 400, delay: 340 },
    ],
    decay: 520, gain: 0.9,
    reverb: 0.3,
  },
  // defeat: dark minor descent with wobble
  defeat: {
    voices: [
      { type: 'triangle', freq: 440, gain: 0.25, detune: -5 },
      { type: 'sine', freq: 110, gain: 0.1 },
    ],
    arp: [
      { voice: 0, dur: 140, delay: 0 },
      { voice: 0, dur: 140, delay: 130 },
      { voice: 0, dur: 140, delay: 270 },
      { voice: 0, dur: 420, delay: 410 },
    ],
    decay: 520, gain: 0.85,
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
  _comp.ratio.setValueAtTime(6, c.currentTime);
  _comp.attack.setValueAtTime(0.003, c.currentTime);
  _comp.release.setValueAtTime(0.15, c.currentTime);

  const _master = c.createGain();
  _master.gain.setValueAtTime(settings.volume, c.currentTime);
  master = _master;

  const _conv = c.createConvolver();
  const ir = c.createBuffer(2, c.sampleRate * 0.35, c.sampleRate);
  buildIR(ir);
  _conv.buffer = ir;
  conv = _conv;

  const _reverb = c.createGain();
  _reverb.gain.setValueAtTime(0.35, c.currentTime);

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
  playSound((btn.getAttribute('data-click-sound') || 'click') as SoundType);
}

export function initClickSound() {
  if (gateAttached) return;
  gateAttached = true;
  document.addEventListener('click', handleClickGate, { capture: true });
}
