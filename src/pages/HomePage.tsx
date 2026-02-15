import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PixelIcon } from '../components/PixelIcon'
import { GameLogo } from '../components/GameLogo'
import { UPDATE_NOTES } from '../data/updateNotes'

const HomePage = () => {
  const [showUpdateNotes, setShowUpdateNotes] = useState(false)

  return (
    <div className="container retro-container home-page">
      <header className="game-header">
        <nav className="top-nav">
          <div className="nav-left">
            {/* Future Nav Items */}
          </div>
          <div className="nav-right">
            <Link to="/login" className="nav-btn">
              <PixelIcon type="user" size={16} />
              <span>LOGIN</span>
            </Link>
          </div>
        </nav>

        <div className="logo">
          <GameLogo />
        </div>
      </header>

      <main>
        <div className="hero-section">
          <h2 className="hero-title hero-text">Create Your Fighter</h2>
          <p className="hero-subtitle">Build the ultimate warrior and dominate the arena!</p>

          <div className="actions">
            <Link to="/create-character" className="button primary-btn">
              CREATE FIGHTER
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
        <div className="retro-modal-overlay home-notes-overlay" onClick={() => setShowUpdateNotes(false)}>
          <div className="retro-modal home-notes-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">PATCH NOTES</div>
            <div className="modal-body">
              <div className="home-notes-list">
                {UPDATE_NOTES.map((note) => (
                  <article key={`${note.version}-${note.date}`} className="home-note-entry">
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
              <button type="button" className="button primary-btn" onClick={() => setShowUpdateNotes(false)}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HomePage
