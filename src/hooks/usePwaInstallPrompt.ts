import { useEffect, useMemo, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const getIsIos = () => {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

const getIsStandalone = () => {
  if (typeof window === 'undefined') return false
  const isStandaloneDisplay = window.matchMedia?.('(display-mode: standalone)').matches
  const isIosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return Boolean(isStandaloneDisplay || isIosStandalone)
}

export const usePwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(getIsStandalone())
  const isIos = useMemo(getIsIos, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const handleDisplayModeChange = () => {
      setIsStandalone(getIsStandalone())
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
    const mediaQuery = window.matchMedia?.('(display-mode: standalone)')
    mediaQuery?.addEventListener?.('change', handleDisplayModeChange)
    mediaQuery?.addListener?.(handleDisplayModeChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
      mediaQuery?.removeEventListener?.('change', handleDisplayModeChange)
      mediaQuery?.removeListener?.(handleDisplayModeChange)
    }
  }, [])

  const promptInstall = async () => {
    if (!deferredPrompt) return { outcome: 'dismissed' as const }
    await deferredPrompt.prompt()
    const choiceResult = await deferredPrompt.userChoice
    if (choiceResult.outcome === 'accepted') {
      setDeferredPrompt(null)
    }
    return choiceResult
  }

  return {
    canPrompt: Boolean(deferredPrompt),
    promptInstall,
    isStandalone,
    isIos,
  }
}
