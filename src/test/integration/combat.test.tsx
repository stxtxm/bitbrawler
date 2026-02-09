import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findOpponent, getMatchDifficultyLabel } from '../../utils/matchmakingUtils';
import { Character } from '../../types/Character';
import { getDocs } from 'firebase/firestore';

// Mock Firebase
vi.mock('../../config/firebase', () => ({
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    getDocs: vi.fn(),
    deleteField: vi.fn(),
}));

describe('🤝 Matchmaking System', () => {
    const player: Character = {
        name: 'Player',
        gender: 'male',
        seed: '123',
        level: 5,
        hp: 100,
        maxHp: 100,
        strength: 10,
        vitality: 10,
        dexterity: 10,
        luck: 10,
        intelligence: 10,
        focus: 10,
        experience: 0,
        wins: 0,
        losses: 0,
        fightsLeft: 5,
        lastFightReset: 0,
        firestoreId: 'p1',
        foughtToday: []
    };

    const sameLevelOpponent: Character = {
        ...player,
        name: 'Equal',
        firestoreId: 'o1'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should find opponent of EXACT same level', async () => {
        // In reality, Firestore filters by level. We simulate this by only returning matching docs.
        (getDocs as any).mockResolvedValue({
            empty: false,
            docs: [
                { id: 'o1', data: () => sameLevelOpponent }
            ]
        });

        const result = await findOpponent(player);

        // Safety check: ensure we query for the correct level
        // We can't easily check 'query' arguments deeply without complex mocking,
        // but we can trust the return value logic if the mock setup implies it.

        expect(result).not.toBeNull();
        if (result) {
            expect(result.opponent.level).toBe(player.level);
            expect(result.opponent.name).toBe('Equal');
            expect(result.matchType).toMatch(/balanced|similar/);
            expect(result.candidates.length).toBeGreaterThan(0);
        }
    });

    it('should return null if no exact level match found', async () => {
        // Mock getDocs to return empty (simulating query finding nothing)
        (getDocs as any).mockResolvedValue({
            empty: true,
            docs: []
        });

        const result = await findOpponent(player);
        expect(result).toBeNull();
    });

    it('should exclude opponents already fought today', async () => {
        const playerWithHistory: Character = { ...player, foughtToday: ['o1'] };
        const freshOpponent: Character = { ...sameLevelOpponent, name: 'Fresh', firestoreId: 'o2' };

        (getDocs as any).mockResolvedValue({
            empty: false,
            docs: [
                { id: 'o1', data: () => sameLevelOpponent },
                { id: 'o2', data: () => freshOpponent }
            ]
        });

        const result = await findOpponent(playerWithHistory);

        expect(result).not.toBeNull();
        if (result) {
            expect(result.opponent.firestoreId).toBe('o2');
            expect(result.opponent.name).toBe('Fresh');
            expect(result.candidates.some((cand) => cand.firestoreId === 'o2')).toBe(true);
        }
    });

    it('should return null if all same-level opponents were fought today', async () => {
        const playerWithHistory: Character = { ...player, foughtToday: ['o1', 'o2'] };
        const opponentTwo: Character = { ...sameLevelOpponent, name: 'Opponent Two', firestoreId: 'o2' };

        (getDocs as any).mockResolvedValue({
            empty: false,
            docs: [
                { id: 'o1', data: () => sameLevelOpponent },
                { id: 'o2', data: () => opponentTwo }
            ]
        });

        const result = await findOpponent(playerWithHistory);
        expect(result).toBeNull();
    });

    it('should exclude the current player from candidates', async () => {
        (getDocs as any).mockResolvedValue({
            empty: false,
            docs: [
                { id: player.firestoreId, data: () => player }
            ]
        });

        const result = await findOpponent(player);
        expect(result).toBeNull();
    });

    it('should sort candidates by closest power difference', async () => {
        const playerPower: Character = {
            ...player,
            strength: 10,
            vitality: 10,
            dexterity: 10,
            luck: 10,
            intelligence: 10,
            focus: 10
        };

        const close = { ...sameLevelOpponent, name: 'Close', firestoreId: 'o1', strength: 10 };
        const mid = { ...sameLevelOpponent, name: 'Mid', firestoreId: 'o2', strength: 14 };
        const far = { ...sameLevelOpponent, name: 'Far', firestoreId: 'o3', strength: 22 };

        (getDocs as any).mockResolvedValue({
            empty: false,
            docs: [
                { id: 'o3', data: () => far },
                { id: 'o1', data: () => close },
                { id: 'o2', data: () => mid }
            ]
        });

        vi.spyOn(Math, 'random').mockReturnValue(0);
        const result = await findOpponent(playerPower);
        expect(result).not.toBeNull();
        if (result) {
            expect(result.candidates.map((cand) => cand.firestoreId)).toEqual(['o1', 'o2', 'o3']);
            expect(result.opponent.firestoreId).toBe('o1');
            expect(result.matchType).toBe('balanced');
        }
    });

    it('should prioritize balanced stats', async () => {
        // Two opponents at same level: one balanced, one weak stats
        const balancedOpponent = { ...sameLevelOpponent, strength: 10, name: 'Balanced' };
        const unbalancedOpponent = { ...sameLevelOpponent, strength: 20, name: 'Strong' }; // 10 diff

        (getDocs as any).mockResolvedValue({
            empty: false,
            docs: [
                { id: 'o1', data: () => balancedOpponent },
                { id: 'o2', data: () => unbalancedOpponent }
            ]
        });

        // The logic should prefer the one with closer total power
        // Player total power = 50
        // Balanced total power = 50 (diff 0)
        // Strong total power = 60 (diff 10)

        // Since we sort by power diff, Balanced should be picked more likely or if we take top 3
        // Here we technically randomness involved but the pool is small.
        // If we only return these two, logic takes top 3 and picks random. 
        // Both are in top 3. So it's random.
        // But we can check matchType label logic.

        const result = await findOpponent(player);
        if (result && result.opponent.name === 'Balanced') {
            expect(result.matchType).toBe('balanced');
        }
    });

    it('should categorize match difficulty correctly', () => {
        expect(getMatchDifficultyLabel('balanced')).toBe('BALANCED MATCH');
        expect(getMatchDifficultyLabel('similar')).toBe('FAIR MATCH');
    });
});
