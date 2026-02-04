import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

const Login = () => {
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const { login, loading } = useGame();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) return;

        const err = await login(name.trim().toUpperCase());
        if (err) {
            setError(err);
        } else {
            navigate('/arena');
        }
    };

    return (
        <div className="container retro-container login-container">
            <header className="game-header">
                <h1 className="hero-text">LOGIN</h1>
                <p className="subtitle">ENTER YOUR NAME, FIGHTER</p>
            </header>

            <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="CHARACTER NAME"
                        className="retro-input"
                        autoFocus
                    />
                </div>

                {error && <div className="error-message blink">{error}</div>}

                <div className="actions">
                    <button
                        type="submit"
                        className="button primary-btn"
                        disabled={loading || !name.trim()}
                    >
                        {loading ? 'CONNECTING...' : 'ENTER ARENA'}
                    </button>

                    <button
                        type="button"
                        className="button secondary"
                        onClick={() => navigate('/')}
                    >
                        BACK
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Login;
