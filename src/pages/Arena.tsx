import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useConnectionGate } from '../hooks/useConnectionGate';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import ConnectionModal from '../components/ConnectionModal';
import { PixelCharacter } from '../components/PixelCharacter';
import { PixelIcon } from '../components/PixelIcon';
import { getXpProgress, formatXpDisplay, getMaxLevel } from '../utils/xpUtils';
import { CombatView } from '../components/CombatView';
import { MatchmakingResult } from '../utils/matchmakingUtils';

const Arena = () => {
    const { activeCharacter, logout, useFight, findOpponent, lastXpGain, lastLevelUp, clearXpNotifications, firebaseAvailable } = useGame();
    const { ensureConnection, openModal, closeModal, connectionModal } = useConnectionGate();
    const navigate = useNavigate();
    const isOnline = useOnlineStatus();
    const connectionMessage = 'Connect to battle and sync your progress.';

    const [showXpGain, setShowXpGain] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [xpBarAnimating, setXpBarAnimating] = useState(false);
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [matchmaking, setMatchmaking] = useState(false);
    const [combatData, setCombatData] = useState<MatchmakingResult | null>(null);

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

            const timer = setTimeout(() => {
                setShowLevelUp(false);
                clearXpNotifications();
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [lastLevelUp, clearXpNotifications]);

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
            await useFight(won, xpGained);
        } catch (error) {
            console.error('Fight result save failed:', error);
            openModal(connectionMessage);
        }
    };

    const handleCloseCombat = () => {
        setCombatData(null);
    };


    return (
        <div className="container retro-container arena-container">
            {/* Level Up Notification (Dopamine hit!) */}
            {showLevelUp && lastLevelUp && (
                <div className="level-up-pop-overlay">
                    <div className="level-up-card">
                        <div className="card-shine"></div>
                        <div className="level-up-badge">NEW RANK!</div>
                        <div className="stars-top">★ ★ ★ ★ ★</div>
                        <h2 className="lvl-title">LEVEL UP</h2>
                        <div className="lvl-big-number">
                            <span className="lvl-old">{lastLevelUp.newLevel - lastLevelUp.levelsGained}</span>
                            <span className="lvl-arrow">➜</span>
                            <span className="lvl-new">{lastLevelUp.newLevel}</span>
                        </div>
                        <div className="stars-bottom">★ ★ ★ ★ ★</div>
                        <div className="level-up-footer">STRENGTH INCREASED!</div>
                    </div>
                </div>
            )}

            <header className="arena-header">
                <div className="char-info">
                    <h2 className="arena-char-name">{activeCharacter.name}</h2>
                    <div className="arena-lvl-badge">LVL {activeCharacter.level}</div>
                </div>
                <div className="header-actions">
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
                            <div className="compact-stat"><span>STR</span> <span>{activeCharacter.strength}</span></div>
                            <div className="compact-stat"><span>VIT</span> <span>{activeCharacter.vitality}</span></div>
                            <div className="compact-stat"><span>DEX</span> <span>{activeCharacter.dexterity}</span></div>
                            <div className="compact-stat"><span>LUK</span> <span>{activeCharacter.luck}</span></div>
                        </div>
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
