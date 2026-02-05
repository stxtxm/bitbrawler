import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import StatusScreen from '../components/StatusScreen'
import { useGame } from './GameContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

interface ConnectionBlockerContextValue {
  requireConnection: () => Promise<boolean>
}

const ConnectionBlockerContext = createContext<ConnectionBlockerContextValue | undefined>(undefined)

const resolveAll = (resolvers: Array<(value: boolean) => void>, value: boolean) => {
  resolvers.forEach((resolve) => resolve(value))
  resolvers.length = 0
}

export const ConnectionBlockerProvider = ({ children }: { children: React.ReactNode }) => {
  const isOnline = useOnlineStatus()
  const { firebaseAvailable, retryConnection } = useGame()
  const [isBlocking, setIsBlocking] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const pendingResolvers = useRef<Array<(value: boolean) => void>>([])

  useEffect(() => {
    if (isBlocking && isOnline && firebaseAvailable) {
      setIsBlocking(false)
      resolveAll(pendingResolvers.current, true)
    }
  }, [firebaseAvailable, isBlocking, isOnline])

  const handleRetry = useCallback(async () => {
    if (isRetrying) return
    setIsRetrying(true)
    await retryConnection()
    setIsRetrying(false)
  }, [isRetrying, retryConnection])

  const requireConnection = useCallback(async (): Promise<boolean> => {
    if (isOnline && firebaseAvailable) {
      return true
    }

    setIsBlocking(true)
    if (isOnline) {
      setTimeout(() => {
        handleRetry()
      }, 0)
    }

    return new Promise((resolve) => {
      pendingResolvers.current.push(resolve)
    })
  }, [firebaseAvailable, handleRetry, isOnline])

  useEffect(() => {
    if (isOnline && !firebaseAvailable && isBlocking) {
      handleRetry()
    }
  }, [firebaseAvailable, handleRetry, isBlocking, isOnline])

  const title = !isOnline ? 'OFFLINE MODE' : 'CONNECTION LOST'
  const message = !isOnline
    ? 'No internet connection detected.'
    : 'Unable to reach the game servers right now.'
  const details = !isOnline
    ? 'Reconnect to continue. Online access is required to sync your fighter data.'
    : 'Please retry. You will not be able to play without live data.'

  return (
    <ConnectionBlockerContext.Provider value={{ requireConnection }}>
      {children}
      {isBlocking ? (
        <StatusScreen
          title={title}
          message={message}
          details={details}
          actionLabel={isRetrying ? 'Checking...' : 'Retry Connection'}
          onAction={handleRetry}
          actionDisabled={isRetrying}
          variant="warning"
          showLoader
        />
      ) : null}
    </ConnectionBlockerContext.Provider>
  )
}

export const useConnectionBlocker = (): ConnectionBlockerContextValue => {
  const context = useContext(ConnectionBlockerContext)
  if (!context) {
    throw new Error('useConnectionBlocker must be used within ConnectionBlockerProvider')
  }
  return context
}
