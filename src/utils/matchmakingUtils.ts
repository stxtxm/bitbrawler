import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Character } from '../types/Character';

export interface MatchmakingResult {
    opponent: Character;
    matchType: 'balanced' | 'similar';
}

/**
 * Find an opponent for the given character using strict level-based matchmaking
 * ONLY matches players of the exact same level for maximum fairness
 * 
 * Priority:
 * 1. Find someone at the exact same level with similar total power
 * 2. If not found, find any opponent at the exact same level
 * 3. If still not found, return null (no match possible)
 */
export async function findOpponent(player: Character): Promise<MatchmakingResult | null> {
    try {
        // Only search for exact level matches
        const exactMatch = await findOpponentByExactLevel(player);
        if (exactMatch) {
            return exactMatch;
        }

        // No match found at all
        return null;
    } catch (error) {
        console.error('Matchmaking error:', error);
        return null;
    }
}

/**
 * Calculate total power of a character for balanced matchmaking
 */
function calculateTotalPower(character: Character): number {
    return (
        character.strength +
        character.vitality +
        character.dexterity +
        character.luck +
        character.intelligence
    );
}

/**
 * Find an opponent at the exact same level
 */
async function findOpponentByExactLevel(player: Character): Promise<MatchmakingResult | null> {
    try {
        // Query characters at the exact same level, excluding the current player
        const q = query(
            collection(db, 'characters'),
            where('level', '==', player.level),
            limit(50) // Get multiple candidates for better selection
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        // Filter out the current player and get all candidates
        const candidates = snapshot.docs
            .map(doc => ({
                ...doc.data() as Character,
                firestoreId: doc.id
            }))
            .filter(char => char.firestoreId !== player.firestoreId);

        if (candidates.length === 0) {
            return null;
        }

        // Calculate player's total power
        const playerPower = calculateTotalPower(player);

        // Sort candidates by power similarity (closest total stats to player)
        const sortedCandidates = candidates
            .map(candidate => ({
                character: candidate,
                powerDiff: Math.abs(calculateTotalPower(candidate) - playerPower)
            }))
            .sort((a, b) => a.powerDiff - b.powerDiff);

        // Pick from top 3 most balanced opponents (if available) for variety
        const topCandidates = sortedCandidates.slice(0, Math.min(3, sortedCandidates.length));
        const selectedCandidate = topCandidates[Math.floor(Math.random() * topCandidates.length)];

        // Determine match type based on power difference
        const matchType = selectedCandidate.powerDiff <= 3 ? 'balanced' : 'similar';

        return {
            opponent: selectedCandidate.character,
            matchType
        };
    } catch (error) {
        console.error('Exact level query error:', error);
        return null;
    }
}

/**
 * Get match difficulty label
 */
export function getMatchDifficultyLabel(matchType: 'balanced' | 'similar'): string {
    switch (matchType) {
        case 'balanced':
            return 'BALANCED MATCH';
        case 'similar':
            return 'FAIR MATCH';
        default:
            return 'MATCH';
    }
}
