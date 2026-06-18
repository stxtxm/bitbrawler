import { useState, useEffect, useRef, useCallback } from 'react';
import { Character } from '../types/Character';
import { IdleCombatState, IdleCombatEntry, OfflineGains } from '../types/IdleCombat';
import { GAME_RULES } from '../config/gameRules';
import { generateMonsterForPlayer } from '../utils/monsterUtils';
import { simulateCombat } from '../utils/combatUtils';
import { calculateIdleXp, calculateOfflineGains } from '../utils/idleXpUtils';
import { gainXp } from '../utils/xpUtils';

const INTERVAL_MS = GAME_RULES.IDLE.COMBAT_INTERVAL_MS;

function createInitialState(lastActiveTimestamp?: number): IdleCombatState {
    return {
        isRunning: true,
        combatLog: [],
        currentMonsterName: null,
        currentMonsterId: null,
        currentResult: null,
        lastActiveTimestamp: lastActiveTimestamp ?? Date.now(),
        totalIdleXpGained: 0,
        totalIdleFights: 0,
        totalIdleWins: 0,
    };
}

export function useIdleCombat(
    character: Character,
    setCharacter: ((c: Character) => void) | undefined,
): {
    idleState: IdleCombatState;
    offlineGains: OfflineGains | null;
    dismissOfflineRecap: () => void;
} {
    const [idleState, setIdleState] = useState<IdleCombatState>(() =>
        createInitialState(character.lastIdleTimestamp)
    );
    const [offlineGains, setOfflineGains] = useState<OfflineGains | null>(null);

    const characterRef = useRef(character);
    const setCharacterRef = useRef(setCharacter);

    characterRef.current = character;
    setCharacterRef.current = setCharacter;

    const persistIdleTimestamp = useCallback(() => {
        if (!setCharacterRef.current) return;
        const updated = { ...characterRef.current, lastIdleTimestamp: Date.now() };
        setCharacterRef.current(updated);
    }, []);

    const runCombat = useCallback(() => {
        const char = characterRef.current;
        if (!char) return;

        const { character: monster } = generateMonsterForPlayer(char.level);
        const result = simulateCombat(char, monster);
        const won = result.winner === 'attacker';
        const xp = calculateIdleXp(won, char.level);

        const xpResult = gainXp(char, xp);
        const updatedChar = {
            ...xpResult.updatedCharacter,
            hp: xpResult.updatedCharacter.maxHp,
        };

        if (setCharacterRef.current) {
            setCharacterRef.current(updatedChar);
        }

        const entry: IdleCombatEntry = {
            timestamp: Date.now(),
            monsterName: monster.name,
            monsterId: monster.seed.replace('monster_', ''),
            won,
            xpGained: xp,
            rounds: result.rounds,
        };

        setIdleState(prev => ({
            ...prev,
            combatLog: [...prev.combatLog.slice(-49), entry],
            currentMonsterName: monster.name,
            currentMonsterId: monster.seed.replace('monster_', ''),
            currentResult: { won, xpGained: xp },
            totalIdleFights: prev.totalIdleFights + 1,
            totalIdleXpGained: prev.totalIdleXpGained + xp,
            totalIdleWins: prev.totalIdleWins + (won ? 1 : 0),
            lastActiveTimestamp: Date.now(),
        }));
    }, []);

    // Handle offline gains on mount
    useEffect(() => {
        const lastTimestamp = character.lastIdleTimestamp;
        if (!lastTimestamp) return;

        const elapsedMs = Date.now() - lastTimestamp;
        if (elapsedMs < INTERVAL_MS) return;

        const elapsedHours = elapsedMs / 3600000;
        const gains = calculateOfflineGains(character, elapsedHours);

        if (gains.fightsSimulated > 0) {
            setOfflineGains(gains);

            // Apply offline gains to character
            let current = { ...character };
            for (let i = 0; i < gains.fightsSimulated; i++) {
                const won = Math.random() < 0.7;
                const xp = calculateIdleXp(won, current.level);
                const result = gainXp(current, xp);
                current = {
                    ...result.updatedCharacter,
                    hp: result.updatedCharacter.maxHp,
                };
            }

            setIdleState(prev => ({
                ...prev,
                totalIdleFights: prev.totalIdleFights + gains.fightsSimulated,
                totalIdleXpGained: prev.totalIdleXpGained + gains.totalXpGained,
                totalIdleWins: prev.totalIdleWins + gains.wins,
                lastActiveTimestamp: Date.now(),
            }));

            if (setCharacter) {
                setCharacter(current);
            }
        }
        // Only run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Start idle combat loop
    useEffect(() => {
        const intervalId = setInterval(runCombat, INTERVAL_MS);
        return () => {
            clearInterval(intervalId);
            persistIdleTimestamp();
        };
    }, [runCombat, persistIdleTimestamp]);

    const dismissOfflineRecap = useCallback(() => {
        setOfflineGains(null);
    }, []);

    return { idleState, offlineGains, dismissOfflineRecap };
}
