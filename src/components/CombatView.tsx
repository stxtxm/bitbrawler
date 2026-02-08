import { useState, useEffect, useRef } from 'react';
import { Character } from '../types/Character';
import { PixelCharacter } from './PixelCharacter';
import { PixelIcon } from './PixelIcon';
import { simulateCombat } from '../utils/combatUtils';
import { getMatchDifficultyLabel } from '../utils/matchmakingUtils';
import { parseCombatDetail, CombatAction } from '../utils/combatLogUtils';

interface CombatViewProps {
    player: Character;
    opponent: Character;
    matchType: 'balanced' | 'similar';
    onComplete: (won: boolean, xpGained: number) => void;
    onClose: () => void;
}

export const CombatView = ({ player, opponent, matchType, onComplete, onClose }: CombatViewProps) => {
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
                        pulseTimeoutRef.current = window.setTimeout(() => {
                            setActionPulse(null);
                            pulseTimeoutRef.current = null;
                        }, 260);
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

    const handleFinish = () => {
        if (!combatResult) return;

        const won = combatResult.winner === 'attacker';
        const baseXp = won ? 50 : 20;
        const xpGained = Math.round(baseXp * (1 + (opponent.level - player.level) * 0.1));

        onComplete(won, xpGained);
        onClose();
    };

    const won = combatResult?.winner === 'attacker';
    const draw = combatResult?.winner === 'draw';

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

    return (
        <div className="combat-overlay" onClick={(e) => e.target === e.currentTarget && phase === 'result' && handleFinish()}>
            <div className="combat-modal">
                {/* Intro Phase */}
                {phase === 'intro' && (
                    <div className="combat-intro">
                        <div className="match-type-badge">{getMatchDifficultyLabel(matchType)}</div>
                        <h2 className="combat-title">BATTLE START!</h2>
                        <div className="vs-container">
                            <div className="fighter-intro">
                                <PixelCharacter seed={player.seed} gender={player.gender} scale={8} />
                                <div className="fighter-name">{player.name}</div>
                                <div className="fighter-level">LVL {player.level}</div>
                            </div>
                            <div className="vs-text">VS</div>
                            <div className="fighter-intro">
                                <PixelCharacter seed={opponent.seed} gender={opponent.gender} scale={8} />
                                <div className="fighter-name">{opponent.name}</div>
                                <div className="fighter-level">LVL {opponent.level}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Combat Phase */}
                {phase === 'combat' && combatResult && (
                    <div className="combat-action">
                        <div className="combat-fighters">
                            <div className={`fighter-side left${actionPulse?.actor === 'player' ? ` action-${actionPulse.type}` : ''}`}>
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
                            <div className={`fighter-side right${actionPulse?.actor === 'opponent' ? ` action-${actionPulse.type}` : ''}`}>
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
                    <div className="combat-result">
                        {won && (
                            <>
                                <div className="result-badge victory">VICTORY!</div>
                                <div className="result-icon pixel">
                                    <PixelIcon type="trophy" size={72} />
                                </div>
                                <div className="result-message">
                                    You defeated {opponent.name} in {combatResult.rounds} rounds!
                                </div>
                            </>
                        )}
                        {!won && !draw && (
                            <>
                                <div className="result-badge defeat">DEFEAT</div>
                                <div className="result-icon pixel">
                                    <PixelIcon type="skull" size={72} />
                                </div>
                                <div className="result-message">
                                    {opponent.name} defeated you in {combatResult.rounds} rounds.
                                </div>
                            </>
                        )}
                        {draw && (
                            <>
                                <div className="result-badge draw">DRAW</div>
                                <div className="result-icon pixel">
                                    <PixelIcon type="swords" size={72} />
                                </div>
                                <div className="result-message">
                                    The match ended in a draw after {combatResult.rounds} rounds!
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
