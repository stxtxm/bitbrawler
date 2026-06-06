import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Sound type definitions
// ---------------------------------------------------------------------------
export type SoundType =
  | 'nav'       // navigation blip
  | 'click'     // button click tick
  | 'hit'       // combat hit impact
  | 'crit'      // critical hit
  | 'magic'     // magic surge
  | 'miss'      // attack miss
  | 'counter'   // counter attack
  | 'levelup'   // level-up jingle
  | 'lootbox'   // lootbox roll + open
  | 'victory'   // victory fanfare
  | 'defeat';   // defeat descent

interface SoundConfig {
  type: OscillatorType;
  frequencies: number[];
  durations: number[];
  startGain?: number;
  endGain?: number;
  ramp?: 'linear' | 'expo';
  noise?: { duration: number; volume: number };
}

const SOUND_DEFINITIONS: Record<SoundType, SoundConfig> = {
  nav: {
    type: 'square',
    frequencies: [660],
    durations: [50],
    startGain: 0.2,
    endGain: 0,
    ramp: 'expo',
  },
  click: {
    type: 'square',
    frequencies: [880],
    durations: [25],
    startGain: 0.12,
    endGain: 0,
    ramp: 'expo',
  },
  hit: {
    type: 'square',
    frequencies: [150, 80],
    durations: [40, 60],
    startGain: 0.35,
    endGain: 0,
    ramp: 'expo',
    noise: { duration: 0.05, volume: 0.12 },
  },
  crit: {
    type: 'square',
    frequencies: [500, 800, 1200],
    durations: [60, 60, 100],
    startGain: 0.3,
    endGain: 0,
    ramp: 'expo',
    noise: { duration: 0.06, volume: 0.15 },
  },
  magic: {
    type: 'triangle',
    frequencies: [350, 500, 700, 900],
    durations: [50, 50, 50, 120],
    startGain: 0.25,
    endGain: 0,
    ramp: 'expo',
  },
  miss: {
    type: 'sine',
    frequencies: [120],
    durations: [40],
    startGain: 0.15,
    endGain: 0,
    ramp: 'expo',
    noise: { duration: 0.04, volume: 0.05 },
  },
  counter: {
    type: 'square',
    frequencies: [800, 1200, 600],
    durations: [40, 30, 60],
    startGain: 0.28,
    endGain: 0,
    ramp: 'expo',
    noise: { duration: 0.03, volume: 0.1 },
  },
  levelup: {
    type: 'square',
    frequencies: [523.25, 659.25, 783.99],
    durations: [100, 100, 200],
    startGain: 0.25,
    endGain: 0,
    ramp: 'expo',
  },
  lootbox: {
    type: 'square',
    frequencies: [220, 330, 440, 554.37, 659.25],
    durations: [60, 60, 60, 120, 200],
    startGain: 0.2,
    endGain: 0,
    ramp: 'expo',
  },
  victory: {
    type: 'square',
    frequencies: [523.25, 659.25, 783.99, 1046.5],
    durations: [120, 120, 120, 350],
    startGain: 0.3,
    endGain: 0,
    ramp: 'expo',
  },
  defeat: {
    type: 'triangle',
    frequencies: [350, 260, 180, 100],
    durations: [120, 120, 120, 350],
    startGain: 0.3,
    endGain: 0,
    ramp: 'expo',
  },
};

// ---------------------------------------------------------------------------
// Module-level state (shared across all hook instances)
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'bitbrawler_sound';

interface SoundSettings {
  enabled: boolean;
  volume: number;
}

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
} catch {
  // ignore corrupted data
}

function persistSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage full or unavailable
  }
}

function notifyListeners() {
  for (const fn of listeners) {
    fn(settings);
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined') {
    return null;
  }
  const Ctor: typeof AudioContext =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : (window as any).webkitAudioContext;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  type: OscillatorType,
  frequency: number,
  durationMs: number,
  volume: number,
  startGain: number,
  endGain?: number,
  ramp?: 'linear' | 'expo',
  delayMs = 0,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  const t = ctx.currentTime + delayMs / 1000;
  osc.frequency.setValueAtTime(frequency, t);

  const gStart = volume * startGain;
  gain.gain.setValueAtTime(gStart, t);

  const durSec = durationMs / 1000;
  if (endGain !== undefined) {
    const gEnd = volume * endGain;
    if (ramp === 'expo') {
      gain.gain.exponentialRampToValueAtTime(Math.max(gEnd, 0.0001), t + durSec);
    } else {
      gain.gain.linearRampToValueAtTime(gEnd, t + durSec);
    }
  }

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t);
  osc.stop(t + durSec);
}

function playNoise(ctx: AudioContext, duration: number, volume: number, delayMs = 0) {
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';

  const t = ctx.currentTime + delayMs / 1000;
  filter.frequency.setValueAtTime(3000, t);
  filter.frequency.exponentialRampToValueAtTime(200, t + duration);

  gain.gain.setValueAtTime(volume * 0.3, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(t);
}

export async function playSound(sound: SoundType) {
  if (!settings.enabled || settings.volume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const def = SOUND_DEFINITIONS[sound];

  for (let i = 0; i < def.frequencies.length; i++) {
    playTone(
      ctx,
      def.type,
      def.frequencies[i],
      def.durations[i],
      settings.volume,
      def.startGain ?? 0.3,
      i === def.frequencies.length - 1 ? def.endGain : undefined,
      i === def.frequencies.length - 1 ? def.ramp : undefined,
    );
  }

  if (def.noise) {
    playNoise(ctx, def.noise.duration, def.noise.volume * settings.volume);
  }
}

export function setSoundEnabled(enabled: boolean) {
  settings = { ...settings, enabled };
  persistSettings();
  notifyListeners();
}

export function setSoundVolume(volume: number) {
  settings = { ...settings, volume };
  persistSettings();
  notifyListeners();
}

export function getSoundSettings(): SoundSettings {
  return { ...settings };
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------
function readLocalSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return { ...defaultSettings };
}

export function useSound() {
  const [state, setState] = useState<SoundSettings>(readLocalSettings);

  useEffect(() => {
    const handler = (s: SoundSettings) => setState({ ...s });
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((fn) => fn !== handler);
    };
  }, []);

  const play = useCallback((sound: SoundType) => {
    playSound(sound);
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setSoundEnabled(v);
  }, []);

  const setVolume = useCallback((v: number) => {
    setSoundVolume(v);
  }, []);

  return {
    play,
    enabled: state.enabled,
    volume: state.volume,
    setEnabled,
    setVolume,
  };
}

// ---------------------------------------------------------------------------
// Global click listener — attach once after DOM is ready
// ---------------------------------------------------------------------------
let clickGateAttached = false;

function handleClickGate(e: MouseEvent) {
  const el = e.target as HTMLElement;
  const button = el.closest('button, a.button, [role="button"], [data-click-sound]') as HTMLElement | null;
  if (!button) return;

  // Skip internal button elements (icons inside buttons)
  if (el !== button && !button.hasAttribute('data-click-sound')) {
    const parentButton = button.closest('button, a.button, [role="button"]');
    if (parentButton && parentButton !== button) return;
  }

  const sound = button.getAttribute('data-click-sound') || 'click';
  playSound(sound as SoundType);
}

export function initClickSound() {
  if (clickGateAttached) return;
  clickGateAttached = true;
  document.addEventListener('click', handleClickGate);
}
