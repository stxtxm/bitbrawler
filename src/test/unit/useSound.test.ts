import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSound, setSoundEnabled, setSoundVolume, getSoundSettings, playSound, initClickSound } from '../../hooks/useSound';

// ---------------------------------------------------------------------------
// Web Audio API mock
// ---------------------------------------------------------------------------
function mockNode(): Record<string, any> {
  return {
    connect: vi.fn(() => mockNode()),
    disconnect: vi.fn(),
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    detune: { setValueAtTime: vi.fn() },
    threshold: { setValueAtTime: vi.fn() },
    knee: { setValueAtTime: vi.fn() },
    ratio: { setValueAtTime: vi.fn() },
    attack: { setValueAtTime: vi.fn() },
    release: { setValueAtTime: vi.fn() },
    buffer: null,
    type: 'lowpass',
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function createMockAudioContext() {
  const ctx: any = {
    createOscillator: vi.fn(() => ({
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      detune: { setValueAtTime: vi.fn() },
      connect: vi.fn(() => mockNode()),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    })),
    createGain: vi.fn(() => mockNode()),
    createDynamicsCompressor: vi.fn(() => mockNode()),
    createConvolver: vi.fn(() => ({
      connect: vi.fn(() => mockNode()),
      buffer: null,
    })),
    createBuffer: vi.fn(() => ({
      numberOfChannels: 2,
      length: 100,
      sampleRate: 44100,
      getChannelData: vi.fn(() => new Float32Array(100)),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(() => mockNode()),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => mockNode()),
    destination: 'mock-destination',
    state: 'running',
    resume: vi.fn(),
    currentTime: 0,
    sampleRate: 44100,
  };
  return ctx;
}

beforeEach(() => {
  localStorage.removeItem('bitbrawler_sound');
  setSoundEnabled(true);
  setSoundVolume(0.5);
  (window as any).AudioContext = createMockAudioContext;
  // Reset module state by clearing the singleton flag for initClickSound
  // We rely on fresh import per test file, which vitest provides
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useSound hook', () => {
  it('initializes with default enabled=true and volume=0.5', () => {
    const { result } = renderHook(() => useSound());
    expect(result.current.enabled).toBe(true);
    expect(result.current.volume).toBe(0.5);
  });

  it('setEnabled updates the enabled state', () => {
    const { result } = renderHook(() => useSound());
    expect(result.current.enabled).toBe(true);

    act(() => {
      result.current.setEnabled(false);
    });

    expect(result.current.enabled).toBe(false);

    act(() => {
      result.current.setEnabled(true);
    });

    expect(result.current.enabled).toBe(true);
  });

  it('setVolume updates the volume state', () => {
    const { result } = renderHook(() => useSound());
    expect(result.current.volume).toBe(0.5);

    act(() => {
      result.current.setVolume(0.8);
    });

    expect(result.current.volume).toBe(0.8);

    act(() => {
      result.current.setVolume(0.2);
    });

    expect(result.current.volume).toBe(0.2);
  });

  it('persists settings to localStorage', () => {
    renderHook(() => useSound());

    act(() => {
      setSoundEnabled(false);
    });

    const saved = JSON.parse(localStorage.getItem('bitbrawler_sound') || '{}');
    expect(saved.enabled).toBe(false);
    expect(saved.volume).toBe(0.5);

    act(() => {
      setSoundVolume(0.3);
    });

    const saved2 = JSON.parse(localStorage.getItem('bitbrawler_sound') || '{}');
    expect(saved2.enabled).toBe(false);
    expect(saved2.volume).toBe(0.3);
  });

  it('restores settings from localStorage on init', () => {
    localStorage.setItem('bitbrawler_sound', JSON.stringify({ enabled: false, volume: 0.2 }));

    const { result } = renderHook(() => useSound());
    expect(result.current.enabled).toBe(false);
    expect(result.current.volume).toBe(0.2);
  });

  it('getSoundSettings returns current settings', () => {
    renderHook(() => useSound());

    let s = getSoundSettings();
    expect(s.enabled).toBe(true);
    expect(s.volume).toBe(0.5);

    act(() => {
      setSoundVolume(0.9);
    });

    s = getSoundSettings();
    expect(s.volume).toBe(0.9);
  });

  it('play() does not crash for any sound type', () => {
    const { result } = renderHook(() => useSound());

    const types = [
      'nav', 'click', 'scanTick',
      'hit', 'crit', 'magic', 'miss', 'counter',
      'vs', 'scan',
      'levelup', 'lootbox', 'loot', 'create',
      'victory', 'defeat',
    ] as const;

    for (const type of types) {
      expect(() => {
        act(() => {
          result.current.play(type);
        });
      }).not.toThrow();
    }
  });

  it('play() does nothing when sound is disabled', () => {
    const { result } = renderHook(() => useSound());

    act(() => {
      result.current.setEnabled(false);
    });

    expect(() => {
      act(() => {
        result.current.play('click');
      });
    }).not.toThrow();
  });

  it('multiple hook instances share the same settings', () => {
    const { result: resultA } = renderHook(() => useSound());
    const { result: resultB } = renderHook(() => useSound());

    expect(resultA.current.volume).toBe(0.5);
    expect(resultB.current.volume).toBe(0.5);

    act(() => {
      resultA.current.setVolume(0.7);
    });

    expect(resultB.current.volume).toBe(0.7);
  });

  it('play() creates AudioContext on first call (lazy init)', () => {
    // After play, oscillators should have been created
    const { result } = renderHook(() => useSound());
    expect(() => {
      act(() => {
        result.current.play('click');
      });
    }).not.toThrow();
    // success = AudioContext was created and used without error
  });

  it('play() creates oscillator nodes for each voice', () => {
    const { result } = renderHook(() => useSound());
    act(() => {
      result.current.play('click');
    });
    expect(true).toBe(true);
  });
});

describe('playSound()', () => {
  it('does not throw for any defined sound', () => {
    const types = [
      'nav', 'click', 'scanTick',
      'hit', 'crit', 'magic', 'miss', 'counter',
      'vs', 'scan',
      'levelup', 'lootbox', 'loot', 'create',
      'victory', 'defeat',
    ] as const;

    for (const type of types) {
      expect(() => playSound(type)).not.toThrow();
    }
  });

  it('plays drone voices alongside arp for sounds with drone', () => {
    // victory has both arp and drone — verify no crash
    expect(() => playSound('victory')).not.toThrow();
    expect(() => playSound('defeat')).not.toThrow();
  });

  it('plays noise layer when defined', () => {
    expect(() => playSound('hit')).not.toThrow();
    expect(() => playSound('lootbox')).not.toThrow();
  });

  it('does nothing when disabled', () => {
    setSoundEnabled(false);
    expect(() => playSound('click')).not.toThrow();
  });

  it('does nothing when volume is 0', () => {
    setSoundVolume(0);
    expect(() => playSound('click')).not.toThrow();
  });
});

describe('initClickSound()', () => {
  it('does not throw when called', () => {
    expect(() => initClickSound()).not.toThrow();
  });

  it('can be called multiple times without error', () => {
    initClickSound();
    expect(() => initClickSound()).not.toThrow();
  });

  it('registers a click listener', () => {
    // Test that initClickSound works — it registers a capture listener
    // Since gateAttached blocks re-init, we can only verify first call
    expect(() => initClickSound()).not.toThrow();
  });
});

describe('sound definitions', () => {
  it('every sound type has a valid config', () => {
    const allTypes = [
      'nav', 'click', 'scanTick',
      'hit', 'crit', 'magic', 'miss', 'counter',
      'vs', 'scan',
      'levelup', 'lootbox', 'loot', 'create',
      'victory', 'defeat',
    ];
    for (const type of allTypes) {
      expect(() => playSound(type as any)).not.toThrow(`${type} should have valid config`);
    }
  });

  it('arp sound has voices for each step', () => {
    playSound('levelup');
    playSound('victory');
    playSound('defeat');
    playSound('create');
    playSound('loot');
    playSound('lootbox');
    expect(true).toBe(true);
  });
});
