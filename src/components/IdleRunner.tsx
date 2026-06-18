import { IdleCombatState } from '../types/IdleCombat';
import { Character } from '../types/Character';
import { PixelCharacter } from './PixelCharacter';
import { PixelIcon } from './PixelIcon';
import { getXpProgress } from '../utils/xpUtils';

interface IdleRunnerProps {
    character: Character;
    idleState: IdleCombatState;
}

export function IdleRunner({ character, idleState }: IdleRunnerProps) {
    const xpProgress = getXpProgress(character);
    const hpPercent = character.maxHp > 0
        ? Math.round((character.hp / character.maxHp) * 100)
        : 100;

    return (
        <div className="idle-runner" role="region" aria-label="Idle PvE mode">
            <div className="idle-runner-header">
                <span className="idle-label">IDLE MODE</span>
                <span className="idle-fights-count">
                    <PixelIcon type="sword" size={12} />
                    {idleState.totalIdleFights}
                </span>
                <span className="idle-xp-total">
                    +{idleState.totalIdleXpGained} XP
                </span>
            </div>

            <div className="idle-scene">
                <div className="idle-scroll-bg" />
                <div className="idle-ground" />

                <div className="idle-character">
                    <PixelCharacter
                        seed={character.seed}
                        gender={character.gender}
                        scale={window.innerWidth < 600 ? 8 : 6}
                    />
                </div>

                {(idleState.currentMonsterName || idleState.currentResult) && (
                    <div className="idle-monster-container">
                        <div className="idle-monster-label">
                            {idleState.currentMonsterName ?? ''}
                        </div>
                        {idleState.currentResult && (
                            <div className={`idle-combat-result ${idleState.currentResult.won ? 'victory' : 'defeat'}`}>
                                <span className="idle-result-icon">
                                    {idleState.currentResult.won ? '🏆' : '💀'}
                                </span>
                                <span className="idle-result-xp">
                                    +{idleState.currentResult.xpGained} XP
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="idle-stats-bar">
                <div className="idle-stat-block">
                    <span className="idle-stat-label">HP</span>
                    <div className="idle-bar-track">
                        <div
                            className="idle-bar-fill hp-fill"
                            style={{ width: `${hpPercent}%` }}
                        />
                    </div>
                    <span className="idle-stat-value">{character.hp} / {character.maxHp}</span>
                </div>

                <div className="idle-stat-block">
                    <span className="idle-stat-label">XP</span>
                    <div className="idle-bar-track">
                        <div
                            className="idle-bar-fill xp-fill"
                            style={{ width: `${xpProgress.percentage}%` }}
                        />
                    </div>
                    <span className="idle-stat-value">
                        {xpProgress.currentXpInLevel} / {xpProgress.xpForNextLevel}
                    </span>
                </div>
            </div>

            <div className="idle-character-info">
                <span className="idle-char-name">{character.name}</span>
                <span className="idle-char-level">LVL {character.level}</span>
            </div>
        </div>
    );
}
