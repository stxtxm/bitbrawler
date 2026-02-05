import { useEffect, useState } from 'react'
import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt'

const DISMISS_KEY = 'bitbrawler_pwa_install_dismissed'

const PwaInstallScreen = () => {
  const { canPrompt, promptInstall, isStandalone, isIos } = usePwaInstallPrompt()
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem(DISMISS_KEY) === '1'
  })
  const [isInstalling, setIsInstalling] = useState(false)

  useEffect(() => {
    if (isStandalone) {
      setDismissed(true)
    }
  }, [isStandalone])

  if (isStandalone || dismissed) return null
  if (!canPrompt && !isIos) return null

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  const handleInstall = async () => {
    if (!canPrompt || isInstalling) return
    setIsInstalling(true)
    const result = await promptInstall()
    setIsInstalling(false)
    if (result.outcome === 'accepted') {
      setDismissed(true)
    }
  }

  return (
    <div className="pwa-install">
      <div className="pwa-install__panel retro-container">
        <p className="pwa-install__badge">PWA INSTALL</p>
        <h2 className="pwa-install__title">Install BitBrawler</h2>
        <p className="pwa-install__text">
          Get a native-like experience, faster loading, and offline access to the home screen.
        </p>

        {isIos ? (
          <div className="pwa-install__steps">
            <p className="pwa-install__step">1. Tap Share in Safari</p>
            <p className="pwa-install__step">2. Choose Add to Home Screen</p>
            <p className="pwa-install__step">3. Launch from your home screen</p>
          </div>
        ) : (
          <button
            className="button pwa-install__button"
            onClick={handleInstall}
            disabled={isInstalling}
          >
            {isInstalling ? 'INSTALLING...' : 'INSTALL APP'}
          </button>
        )}

        <button className="button secondary pwa-install__later" onClick={handleDismiss}>
          NOT NOW
        </button>
      </div>
    </div>
  )
}

export default PwaInstallScreen
