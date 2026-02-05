import { useEffect, useState } from 'react'
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate'

const SwUpdateToast = () => {
  const registration = useServiceWorkerUpdate()
  const [isVisible, setIsVisible] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (registration?.waiting) {
      setIsVisible(true)
    }
  }, [registration])

  useEffect(() => {
    const handleControllerChange = () => {
      if (isUpdating) {
        window.location.reload()
      }
    }

    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange)
    return () => {
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [isUpdating])

  if (!isVisible) return null

  const handleUpdate = () => {
    if (!registration?.waiting || isUpdating) return
    setIsUpdating(true)
    registration.waiting.postMessage('SKIP_WAITING')
  }

  return (
    <div className="sw-toast">
      <div className="sw-toast__content">
        <p className="sw-toast__title">Nouvelle version dispo</p>
        <p className="sw-toast__text">Mets a jour pour profiter des dernieres ameliorations.</p>
      </div>
      <div className="sw-toast__actions">
        <button className="button sw-toast__btn" onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? 'MAJ...' : 'METTRE A JOUR'}
        </button>
        <button className="button secondary sw-toast__btn" onClick={() => setIsVisible(false)}>
          PLUS TARD
        </button>
      </div>
    </div>
  )
}

export default SwUpdateToast
