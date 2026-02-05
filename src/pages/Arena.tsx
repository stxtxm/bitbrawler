import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useConnectionGate } from '../hooks/useConnectionGate';
import ConnectionModal from '../components/ConnectionModal';
import { PixelCharacter } from '../components/PixelCharacter';
import { PixelIcon } from '../components/PixelIcon';
import { getXpProgress, formatXpDisplay, getMaxLevel } from '../utils/xpUtils';

const Arena = () => {
    const { activeCharacter, logout, useFight, lastXpGain, lastLevelUp, clearXpNotifications } = useGame();
    const { ensureConnection, openModal, closeModal, connectionModal } = useConnectionGate();
    const navigate = useNavigate();
    const connectionMessage = 'Connect to battle and sync your progress.';

    const [showXpGain, setShowXpGain] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [xpBarAnimating, setXpBarAnimating] = useState(false);

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
    const handleFight = async () => {
        const canProceed = await ensureConnection(connectionMessage);
        if (!canProceed) return;
        try {
            await useFight();
        } catch (error) {
            console.error('Fight failed:', error);
            openModal(connectionMessage);
        }
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
                    <button className="button icon-btn" onClick={() => navigate('/rankings')} title="Rankings">
                        <PixelIcon type="trophy" size={26} />
                    </button>
                    <button className="button icon-btn" onClick={() => { logout(); setTimeout(() => navigate('/'), 0); }} title="Logout">
                        <PixelIcon type="power" size={26} />
                    </button>
                </div>
            </header>


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
                                <span className="label-sub">{activeCharacter.fightsLeft || 0} / 5 AVAILABLE</span>
                            </div>
                        </div>
                        <div className="mini-pips">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className={`mini-pip ${i < (activeCharacter.fightsLeft || 0) ? 'active' : 'used'}`}></div>
                            ))}
                        </div>
                    </div>

                    <button
                        className="button primary-btn giant-btn"
                        disabled={(activeCharacter.fightsLeft || 0) <= 0}
                        onClick={handleFight}
                    >
                        {(activeCharacter.fightsLeft || 0) > 0 ? 'FIGHT!' : 'REST NOW'}
                    </button>
                </div>

            </div>
            <ConnectionModal
                open={connectionModal.open}
                message={connectionModal.message}
                onClose={closeModal}
            />
        </div>
    );
};

export default Arena;
