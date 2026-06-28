import { useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PixelIcon } from '../components/PixelIcon'
import { GameLogo } from '../components/GameLogo'
import { useGame } from '../context/GameContext'
import { getUnlockedCount, getTotalMedalCount } from '../utils/medalUtils'
import { UPDATE_NOTES } from '../data/updateNotes'

const HomePage = () => {
  const [showUpdateNotes, setShowUpdateNotes] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const notesListRef = useRef<HTMLDivElement>(null)
  const { activeCharacter } = useGame()
  const medalProgress = activeCharacter?.medalProgress
  const unlockedCount = useMemo(() => getUnlockedCount(medalProgress ?? {}), [medalProgress])
  const totalCount = useMemo(() => getTotalMedalCount(), [])

  const visibleNotes = showArchived
    ? UPDATE_NOTES
    : UPDATE_NOTES.filter(n => !n.archived)

  const hasArchived = UPDATE_NOTES.some(n => n.archived)

  const handleToggleArchived = () => {
    setShowArchived(prev => !prev)
    // Scroll to top when toggling SHOW ALL / SHOW LESS
    // to prevent the browser from jumping to a weird scroll position
    // after the list expands or collapses (especially on mobile).
    requestAnimationFrame(() => {
      notesListRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  return (
    <div className="container retro-container home-page">
      <header className="game-header">
        <nav className="top-nav">

          <div className="nav-right">
            <Link to="/login" className="nav-btn" data-click-sound="nav">
              <PixelIcon type="user" size={16} />
              <span>LOGIN</span>
            </Link>
          </div>
        </nav>

        <div className="logo">
          <GameLogo />
        </div>
      </header>

      <main id="main-content">
        <div className="hero-section">
          <h2 className="hero-title hero-text">Create Your Fighter</h2>
          <p className="hero-subtitle">Build the ultimate warrior and dominate the arena!</p>

          <div className="actions">
            <Link to="/create-character" className="button primary-btn">
              CREATE FIGHTER
            </Link>
            <Link to="/medal-hall" className="button secondary medal-hall-btn">
              <PixelIcon type="trophy" size={14} />
              <span>MEDAL HALL</span>
              {unlockedCount > 0 && (
                <span className="medal-badge">{unlockedCount}</span>
              )}
            </Link>
            <Link to="/rankings" className="button secondary">
              HALL OF FAME
            </Link>
            <button
              type="button"
              className="button secondary update-notes-btn"
              onClick={() => setShowUpdateNotes(true)}
            >
              PATCH NOTES
            </button>
          </div>
        </div>

        <div className="features">
          <div className="feature-card">
            <div className="feature-icon"><PixelIcon type="fighters" size={48} /></div>
            <div className="feature-card-content">
              <h3>FIGHTERS</h3>
              <p>Design unique fighters with randomized stats and appearances</p>
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><PixelIcon type="arena" size={48} /></div>
            <div className="feature-card-content">
              <h3>ARENA</h3>
              <p>Fight against other players in intense combat matches</p>
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><PixelIcon type="levels" size={48} /></div>
            <div className="feature-card-content">
              <h3>LEVELS</h3>
              <p>Level up your fighter and unlock new abilities</p>
            </div>
          </div>
          <div className="feature-card highlight-card medal-feature-card" data-click-sound="nav">
            <Link to="/medal-hall" className="feature-card-link">
              <div className="feature-icon"><PixelIcon type="trophy" size={48} /></div>
              <div className="feature-card-content">
                <h3>MEDALS</h3>
                <p>Track achievements and earn permanent rewards</p>
                {unlockedCount > 0 && (
                  <span className="medal-count-text">🏅 {unlockedCount}/{totalCount}</span>
                )}
              </div>
            </Link>
          </div>
          <div className="feature-card highlight-card">
            <div className="feature-icon"><PixelIcon type="updates" size={48} /></div>
            <div className="feature-card-content">
              <h3>UPDATES</h3>
              <p>Regular updates with new features and content</p>
            </div>
          </div>
        </div>
      </main>

      {showUpdateNotes && (
        <div className="retro-modal-overlay home-notes-overlay" onClick={() => setShowUpdateNotes(false)} role="dialog" aria-modal="true" aria-label="Patch notes">
          <div className="retro-modal home-notes-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">PATCH NOTES</div>
            <div className="modal-body">
              <div className="home-notes-list" ref={notesListRef}>
                {visibleNotes.map((note) => (
                  <article key={`${note.version}-${note.date}`} className={`home-note-entry${note.archived ? ' archived' : ''}`}>
                    <h3>{note.version} · {note.date}</h3>
                    <p className="home-note-title">{note.title}</p>
                    <ul>
                      {note.changes.map((change) => (
                        <li key={change}>{change}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
              <div className="home-notes-actions">
                {hasArchived && (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={handleToggleArchived}
                  >
                    {showArchived ? 'SHOW LESS' : 'SHOW ALL'}
                  </button>
                )}
                <button type="button" className="button primary-btn" onClick={() => setShowUpdateNotes(false)}>
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HomePage
