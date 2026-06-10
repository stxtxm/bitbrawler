import { useEffect } from 'react';
import { Character } from '../types/Character';
import { PixelIcon } from './PixelIcon';
import { StatKey, STAT_TOOLTIPS } from '../utils/statUtils';

type StatIconType = 'strength' | 'vitality' | 'dexterity' | 'luck' | 'intelligence' | 'focus';

interface LevelUpOverlayProps {
    shouldShowLevelUp: boolean;
    activeCharacter: Character;
    lastLevelUp: { levelsGained: number; newLevel: number; hpGained: number } | null;
    pendingStatPoints: number;
    isOfflineMode: boolean;
    statOptions: Array<{ key: StatKey; label: string; value: number; hint: string; icon: StatIconType }>;
    hasLevelInfo: boolean;
    autoClose?: boolean;
    handleAllocateStat: (stat: StatKey) => void;
    handleCloseLevelUp: () => void;
    handleDeferLevelUp: () => void;
}

const LevelUpOverlay = ({
    shouldShowLevelUp,
    activeCharacter,
    lastLevelUp,
    pendingStatPoints,
    isOfflineMode,
    statOptions,
    hasLevelInfo,
    autoClose = false,
    handleAllocateStat,
    handleCloseLevelUp,
    handleDeferLevelUp,
}: LevelUpOverlayProps) => {
    useEffect(() => {
        if (!autoClose || !shouldShowLevelUp) return;

        const timer = setTimeout(() => {
            handleCloseLevelUp();
        }, 1500);

        return () => clearTimeout(timer);
    }, [autoClose, shouldShowLevelUp, handleCloseLevelUp]);

    if (!shouldShowLevelUp) return null;

    return (
        <div className="level-up-pop-overlay">
            <div className="level-up-card">
                <div className="card-shine"></div>
                <div className="level-up-badge">NEW RANK!</div>
                <div className="stars-top">★ ★ ★ ★ ★</div>
                <h2 className="lvl-title">LEVEL UP</h2>
                {hasLevelInfo ? (
                    <div className="lvl-big-number">
                        <span className="lvl-old">{lastLevelUp!.newLevel - lastLevelUp!.levelsGained}</span>
                        <span className="lvl-arrow">➜</span>
                        <span className="lvl-new">{lastLevelUp!.newLevel}</span>
                    </div>
                ) : (
                    <div className="lvl-big-number">
                        <span className="lvl-new">LVL {activeCharacter.level}</span>
                    </div>
                )}
                {hasLevelInfo && lastLevelUp!.hpGained > 0 && (
                    <div className="level-up-hp">
                        <span className="hp-icon">❤</span>
                        <span className="hp-gained">+{lastLevelUp!.hpGained} HP</span>
                        <span className="hp-range">
                            (max HP: {activeCharacter.maxHp - lastLevelUp!.hpGained} → {activeCharacter.maxHp})
                        </span>
                    </div>
                )}
                <div className="stars-bottom">★ ★ ★ ★ ★</div>
                <div className="level-up-points">
                    <div className="points-label">
                        {pendingStatPoints > 1 ? 'POINTS TO SPEND' : 'CHOOSE A STAT'}
                    </div>
                    {pendingStatPoints > 1 && (
                        <div className="points-value">{pendingStatPoints}</div>
                    )}
                    {isOfflineMode && (
                        <div className="points-warning">CONNECT TO ASSIGN POINTS</div>
                    )}
                </div>
                <div className="level-up-stats">
                    {statOptions.map((stat) => (
                        <div key={stat.key} className="level-up-stat-row" title={`${stat.label}: ${STAT_TOOLTIPS[stat.key]}`}>
                            <span className="stat-icon">
                                <PixelIcon type={stat.icon} size={12} />
                            </span>
                            <span className="stat-label">{stat.label}</span>
                            <span className="stat-value">{stat.value}</span>
                            <span className="stat-hint">{stat.hint}</span>
                            <button
                                className="button stat-add-btn"
                                onClick={() => handleAllocateStat(stat.key)}
                                disabled={pendingStatPoints <= 0 || isOfflineMode}
                                aria-label={`Increase ${stat.label}`}
                            >
                                +
                            </button>
                        </div>
                    ))}
                </div>
                <div className="level-up-actions">
                    <button
                        className="button secondary-btn level-up-later"
                        onClick={handleDeferLevelUp}
                    >
                        LATER
                    </button>
                    <button
                        className="button primary-btn level-up-confirm"
                        onClick={handleCloseLevelUp}
                    >
                        APPLY
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LevelUpOverlay;
