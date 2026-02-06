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

describe('Firebase Unavailability Handling', () => {
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
    fightsLeft: 3,
    lastFightReset: Date.now(),
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

    // Default mock
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

  it('should set firebaseAvailable to false when Firestore fails during load', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    (getDocs as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.firebaseAvailable).toBe(false);
    expect(result.current.activeCharacter?.name).toBe('Test Hero');
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });

  it('should set firebaseAvailable to false when login fails', async () => {
    (getDocs as any).mockRejectedValue(new Error('Connection failed'));

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

    expect(loginResult).toBe('Connection error - please check your internet connection and try again');
    expect(result.current.firebaseAvailable).toBe(false);
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });

  it('should set firebaseAvailable to false when useFight fails', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    (getDocs as any).mockResolvedValue({
      docs: [{
        data: () => mockCharacter,
        id: 'test-firestore-id'
      }]
    });
    (updateDoc as any).mockRejectedValue(new Error('Connection lost'));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.useFight()).rejects.toThrow('Connection error - fight not counted');
    });

    expect(result.current.firebaseAvailable).toBe(false);
    expect(result.current.activeCharacter).toBeDefined();
  });

  it('should set firebaseAvailable to false when daily reset fails', async () => {
    const yesterdayChar = {
      ...mockCharacter,
      lastFightReset: Date.now() - 86400000 * 2,
      fightsLeft: 0
    };
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(yesterdayChar));

    // First call: sync character
    (getDocs as any).mockResolvedValueOnce({
      docs: [{
        data: () => yesterdayChar,
        id: 'test-firestore-id'
      }]
    });

    // Second call: get server time
    (getDocs as any).mockResolvedValueOnce({
      docs: [{
        data: () => ({ timestamp: Date.now() })
      }]
    });

    // Update fails
    (updateDoc as any).mockRejectedValueOnce(new Error('Server unavailable'));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Advance timers to trigger daily reset check
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current.firebaseAvailable).toBe(false);
    }, { timeout: 5000 });

    expect(result.current.activeCharacter).toBeDefined();
  });

  it('should keep localStorage when Firebase is unavailable', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    (getDocs as any).mockRejectedValue(new Error('Firebase down'));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(result.current.activeCharacter).toBeDefined();
    expect(result.current.firebaseAvailable).toBe(false);
  });

  it('should keep snapshot but block actions when Firebase is unavailable', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    (getDocs as any).mockRejectedValue(new Error('No internet'));
    (updateDoc as any).mockRejectedValue(new Error('Connection lost'));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.firebaseAvailable).toBe(false);
    expect(result.current.activeCharacter).toBeDefined();

    let loginResult: string | null = null;
    await act(async () => {
      loginResult = await result.current.login('any');
    });
    expect(loginResult).toBe('Connection error - please check your internet connection and try again');

    await act(async () => {
      await expect(result.current.useFight()).rejects.toThrow('Connection error - fight not counted');
    });
  });

  it('should return false when retryConnection cannot reach server', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    (getDocs as any).mockRejectedValue(new Error('No internet'));
    (getDocsFromServer as any).mockRejectedValue(new Error('No internet'));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let ok = true;
    await act(async () => {
      ok = await result.current.retryConnection();
    });

    expect(ok).toBe(false);
    expect(result.current.firebaseAvailable).toBe(false);
  });
});
