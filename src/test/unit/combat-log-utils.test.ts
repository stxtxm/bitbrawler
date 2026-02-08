import { describe, it, expect } from 'vitest';
import { parseCombatDetail } from '../../utils/combatLogUtils';

describe('combatLogUtils', () => {
    const player = 'Hero';
    const opponent = 'Villain';

    it('returns null for summary lines', () => {
        expect(parseCombatDetail('Hero vs Villain', player, opponent)).toBeNull();
        expect(parseCombatDetail('Hero gagne !', player, opponent)).toBeNull();
        expect(parseCombatDetail('Limite de rounds atteinte !', player, opponent)).toBeNull();
    });

    it('detects player miss', () => {
        const result = parseCombatDetail('Round 1: Hero missed!', player, opponent);
        expect(result).toEqual({ actor: 'player', type: 'miss' });
    });

    it('detects opponent magic', () => {
        const result = parseCombatDetail('Round 2: Villain uses MAGIC SURGE! 12 DMG', player, opponent);
        expect(result).toEqual({ actor: 'opponent', type: 'magic' });
    });

    it('detects crit and counter', () => {
        const crit = parseCombatDetail('Round 3: Hero hit CRIT! 20 DMG', player, opponent);
        expect(crit).toEqual({ actor: 'player', type: 'crit' });

        const counter = parseCombatDetail('Round 4: Villain counter 8 DMG', player, opponent);
        expect(counter).toEqual({ actor: 'opponent', type: 'counter' });
    });

    it('detects normal hit', () => {
        const hit = parseCombatDetail('Round 5: Hero hit 9 DMG', player, opponent);
        expect(hit).toEqual({ actor: 'player', type: 'hit' });
    });
});
