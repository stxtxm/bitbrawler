import React from 'react'

type StatusVariant = 'info' | 'warning' | 'error'

interface StatusScreenProps {
  title: string
  message: string
  details?: string
  actionLabel?: string
  onAction?: () => void
  variant?: StatusVariant
  showLoader?: boolean
  actionDisabled?: boolean
}

const StatusScreen: React.FC<StatusScreenProps> = ({
  title,
  message,
  details,
  actionLabel,
  onAction,
  variant = 'info',
  showLoader = false,
  actionDisabled = false,
}) => {
  const variantClass = `status-screen--${variant}`

  return (
    <div className={`status-screen ${variantClass}`}>
      <div className="status-screen__panel retro-container">
        <h2 className="status-screen__title">{title}</h2>
        <p className="status-screen__message">{message}</p>
        {details ? <p className="status-screen__details">{details}</p> : null}
        {showLoader ? (
          <div className="status-screen__loader" aria-hidden="true">
            <span className="status-screen__dot" />
            <span className="status-screen__dot" />
            <span className="status-screen__dot" />
          </div>
        ) : null}
        {actionLabel && onAction ? (
          <button className="button" onClick={onAction} disabled={actionDisabled}>
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default StatusScreen
