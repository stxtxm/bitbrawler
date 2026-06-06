import { useCallback, useEffect, useState } from 'react';

export type SoundType =
  | 'nav' | 'click'
  | 'hit' | 'crit' | 'magic' | 'miss' | 'counter'
  | 'levelup' | 'lootbox'
  | 'victory' | 'defeat';

interface SoundConfig {
  type: OscillatorType;
  frequencies: number[];
  durations: number[];
  delays?: number[];
  startGain?: number;
  endGain?: number;
  ramp?: 'linear' | 'expo';
  noise?: { duration: number; volume: number };
  altType?: OscillatorType;        // second oscillator layer
  altFrequencies?: number[];       // frequencies for alt layer
  altVolumes?: number[];           // gain per alt frequency
}

const SOUND_DEFINITIONS: Record<SoundType, SoundConfig> = {
  // ── UI ──
  nav: {
    type: 'square', frequencies: [660], durations: [50],
    startGain: 0.2, endGain: 0, ramp: 'expo',
  },
  click: {
    type: 'square', frequencies: [880], durations: [22],
    startGain: 0.1, endGain: 0, ramp: 'expo',
  },

  // ── COMBAT ──
  hit: {
    type: 'square', frequencies: [100, 200], durations: [60, 40],
    startGain: 0.3, endGain: 0, ramp: 'expo',
    noise: { duration: 0.04, volume: 0.18 },
    altType: 'triangle', altFrequencies: [80], altVolumes: [0.15],
  },
  crit: {
    type: 'square', frequencies: [120, 300, 200], durations: [80, 50, 40],
    startGain: 0.35, endGain: 0, ramp: 'expo',
    noise: { duration: 0.06, volume: 0.22 },
    altType: 'sine', altFrequencies: [900, 1400], altVolumes: [0.08, 0.05],
  },
  magic: {
    type: 'triangle', frequencies: [300, 500, 700], durations: [60, 50, 100],
    startGain: 0.2, endGain: 0, ramp: 'expo',
    altType: 'sine', altFrequencies: [900], altVolumes: [0.04],
  },
  miss: {
    type: 'sine', frequencies: [150], durations: [30],
    startGain: 0.12, endGain: 0, ramp: 'expo',
    noise: { duration: 0.03, volume: 0.04 },
  },
  counter: {
    type: 'square', frequencies: [600, 300], durations: [40, 50],
    startGain: 0.3, endGain: 0, ramp: 'expo',
    noise: { duration: 0.025, volume: 0.12 },
    altType: 'sine', altFrequencies: [1200], altVolumes: [0.06],
  },

  // ── GAME EVENTS ──
  levelup: {
    type: 'square', frequencies: [523.25, 659.25, 783.99],
    durations: [100, 100, 200], startGain: 0.25, endGain: 0, ramp: 'expo',
  },
  lootbox: {
    type: 'square', frequencies: [220, 330, 440, 554.37, 659.25],
    durations: [60, 60, 60, 120, 200],
    startGain: 0.2, endGain: 0, ramp: 'expo',
  },
  victory: {
    type: 'triangle', frequencies: [523.25, 659.25, 783.99, 1046.5],
    durations: [130, 130, 130, 380],
    delays: [0, 120, 240, 360],
    startGain: 0.25, endGain: 0, ramp: 'expo',
    altType: 'square', altFrequencies: [130.81, 164.81, 196, 261.63],
    altVolumes: [0.08, 0.08, 0.08, 0.08],
  },
  defeat: {
    type: 'triangle', frequencies: [440, 349.23, 293.66, 220],
    durations: [150, 150, 150, 400],
    delays: [0, 140, 280, 420],
    startGain: 0.25, endGain: 0, ramp: 'expo',
  },
};

// ── Module-level state ──
const STORAGE_KEY = 'bitbrawler_sound';

interface SoundSettings { enabled: boolean; volume: number; }

const defaultSettings: SoundSettings = { enabled: true, volume: 0.5 };

let settings: SoundSettings = { ...defaultSettings };
let listeners: Array<(s: SoundSettings) => void> = [];
let audioCtx: AudioContext | null = null;

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

function getAudioContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined') return null;
  const Ctor: typeof AudioContext = typeof AudioContext !== 'undefined' ? AudioContext : (window as any).webkitAudioContext;
  if (!audioCtx || audioCtx.state === 'closed') audioCtx = new Ctor();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function scheduleTone(
  ctx: AudioContext, type: OscillatorType, freq: number,
  durMs: number, vol: number, gain: number, delayMs: number,
  endGain?: number, ramp?: 'linear' | 'expo',
) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  const t = ctx.currentTime + delayMs / 1000;
  osc.frequency.setValueAtTime(freq, t);
  const g = vol * gain;
  gainNode.gain.setValueAtTime(g, t);
  const durSec = durMs / 1000;
  if (endGain !== undefined) {
    const gEnd = vol * endGain;
    if (ramp === 'expo') gainNode.gain.exponentialRampToValueAtTime(Math.max(gEnd, 0.0001), t + durSec);
    else gainNode.gain.linearRampToValueAtTime(gEnd, t + durSec);
  }
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + durSec);
}

function scheduleNoise(ctx: AudioContext, duration: number, volume: number, delayMs = 0) {
  const sr = ctx.sampleRate;
  const bufSize = Math.ceil(sr * duration);
  const buf = ctx.createBuffer(1, bufSize, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const t = ctx.currentTime + delayMs / 1000;
  filter.frequency.setValueAtTime(4000, t);
  filter.frequency.exponentialRampToValueAtTime(300, t + duration);
  gain.gain.setValueAtTime(volume * 0.3, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(t);
}

export function playSound(sound: SoundType) {
  if (!settings.enabled || settings.volume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const def = SOUND_DEFINITIONS[sound];
  const vol = settings.volume;

  // Primary layer
  for (let i = 0; i < def.frequencies.length; i++) {
    const delay = def.delays?.[i] ?? 0;
    scheduleTone(
      ctx, def.type, def.frequencies[i], def.durations[i], vol,
      def.startGain ?? 0.3, delay,
      i === def.frequencies.length - 1 ? def.endGain : undefined,
      i === def.frequencies.length - 1 ? def.ramp : undefined,
    );
  }

  // Secondary oscillator layer
  if (def.altType && def.altFrequencies) {
    const altVolumes = def.altVolumes ?? def.altFrequencies.map(() => 0.1);
    for (let i = 0; i < def.altFrequencies.length; i++) {
      const delay = def.delays?.[i] ?? 0;
      scheduleTone(ctx, def.altType, def.altFrequencies[i], def.durations[i] ?? 60, vol, altVolumes[i] ?? 0.1, delay);
    }
  }

  // Noise burst
  if (def.noise) {
    scheduleNoise(ctx, def.noise.duration, def.noise.volume * vol);
  }
}

export function setSoundEnabled(enabled: boolean) { settings = { ...settings, enabled }; persistSettings(); notifyListeners(); }
export function setSoundVolume(volume: number) { settings = { ...settings, volume }; persistSettings(); notifyListeners(); }
export function getSoundSettings(): SoundSettings { return { ...settings }; }

// ── React Hook ──
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

  const play = useCallback((sound: SoundType) => playSound(sound), []);
  const setEnabled = useCallback((v: boolean) => setSoundEnabled(v), []);
  const setVolume = useCallback((v: number) => setSoundVolume(v), []);

  return { play, enabled: state.enabled, volume: state.volume, setEnabled, setVolume };
}

// ── Global click gate ──
let gateAttached = false;

function handleClickGate(e: MouseEvent) {
  const el = e.target as HTMLElement;
  const btn = el.closest('button, a.button, [role="button"], [data-click-sound]') as HTMLElement | null;
  if (!btn) return;
  const sound = btn.getAttribute('data-click-sound') || 'click';
  playSound(sound as SoundType);
}

export function initClickSound() {
  if (gateAttached) return;
  gateAttached = true;
  document.addEventListener('click', handleClickGate);
}
