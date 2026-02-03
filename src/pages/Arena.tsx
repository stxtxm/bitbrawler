import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { PixelCharacter } from '../components/PixelCharacter';
import './Arena.css';

const Arena = () => {
    const { activeCharacter, logout, useFight } = useGame();
    const navigate = useNavigate();

    if (!activeCharacter) {
        // Redirection vers la home si pas de perso (ex: après un logout)
        setTimeout(() => navigate('/'), 100);
        return <div className="loading-screen">ACCESS DENIED</div>;
    }

    return (
        <div className="container retro-container arena-container">
            <header className="arena-header">
                <div className="char-info">
                    <h2>{activeCharacter.name}</h2>
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
