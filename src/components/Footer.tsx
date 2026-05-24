import { version } from '../../package.json'

const GITHUB_URL = 'https://github.com/stxtxm/bitbrawler'
const CURRENT_YEAR = new Date().getFullYear()
const CREDITS_TEXT = 'Made with 🎮 by stxtxm'

const Footer = () => {
  return (
    <footer className="app-footer" role="contentinfo">
      <div className="footer-pixel-divider" aria-hidden="true"></div>
      <div className="footer-content">
        <span className="footer-item">
          &copy; {CURRENT_YEAR} Bitbrawler
        </span>
        <span className="footer-separator" aria-hidden="true">|</span>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link"
          aria-label="Bitbrawler GitHub repository"
        >
          GitHub
        </a>
        <span className="footer-separator" aria-hidden="true">|</span>
        <span className="footer-item">{CREDITS_TEXT}</span>
        <span className="footer-separator" aria-hidden="true">|</span>
        <span className="footer-item">v{version}</span>
      </div>
    </footer>
  )
}

export default Footer
