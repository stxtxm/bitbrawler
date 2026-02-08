import { useState, useEffect } from 'react';
import { Character } from '../types/Character';
import { PixelCharacter } from './PixelCharacter';
import { simulateCombat } from '../utils/combatUtils';
import { getMatchDifficultyLabel } from '../utils/matchmakingUtils';

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
    } | null>(null);
    const [currentRound, setCurrentRound] = useState(0);

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
                    roundIndex++;
                } else {
                    clearInterval(roundInterval);
                    // Show result after combat animation
                    setTimeout(() => {
                        setPhase('result');
                    }, 1000);
                }
            }, 400); // 400ms per round detail

            return () => clearInterval(roundInterval);
        }
    }, [phase, combatResult]);

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
                            <div className="fighter-side left">
                                <PixelCharacter seed={player.seed} gender={player.gender} scale={6} />
                                <div className="fighter-name-small">{player.name}</div>
                            </div>
                            <div className="fighter-side right">
                                <PixelCharacter seed={opponent.seed} gender={opponent.gender} scale={6} />
                                <div className="fighter-name-small">{opponent.name}</div>
                            </div>
                        </div>
                        <div className="combat-log">
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
                                <div className="result-icon">🏆</div>
                                <div className="result-message">
                                    You defeated {opponent.name} in {combatResult.rounds} rounds!
                                </div>
                            </>
                        )}
                        {!won && !draw && (
                            <>
                                <div className="result-badge defeat">DEFEAT</div>
                                <div className="result-icon">💀</div>
                                <div className="result-message">
                                    {opponent.name} defeated you in {combatResult.rounds} rounds.
                                </div>
                            </>
                        )}
                        {draw && (
                            <>
                                <div className="result-badge draw">DRAW</div>
                                <div className="result-icon">⚔️</div>
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
