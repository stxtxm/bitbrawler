import { useEffect, useState } from 'react'

const getInitialOnline = () => {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export const useOnlineStatus = (): boolean => {
  const [online, setOnline] = useState<boolean>(getInitialOnline)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}
