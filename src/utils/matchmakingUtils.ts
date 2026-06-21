import { supabase } from '../config/supabase';
import { Character } from '../types/Character';
import { calculateCombatStats } from './combatUtils';
import { convertFromSupabase } from './supabaseUtils';

export interface MatchmakingResult {
    opponent: Character;
    matchType: 'balanced' | 'similar' | 'pve';
    candidates: Character[];
}

/**
 * Find an opponent for the given character using stat-based matchmaking.
 * Searches within a level range and picks the closest total power.
 */
export async function findOpponent(player: Character): Promise<MatchmakingResult | null> {
    try {
        const rangeMatch = await findOpponentByPowerRange(player);
        if (rangeMatch) {
            return rangeMatch;
        }

        return null;
    } catch (error) {
        console.error('Matchmaking error:', error);
        return null;
    }
}

/**
 * Calculate combat power using shared combat math so matchmaking stays aligned
 * with actual fight outcomes.
 */
function calculateTotalPower(character: Character): number {
    return calculateCombatStats(character).totalPower;
}

/**
 * Find an opponent within a nearby level range, ordered by power proximity.
 */
async function findOpponentByPowerRange(player: Character): Promise<MatchmakingResult | null> {
    try {
        const levelRange = 3;
        const { data, error } = await supabase
            .from('characters')
            .select('*')
            .gte('level', Math.max(1, player.level - levelRange))
            .lte('level', player.level + levelRange)
            .limit(100);

        if (error || !data || data.length === 0) {
            return null;
        }

        const candidates = data
            .map(convertFromSupabase)
            .filter(char => {
                if (!char.id) return false;
                if (char.id === player.id) return false;
                if (player.foughtToday && player.foughtToday.includes(char.id)) return false;
                return true;
            });

        if (candidates.length === 0) {
            return null;
        }

        const playerPower = calculateTotalPower(player);

        const sortedCandidates = candidates
            .map(candidate => ({
                character: candidate,
                powerDiff: Math.abs(calculateTotalPower(candidate) - playerPower),
            }))
            .sort((a, b) => a.powerDiff - b.powerDiff);

        const topCandidates = sortedCandidates.slice(0, Math.min(5, sortedCandidates.length));
        const selectedCandidate = topCandidates[Math.floor(Math.random() * topCandidates.length)];

        const matchType = selectedCandidate.powerDiff <= 5 ? 'balanced' : 'similar';
        const candidateList = sortedCandidates.map(entry => entry.character);

        return {
            opponent: selectedCandidate.character,
            matchType,
            candidates: candidateList,
        };
    } catch (error) {
        console.error('Power range query error:', error);
        return null;
    }
}

/**
 * Get match difficulty label
 */
export function getMatchDifficultyLabel(matchType: 'balanced' | 'similar' | 'pve'): string {
    switch (matchType) {
        case 'balanced':
            return 'BALANCED MATCH';
        case 'similar':
            return 'FAIR MATCH';
        case 'pve':
            return 'MONSTER BATTLE';
        default:
            return 'MATCH';
    }
}