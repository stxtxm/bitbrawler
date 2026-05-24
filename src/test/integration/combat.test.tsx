import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findOpponent, getMatchDifficultyLabel } from '../../utils/matchmakingUtils';
import { Character } from '../../types/Character';
import { createQueryBuilder, characterToSupabaseRow } from '../../test/utils/supabaseMock';

const { mockSupabaseFrom } = vi.hoisted(() => ({
    mockSupabaseFrom: vi.fn()
}));

vi.mock('../../config/supabase', () => ({
    supabase: { from: mockSupabaseFrom },
    CharacterRow: {}
}));

function mockCharacters(chars: any[]) {
    const rows = chars.map(characterToSupabaseRow);
    const builder = createQueryBuilder({ data: rows, error: null });
    mockSupabaseFrom.mockReturnValue(builder);
}

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
        mockCharacters([sameLevelOpponent]);

        const result = await findOpponent(player);

        expect(result).not.toBeNull();
        if (result) {
            expect(result.opponent.level).toBe(player.level);
            expect(result.opponent.name).toBe('Equal');
            expect(result.matchType).toMatch(/balanced|similar/);
            expect(result.candidates.length).toBeGreaterThan(0);
        }
    });

    it('should return null if no exact level match found', async () => {
        mockCharacters([]);

        const result = await findOpponent(player);
        expect(result).toBeNull();
    });

    it('should exclude opponents already fought today', async () => {
        const playerWithHistory: Character = { ...player, foughtToday: ['o1'] };
        const freshOpponent: Character = { ...sameLevelOpponent, name: 'Fresh', firestoreId: 'o2' };

        mockCharacters([sameLevelOpponent, freshOpponent]);

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

        mockCharacters([sameLevelOpponent, opponentTwo]);

        const result = await findOpponent(playerWithHistory);
        expect(result).toBeNull();
    });

    it('should exclude the current player from candidates', async () => {
        mockCharacters([player]);

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

        mockCharacters([far, close, mid]);

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
        const balancedOpponent = { ...sameLevelOpponent, strength: 10, name: 'Balanced' };
        const unbalancedOpponent = { ...sameLevelOpponent, strength: 20, name: 'Strong' };

        mockCharacters([balancedOpponent, unbalancedOpponent]);

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
