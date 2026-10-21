import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SettingsPanel } from '../../components/arena/SettingsPanel';
import { useSettings } from '../../hooks/useSettings';
import type { Character } from '../../types/Character';

vi.mock('../../context/GameContext', () => ({
  useGame: () => ({ activeCharacter: { id: 'pass-char', seed: 'pass-seed' } }),
}));

const baseProps = {
  settingsView: 'main' as const,
  autoModeEnabled: false,
  autoModeUpdating: false,
  soundEnabled: true,
  deleteStep: 'idle' as const,
  deletePending: false,
  combinedHistory: [],
  isOfflineMode: false,
  combatSpeed: 1 as const,
  telemetryEnabled: true,
  onClose: vi.fn(),
  onToggleAutoMode: vi.fn(),
  onToggleSound: vi.fn(),
  onToggleCombatSpeed: vi.fn(),
  onToggleTelemetry: vi.fn(),
  onDeleteCharacter: vi.fn(),
  onOpenLogs: vi.fn(),
  onOpenMedals: vi.fn(),
  onOpenCompendium: vi.fn(),
  onOpenPass: vi.fn(),
  onReturnToMain: vi.fn(),
  onSetDeleteStep: vi.fn(),
};

const baseCharacter: Character = {
  id: 'pass-char',
  seed: 'pass-seed',
  name: 'Pass Hero',
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

const renderSettingsHook = () =>
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

describe('SettingsPanel season pass entry', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('opens the season pass from the main settings view', () => {
    render(<SettingsPanel {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /season pass/i }));
    expect(baseProps.onOpenPass).toHaveBeenCalledTimes(1);
  });

  it('renders the pass track inside the pass view', () => {
    render(<SettingsPanel {...baseProps} settingsView="pass" />);
    expect(screen.getByText(/MASTERY PASS/)).toBeTruthy();
    expect(screen.getByText(/Tier 0 \/ 20/)).toBeTruthy();
  });

  it('returns to the main settings view when closing the pass', () => {
    render(<SettingsPanel {...baseProps} settingsView="pass" />);
    fireEvent.click(screen.getByRole('button', { name: /close pass/i }));
    expect(baseProps.onReturnToMain).toHaveBeenCalledTimes(1);
  });
});

describe('useSettings season pass navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('switches the settings view to the season pass', () => {
    const { result } = renderSettingsHook();
    act(() => {
      result.current.openSettings();
    });
    act(() => {
      result.current.onOpenPass();
    });
    expect(result.current.settingsView).toBe('pass');
  });

  it('returns to the main settings view', () => {
    const { result } = renderSettingsHook();
    act(() => {
      result.current.openSettings();
    });
    act(() => {
      result.current.onOpenPass();
    });
    act(() => {
      result.current.onReturnToMain();
    });
    expect(result.current.settingsView).toBe('main');
  });
});
