import { Link } from 'react-router-dom'
import { PixelIcon } from '../components/PixelIcon'
import { GameLogo } from '../components/GameLogo'
import './HomePage.css'

const HomePage = () => {
  return (
    <div className="container">
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
          </div>
        </div>

        <div className="features">
          <div className="feature-card">
            <div className="feature-icon"><PixelIcon type="fighters" size={48} /></div>
            <h3>FIGHTERS</h3>
            <p>Design unique fighters with randomized stats and appearances</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><PixelIcon type="arena" size={48} /></div>
            <h3>ARENA</h3>
            <p>Fight against other players in intense combat matches</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><PixelIcon type="levels" size={48} /></div>
            <h3>LEVELS</h3>
            <p>Level up your fighter and unlock new abilities</p>
          </div>
          <div className="feature-card highlight-card">
            <div className="feature-icon"><PixelIcon type="updates" size={48} /></div>
            <h3>UPDATES</h3>
            <p>Regular updates with new features and content</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default HomePage

