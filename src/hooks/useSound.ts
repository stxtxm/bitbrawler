import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Sound type definitions
// ---------------------------------------------------------------------------
export type SoundType =
  | 'nav'       // navigation blip
  | 'click'     // button click tick
  | 'hit'       // combat hit impact
  | 'crit'      // critical hit rise
  | 'levelup'   // level-up jingle
  | 'lootbox'   // lootbox roll + open
  | 'victory'   // victory fanfare
  | 'defeat';   // defeat descent

interface SoundConfig {
  type: OscillatorType;
  frequencies: number[];       // sequence of frequencies (Hz)
  durations: number[];         // duration per step (ms) – same length as frequencies
  startGain?: number;          // initial gain (0-1, default 0.3)
  endGain?: number;            // final gain (optional, for decay)
  ramp?: 'linear' | 'expo';   // gain ramp style
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
    durations: [30],
    startGain: 0.15,
    endGain: 0,
    ramp: 'expo',
  },
  hit: {
    type: 'triangle',
    frequencies: [150, 80],
    durations: [40, 80],
    startGain: 0.35,
    endGain: 0,
    ramp: 'expo',
  },
  crit: {
    type: 'square',
    frequencies: [500, 800, 1200],
    durations: [80, 80, 100],
    startGain: 0.3,
    endGain: 0,
    ramp: 'expo',
  },
  levelup: {
    type: 'square',
    frequencies: [523.25, 659.25, 783.99], // C5, E5, G5
    durations: [100, 100, 200],
    startGain: 0.25,
    endGain: 0,
    ramp: 'expo',
  },
  lootbox: {
    type: 'square',
    frequencies: [220, 330, 440, 554.37, 659.25], // A3, E4, A4, C#5, E5 (building tension)
    durations: [60, 60, 60, 120, 200],
    startGain: 0.2,
    endGain: 0,
    ramp: 'expo',
  },
  victory: {
    type: 'square',
    frequencies: [523.25, 659.25, 783.99, 1046.5], // C5, E5, G5, C6
    durations: [120, 120, 120, 300],
    startGain: 0.3,
    endGain: 0,
    ramp: 'expo',
  },
  defeat: {
    type: 'triangle',
    frequencies: [350, 260, 180, 100],
    durations: [120, 120, 120, 300],
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
  volume: number; // 0-1
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

/** Shared AudioContext – created lazily on first play(). */
function getAudioContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined') {
    return null; // server-side / unsupported environment
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

/**
 * Play a single frequency segment with gain envelope.
 * Returns a Promise that resolves when the segment finishes.
 */
function playTone(
  ctx: AudioContext,
  type: OscillatorType,
  frequency: number,
  durationMs: number,
  volume: number,
  startGain: number,
  endGain?: number,
  ramp?: 'linear' | 'expo',
): Promise<void> {
  return new Promise((resolve) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    const gStart = volume * startGain;
    gain.gain.setValueAtTime(gStart, ctx.currentTime);

    const durSec = durationMs / 1000;
    if (endGain !== undefined) {
      const gEnd = volume * endGain;
      if (ramp === 'expo') {
        // Avoid exponential ramp to 0 – use a very small value
        gain.gain.exponentialRampToValueAtTime(Math.max(gEnd, 0.0001), ctx.currentTime + durSec);
      } else {
        gain.gain.linearRampToValueAtTime(gEnd, ctx.currentTime + durSec);
      }
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durSec);

    osc.onended = () => resolve();
    // Fallback resolve if onended doesn't fire
    setTimeout(resolve, durSec * 1000 + 50);
  });
}

/** Core play function – called by hook. */
async function playSound(sound: SoundType) {
  if (!settings.enabled || settings.volume <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const def = SOUND_DEFINITIONS[sound];
  for (let i = 0; i < def.frequencies.length; i++) {
    await playTone(
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
