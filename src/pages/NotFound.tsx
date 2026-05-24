import { Link } from 'react-router-dom'

const SadPixelCharacter = () => (
  <svg
    className="sad-pixel-character"
    width="80"
    height="80"
    viewBox="0 0 16 16"
    shapeRendering="crispEdges"
    aria-label="Sad pixel character"
  >
    {/* Head */}
    <rect x="4" y="2" width="8" height="8" fill="#f0c7a4" />
    {/* Hair */}
    <rect x="4" y="1" width="8" height="1" fill="#4a2c1a" />
    <rect x="3" y="2" width="1" height="2" fill="#4a2c1a" />
    <rect x="12" y="2" width="1" height="2" fill="#4a2c1a" />
    {/* Eyes - sad/droopy */}
    <rect x="5" y="5" width="1" height="2" fill="#000" />
    <rect x="10" y="5" width="1" height="2" fill="#000" />
    {/* Tear drops */}
    <rect x="5" y="7" width="1" height="1" fill="#66b3ff" />
    <rect x="10" y="7" width="1" height="1" fill="#66b3ff" />
    {/* Sad mouth */}
    <rect x="6" y="9" width="4" height="1" fill="#000" />
    <rect x="7" y="10" width="2" height="1" fill="#000" />
    {/* Body */}
    <rect x="5" y="10" width="6" height="4" fill="#ff3333" />
    {/* Arms */}
    <rect x="3" y="11" width="2" height="1" fill="#f0c7a4" />
    <rect x="11" y="11" width="2" height="1" fill="#f0c7a4" />
    {/* Legs */}
    <rect x="5" y="14" width="2" height="2" fill="#333" />
    <rect x="9" y="14" width="2" height="2" fill="#333" />
  </svg>
)

const NotFound = () => {
  return (
    <div className="container not-found-page">
      <div className="not-found-content">
        <h1 className="not-found-404">404</h1>

        <div className="not-found-character">
          <SadPixelCharacter />
        </div>

        <h2 className="not-found-title">PAGE NOT FOUND</h2>

        <p className="not-found-message">
          The page you&apos;re looking for doesn&apos;t exist...
        </p>

        <Link to="/" className="button primary-btn not-found-return">
          RETURN HOME
        </Link>
      </div>
    </div>
  )
}

export default NotFound
