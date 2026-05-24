import { usePwaInstall } from '../hooks/usePwaInstall'
import { PixelIcon } from './PixelIcon'

const PwaInstallPrompt = () => {
  const { isInstallable, install, dismiss } = usePwaInstall()

  if (!isInstallable) return null

  return (
    <div className="pwa-install">
      <div className="retro-container pwa-install__panel">
        <div className="pwa-install__badge">
          <PixelIcon type="focus" size={12} /> NEW <PixelIcon type="focus" size={12} />
        </div>
        <h2 className="pwa-install__title">INSTALL BITBRAWLER</h2>
        <p className="pwa-install__text">
          Add BitBrawler to your home screen for the best 8-bit experience!
        </p>
        <div className="pwa-install__steps">
          <div className="pwa-install__step">
            <PixelIcon type="dice" size={10} /> 1. Tap <strong>Install</strong>
          </div>
          <div className="pwa-install__step">
            <PixelIcon type="sword" size={10} /> 2. Play offline anytime
          </div>
          <div className="pwa-install__step">
            <PixelIcon type="power" size={10} /> 3. Faster loading & fullscreen
          </div>
        </div>
        <button
          className="button pwa-install__button"
          onClick={install}
          type="button"
        >
          INSTALL
        </button>
        <button
          className="button secondary pwa-install__later"
          onClick={dismiss}
          type="button"
        >
          LATER
        </button>
      </div>
    </div>
  )
}

export default PwaInstallPrompt
