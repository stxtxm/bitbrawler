import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { PixelCharacter } from '../components/PixelCharacter';
import { getXpProgress, formatXpDisplay, getMaxLevel } from '../utils/xpUtils';
import './Arena.css';

const Arena = () => {
    const { activeCharacter, logout, useFight, lastXpGain, lastLevelUp, clearXpNotifications } = useGame();
    const navigate = useNavigate();
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

    return (
        <div className="container retro-container arena-container">
            {/* Level Up Overlay */}
            {showLevelUp && lastLevelUp && (
                <div className="level-up-overlay">
                    <div className="level-up-content">
                        <div className="level-up-stars">★ ★ ★</div>
                        <h2 className="level-up-title">LEVEL UP!</h2>
                        <div className="level-up-number">LV. {lastLevelUp.newLevel}</div>
                        {lastLevelUp.levelsGained > 1 && (
                            <p className="multi-level">+{lastLevelUp.levelsGained} LEVELS!</p>
                        )}
                        <div className="level-up-stars">★ ★ ★</div>
                    </div>
                </div>
            )}

            <header className="arena-header">
                <div className="char-info">
                    <h2 className="hero-text" style={{ fontSize: '1.5rem', letterSpacing: '4px' }}>{activeCharacter.name}</h2>
                    <span className="level">LVL {activeCharacter.level}</span>
                </div>
                <button className="button small-btn logout-btn" onClick={() => { logout(); setTimeout(() => navigate('/'), 0); }}>
                    LOGOUT
                </button>
            </header>

            <div className="arena-content">
                <div className="character-display">
                    <div className="avatar-box">
                        <PixelCharacter seed={activeCharacter.seed} gender={activeCharacter.gender} scale={8} />
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
                        <div className="stat-row"><span>HP</span> <div className="bar-container"><div className="bar hp-bar" style={{ width: '100%' }}></div></div> {activeCharacter.hp}</div>
                        <div className="stat-row"><span>STR</span> {activeCharacter.strength}</div>
                        <div className="stat-row"><span>VIT</span> {activeCharacter.vitality}</div>
                        <div className="stat-row"><span>DEX</span> {activeCharacter.dexterity}</div>
                        <div className="stat-row"><span>LUK</span> {activeCharacter.luck}</div>
                    </div>
                </div>

                <div className="action-panel">
                    <div className="daily-status">
                        <h3>DAILY FIGHTS</h3>
                        <div className="fights-counter">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className={`fight-pip ${i < (activeCharacter.fightsLeft || 0) ? 'active' : 'used'}`}></div>
                            ))}
                        </div>
                        <p>{activeCharacter.fightsLeft || 0} REMAINING</p>
                    </div>

                    <button
                        className="button primary-btn giant-btn"
                        disabled={(activeCharacter.fightsLeft || 0) <= 0}
                        onClick={useFight}
                    >
                        {(activeCharacter.fightsLeft || 0) > 0 ? 'FIGHT!' : 'REST NOW'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Arena;
