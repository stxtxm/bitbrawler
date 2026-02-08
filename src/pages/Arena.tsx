import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useConnectionGate } from '../hooks/useConnectionGate';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import ConnectionModal from '../components/ConnectionModal';
import { PixelCharacter } from '../components/PixelCharacter';
import { PixelIcon } from '../components/PixelIcon';
import { getXpProgress, formatXpDisplay, getMaxLevel } from '../utils/xpUtils';
import { StatKey } from '../utils/statUtils';
import { CombatView } from '../components/CombatView';
import { MatchmakingResult } from '../utils/matchmakingUtils';

const Arena = () => {
    const { activeCharacter, logout, useFight, findOpponent, lastXpGain, lastLevelUp, clearXpNotifications, firebaseAvailable, allocateStatPoint } = useGame();
    const { ensureConnection, openModal, closeModal, connectionModal } = useConnectionGate();
    const navigate = useNavigate();
    const isOnline = useOnlineStatus();
    const connectionMessage = 'Connect to battle and sync your progress.';

    const [showXpGain, setShowXpGain] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [xpBarAnimating, setXpBarAnimating] = useState(false);
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [matchmaking, setMatchmaking] = useState(false);
    const [combatData, setCombatData] = useState<MatchmakingResult | null>(null);
    const [allocatingStat, setAllocatingStat] = useState<StatKey | null>(null);
    const [deferLevelUp, setDeferLevelUp] = useState(false);

    // Handle XP gain notification
    useEffect(() => {
        if (lastXpGain !== null) {
            setShowXpGain(true);
            setXpBarAnimating(true);

            const timer = setTimeout(() => {
                setShowXpGain(false);
                setXpBarAnimating(false);
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [lastXpGain]);

    // Handle Level up notification
    useEffect(() => {
        if (lastLevelUp !== null) {
            setShowLevelUp(true);
            setDeferLevelUp(false);
        }
    }, [lastLevelUp]);

    if (!activeCharacter) {
        // Redirection vers la home si pas de perso (ex: après un logout)
        setTimeout(() => navigate('/'), 100);
        return <div className="loading-screen">ACCESS DENIED</div>;
    }

    const xpProgress = getXpProgress(activeCharacter);
    const isMaxLevel = activeCharacter.level >= getMaxLevel();
    const isOfflineMode = !isOnline || !firebaseAvailable;
    const fightsLeft = activeCharacter.fightsLeft || 0;
    const canFight = !isOfflineMode && fightsLeft > 0;
    const pendingStatPoints = activeCharacter.statPoints || 0;
    const canCloseLevelUp = pendingStatPoints === 0;
    const shouldShowLevelUp = showLevelUp || (pendingStatPoints > 0 && !deferLevelUp);
    const hasLevelInfo = lastLevelUp !== null;
    type StatIconType = 'strength' | 'vitality' | 'dexterity' | 'luck' | 'intelligence';
    const statOptions: Array<{ key: StatKey; label: string; value: number; hint: string; icon: StatIconType }> = [
        { key: 'strength', label: 'STR', value: activeCharacter.strength, hint: 'Damage', icon: 'strength' },
        { key: 'vitality', label: 'VIT', value: activeCharacter.vitality, hint: 'HP / Defense', icon: 'vitality' },
        { key: 'dexterity', label: 'DEX', value: activeCharacter.dexterity, hint: 'Accuracy / Speed', icon: 'dexterity' },
        { key: 'luck', label: 'LUK', value: activeCharacter.luck, hint: 'Crit Chance', icon: 'luck' },
        { key: 'intelligence', label: 'INT', value: activeCharacter.intelligence, hint: 'Magic Power', icon: 'intelligence' },
    ];

    const handleAllocateStat = async (stat: StatKey) => {
        if (allocatingStat || pendingStatPoints <= 0) return;

        if (isOfflineMode) {
            openModal(connectionMessage);
            return;
        }

        setAllocatingStat(stat);
        try {
            await allocateStatPoint(stat);
        } catch (error: any) {
            openModal(error.message || connectionMessage);
        } finally {
            setAllocatingStat(null);
        }
    };

    const handleCloseLevelUp = () => {
        if (!canCloseLevelUp) return;
        setShowLevelUp(false);
        clearXpNotifications();
    };

    const handleDeferLevelUp = () => {
        setShowLevelUp(false);
        setDeferLevelUp(true);
        clearXpNotifications();
    };

    const handleOpenLevelUp = () => {
        setShowLevelUp(true);
        setDeferLevelUp(false);
    };

    useEffect(() => {
        if (pendingStatPoints === 0) {
            setDeferLevelUp(false);
        }
    }, [pendingStatPoints]);

    const handleFight = async () => {
        const canProceed = await ensureConnection(connectionMessage);
        if (!canProceed) return;

        if (window.navigator.vibrate) window.navigator.vibrate(80);
        setMatchmaking(true);

        try {
            // Find an opponent
            const match = await findOpponent();

            if (!match) {
                openModal('No opponents found! Try again later.');
                setMatchmaking(false);
                return;
            }

            // Start combat with the matched opponent
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
            const opponentId = combatData?.opponent.firestoreId || '';
            await useFight(won, xpGained, opponentName, opponentId);
        } catch (error: any) {
            console.error('Fight result save failed:', error);
            openModal(error.message || connectionMessage);
        }
    };

    const handleCloseCombat = () => {
        setCombatData(null);
    };


    return (
        <div className="container retro-container arena-container">
            {/* Level Up Notification (Dopamine hit!) */}
            {shouldShowLevelUp && (
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
                                <div key={stat.key} className="level-up-stat-row">
                                    <span className="stat-icon">
                                        <PixelIcon type={stat.icon} size={12} />
                                    </span>
                                    <span className="stat-label">{stat.label}</span>
                                    <span className="stat-value">{stat.value}</span>
                                    <span className="stat-hint">{stat.hint}</span>
                                    <button
                                        className="button stat-add-btn"
                                        onClick={() => handleAllocateStat(stat.key as StatKey)}
                                        disabled={pendingStatPoints <= 0 || !!allocatingStat || isOfflineMode}
                                        aria-label={`Increase ${stat.label}`}
                                    >
                                        +
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="level-up-actions">
                            {pendingStatPoints > 0 && (
                                <button
                                    className="button secondary-btn level-up-later"
                                    onClick={handleDeferLevelUp}
                                >
                                    LATER
                                </button>
                            )}
                            <button
                                className="button primary-btn level-up-confirm"
                                disabled={!canCloseLevelUp}
                                onClick={handleCloseLevelUp}
                            >
                                APPLY
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header className="arena-header">
                <div className="char-info">
                    <h2 className="arena-char-name">{activeCharacter.name}</h2>
                    <div className="arena-lvl">
                        <span className="lvl-label">LVL</span>
                        <span className="lvl-chip">{activeCharacter.level}</span>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className="button icon-btn"
                        onClick={() => setHistoryOpen(true)}
                        title="Combat History"
                        aria-label="Combat History"
                    >
                        <PixelIcon type="history" size={26} />
                    </button>
                    <button
                        className="button icon-btn inventory-btn"
                        onClick={() => setInventoryOpen(true)}
                        title="Inventory"
                        aria-label="Inventory"
                    >
                        <PixelIcon type="backpack" size={26} />
                    </button>
                    <button className="button icon-btn" onClick={() => { logout(); setTimeout(() => navigate('/'), 0); }} title="Logout">
                        <PixelIcon type="power" size={26} />
                    </button>
                </div>
            </header>


            {isOfflineMode && (
                <div className="offline-banner" role="status" aria-live="polite">
                    <div className="offline-row">
                        <div className="offline-title">OFFLINE MODE</div>
                    </div>
                    <div className="offline-sub">Stats are the last synced snapshot. Connect to fight and sync.</div>
                </div>
            )}

            <div className="arena-content">
                <div className="character-display">
                    <div className="avatar-box">
                        <PixelCharacter seed={activeCharacter.seed} gender={activeCharacter.gender} scale={window.innerWidth < 600 ? 16 : 12} />
                    </div>

                    {/* XP Bar Section */}
                    <div className="xp-section">
                        <div className="xp-header">
                            <span className="xp-label">EXP</span>
                            <span className="xp-text">{formatXpDisplay(activeCharacter)}</span>
                        </div>
                        <div className="xp-bar-container">
                            <div
                                className={`xp-bar ${xpBarAnimating ? 'animating' : ''} ${isMaxLevel ? 'max-level' : ''}`}
                                style={{ width: `${xpProgress.percentage}%` }}
                            >
                                <div className="xp-bar-shine"></div>
                            </div>
                            {showXpGain && lastXpGain && (
                                <div className="xp-gain-popup">+{lastXpGain} XP</div>
                            )}
                        </div>
                        {isMaxLevel && <span className="max-level-badge">★ MAX LEVEL ★</span>}
                    </div>

                    <div className="stats-panel">
                        <div className="stat-row principal">
                            <span>HP</span>
                            <div className="bar-container">
                                <div className="bar hp-bar" style={{ width: '100%' }}></div>
                            </div>
                            <span className="stat-val">{activeCharacter.hp}</span>
                        </div>
                        <div className="stats-grid-compact">
                            {statOptions.map((stat) => (
                                <div key={stat.key} className="compact-stat">
                                    <span className="compact-stat-icon">
                                        <PixelIcon type={stat.icon} size={12} />
                                    </span>
                                    <span className="compact-stat-label">{stat.label}</span>
                                    <span className="compact-stat-value">{stat.value}</span>
                                </div>
                            ))}
                        </div>
                        {pendingStatPoints > 0 && (
                            <button
                                className="button secondary-btn stat-allocate-btn"
                                onClick={handleOpenLevelUp}
                            >
                                SPEND POINT
                            </button>
                        )}
                    </div>
                </div>

                <div className="action-panel">
                    <div className="daily-status-compact">
                        <div className="status-label">
                            <PixelIcon type="sword" size={32} />
                            <div className="label-text">
                                <span className="label-main">BATTLE ENERGY</span>
                                <span className="label-sub">
                                    {isOfflineMode ? 'OFFLINE SNAPSHOT' : `${fightsLeft} / 5 AVAILABLE`}
                                </span>
                            </div>
                        </div>
                        <div className="mini-pips">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className={`mini-pip ${i < fightsLeft ? 'active' : 'used'}`}></div>
                            ))}
                        </div>
                    </div>

                    <button
                        className="button primary-btn giant-btn"
                        disabled={!canFight || matchmaking}
                        onClick={handleFight}
                    >
                        {matchmaking ? 'SEARCHING...' : (isOfflineMode ? 'OFFLINE' : (fightsLeft > 0 ? 'FIGHT!' : 'REST NOW'))}
                    </button>
                </div>

            </div>
            <ConnectionModal
                open={connectionModal.open}
                message={connectionModal.message}
                onClose={closeModal}
            />
            {inventoryOpen && (
                <div className="retro-modal-overlay inventory-overlay" onClick={() => setInventoryOpen(false)}>
                    <div className="retro-modal inventory-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="inventory-header">
                            <h2 className="inventory-title">INVENTORY</h2>
                            <button className="inventory-close" onClick={() => setInventoryOpen(false)} aria-label="Close inventory">
                                ×
                            </button>
                        </div>
                        <div className="inventory-grid">
                            {Array.from({ length: 24 }).map((_, index) => (
                                <div key={index} className="inventory-slot" aria-hidden="true" />
                            ))}
                        </div>
                        <div className="inventory-footer">EMPTY SLOTS</div>
                    </div>
                </div>
            )}
            {historyOpen && (
                <div className="retro-modal-overlay" onClick={() => setHistoryOpen(false)}>
                    <div className="retro-modal history-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="inventory-header">
                            <h2 className="inventory-title">COMBAT LOGS</h2>
                            <button className="inventory-close" onClick={() => setHistoryOpen(false)} aria-label="Close history">
                                ×
                            </button>
                        </div>
                        <div className="history-list">
                            {!activeCharacter.fightHistory || activeCharacter.fightHistory.length === 0 ? (
                                <div className="no-history">NO BATTLES RECORDED YET</div>
                            ) : (
                                activeCharacter.fightHistory.map((fight, i) => (
                                    <div key={i} className={`history-item ${fight.won ? 'won' : 'lost'}`}>
                                        <div className="history-status">{fight.won ? 'WIN' : 'LOST'}</div>
                                        <div className="history-info">
                                            <div className="history-opponent">VS {fight.opponentName}</div>
                                            <div className="history-date">
                                                {new Date(fight.date).toLocaleDateString()} {new Date(fight.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <div className="history-xp">+{fight.xpGained} XP</div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="inventory-footer">LAST 20 ENCOUNTERS</div>
                    </div>
                </div>
            )}
            {combatData && activeCharacter && (
                <CombatView
                    player={activeCharacter}
                    opponent={combatData.opponent}
                    matchType={combatData.matchType}
                    onComplete={handleCombatComplete}
                    onClose={handleCloseCombat}
                />
            )}
        </div>
    );
};

export default Arena;
