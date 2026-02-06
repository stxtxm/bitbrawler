import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { GameProvider, useGame } from '../context/GameContext';
import { Character } from '../types/Character';

// Mock Firebase
vi.mock('../config/firebase', () => ({
  db: {
    collection: vi.fn(),
    doc: vi.fn(),
  }
}));

// Mock Firestore functions
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  getDocsFromServer: vi.fn(),
  updateDoc: vi.fn(),
  limit: vi.fn(),
}));

import { getDocs, getDocsFromServer, updateDoc } from 'firebase/firestore';

// Wrapper component for testing hooks
const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <GameProvider>{children}</GameProvider>
  );
};

describe('GameContext Integration', () => {
  const mockCharacter: Character = {
    name: 'Test Hero',
    gender: 'male',
    seed: 'test-seed',
    level: 5,
    hp: 150,
    maxHp: 150,
    strength: 15,
    vitality: 12,
    dexterity: 10,
    luck: 8,
    intelligence: 11,
    experience: 500,
    wins: 10,
    losses: 3,
    fightsLeft: 2,
    lastFightReset: Date.now() - 86400000, // Yesterday
    firestoreId: 'test-firestore-id'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true
    });

    // Default mock for server time
    (getDocs as any).mockResolvedValue({
      docs: [{
        data: () => ({ timestamp: Date.now() })
      }]
    });

    (getDocsFromServer as any).mockResolvedValue({
      docs: [{
        data: () => ({ timestamp: Date.now() })
      }]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should load character from Firestore on mount', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    (getDocs as any).mockResolvedValue({
      docs: [{
        data: () => mockCharacter,
        id: 'test-firestore-id'
      }]
    });
    (updateDoc as any).mockResolvedValue(undefined);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeCharacter).toBeDefined();
    expect(result.current.activeCharacter?.name).toBe('Test Hero');
  });

  it('should prioritize Firestore data over localStorage', async () => {
    const localStorageChar = { ...mockCharacter, fightsLeft: 1, experience: 100 };
    const firestoreChar = { ...mockCharacter, fightsLeft: 5, experience: 600 };

    (localStorage.getItem as any).mockReturnValue(JSON.stringify(localStorageChar));
    (getDocs as any).mockResolvedValue({
      docs: [{
        data: () => firestoreChar,
        id: 'test-firestore-id'
      }]
    });

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeCharacter?.fightsLeft).toBe(5);
    expect(result.current.activeCharacter?.experience).toBe(600);
  });

  it('should handle login with Firestore data', async () => {
    (getDocs as any).mockResolvedValue({
      docs: [{
        data: () => mockCharacter,
        id: 'test-firestore-id'
      }]
    });

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let loginResult: string | null = null;
    await act(async () => {
      loginResult = await result.current.login('Test Hero');
    });

    expect(loginResult).toBe(null);
    expect(result.current.activeCharacter?.name).toBe('Test Hero');
    expect(result.current.activeCharacter?.firestoreId).toBe('test-firestore-id');
  });

  it('should update fights and XP when useFight is called', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    (getDocs as any).mockResolvedValue({
      docs: [{
        data: () => mockCharacter,
        id: 'test-firestore-id'
      }]
    });
    (updateDoc as any).mockResolvedValue(undefined);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialFights = result.current.activeCharacter?.fightsLeft || 0;

    await act(async () => {
      await result.current.useFight();
    });

    expect(result.current.activeCharacter?.fightsLeft).toBe(initialFights - 1);

    // Verify updateDoc was called with XP data
    const lastCall = (updateDoc as any).mock.calls.at(-1);
    expect(lastCall[1]).toMatchObject({ fightsLeft: initialFights - 1 });
    expect(lastCall[1]).toHaveProperty('level');
    expect(lastCall[1]).toHaveProperty('experience');
  });

  it('should handle logout correctly', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    (getDocs as any).mockResolvedValue({
      docs: [{
        data: () => mockCharacter,
        id: 'test-firestore-id'
      }]
    });

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeCharacter).toBeDefined();

    act(() => {
      result.current.logout();
    });

    await waitFor(() => {
      expect(result.current.activeCharacter).toBeNull();
    });

    expect(localStorage.removeItem).toHaveBeenCalledWith('bitbrawler_active_char');
  });

  it('should handle Firestore sync errors gracefully', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    (getDocs as any).mockResolvedValueOnce({
      docs: [{
        data: () => mockCharacter,
        id: 'test-firestore-id'
      }]
    });

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeCharacter?.name).toBe('Test Hero');
  });

  it('should handle corrupted localStorage', async () => {
    (localStorage.getItem as any).mockReturnValue('invalid-json');

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeCharacter).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith('bitbrawler_active_char');
  });

  it('should track XP gain notifications', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    (getDocs as any).mockResolvedValue({
      docs: [{
        data: () => mockCharacter,
        id: 'test-firestore-id'
      }]
    });
    (updateDoc as any).mockResolvedValue(undefined);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.useFight();
    });

    // Should have XP gain notification
    expect(result.current.lastXpGain).toBeGreaterThan(0);
  });

  it('should clear XP notifications when requested', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    (getDocs as any).mockResolvedValue({
      docs: [{
        data: () => mockCharacter,
        id: 'test-firestore-id'
      }]
    });
    (updateDoc as any).mockResolvedValue(undefined);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.useFight();
    });

    expect(result.current.lastXpGain).not.toBeNull();

    act(() => {
      result.current.clearXpNotifications();
    });

    expect(result.current.lastXpGain).toBeNull();
  });
});
