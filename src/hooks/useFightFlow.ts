import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { MatchmakingResult } from '../utils/matchmakingUtils';

/**
 * Custom hook that encapsulates the fight/matchmaking/combat flow.
 * Extracted from Arena.tsx to reduce its complexity.
 */
export function useFightFlow(
    isOfflineMode: boolean,
    fightsLeft: number,
    hasPendingFight: boolean,
    ensureConnection: (message: string) => Promise<boolean>,
    openModal: (message: string) => void,
) {
    const { startMatchmaking, useFight } = useGame();

    const [matchmaking, setMatchmaking] = useState(false);
    const [combatData, setCombatData] = useState<MatchmakingResult | null>(null);

    const connectionMessage = 'Connect to battle and sync your progress.';
    const canFight = !isOfflineMode && fightsLeft > 0 && !hasPendingFight;

    const handleFight = async () => {
        if (matchmaking || hasPendingFight) return;
        const canProceed = await ensureConnection(connectionMessage);
        if (!canProceed) return;

        if (window.navigator.vibrate) window.navigator.vibrate(80);
        setMatchmaking(true);

        try {
            const match = await startMatchmaking();

            if (!match) {
                openModal('No opponents found! Try again later.');
                setMatchmaking(false);
                return;
            }

            setCombatData(match);
            setMatchmaking(false);
        } catch (error) {
            console.error('Matchmaking failed:', error);
            openModal(connectionMessage);
            setMatchmaking(false);
        }
    };

    const handleCombatComplete = async (won: boolean, xpGained: number) => {
        try {
            const opponentName = combatData?.opponent.name || 'UNKNOWN';
            const opponentId = combatData?.opponent.id || '';
            await useFight(won, xpGained, opponentName, opponentId);
        } catch (error: any) {
            console.error('Fight result save failed:', error);
            openModal(error.message || connectionMessage);
        }
    };

    const handleCloseCombat = () => {
        setCombatData(null);
    };

    return {
        matchmaking,
        combatData,
        canFight,
        handleFight,
        handleCombatComplete,
        handleCloseCombat,
    };
}
