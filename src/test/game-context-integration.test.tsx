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

describe('GameContext Daily Reset Integration', () => {
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

  it('should load character and trigger daily reset on mount', async () => {
    // Setup: Character in localStorage from yesterday
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));

    // Mock Firestore character data
    (getDocs as any).mockResolvedValue({
      docs: [{
        data: () => mockCharacter,
        id: 'test-firestore-id'
      }]
    });

    // Mock update for daily reset
    (updateDoc as any).mockResolvedValue(undefined);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Character should be loaded
    expect(result.current.activeCharacter).toBeDefined();
    expect(result.current.activeCharacter?.name).toBe('Test Hero');
  });

  it('should prioritize Firestore data over localStorage', async () => {
    // Setup: Different data in localStorage vs Firestore
    const localStorageChar = {
      ...mockCharacter,
      fightsLeft: 1,
      experience: 100
    };

    const firestoreChar = {
      ...mockCharacter,
      fightsLeft: 5,
      experience: 600
    };

    (localStorage.getItem as any).mockReturnValue(JSON.stringify(localStorageChar));

    // Mock Firestore with different data
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

    // Should use Firestore data
    expect(result.current.activeCharacter?.fightsLeft).toBe(5);
    expect(result.current.activeCharacter?.experience).toBe(600);
  });

  it('should handle login with Firestore data', async () => {
    // Mock login response
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

    // Perform login
    const loginResult = await result.current.login('Test Hero');

    expect(loginResult).toBe(null); // Success
    
    // Wait for state update
    await waitFor(() => {
      expect(result.current.activeCharacter?.name).toBe('Test Hero');
    });
    
    expect(result.current.activeCharacter?.firestoreId).toBe('test-firestore-id');
  });

  it('should update fights when useFight is called', async () => {
    // Setup: Character loaded
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

    // Use a fight
    await result.current.useFight();

    // Wait for state update
    await waitFor(() => {
      expect(result.current.activeCharacter?.fightsLeft).toBe(initialFights - 1);
    });
    
    // Firestore should be updated
    expect(updateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      { fightsLeft: initialFights - 1 }
    );
  });

  it('should handle logout correctly', async () => {
    // Setup: Character loaded
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

    // Logout
    result.current.logout();

    // Wait for state update
    await waitFor(() => {
      expect(result.current.activeCharacter).toBeNull();
    });
    
    expect(localStorage.removeItem).toHaveBeenCalledWith('bitbrawler_active_char');
  });

  it('should handle Firestore errors gracefully', async () => {
    // Setup: Character in localStorage
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));

    // Mock Firestore error
    (getDocs as any).mockRejectedValue(new Error('Firestore unavailable'));

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should still have character from localStorage
    await waitFor(() => {
      expect(result.current.activeCharacter).toBeDefined();
    });
    expect(result.current.activeCharacter?.name).toBe('Test Hero');
  });

  it('should handle corrupted localStorage', async () => {
    // Mock corrupted localStorage
    (localStorage.getItem as any).mockReturnValue('invalid-json');

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have no character and corrupted data removed
    expect(result.current.activeCharacter).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith('bitbrawler_active_char');
  });
});
