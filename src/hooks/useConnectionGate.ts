import { useCallback, useState, useEffect } from 'react'
import { useGame } from '../context/GameContext'
import { useOnlineStatus } from './useOnlineStatus'

type ConnectionModalState = {
  open: boolean
  message: string
}

export const useConnectionGate = () => {
  const { firebaseAvailable, retryConnection } = useGame()
  const isOnline = useOnlineStatus()
  const [connectionModal, setConnectionModal] = useState<ConnectionModalState>({
    open: false,
    message: '',
  })

  const openModal = useCallback((message: string) => {
    setConnectionModal((prev) => {
      if (prev.open && prev.message === message) return prev
      return { open: true, message }
    })
  }, [])

  const closeModal = useCallback(() => {
    setConnectionModal((prev) => ({ ...prev, open: false }))
  }, [])

  // Auto-close modal when connection is restored
  useEffect(() => {
    if (isOnline && firebaseAvailable && connectionModal.open) {
      closeModal()
    }
  }, [isOnline, firebaseAvailable, connectionModal.open, closeModal])

  const ensureConnection = useCallback(
    async (message: string) => {
      if (!isOnline) {
        openModal(message)
        return false
      }

      if (!firebaseAvailable) {
        const ok = await retryConnection()
        if (!ok) {
          openModal(message)
          return false
        }
      }

      return true
    },
    [firebaseAvailable, isOnline, openModal, retryConnection],
  )

  return {
    ensureConnection,
    openModal,
    closeModal,
    connectionModal,
  }
}
