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
import { MonsterId, MONSTER_ASSETS } from '../data/monsterAssets';
import { ParticleSystem, type ParticleType } from '../utils/particleSystem';
import { COMBAT_BALANCE } from '../config/combatBalance';
import { useLowPerformanceMode } from '../hooks/useLowPerformanceMode';

const HIT_STOP_DURATION: Record<string, number> = {
  hit: 100,
  crit: 150,
  ko: 150,
};

const SCREEN_FLASH_DURATION: Record<string, number> = {
  crit: 80,
  ko: 150,
};

function extractDamage(detail: string): number | null {
    const match = detail.match(/(\d+)\s*DMG/);
    return match ? parseInt(match[1], 10) : null;
}

const ACTION_DURATIONS: Record<CombatActionType, number> = {
  hit: 380,
  crit: 560,
  magic: 600,
  miss: 420,
  counter: 440,
};

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
    const lowPerf = useLowPerformanceMode();
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
    const pulseTimeoutRef = useRef<number | null>(null);
    const [scanIndex, setScanIndex] = useState(0);
    const [scanLocked, setScanLocked] = useState(false);
    const [fighterEntrance, setFighterEntrance] = useState(false);
    const [showAutoResolve, setShowAutoResolve] = useState(false);
    const [hitStop, setHitStop] = useState(false);
    const [screenFlash, setScreenFlash] = useState<'none' | 'crit' | 'ko'>('none');
    const [isKO, setIsKO] = useState(false);
    const hitStopTimerRef = useRef<number | null>(null);
    const flashTimerRef = useRef<number | null>(null);

    const leftLayerRef = useRef<HTMLDivElement | null>(null);
    const rightLayerRef = useRef<HTMLDivElement | null>(null);
    const leftParticleSystemRef = useRef<ParticleSystem | null>(null);
    const rightParticleSystemRef = useRef<ParticleSystem | null>(null);

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

    useEffect(() => {
        if (leftLayerRef.current && !leftParticleSystemRef.current) {
            const ps = new ParticleSystem();
            ps.mount(leftLayerRef.current);
            leftParticleSystemRef.current = ps;
        }
        if (rightLayerRef.current && !rightParticleSystemRef.current) {
            const ps = new ParticleSystem();
            ps.mount(rightLayerRef.current);
            rightParticleSystemRef.current = ps;
        }
        return () => {
            leftParticleSystemRef.current?.destroy();
            leftParticleSystemRef.current = null;
            rightParticleSystemRef.current?.destroy();
            rightParticleSystemRef.current = null;
        };
    }, [phase]);

    // Hard timeout watchdog — force-finish the fight if it exceeds the limit.
    // Set once on mount, NOT reset on phase transitions or HP changes.
    const hardTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        hardTimeoutRef.current = window.setTimeout(() => {
            console.warn(`[CombatView] Hard timeout — forcing result phase after ${COMBAT_BALANCE.fightHardTimeoutMs}ms`);
            hardTimeoutRef.current = null;
            setCombatResult(prev => prev ?? {
                winner: 'draw',
                rounds: 0,
                details: ['Fight timed out'],
                timeline: [{ attackerHp: player.hp, defenderHp: opponent.hp }],
            });
            setPhase('result');
        }, COMBAT_BALANCE.fightHardTimeoutMs);

        return () => {
            if (hardTimeoutRef.current !== null) {
                window.clearTimeout(hardTimeoutRef.current);
                hardTimeoutRef.current = null;
            }
        };
    }, []); // mount only — never resets

    // Clear the timeout when the fight completes naturally (result phase reached)
    useEffect(() => {
        if (phase === 'result' && hardTimeoutRef.current !== null) {
            window.clearTimeout(hardTimeoutRef.current);
            hardTimeoutRef.current = null;
        }
    }, [phase]);

    // Auto-resolve warning timer — shows "Le combat s'éternise..." after 30s in combat phase
    useEffect(() => {
        if (phase !== 'combat') {
            setShowAutoResolve(false);
            return;
        }

        const warningTimer = window.setTimeout(() => {
            setShowAutoResolve(true);
        }, COMBAT_BALANCE.autoResolveWarningMs);

        return () => window.clearTimeout(warningTimer);
    }, [phase]);

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

    useEffect(() => {
        if (phase !== 'vs') return;
        play('vs');
        const vsTimer = setTimeout(() => {
            setFighterEntrance(true);

            // Emit spark particles on fighter entrance
            const leftPs = leftParticleSystemRef.current;
            const rightPs = rightParticleSystemRef.current;
            if (leftPs && rightPs) {
                if (!lowPerf) {
                    leftPs.emit('spark', 80, 50, 3);
                    rightPs.emit('spark', 80, 50, 3);
                }
            }

            setTimeout(() => {
                setPhase('combat');
            }, 500);
        }, 900);
        return () => clearTimeout(vsTimer);
    }, [phase, play, lowPerf]);

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

    useEffect(() => {
        if (phase === 'combat' && combatResult) {
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
                        const duration = ACTION_DURATIONS[action.type] ?? 320;
                        pulseTimeoutRef.current = window.setTimeout(() => {
                            setActionPulse(null);
                            pulseTimeoutRef.current = null;
                        }, duration);

                        // --- Hit Stop & Screen Shake / Flash ---
                        if (!lowPerf && action.type !== 'miss') {
                            const lastRound = roundIndex >= combatResult.details.length - 1;
                            const koBlow = lastRound && (
                                (action.actor === 'player' && combatResult.winner === 'attacker') ||
                                (action.actor === 'opponent' && combatResult.winner === 'defender')
                            );

                            if (koBlow) {
                                setIsKO(true);
                                setHitStop(true);
                                setScreenFlash('ko');
                                if (hitStopTimerRef.current !== null) window.clearTimeout(hitStopTimerRef.current);
                                hitStopTimerRef.current = window.setTimeout(() => {
                                    setHitStop(false);
                                    hitStopTimerRef.current = null;
                                }, HIT_STOP_DURATION.ko);
                                if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
                                flashTimerRef.current = window.setTimeout(() => {
                                    setScreenFlash('none');
                                    flashTimerRef.current = null;
                                }, SCREEN_FLASH_DURATION.ko);
                            } else if (action.type === 'crit') {
                                setHitStop(true);
                                setScreenFlash('crit');
                                if (hitStopTimerRef.current !== null) window.clearTimeout(hitStopTimerRef.current);
                                hitStopTimerRef.current = window.setTimeout(() => {
                                    setHitStop(false);
                                    hitStopTimerRef.current = null;
                                }, HIT_STOP_DURATION.crit);
                                if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
                                flashTimerRef.current = window.setTimeout(() => {
                                    setScreenFlash('none');
                                    flashTimerRef.current = null;
                                }, SCREEN_FLASH_DURATION.crit);
                            } else if (action.type === 'hit') {
                                setHitStop(true);
                                if (hitStopTimerRef.current !== null) window.clearTimeout(hitStopTimerRef.current);
                                hitStopTimerRef.current = window.setTimeout(() => {
                                    setHitStop(false);
                                    hitStopTimerRef.current = null;
                                }, HIT_STOP_DURATION.hit);
                            }
                        }

                        const dmg = extractDamage(detail);
                        const targetPs = action.actor === 'player' ? rightParticleSystemRef.current : leftParticleSystemRef.current;
                        const targetLayer = action.actor === 'player' ? rightLayerRef.current : leftLayerRef.current;
                        const targetLayerWidth = targetLayer?.clientWidth || 300;
                        const x = action.actor === 'player' ? targetLayerWidth * 0.3 : targetLayerWidth * 0.7;

                        // Damage number
                        // Always emit action-specific VFX
                        const actionParticleType: ParticleType =
                            action.type === 'magic' ? 'magic' :
                            action.type === 'crit' ? 'crit' :
                            action.type === 'hit' ? 'hit' :
                            action.type === 'counter' ? 'hit' : 'hit';

                        if (!lowPerf) {
                            if (action.type === 'crit') {
                                targetPs?.emit('hit_ring', x, 36, 1);
                                targetPs?.emit('dust', x, 50, 2);
                            } else if (action.type !== 'miss') {
                                targetPs?.emit('dust', x, 50, 1);
                            }
                        }

                        // Damage number (always, even alongside crit FX)
                        if (dmg !== null) {
                            targetPs?.emit('damage', x, 44, 1, dmg);
                        } else if (action.type === 'miss') {
                            targetPs?.emit('miss', x, 44, 1);
                        } else {
                            targetPs?.emit(actionParticleType, x, 44, 1);
                        }
                    }
                    roundIndex++;
                } else {
                    clearInterval(roundInterval);
                    setTimeout(() => {
                        setPhase('result');

                        // Victory particles
                        const leftPs = leftParticleSystemRef.current;
                        const rightPs = rightParticleSystemRef.current;
                        const winner = combatResult.winner;
                        if (winner === 'attacker' || winner === 'defender') {
                            const winningSide = winner === 'attacker' ? rightPs : leftPs;
                            const winningLayer = winner === 'attacker' ? rightLayerRef.current : leftLayerRef.current;
                            const w = winningLayer?.clientWidth || 300;
                            if (winningSide) {
                                winningSide.emit('xp_star', w * 0.3, 30, lowPerf ? 2 : 5);
                                winningSide.emit('spark', w * 0.5, 40, lowPerf ? 1 : 3);
                            }
                        }
                    }, 1200);
                }
            }, 520);

            return () => clearInterval(roundInterval);
        }
    }, [phase, combatResult, player.name, opponent.name, lowPerf]);

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
            if (hitStopTimerRef.current !== null) {
                window.clearTimeout(hitStopTimerRef.current);
            }
            if (flashTimerRef.current !== null) {
                window.clearTimeout(flashTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (phase !== 'combat') {
            setActionPulse(null);
            setHitStop(false);
            setScreenFlash('none');
            setIsKO(false);
            if (hitStopTimerRef.current !== null) {
                window.clearTimeout(hitStopTimerRef.current);
                hitStopTimerRef.current = null;
            }
            if (flashTimerRef.current !== null) {
                window.clearTimeout(flashTimerRef.current);
                flashTimerRef.current = null;
            }
        }
    }, [phase]);

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

    const handleAutoResolve = () => {
        if (phase !== 'combat') return;
        setPhase('result');
    };

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

    // Defeat detection
    const playerDefeated = phase === 'result' && !won && !draw;
    const opponentDefeated = phase === 'result' && won;
    const isLastRound = phase === 'result' ||
        (combatResult && currentRound >= combatResult.details.length - 1);
    const showPlayerDefeat = (phase === 'combat' && isLastRound && combatResult?.winner === 'defender') || playerDefeated;
    const showOpponentDefeat = (phase === 'combat' && isLastRound && combatResult?.winner === 'attacker') || opponentDefeated;

    return (
        <div className="combat-overlay" onClick={(e) => e.target === e.currentTarget && phase === 'result' && handleFinish()}>
            <div className="combat-modal">
                <div className="particle-layer left" ref={leftLayerRef} />
                <div className="particle-layer right" ref={rightLayerRef} />
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
                            {scanLocked && scanList.length > 1 && (
                                <div className="scan-lock">
                                    <span className="lock-pulse" aria-hidden="true"></span>
                                    LOCKED
                                </div>
                            )}
                        </div>
                    </div>
                ))}
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
                {phase === 'combat' && combatResult && (
                    <div
                        className={`combat-action${actionPulse ? ` action-${actionPulse.type}` : ''}${hitStop ? ' hit-stop' : ''}${isKO ? ' action-ko' : ''}`}
                        style={{ '--shake-dir': actionPulse?.actor === 'player' ? -1 : 1 } as React.CSSProperties}
                    >
                        {screenFlash !== 'none' && <div className={`screen-flash flash-${screenFlash}`} />}
                        <div className="combat-fighters">
                            <div key={`player-${currentRound}`} className={`fighter-side left${fighterEntrance ? ' enter-left' : ''}${actionPulse?.actor === 'player' ? ` action-${actionPulse.type}` : reactionType && actionPulse?.actor === 'opponent' ? ` react-${reactionType}` : ''}${showPlayerDefeat ? ' defeated' : ''}`}>
                                <div className="fighter-character-wrap">
                                    <PixelCharacter seed={player.seed} gender={player.gender} scale={6} />
                                    <div className="fighter-shadow" />
                                </div>
                                <div className="fighter-name-small">{player.name}</div>
                                <div className="fighter-health">
                                    <div className="health-bar"><div className={`health-bar-fill ${playerHpPercent <= 25 ? 'low' : ''}`} style={{ width: `${playerHpPercent}%` }}/></div>
                                    <div className="health-values">{playerHp} / {playerMaxHp}</div>
                                </div>
                            </div>
                            <div key={`opponent-${currentRound}`} className={`fighter-side right${fighterEntrance ? ' enter-right' : ''}${actionPulse?.actor === 'opponent' ? ` action-${actionPulse.type}` : reactionType && actionPulse?.actor === 'player' ? ` react-${reactionType}` : ''}${showOpponentDefeat ? ' defeated' : ''}`}>
                                <div className="fighter-character-wrap">
                                    {matchType === 'pve' && monsterId ? (
                                        <PixelMonster monsterId={monsterId} scale={5} />
                                    ) : (
                                        <PixelCharacter seed={opponent.seed} gender={opponent.gender} scale={6} />
                                    )}
                                    <div className="fighter-shadow" />
                                </div>
                                <div className="fighter-name-small">{opponent.name}</div>
                                <div className="fighter-health">
                                    <div className="health-bar"><div className={`health-bar-fill ${opponentHpPercent <= 25 ? 'low' : ''}`} style={{ width: `${opponentHpPercent}%` }}/></div>
                                    <div className="health-values">{opponentHp} / {opponentMaxHp}</div>
                                </div>
                            </div>
                        </div>
                        <div className="combat-progress-section">
                            <div className="round-counter">
                                <span className="round-label">ROUND</span>
                                <span className="round-value">{Math.min(currentRound + 1, combatResult.details.length)}/{combatResult.details.length}</span>
                            </div>
                            <div className="combat-progress-bar">
                                <div className="combat-progress-fill" style={{ width: `${Math.min(100, ((currentRound + 1) / combatResult.details.length) * 100)}%` }} />
                            </div>
                        </div>
                        <div className="combat-log" ref={logRef}>
                            {combatResult.details.slice(0, currentRound + 1).map((detail, idx) => (
                                <div key={idx} className={`log-entry ${idx === currentRound ? `active action-${extractActionColor(detail)}` : ''}`}>
                                    {detail}
                                </div>
                            ))}
                        </div>
                        {showAutoResolve && (
                            <div className="auto-resolve-banner">
                                <span className="auto-resolve-text">⚔️ Le combat s'éternise...</span>
                                <button className="auto-resolve-btn" onClick={handleAutoResolve}>
                                    Auto-resolve ⏩
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {phase === 'result' && combatResult && (
                    <div className={`combat-result${won ? ' victory' : draw ? ' draw' : ' defeat'}${!won ? ' combat-result-shake' : ''}`}>
                        {won && <><div className="result-badge victory">VICTORY!</div><div className="result-icon pixel victory"><PixelIcon type="trophy" size={80}/></div><div className="result-message"><div className="result-xp victory result-xp-popup">+{xpGained} XP</div><div className="result-sub">Victory over {opponent.name}</div></div></>}
                        {!won && !draw && <><div className="result-badge defeat">DEFEAT</div><div className="result-icon pixel defeat"><PixelIcon type="skull" size={72}/></div><div className="result-message"><div className="result-xp defeat result-xp-popup">+{xpGained} XP</div><div className="result-sub">Defeated by {opponent.name}</div></div></>}
                        {draw && <><div className="result-badge draw">DRAW</div><div className="result-icon pixel draw"><PixelIcon type="swords" size={72}/></div><div className="result-message"><div className="result-xp draw result-xp-popup">+{xpGained} XP</div><div className="result-sub">Stalemate vs {opponent.name}</div></div></>}
                        <button className="button primary-btn result-btn" onClick={handleFinish}>CONTINUE</button>
                    </div>
                )}
            </div>
        </div>
    );
};
