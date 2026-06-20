import { useState, useEffect, useRef, useMemo } from 'react';
import { Character } from '../types/Character';
import { PixelCharacter } from './PixelCharacter';
import { PixelMonster } from './PixelMonster';
import { PixelIcon } from './PixelIcon';
import { simulateCombat } from '../utils/combatUtils';
import { getMatchDifficultyLabel } from '../utils/matchmakingUtils';
import { parseCombatDetail, CombatAction, CombatActionType } from '../utils/combatLogUtils';
import { calculateFightXp } from '../utils/xpUtils';
import { useSound } from '../hooks/useSound';
import { MONSTER_ASSETS, MonsterId } from '../data/monsterAssets';
import { ParticleSystem } from '../utils/particleSystem'; // Import ParticleSystem

function extractDamage(detail: string): number | null {
    const match = detail.match(/(\d+)\s*DMG/);
    return match ? parseInt(match[1], 10) : null;
}

function extractActionColor(detail: string): string {
    const lower = detail.toLowerCase();
    if (lower.includes('crit')) return 'crit';
    if (lower.includes('magic')) return 'magic';
    if (lower.includes('counter')) return 'counter';
    if (lower.includes('miss')) return 'miss';
    if (lower.includes('hit')) return 'hit';
    return '';
}

interface CombatViewProps {
    player: Character;
    opponent: Character;
    matchType: 'balanced' | 'similar' | 'pve';
    monsterId?: MonsterId;
    onComplete: (won: boolean, xpGained: number) => void;
    onClose: () => void;
    candidates?: Character[];
}

