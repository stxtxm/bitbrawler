import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../config/supabase'
import { Character } from '../types/Character'
import { PixelCharacter } from '../components/PixelCharacter'
import { useGame } from '../context/GameContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { convertFromSupabase } from '../utils/supabaseUtils'

const Rankings = () => {
    const navigate = useNavigate()
    const { dbAvailable, retryConnection } = useGame()
    const [characters, setCharacters] = useState<Character[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const isOnline = useOnlineStatus()

    const fetchCharacters = useCallback(async () => {
        setLoading(true)
        setLoadError(null)

        try {
            const { data, error } = await supabase
                .from('characters')
                .select('*')
                .order('level', { ascending: false })
                .order('name', { ascending: true });

            if (error) throw error;

            const fetchedChars: Character[] = data.map(convertFromSupabase);

            setCharacters(fetchedChars)
        } catch (error) {
            console.error("Error fetching characters:", error)
            setLoadError('Unable to load rankings. Please retry when you are online.')
            setCharacters([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!isOnline || !dbAvailable) {
            setCharacters([])
            setLoading(false)
            return
        }

        fetchCharacters()
    }, [fetchCharacters, dbAvailable, isOnline])

    return (
        <div className="container retro-container rankings-page">
            <header className="game-header">
                <h1 className="hero-text">HALL OF FAME</h1>
                <p className="subtitle">LEGENDARY FIGHTERS</p>
            </header>

            <main id="main-content" className="rankings-content">
                {!isOnline || !dbAvailable ? (
                    <div className="empty-state">
                        <p>CONNECTION REQUIRED</p>
                        <p className="sub-text">Connect to load the Hall of Fame.</p>
                        <button
                            className="button retro-btn"
                            onClick={async () => {
                                if (!isOnline) return
                                const ok = await retryConnection()
                                if (ok) fetchCharacters()
                            }}
                        >
                            RETRY CONNECTION
                        </button>
                    </div>
                ) : loading ? (
                    <div className="loading-state">
                        <p className="blink">LOADING DATA...</p>
                    </div>
                ) : loadError ? (
                    <div className="empty-state">
                        <p>CONNECTION REQUIRED</p>
                        <p className="sub-text">{loadError}</p>
                        <button
                            className="button retro-btn"
                            onClick={async () => {
                                if (!isOnline) return
                                const ok = await retryConnection()
                                if (ok) fetchCharacters()
                            }}
                        >
                            RETRY CONNECTION
                        </button>
                    </div>
                ) : characters.length === 0 ? (
                    <div className="empty-state">
                        <p>NO FIGHTERS REGISTERED YET</p>
                        <button className="button retro-btn" onClick={() => navigate('/create-character')}>
                            BE THE FIRST
                        </button>
                    </div>
                ) : (
                    <div className="rankings-grid">
                        <div className="rankings-header">
                            <div className="col-rank">#</div>
                            <div className="col-avatar">AVATAR</div>
                            <div className="col-name">NAME</div>
                            <div className="col-lvl">LVL</div>
                        </div>

                        <div className="rankings-list">
                            {characters.map((char, index) => (
                                <div
                                    key={index}
                                    className={`ranking-row${index < 3 ? ` rank-${index + 1}` : ''}`}
                                >
                                    <div className={`col-rank rank-${index + 1}`}>{index + 1}</div>
                                    <div className="col-avatar">
                                        <div className="mini-avatar">
                                            <PixelCharacter seed={char.seed} gender={char.gender} scale={3} />
                                        </div>
                                    </div>
                                    <div className="col-name">
                                        <span className="char-name">{char.name}</span>
                                        <span className="char-class">{char.gender === 'male' ? 'WARRIOR' : 'VALKYRIE'}</span>
                                    </div>
                                    <div className="col-lvl">
                                        <span className="lvl-badge">{char.level}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <div className="actions">
                <button className="button secondary" onClick={() => navigate('/')}>
                    BACK TO MENU
                </button>
            </div>
        </div>
    )
}

export default Rankings
