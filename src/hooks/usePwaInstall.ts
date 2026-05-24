import { useEffect, useState, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface UsePwaInstallReturn {
  /** Whether the install prompt can be shown */
  isInstallable: boolean
  /** Whether the app has been installed */
  isInstalled: boolean
  /** Whether the user has dismissed the prompt */
  isDismissed: boolean
  /** Triggers the native install prompt */
  install: () => Promise<void>
  /** Dismisses the prompt (hides banner for session) */
  dismiss: () => void
}

export const usePwaInstall = (): UsePwaInstallReturn => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // Check if already installed via display-mode media query
    if (typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(display-mode: standalone)')
      if (mq.matches) {
        setIsInstalled(true)
        return
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstalled(true)
    } else {
      setIsDismissed(true)
    }

    setDeferredPrompt(null)
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    setIsDismissed(true)
    setDeferredPrompt(null)
  }, [])

  const isInstallable = deferredPrompt !== null && !isInstalled && !isDismissed

  return {
    isInstallable,
    isInstalled,
    isDismissed,
    install,
    dismiss,
  }
}