export const CombatView = ({ player, opponent, matchType, monsterId, onComplete, onClose, candidates = [] }: CombatViewProps) => {
    const { play } = useSound();
    const [phase, setPhase] = useState<'intro' | 'vs' | 'combat' | 'result'>('intro');
    const [combatResult, setCombatResult] = useState<{
        winner: 'attacker' | 'defender' | 'draw';
        rounds: number;
        details: string[];
        timeline: { attackerHp: number; defenderHp: number }[];
    } | null>(null);
    const [currentRound, setCurrentRound] = useState(0);
    const logRef = useRef<HTMLDivElement | null>(null);
    const [actionPulse, setActionPulse] = useState<CombatAction | null>(null);
    // Removed damageNumber state as particles will handle it
    // const [damageNumber, setDamageNumber] = useState<{ value: number; actor: 'player' | 'opponent' } | null>(null);
    const pulseTimeoutRef = useRef<number | null>(null);
    // Removed damageTimeoutRef as particles handle their own timing
    // const damageTimeoutRef = useRef<number | null>(null);
    const [scanIndex, setScanIndex] = useState(0);
    const [scanLocked, setScanLocked] = useState(false);
    const [fighterEntrance, setFighterEntrance] = useState(false);
    const actionDurations: Record<CombatActionType, number> = {
        hit: 380,
        crit: 560,
        magic: 600,
        miss: 420,
        counter: 440,
    };

    // Particle system refs
    const particleSystemRef = useRef<ParticleSystem | null>(null);
    const mainContainerRef = useRef<HTMLDivElement | null>(null);

    const scanList = useMemo(() => {
        const map = new Map<string, Character>();
        const add = (entry: Character) => {
            const key = entry.id || entry.name;
            if (!map.has(key)) {
                map.set(key, entry);
            }
        };
        candidates.forEach(add);
        add(opponent);
        return Array.from(map.values());
    }, [candidates, opponent]);

    const selectedKey = opponent.id || opponent.name;

    // Initialize ParticleSystem on mount
    useEffect(() => {
        if (mainContainerRef.current) {
            const ps = new ParticleSystem();
            ps.mount(mainContainerRef.current);
            particleSystemRef.current = ps;
        }

        // Cleanup
        return () => {
            particleSystemRef.current?.destroy();
        };
    }, []); // Run only on mount

    // Intro → VS
    useEffect(() => {
        if (phase !== 'intro') return;
        const delay = matchType === 'pve' ? 1200 : 2000;
        const introTimer = setTimeout(() => {
            const result = simulateCombat(player, opponent);
            setCombatResult(result);
            setPhase('vs');
        }, delay);
        return () => clearTimeout(introTimer);
    }, [phase, player, opponent, matchType]);

    // VS → Combat (with fighter entrance)
    useEffect(() => {
        if (phase !== 'vs') return;
        play('vs');
        const vsTimer = setTimeout(() => {
            setFighterEntrance(true);
            setTimeout(() => {
                setPhase('combat');
            }, 500);
        }, 900);
        return () => clearTimeout(vsTimer);
    }, [phase, play]);

    // Scanning animation
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
            play('scanTick');
        }, scanInterval);

        const lockTimer = window.setTimeout(() => {
            window.clearInterval(intervalId);
            const finalIndex = scanList.findIndex((entry) => (entry.id || entry.name) === selectedKey);
            setScanIndex(finalIndex >= 0 ? finalIndex : 0);
            setScanLocked(true);
            play('scan');
        }, scanDuration);

        return () => {
            window.clearInterval(intervalId);
            window.clearTimeout(lockTimer);
        };
    }, [phase, scanList, selectedKey]);

    // Combat round playback and particle emission
    useEffect(() => {
        if (phase === 'combat' && combatResult) {
            let roundIndex = 0;
            const roundInterval = setInterval(() => {
                if (roundIndex < combatResult.details.length) {
                    setCurrentRound(roundIndex);
                    const detail = combatResult.details[roundIndex];
                    const action = parseCombatDetail(detail, player.name, opponent.name);
                    
                    const ps = particleSystemRef.current;
                    const playerX = 30; // Relative X for player in combat view
                    const opponentX = 70; // Relative X for opponent in combat view
                    const centerY = 55; // Relative Y for center of combat view

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

                        // Emit particles based on action type and damage
                        const dmg = extractDamage(detail);
                        if (dmg !== null) {
                            if (action.actor === 'player') { // Player hit opponent
                                if (action.type === 'crit') ps?.emit('crit', opponentX, centerY, 1); 
                                else if (action.type === 'miss') ps?.emit('miss', opponentX, centerY, 1);
                                else ps?.emit('damage', opponentX, centerY, 1, dmg);
                            } else { // Opponent hit player
                                if (action.type === 'crit') ps?.emit('crit', playerX, centerY, 1); 
                                else if (action.type === 'miss') ps?.emit('miss', playerX, centerY, 1);
                                else ps?.emit('damage', playerX, centerY, 1, dmg);
                            }
                        } else if (action.type === 'miss') { // Handle miss if no damage value but action is miss
                             if (action.actor === 'player') ps?.emit('miss', opponentX, centerY, 1);
                             else ps?.emit('miss', playerX, centerY, 1);
                        }
                        // Add logic for 'heal' if it becomes relevant in combat view
                    }
                    roundIndex++;
                } else {
                    clearInterval(roundInterval);
                    setTimeout(() => {
                        setPhase('result');
                    }, 1200);
                }
            }, 520);

            return () => clearInterval(roundInterval);
        }
    }, [phase, combatResult, player.name, opponent.name, player, opponent, actionDurations, particleSystemRef.current]); // Added dependencies

    // Play sound on each action pulse
    useEffect(() => {
        if (actionPulse) {
            play(actionPulse.type);
        }
    }, [actionPulse, play]);

    useEffect(() => {
        return () => {
            if (pulseTimeoutRef.current !== null) {
                window.clearTimeout(pulseTimeoutRef.current);
            }
            // Removed damageTimeoutRef cleanup as it's no longer used
        };
    }, []);

    useEffect(() => {
        if (phase !== 'combat') {
            setActionPulse(null);
            // Removed setDamageNumber(null);
        }
    }, [phase]);

    // Victory / defeat sound
    useEffect(() => {
        if (phase === 'result' && combatResult) {
            play(combatResult.winner === 'attacker' ? 'victory' : 'defeat');
        }
    }, [phase, combatResult, play]);

    useEffect(() => {
        if (phase !== 'combat') return;
        const node = logRef.current;
        if (!node) return;
        requestAnimationFrame(() => {
            node.scrollTop = node.scrollHeight;
        });
    }, [currentRound, phase]);

    const handleFinish = async () => {
        if (!combatResult) return;

        try {
            await onComplete(combatResult.winner === 'attacker', xpGained);
        } finally {
            onClose();
        }
    };

    const won = combatResult?.winner === 'attacker';
    const draw = combatResult?.winner === 'draw';

    const xpGained = useMemo(() => {
        if (!combatResult) return 0;
        return calculateFightXp(combatResult.winner === 'attacker', player.level, opponent.level);
    }, [player.level, combatResult]);

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
        <div className="combat-overlay" onClick={(e) => e.target === e.currentTarget && phase === 'result' && handleFinish()} ref={mainContainerRef}>
            <div className="combat-modal">
                {/* Intro Phase */}
                {phase === 'intro' && (matchType === 'pve' ? (
                    <div className="combat-intro pve-intro">
                        <div className="match-type-badge">{getMatchDifficultyLabel(matchType)}</div>
                        <div className="monster-encounter">
                            <div className="encounter-text">A WILD</div>
                            <div className="encounter-name">{opponent.name}</div>
                            <div className="encounter-text">APPEARS!</div>
                            <div className="encounter-level">LVL {opponent.level}</div>
                        </div>
                    </div>
                ) : (
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
                ))}

                {/* VS Splash Phase */}
                {phase === 'vs' && (
                    <div className="combat-vs">
                        <div className="vs-fighter vs-left">
                            <PixelCharacter seed={player.seed} gender={player.gender} scale={8} />
                            <div className="vs-fighter-name">{player.name}</div>
                            <div className="vs-fighter-lvl">LVL {player.level}</div>
                        </div>
                        <div className="vs-center">
                            <div className="vs-text">VS</div>
                        </div>
                        <div className="vs-fighter vs-right">
                            {matchType === 'pve' && monsterId ? (
                                <div className="monster-vs-display">
                                    <PixelMonster monsterId={monsterId} scale={8} />
                                    {(() => {
                                        const def = MONSTER_ASSETS.find(m => m.id === monsterId);
                                        return def ? (
                                            <div className="monster-specialty">{def.specialty}</div>
                                        ) : null;
                                    })()}
                                </div>
                            ) : (
                                <PixelCharacter seed={opponent.seed} gender={opponent.gender} scale={8} />
                            )}
                            <div className="vs-fighter-name">{opponent.name}</div>
                            <div className="vs-fighter-lvl">LVL {opponent.level}</div>
                        </div>
                    </div>
                )}

                {/* Combat Phase */}
                {phase === 'combat' && combatResult && (
                    <div className={`combat-action${actionPulse ? ` action-${actionPulse.type}` : ''}`}>
                        {/* Removed old damageNumber display */}
                        <div className="combat-fighters">
                            <div
                                key={`player-${currentRound}`}
                                className={`fighter-side left${fighterEntrance ? ' enter-left' : ''}${
                                    actionPulse?.actor === 'player'
                                        ? ` action-${actionPulse.type}`
                                        : reactionType && actionPulse?.actor === 'opponent'
                                            ? ` react-${reactionType}`
                                            : ''
                                }`}
                            >
                                <div className="fighter-character-wrap">
                                    <PixelCharacter seed={player.seed} gender={player.gender} scale={6} />
                                </div>
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
                                key={`opponent-${currentRound}`}
                                className={`fighter-side right${fighterEntrance ? ' enter-right' : ''}${
                                    actionPulse?.actor === 'opponent'
                                        ? ` action-${actionPulse.type}`
                                        : reactionType && actionPulse?.actor === 'player'
                                            ? ` react-${reactionType}`
                                            : ''
                                }`}
                            >
                                <div className="fighter-character-wrap">
                                    {matchType === 'pve' && monsterId ? (
                                        <PixelMonster monsterId={monsterId} scale={5} />
                                    ) : (
                                        <PixelCharacter seed={opponent.seed} gender={opponent.gender} scale={6} />
                                    )}
                                </div>
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
                                    className={`log-entry ${idx === currentRound ? `active action-${extractActionColor(detail)}` : ''}`}
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
                                    <div className="result-xp victory">+{xpGained} XP</div>
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
                                    <div className="result-xp defeat">+{xpGained} XP</div>
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
                                    <div className="result-xp draw">+{xpGained} XP</div>
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
