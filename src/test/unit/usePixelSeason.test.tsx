import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGame } from '../../context/GameContext';
import { usePixelSeason } from '../../hooks/usePixelSeason';
import {
  clearPixelSeasonState,
  recordPixelSeasonAction,
  unlockPixelSeasonPremium,
} from '../../utils/pixelSeasonStorage';

vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}));

const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>;

const ACTIVE_NOW = new Date('2026-01-10T12:00:00Z');
const SEASON = '2026-01-05';

function setupGame() {
  mockUseGame.mockReturnValue({
    activeCharacter: { id: 'char-season', name: 'Season Hero' },
  });
}

describe('usePixelSeason', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPixelSeasonState();
    localStorage.clear();
    setupGame();
  });

  it('derives the active season from the current date', () => {
    const { result } = renderHook(() => usePixelSeason({ now: ACTIVE_NOW }));
    expect(result.current.seasonId).toBe(SEASON);
    expect(result.current.theme.id).toBe('neon-dojo');
    expect(result.current.calendar.phase).toBe('active');
    expect(result.current.calendar.activeDaysLeft).toBe(9);
  });

  it('starts at tier 0 with all missions incomplete', () => {
    const { result } = renderHook(() => usePixelSeason({ now: ACTIVE_NOW }));
    expect(result.current.points).toBe(0);
    expect(result.current.tier).toBe(0);
    expect(result.current.progressPct).toBe(0);
    expect(result.current.missions.every((mission) => !mission.complete)).toBe(true);
  });

  it('reflects stored mission counters', () => {
    recordPixelSeasonAction('char-season', 'fight', 20, SEASON);
    recordPixelSeasonAction('char-season', 'streak', 12, SEASON);
    const { result } = renderHook(() => usePixelSeason({ now: ACTIVE_NOW }));
    expect(result.current.points).toBe(550);
    expect(result.current.tier).toBe(5);
    expect(result.current.counters.fight).toBe(20);
    expect(result.current.counters.streak).toBe(12);
    const fightMission = result.current.missions.find((mission) => mission.id === 'fight-1');
    expect(fightMission?.complete).toBe(true);
  });

  it('exposes mission progress capped at the target', () => {
    recordPixelSeasonAction('char-season', 'idle', 12, SEASON);
    const { result } = renderHook(() => usePixelSeason({ now: ACTIVE_NOW }));
    const idleMission = result.current.missions.find((mission) => mission.id === 'idle-1');
    expect(idleMission?.progress).toBe(10);
    expect(idleMission?.complete).toBe(true);
  });

  it('claims an unlocked free tier', () => {
    recordPixelSeasonAction('char-season', 'fight', 20, SEASON);
    const { result } = renderHook(() => usePixelSeason({ now: ACTIVE_NOW }));
    expect(result.current.canClaimFree(1)).toBe(true);
    let claimed = false;
    act(() => {
      claimed = result.current.claimFree(1);
    });
    expect(claimed).toBe(true);
    expect(result.current.claimedFree).toContain(1);
    expect(result.current.canClaimFree(1)).toBe(false);
  });

  it('does not claim a locked free tier', () => {
    const { result } = renderHook(() => usePixelSeason({ now: ACTIVE_NOW }));
    let claimed = true;
    act(() => {
      claimed = result.current.claimFree(3);
    });
    expect(claimed).toBe(false);
  });

  it('keeps the premium track locked until unlocked', () => {
    recordPixelSeasonAction('char-season', 'fight', 20, SEASON);
    recordPixelSeasonAction('char-season', 'salvage', 10, SEASON);
    const { result } = renderHook(() => usePixelSeason({ now: ACTIVE_NOW }));
    expect(result.current.premiumUnlocked).toBe(false);
    expect(result.current.canClaimPremium(3)).toBe(false);
    act(() => {
      result.current.unlockPremium();
    });
    expect(result.current.premiumUnlocked).toBe(true);
    expect(result.current.canClaimPremium(3)).toBe(true);
    let claimed = false;
    act(() => {
      claimed = result.current.claimPremium(3);
    });
    expect(claimed).toBe(true);
    expect(result.current.claimedPremium).toContain(3);
  });

  it('picks up premium unlocks made outside the hook', () => {
    recordPixelSeasonAction('char-season', 'fight', 20, SEASON);
    recordPixelSeasonAction('char-season', 'salvage', 10, SEASON);
    const { result } = renderHook(() => usePixelSeason({ now: ACTIVE_NOW }));
    act(() => {
      unlockPixelSeasonPremium('char-season', SEASON);
    });
    expect(result.current.premiumUnlocked).toBe(true);
  });

  it('builds a leaderboard containing the player', () => {
    const { result } = renderHook(() => usePixelSeason({ now: ACTIVE_NOW }));
    const player = result.current.leaderboard.find((entry) => entry.isPlayer);
    expect(player?.name).toBe('Season Hero');
    expect(result.current.leaderboard.length).toBeGreaterThan(1);
  });

  it('detects the rest phase', () => {
    const { result } = renderHook(() => usePixelSeason({ now: new Date('2026-01-19T12:00:00Z') }));
    expect(result.current.calendar.phase).toBe('rest');
    expect(result.current.calendar.restDaysLeft).toBe(2);
  });

  it('does not regress across seasons', () => {
    recordPixelSeasonAction('char-season', 'fight', 90, SEASON);
    const { result } = renderHook(() => usePixelSeason({ now: new Date('2026-01-21T12:00:00Z') }));
    expect(result.current.seasonId).toBe('2026-01-21');
    expect(result.current.points).toBe(0);
  });
});
