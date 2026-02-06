import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useConnectionGate } from '../hooks/useConnectionGate';
import ConnectionModal from '../components/ConnectionModal';
import { prefetchArena } from '../routes/lazyPages';

const Login = () => {
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const { login, loading } = useGame();
    const { ensureConnection, openModal, closeModal, connectionModal } = useConnectionGate();
    const navigate = useNavigate();
    const connectionMessage = 'Please connect to continue.';
    const prefetchStarted = useRef(false);

    useEffect(() => {
        if (prefetchStarted.current) return;
        const runPrefetch = () => {
            if (prefetchStarted.current) return;
            prefetchStarted.current = true;
            prefetchArena();
        };

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            const id = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback?.(runPrefetch);
            return () => {
                if (id !== undefined) {
                    (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
                }
            };
        }

        const timer = window.setTimeout(runPrefetch, 250);
        return () => window.clearTimeout(timer);
    }, []);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) return;

        const canProceed = await ensureConnection(connectionMessage);
        if (!canProceed) return;

        const err = await login(name.trim().toUpperCase());
        if (err) {
            if (err.toLowerCase().includes('connection')) {
                openModal(connectionMessage);
            } else {
                setError(err);
            }
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
            <ConnectionModal
                open={connectionModal.open}
                message={connectionModal.message}
                onClose={closeModal}
            />
        </div>
    );
};

export default Login;
