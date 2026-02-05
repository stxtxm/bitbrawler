import { useEffect, useState } from 'react'

export const useServiceWorkerUpdate = () => {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<ServiceWorkerRegistration>
      setRegistration(custom.detail)
    }

    window.addEventListener('sw-update', handler as EventListener)
    return () => window.removeEventListener('sw-update', handler as EventListener)
  }, [])

  return registration
}
