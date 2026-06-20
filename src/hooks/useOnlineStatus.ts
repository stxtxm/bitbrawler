import { useEffect, useState } from 'react'

const getInitialOnline = () => {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export const useOnlineStatus = (): boolean => {
  const [online, setOnline] = useState<boolean>(getInitialOnline)

  useEffect(() => {
    const handleOnline = () => setOnline(true)

    const handleOffline = () => {
      // On mobile Chrome, switching apps via multitasking can fire a spurious
      // offline event while the page is hidden. Only trust offline events
      // when the page is actually visible to the user.
      if (document.visibilityState !== 'hidden') {
        setOnline(false)
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Re-check connection state when user returns to the page
        // (the browser may have recovered from a transient blip)
        setOnline(navigator.onLine)
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return online
}
