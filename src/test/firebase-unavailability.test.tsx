import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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
  updateDoc: vi.fn(),
}));

import { getDocs, updateDoc } from 'firebase/firestore';

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
    localStorage.clear();
    
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

    // Mock server time
    const mockServerTimeSnapshot = {
      docs: [{
        data: () => ({ timestamp: Date.now() })
      }]
    };
    (getDocs as any).mockResolvedValue(mockServerTimeSnapshot);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should set firebaseAvailable to false when Firestore fails during load', async () => {
    // Setup: Character in localStorage
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));

    // Mock Firestore failure
    (getDocs as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Firebase should be marked as unavailable
    expect(result.current.firebaseAvailable).toBe(false);
    expect(result.current.activeCharacter).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith('bitbrawler_active_char');
  });

  it('should set firebaseAvailable to false when login fails', async () => {
    // Mock login failure
    (getDocs as any).mockRejectedValue(new Error('Connection failed'));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Attempt login
    const loginResult = await result.current.login('Test Hero');

    expect(loginResult).toBe('Connection error - please check your internet connection and try again');
    
    // Wait for state update
    await waitFor(() => {
      expect(result.current.firebaseAvailable).toBe(false);
    });
  });

  it('should set firebaseAvailable to false when useFight fails', async () => {
    // Setup: Character loaded successfully
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));

    (getDocs as any).mockResolvedValue({
      docs: [{
        data: () => mockCharacter,
        id: 'test-firestore-id'
      }]
    });

    // Mock updateDoc failure
    (updateDoc as any).mockRejectedValue(new Error('Connection lost'));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Attempt to use a fight
    await expect(result.current.useFight()).rejects.toThrow('Connection error - fight not counted');
    
    // Wait for state update
    await waitFor(() => {
      expect(result.current.firebaseAvailable).toBe(false);
    });
  });

  it('should set firebaseAvailable to false when daily reset fails', async () => {
    // Setup: Character loaded successfully
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));

    // Mock successful initial load
    (getDocs as any).mockResolvedValueOnce({
      docs: [{
        data: () => mockCharacter,
        id: 'test-firestore-id'
      }]
    });

    // Mock server time failure for daily reset
    (getDocs as any).mockRejectedValueOnce(new Error('Server unavailable'));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Wait for daily reset check to fail
    await waitFor(() => {
      expect(result.current.firebaseAvailable).toBe(false);
    }, { timeout: 3000 });

    expect(result.current.activeCharacter).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith('bitbrawler_active_char');
  });

  it('should clear localStorage when Firebase is unavailable', async () => {
    // Setup: Character in localStorage
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));

    // Mock Firestore failure
    (getDocs as any).mockRejectedValue(new Error('Firebase down'));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should clear localStorage to prevent playing with stale data
    expect(localStorage.removeItem).toHaveBeenCalledWith('bitbrawler_active_char');
    expect(result.current.activeCharacter).toBeNull();
    expect(result.current.firebaseAvailable).toBe(false);
  });

  it('should prevent access to game when Firebase is unavailable', async () => {
    // Setup: Character in localStorage
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));

    // Mock Firestore failure
    (getDocs as any).mockRejectedValue(new Error('No internet'));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // User should not be able to access the game
    expect(result.current.firebaseAvailable).toBe(false);
    expect(result.current.activeCharacter).toBeNull();
    
    // Login should return error message (not reject)
    const loginResult = await result.current.login('any');
    expect(loginResult).toBe('Connection error - please check your internet connection and try again');
    
    // useFight should return undefined when no character is loaded (not reject)
    const fightResult = await result.current.useFight();
    expect(fightResult).toBeUndefined();
  });
});
