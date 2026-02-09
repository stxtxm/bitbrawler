import { useState, useEffect, useRef, useMemo } from 'react';
import { Character } from '../types/Character';
import { PixelCharacter } from './PixelCharacter';
import { PixelIcon } from './PixelIcon';
import { simulateCombat } from '../utils/combatUtils';
import { getMatchDifficultyLabel } from '../utils/matchmakingUtils';
import { parseCombatDetail, CombatAction, CombatActionType } from '../utils/combatLogUtils';

interface CombatViewProps {
    player: Character;
    opponent: Character;
    matchType: 'balanced' | 'similar';
    onComplete: (won: boolean, xpGained: number) => void;
    onClose: () => void;
    candidates?: Character[];
}

export const CombatView = ({ player, opponent, matchType, onComplete, onClose, candidates = [] }: CombatViewProps) => {
    const [phase, setPhase] = useState<'intro' | 'combat' | 'result'>('intro');
    const [combatResult, setCombatResult] = useState<{
        winner: 'attacker' | 'defender' | 'draw';
        rounds: number;
        details: string[];
        timeline: { attackerHp: number; defenderHp: number }[];
    } | null>(null);
    const [currentRound, setCurrentRound] = useState(0);
    const logRef = useRef<HTMLDivElement | null>(null);
    const [actionPulse, setActionPulse] = useState<CombatAction | null>(null);
    const pulseTimeoutRef = useRef<number | null>(null);
    const [scanIndex, setScanIndex] = useState(0);
    const [scanLocked, setScanLocked] = useState(false);
    const actionDurations: Record<CombatActionType, number> = {
        hit: 380,
        crit: 560,
        magic: 600,
        miss: 420,
        counter: 440,
    };

    const scanList = useMemo(() => {
        const map = new Map<string, Character>();
        const add = (entry: Character) => {
            const key = entry.firestoreId || entry.name;
            if (!map.has(key)) {
                map.set(key, entry);
            }
        };
        candidates.forEach(add);
        add(opponent);
        return Array.from(map.values());
    }, [candidates, opponent]);

    const selectedKey = opponent.firestoreId || opponent.name;

    useEffect(() => {
        // Intro phase: 2 seconds
        const introTimer = setTimeout(() => {
            setPhase('combat');
            // Run the simulation
            const result = simulateCombat(player, opponent);
            setCombatResult(result);
        }, 2000);

        return () => clearTimeout(introTimer);
    }, [player, opponent]);

    useEffect(() => {
        if (phase !== 'intro') return;
        if (scanList.length <= 1) {
            setScanIndex(0);
            setScanLocked(true);
            return;
        }

        let index = 0;
        setScanIndex(0);
        setScanLocked(false);

        const scanInterval = 140;
        const scanDuration = 1900;

        const intervalId = window.setInterval(() => {
            index = (index + 1) % scanList.length;
            setScanIndex(index);
        }, scanInterval);

        const lockTimer = window.setTimeout(() => {
            window.clearInterval(intervalId);
            const finalIndex = scanList.findIndex((entry) => (entry.firestoreId || entry.name) === selectedKey);
            setScanIndex(finalIndex >= 0 ? finalIndex : 0);
            setScanLocked(true);
        }, scanDuration);

        return () => {
            window.clearInterval(intervalId);
            window.clearTimeout(lockTimer);
        };
    }, [phase, scanList, selectedKey]);

    useEffect(() => {
        if (phase === 'combat' && combatResult) {
            // Animate through rounds
            let roundIndex = 0;
            const roundInterval = setInterval(() => {
                if (roundIndex < combatResult.details.length) {
                    setCurrentRound(roundIndex);
                    const detail = combatResult.details[roundIndex];
                    const action = parseCombatDetail(detail, player.name, opponent.name);
                    if (action) {
                        setActionPulse(action);
                        if (pulseTimeoutRef.current !== null) {
                            window.clearTimeout(pulseTimeoutRef.current);
                        }
                        const duration = actionDurations[action.type] ?? 320;
                        pulseTimeoutRef.current = window.setTimeout(() => {
                            setActionPulse(null);
                            pulseTimeoutRef.current = null;
                        }, duration);
                    }
                    roundIndex++;
                } else {
                    clearInterval(roundInterval);
                    // Show result after combat animation
                    setTimeout(() => {
                        setPhase('result');
                    }, 1200);
                }
            }, 520); // Slightly slower for readability

            return () => clearInterval(roundInterval);
        }
    }, [phase, combatResult]);

    useEffect(() => {
        return () => {
            if (pulseTimeoutRef.current !== null) {
                window.clearTimeout(pulseTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (phase !== 'combat') {
            setActionPulse(null);
        }
    }, [phase]);

    useEffect(() => {
        if (phase !== 'combat') return;
        const node = logRef.current;
        if (!node) return;
        requestAnimationFrame(() => {
            node.scrollTop = node.scrollHeight;
        });
    }, [currentRound, phase]);

    const getXpGained = (won: boolean) => {
        const baseXp = won ? 50 : 20;
        return Math.round(baseXp * (1 + (opponent.level - player.level) * 0.1));
    };

    const handleFinish = () => {
        if (!combatResult) return;

        const won = combatResult.winner === 'attacker';
        const xpGained = getXpGained(won);

        onComplete(won, xpGained);
        onClose();
    };

    const won = combatResult?.winner === 'attacker';
    const draw = combatResult?.winner === 'draw';
    const xpPreview = getXpGained(won);

    const playerMaxHp = player.maxHp || player.hp;
    const opponentMaxHp = opponent.maxHp || opponent.hp;

    const getSnapshot = () => {
        if (!combatResult?.timeline?.length) {
            return { attackerHp: player.hp, defenderHp: opponent.hp };
        }
        if (phase === 'result') {
            return combatResult.timeline[combatResult.timeline.length - 1];
        }
        const index = Math.min(currentRound, combatResult.timeline.length - 1);
        return combatResult.timeline[index];
    };

    const snapshot = getSnapshot();
    const playerHp = Math.max(0, Math.min(playerMaxHp, snapshot.attackerHp));
    const opponentHp = Math.max(0, Math.min(opponentMaxHp, snapshot.defenderHp));
    const playerHpPercent = Math.max(0, Math.min(100, (playerHp / playerMaxHp) * 100));
    const opponentHpPercent = Math.max(0, Math.min(100, (opponentHp / opponentMaxHp) * 100));
    const reactionType = actionPulse && actionPulse.type !== 'miss' ? actionPulse.type : null;

    return (
        <div className="combat-overlay" onClick={(e) => e.target === e.currentTarget && phase === 'result' && handleFinish()}>
            <div className="combat-modal">
                {/* Intro Phase */}
                {phase === 'intro' && (
                    <div className="combat-intro">
                        <div className="match-type-badge">{getMatchDifficultyLabel(matchType)}</div>
                        <h2 className="combat-title">MATCHMAKING</h2>
                        <div className="matchmaking-stage">
                            <div className={`scan-card ${scanLocked ? 'locked' : 'scanning'}`}>
                                <div className="scan-subtitle">{scanLocked ? 'OPPONENT FOUND' : 'SCANNING...'}</div>
                                <div className="scan-avatar">
                                    <PixelCharacter seed={scanList[scanIndex]?.seed || opponent.seed} gender={scanList[scanIndex]?.gender || opponent.gender} scale={8} />
                                </div>
                                <div className="scan-name">{scanList[scanIndex]?.name || opponent.name}</div>
                                <div className="scan-level">LVL {scanList[scanIndex]?.level ?? opponent.level}</div>
                            </div>
                            <div className="scan-caption">LEVEL {opponent.level} OPPONENTS</div>
                            {scanLocked && (
                                <div className="scan-lock">
                                    <span className="lock-pulse" aria-hidden="true"></span>
                                    LOCKED
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Combat Phase */}
                {phase === 'combat' && combatResult && (
                    <div className={`combat-action${actionPulse ? ` action-${actionPulse.type}` : ''}`}>
                        <div className="combat-fighters">
                            <div
                                className={`fighter-side left${
                                    actionPulse?.actor === 'player'
                                        ? ` action-${actionPulse.type}`
                                        : reactionType && actionPulse?.actor === 'opponent'
                                            ? ` react-${reactionType}`
                                            : ''
                                }`}
                            >
                                <PixelCharacter seed={player.seed} gender={player.gender} scale={6} />
                                <div className="fighter-name-small">{player.name}</div>
                                <div className="fighter-health">
                                    <div className="health-bar">
                                        <div
                                            className={`health-bar-fill ${playerHpPercent <= 25 ? 'low' : ''}`}
                                            style={{ width: `${playerHpPercent}%` }}
                                        />
                                    </div>
                                    <div className="health-values">{playerHp} / {playerMaxHp}</div>
                                </div>
                            </div>
                            <div
                                className={`fighter-side right${
                                    actionPulse?.actor === 'opponent'
                                        ? ` action-${actionPulse.type}`
                                        : reactionType && actionPulse?.actor === 'player'
                                            ? ` react-${reactionType}`
                                            : ''
                                }`}
                            >
                                <PixelCharacter seed={opponent.seed} gender={opponent.gender} scale={6} />
                                <div className="fighter-name-small">{opponent.name}</div>
                                <div className="fighter-health">
                                    <div className="health-bar">
                                        <div
                                            className={`health-bar-fill ${opponentHpPercent <= 25 ? 'low' : ''}`}
                                            style={{ width: `${opponentHpPercent}%` }}
                                        />
                                    </div>
                                    <div className="health-values">{opponentHp} / {opponentMaxHp}</div>
                                </div>
                            </div>
                        </div>
                        <div className="combat-log" ref={logRef}>
                            {combatResult.details.slice(0, currentRound + 1).map((detail, idx) => (
                                <div
                                    key={idx}
                                    className={`log-entry ${idx === currentRound ? 'active' : ''}`}
                                >
                                    {detail}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Result Phase */}
                {phase === 'result' && combatResult && (
                    <div className={`combat-result${won ? ' victory' : draw ? ' draw' : ' defeat'}`}>
                        {won && (
                            <>
                                <div className="result-badge victory">VICTORY!</div>
                                <div className="result-icon pixel victory">
                                    <PixelIcon type="trophy" size={80} />
                                </div>
                                <div className="result-message">
                                    <div className="result-xp victory">+{xpPreview} XP</div>
                                    <div className="result-sub">Victory over {opponent.name}</div>
                                </div>
                            </>
                        )}
                        {!won && !draw && (
                            <>
                                <div className="result-badge defeat">DEFEAT</div>
                                <div className="result-icon pixel defeat">
                                    <PixelIcon type="skull" size={72} />
                                </div>
                                <div className="result-message">
                                    <div className="result-xp defeat">+{xpPreview} XP</div>
                                    <div className="result-sub">Defeated by {opponent.name}</div>
                                </div>
                            </>
                        )}
                        {draw && (
                            <>
                                <div className="result-badge draw">DRAW</div>
                                <div className="result-icon pixel draw">
                                    <PixelIcon type="swords" size={72} />
                                </div>
                                <div className="result-message">
                                    <div className="result-xp draw">+{xpPreview} XP</div>
                                    <div className="result-sub">Stalemate vs {opponent.name}</div>
                                </div>
                            </>
                        )}
                        <button className="button primary-btn result-btn" onClick={handleFinish}>
                            CONTINUE
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
