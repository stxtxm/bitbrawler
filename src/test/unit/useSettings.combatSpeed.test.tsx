import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from '../../hooks/useSettings';
import { GAME_RULES } from '../../config/gameRules';
import { Character } from '../../types/Character';

const STORAGE_KEY = 'bitbrawler_combat_speed';

const baseCharacter: Character = {
  seed: 'speed-seed',
  name: 'Speed Hero',
  gender: 'male',
  level: 3,
  experience: 0,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  hp: 40,
  maxHp: 40,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: 0,
};

const renderSettings = () =>
  renderHook(() =>
    useSettings({
      character: baseCharacter,
      isOfflineMode: false,
      connectionMessage: 'offline',
      ensureConnection: vi.fn().mockResolvedValue(true),
      openModal: vi.fn(),
      setAutoMode: vi.fn().mockResolvedValue(baseCharacter),
      deleteCharacter: vi.fn().mockResolvedValue(true),
      onDeleted: vi.fn(),
    }),
  );

describe('useSettings combatSpeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('exposes only the supported speed options [1, 2]', () => {
    expect(GAME_RULES.COMBAT.SPEED_OPTIONS).toEqual([1, 2]);
  });

  it('defaults to x1 when nothing is stored', () => {
    const { result } = renderSettings();
    expect(result.current.combatSpeed).toBe(1);
  });

  it('cycles from x1 to x2 and persists the choice', () => {
    const { result } = renderSettings();
    act(() => {
      result.current.onToggleCombatSpeed();
    });
    expect(result.current.combatSpeed).toBe(2);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toBe(2);
  });

  it('starts from the persisted value and cycles back to x1', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(2));
    const { result } = renderSettings();
    expect(result.current.combatSpeed).toBe(2);
    act(() => {
      result.current.onToggleCombatSpeed();
    });
    expect(result.current.combatSpeed).toBe(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toBe(1);
  });

  it('ignores unsupported stored speeds and falls back to x1', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(4));
    const { result } = renderSettings();
    expect(result.current.combatSpeed).toBe(1);
  });

  it('ignores corrupted storage payloads and falls back to x1', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');
    const { result } = renderSettings();
    expect(result.current.combatSpeed).toBe(1);
  });

  it('does not persist anything while staying on default speed', () => {
    renderSettings();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
