import React, { memo } from 'react'
import StatusScreen from './StatusScreen'

interface FirebaseErrorProps {
  onRetry?: () => void
}

const FirebaseError: React.FC<FirebaseErrorProps> = memo(({ onRetry }) => {
  const handleRetry = () => {
    if (onRetry) {
      onRetry()
    } else {
      window.location.reload()
    }
  }

  return (
    <StatusScreen
      title="CONNECTION ERROR"
      message="Unable to connect to the game servers. Please check your internet connection."
      details="Your progress is saved online. Playing without connection could cause data loss."
      actionLabel="Retry Connection"
      onAction={handleRetry}
      variant="error"
    />
  )
})

FirebaseError.displayName = 'FirebaseError'

export default FirebaseError
