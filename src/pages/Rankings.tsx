import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, query, doc, deleteDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { Character } from '../types/Character'
import { PixelCharacter } from '../components/PixelCharacter'
import { useGame } from '../context/GameContext'

const Rankings = () => {
    const navigate = useNavigate()
    const { setCharacter } = useGame()
    const [characters, setCharacters] = useState<Character[]>([])
    const [loading, setLoading] = useState(true)
    const [showResetModal, setShowResetModal] = useState(false)
    const [resetStatus, setResetStatus] = useState<'confirm' | 'success' | 'error' | null>(null)

    const handleCharacterSelect = (character: Character) => {
        setCharacter(character)
        navigate('/arena')
    }

    useEffect(() => {
        const fetchCharacters = async () => {
            try {
                const charactersCollection = collection(db, 'characters')
                // On essaie de trier, mais si ça fail (manque d'index), on fallback sans tri
                // Pour l'instant on récupère tout simplement
                const q = query(charactersCollection)
                const querySnapshot = await getDocs(q)

                const fetchedChars: Character[] = []
                querySnapshot.forEach((doc) => {
                    // On ignore les documents malformés ou vides si besoin
                    const data = doc.data() as Character
                    fetchedChars.push({
                        ...data,
                        firestoreId: doc.id // Critical for persistence
                    })
                })

                // Tri local par niveau (décroissant) puis nom
                fetchedChars.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name))

                setCharacters(fetchedChars)
            } catch (error) {
                console.error("Error fetching characters:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchCharacters()
    }, [])

    // ALPHA TOOL: Reset Function
    const handleAlphaResetClick = () => {
        setResetStatus('confirm');
        setShowResetModal(true);
    }

    const confirmReset = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'characters'));
            const deletePromises = querySnapshot.docs.map(d => deleteDoc(doc(db, 'characters', d.id)));
            await Promise.all(deletePromises);

            setCharacters([]);
            setResetStatus('success');
            setTimeout(() => {
                setShowResetModal(false);
                setResetStatus(null);
            }, 2000);
        } catch (error) {
            console.error("Error clearing database:", error);
            setResetStatus('error');
            setTimeout(() => {
                setShowResetModal(false);
                setResetStatus(null);
            }, 2000);
        } finally {
            setLoading(false);
        }
    }

    const cancelReset = () => {
        setShowResetModal(false);
        setResetStatus(null);
    }

    return (
        <div className="container retro-container rankings-page">
            <header className="game-header">
                <h1 className="hero-text">HALL OF FAME</h1>
                <p className="subtitle">LEGENDARY FIGHTERS</p>
            </header>

            <div className="rankings-content">
                {loading ? (
                    <div className="loading-state">
                        <p className="blink">LOADING DATA...</p>
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
                            <div className="col-stats">STATS</div>
                        </div>

                        <div className="rankings-list">
                            {characters.map((char, index) => (
                                <div
                                    key={index}
                                    className="ranking-row"
                                    onClick={() => handleCharacterSelect(char)}
                                    title="Click to play with this character"
                                >
                                    <div className="col-rank">{index + 1}</div>
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
                                    <div className="col-stats">
                                        <div className="mini-stat"><span>STR</span>{char.strength}</div>
                                        <div className="mini-stat"><span>VIT</span>{char.vitality}</div>
                                        <div className="mini-stat"><span>DEX</span>{char.dexterity}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="actions">
                <button className="button secondary" onClick={() => navigate('/')}>
                    BACK TO MENU
                </button>
                <button
                    className="button alpha-reset-btn"
                    onClick={handleAlphaResetClick}
                >
                    [ALPHA] RESET DB
                </button>
            </div>

            {showResetModal && (
                <div className="retro-modal-overlay">
                    <div className="retro-modal" style={{ borderColor: resetStatus === 'error' ? '#ff3333' : '#fff' }}>
                        {resetStatus === 'confirm' && (
                            <>
                                <div className="modal-header" style={{ color: '#ff3333', textShadow: '2px 2px 0 #990000' }}>WARNING</div>
                                <div className="modal-body">
                                    <p>YOU ARE ABOUT TO DELETE ALL DATA.</p>
                                    <h2 style={{ color: '#ff3333', textShadow: 'none' }}>CONFIRM RESET?</h2>
                                    <p className="sub-text">THIS CANNOT BE UNDONE.</p>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px' }}>
                                        <button className="button" style={{ borderColor: '#ff3333', color: '#ff3333' }} onClick={confirmReset}>DELETE ALL</button>
                                        <button className="button secondary" onClick={cancelReset}>CANCEL</button>
                                    </div>
                                </div>
                            </>
                        )}
                        {resetStatus === 'success' && (
                            <>
                                <div className="modal-header">SUCCESS</div>
                                <div className="modal-body">
                                    <p>DATABASE CLEARED</p>
                                    <h2 className="glitch-text">SYSTEM PURGED</h2>
                                </div>
                            </>
                        )}
                        {resetStatus === 'error' && (
                            <>
                                <div className="modal-header" style={{ color: '#ff3333' }}>ERROR</div>
                                <div className="modal-body">
                                    <p>OPERATION FAILED</p>
                                    <p className="sub-text">CHECK PERMISSIONS</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default Rankings
