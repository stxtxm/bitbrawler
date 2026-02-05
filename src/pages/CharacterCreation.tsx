import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PixelCharacter } from '../components/PixelCharacter'
import { Character } from '../types/Character'
import { db } from '../config/firebase'
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore'
import { useGame } from '../context/GameContext'
import { useConnectionBlocker } from '../context/ConnectionBlockerContext'
import { generateInitialStats } from '../utils/characterUtils'

const CharacterCreation = () => {
  const navigate = useNavigate()
  const { setCharacter } = useGame()
  const { requireConnection } = useConnectionBlocker()
  const [name, setName] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [generatedCharacter, setGeneratedCharacter] = useState<Character | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nameError, setNameError] = useState('')
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const generateRandomCharacter = (currentGender: 'male' | 'female' = gender) => {
    setIsGenerating(true)
    const newCharacter = generateInitialStats(name, currentGender)
    setGeneratedCharacter(newCharacter)
    setIsGenerating(false)
  }

  // Handle gender change without full re-roll (only updates visual)
  const handleGenderChange = (newGender: 'male' | 'female') => {
    setGender(newGender);
    if (generatedCharacter) {
      setGeneratedCharacter({ ...generatedCharacter, gender: newGender });
    }
  }

  // Initialize on mount
  useEffect(() => {
    generateRandomCharacter();
  }, []);

  const handleCreateCharacter = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('NAME REQUIRED');
      setShowErrorModal(true);
      return;
    }

    if (!generatedCharacter) return;

    // Prevent double submit and reset any previous error modal
    if (isSubmitting) return;
    setIsSubmitting(true)
    setNameError(''); // Reset error
    setShowErrorModal(false);

    const canProceed = await requireConnection()
    if (!canProceed) {
      setIsSubmitting(false)
      return
    }

    try {
      // 1. Vérifier si le nom existe déjà dans Firestore
      const q = query(collection(db, "characters"), where("name", "==", trimmedName));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setNameError('NAME ALREADY TAKEN!');
        setShowErrorModal(true);
        setIsSubmitting(false)
        return;
      }

      // 2. Si le nom est libre, créer le personnage
      const finalCharacter = {
        ...generatedCharacter,
        name: trimmedName
      }

      const docRef = await addDoc(collection(db, "characters"), finalCharacter);
      console.log("Personnage sauvegardé sur le Cloud avec l'ID: ", docRef.id);

      // Connecter l'utilisateur immédiatement
      setCharacter({ ...finalCharacter, firestoreId: docRef.id });
      // Ensure error modal is closed and show success
      setShowErrorModal(false);
      setShowSuccessModal(true);
      setIsSubmitting(false)
      setTimeout(() => navigate('/arena'), 2000);
    } catch (error) {
      console.error('Erreur Critique:', error);
      alert("ERREUR CRITIQUE : Connexion au serveur impossible.");
    }
  }

  return (
    <div className="container retro-container character-creation-page">
      <header className="game-header">
        <h1 className="hero-text">NEW GAME</h1>
      </header>

      {showSuccessModal && (
        <div className="retro-modal-overlay">
          <div className="retro-modal success-modal">
            <div className="modal-header">SUCCESS!</div>
            <div className="modal-body">
              <p>WARRIOR CREATED</p>
              <h2 className="glitch-text">{name.trim().toUpperCase()}</h2>
              <p className="sub-text">PREPARING ARENA...</p>
            </div>
          </div>
        </div>
      )}

      {showErrorModal && (
        <div className="retro-modal-overlay">
          <div className="retro-modal error-modal">
            <div className="modal-header" style={{ color: '#ff3333' }}>ERROR</div>
            <div className="modal-body">
              <p>{nameError}</p>
              <button
                className="button retro-btn"
                onClick={() => setShowErrorModal(false)}
                style={{ marginTop: '20px' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="creation-content">
        <div className="left-panel">
          <div className="preview-section-compact">
            <div className="preview-box">
              {generatedCharacter && (
                <PixelCharacter
                  seed={generatedCharacter.seed}
                  gender={gender}
                  scale={window.innerWidth > 768 ? 25 : 12}
                />
              )}
            </div>

            {generatedCharacter && (
              <div className="stats-readout-compact">
                <div className="stat-grid">
                  <div className="stat-card" title="Strength">
                    <span className="stat-icon">💪</span>
                    <span className="stat-label">STR</span>
                    <span className="stat-value">{generatedCharacter.strength}</span>
                  </div>
                  <div className="stat-card" title="Vitality">
                    <span className="stat-icon">🛡️</span>
                    <span className="stat-label">VIT</span>
                    <span className="stat-value">{generatedCharacter.vitality}</span>
                  </div>
                  <div className="stat-card" title="Dexterity">
                    <span className="stat-icon">⚡</span>
                    <span className="stat-label">DEX</span>
                    <span className="stat-value">{generatedCharacter.dexterity}</span>
                  </div>
                  <div className="stat-card" title="Luck">
                    <span className="stat-icon">🍀</span>
                    <span className="stat-label">LUK</span>
                    <span className="stat-value">{generatedCharacter.luck}</span>
                  </div>
                  <div className="stat-card" title="Intelligence">
                    <span className="stat-icon">🔮</span>
                    <span className="stat-label">INT</span>
                    <span className="stat-value">{generatedCharacter.intelligence}</span>
                  </div>
                </div>
                <div className="hp-stat-card">
                  <span className="stat-icon">❤️</span>
                  <span className="stat-label">HP</span>
                  <span className="stat-value">{generatedCharacter.hp}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="right-panel">
          <div className="creation-form">
            <div className="form-group">
              <label htmlFor="name">NAME:</label>
              <input
                type="text"
                id="name"
                name="characterName"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={name}
                onChange={(e) => {
                  setName(e.target.value.toUpperCase());
                  setNameError('');
                  setShowErrorModal(false);
                }}
                placeholder="PLAYER 1"
                maxLength={12}
              />
            </div>

            <div className="form-group">
              <label>CLASS:</label>
              <div className="gender-selection">
                <button
                  className={`gender-btn ${gender === 'male' ? 'selected' : ''}`}
                  onClick={() => handleGenderChange('male')}
                >
                  MALE
                </button>
                <button
                  className={`gender-btn ${gender === 'female' ? 'selected' : ''}`}
                  onClick={() => handleGenderChange('female')}
                >
                  FEMALE
                </button>
              </div>
            </div>

            <div className="button-group">
              <button
                className="button retro-btn roll-btn"
                onClick={() => generateRandomCharacter()}
                disabled={isGenerating}
              >
                ROLL STATS
              </button>

              {generatedCharacter && (
                <button className="button retro-btn start-btn" onClick={handleCreateCharacter}>
                  START GAME
                </button>
              )}
            </div>
          </div>

          <div className="actions">
            <button className="button secondary back-btn" onClick={() => navigate('/')}>
              BACK
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

export default CharacterCreation
