import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PixelCharacter } from '../components/PixelCharacter'
import { Character } from '../types/Character'
import { supabase } from '../config/supabase'
import { useGame } from '../context/GameContext'
import { useConnectionGate } from '../hooks/useConnectionGate'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useSound } from '../hooks/useSound'
import ConnectionModal from '../components/ConnectionModal'
import { generateInitialStats, generateCharacterName } from '../utils/characterUtils'
import { PixelIcon } from '../components/PixelIcon'
import { prefetchArena } from '../routes/lazyPages'
import { STAT_TOOLTIPS } from '../utils/statUtils'
import { convertToSupabase } from '../utils/supabaseUtils'

const CharacterCreation = () => {
  const navigate = useNavigate()
  const { setCharacter } = useGame()
  const { ensureConnection, openModal, closeModal, connectionModal } = useConnectionGate()
  const { play } = useSound()
  const [name, setName] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [generatedCharacter, setGeneratedCharacter] = useState<Character | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nameError, setNameError] = useState('')
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const connectionMessage = 'Connect to create and sync your fighter.'
  const prefetchStarted = useRef(false)

  const successModalRef = useFocusTrap<HTMLDivElement>(showSuccessModal, undefined);
  const errorModalRef = useFocusTrap<HTMLDivElement>(showErrorModal, () => setShowErrorModal(false));

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

  useEffect(() => {
    if (prefetchStarted.current) return
    const runPrefetch = () => {
      if (prefetchStarted.current) return
      prefetchStarted.current = true
      prefetchArena()
    }

    const win = globalThis as typeof globalThis & {
      requestIdleCallback?: (cb: () => void) => number
      cancelIdleCallback?: (id: number) => void
    }

    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(runPrefetch)
      return () => {
        if (id !== undefined) {
          win.cancelIdleCallback?.(id)
        }
      }
    }

    const timer = setTimeout(runPrefetch, 250)
    return () => clearTimeout(timer)
  }, [])


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

    const canProceed = await ensureConnection(connectionMessage)
    if (!canProceed) {
      setIsSubmitting(false)
      return
    }

      try {
        const { data: existing } = await supabase
          .from('characters')
          .select('id')
          .eq('name', trimmedName)
          .limit(1);

        if (existing && existing.length > 0) {
          setNameError('NAME ALREADY TAKEN!');
          setShowErrorModal(true);
          setIsSubmitting(false)
          return;
        }

        const finalCharacter = {
          ...generatedCharacter,
          name: trimmedName
        }

        const { data: newChar, error: insertError } = await supabase
          .from('characters')
          .insert([convertToSupabase(finalCharacter)])
          .select()
          .single();

        if (insertError) throw insertError;

        setCharacter({ ...finalCharacter, id: newChar.id });
      setShowErrorModal(false);
      setShowSuccessModal(true);
      play('create');
      setIsSubmitting(false)
      setTimeout(() => navigate('/arena'), 2000);
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string; details?: string };
      const errMsg = err.message || String(error);

      if (errMsg.includes('violates check constraint') || errMsg.includes('violates row-level')) {
        setNameError('DATABASE ERROR - Try again later');
        setShowErrorModal(true);
      } else {
        openModal(connectionMessage);
      }
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container retro-container character-creation-page">
      <header className="game-header">
        <h1 className="hero-text">NEW GAME</h1>
      </header>

      {showSuccessModal && (
        <div className="retro-modal-overlay" role="dialog" aria-modal="true" aria-label="Character created successfully" ref={successModalRef}>
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
        <div className="retro-modal-overlay" role="dialog" aria-modal="true" aria-label="Error" ref={errorModalRef}>
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

      <main id="main-content">
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
                  <div className="stat-card" title={'STR: ' + STAT_TOOLTIPS['strength']}>
                    <span className="stat-icon"><PixelIcon type="strength" size={16} /></span>
                    <span className="stat-label">STR</span>
                    <span className="stat-value">{generatedCharacter.strength}</span>
                  </div>
                  <div className="stat-card" title={'VIT: ' + STAT_TOOLTIPS['vitality']}>
                    <span className="stat-icon"><PixelIcon type="vitality" size={16} /></span>
                    <span className="stat-label">VIT</span>
                    <span className="stat-value">{generatedCharacter.vitality}</span>
                  </div>
                  <div className="stat-card" title={'DEX: ' + STAT_TOOLTIPS['dexterity']}>
                    <span className="stat-icon"><PixelIcon type="dexterity" size={16} /></span>
                    <span className="stat-label">DEX</span>
                    <span className="stat-value">{generatedCharacter.dexterity}</span>
                  </div>
                  <div className="stat-card" title={'LUK: ' + STAT_TOOLTIPS['luck']}>
                    <span className="stat-icon"><PixelIcon type="luck" size={16} /></span>
                    <span className="stat-label">LUK</span>
                    <span className="stat-value">{generatedCharacter.luck}</span>
                  </div>
                  <div className="stat-card" title={'INT: ' + STAT_TOOLTIPS['intelligence']}>
                    <span className="stat-icon"><PixelIcon type="intelligence" size={16} /></span>
                    <span className="stat-label">INT</span>
                    <span className="stat-value">{generatedCharacter.intelligence}</span>
                  </div>
                  <div className="stat-card" title={'FOC: ' + STAT_TOOLTIPS['focus']}>
                    <span className="stat-icon"><PixelIcon type="focus" size={16} /></span>
                    <span className="stat-label">FOC</span>
                    <span className="stat-value">{generatedCharacter.focus}</span>
                  </div>
                </div>
                <div className="hp-stat-card">
                  <span className="stat-icon"><PixelIcon type="vitality" size={16} /></span>
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
              <div className="name-input-wrapper" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
                  maxLength={10}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="button icon-btn name-gen-btn"
                  onClick={() => {
                    if (window.navigator.vibrate) window.navigator.vibrate(50);
                    const newName = generateCharacterName();
                    setName(newName.toUpperCase());
                    setNameError('');
                  }}
                  title="Generate Random Name"
                  aria-label="Generate Random Name"
                  style={{ padding: '8px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <PixelIcon type="dice" size={20} />
                </button>
              </div>
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
                <button
                  className="button retro-btn start-btn"
                  onClick={handleCreateCharacter}
                  disabled={isSubmitting}
                >
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
      </main>
      <ConnectionModal
        open={connectionModal.open}
        message={connectionModal.message}
        onClose={closeModal}
      />

    </div>
  )
}

export default CharacterCreation
