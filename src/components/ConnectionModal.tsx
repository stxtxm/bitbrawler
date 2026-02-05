interface ConnectionModalProps {
  open: boolean
  message: string
  onClose: () => void
  title?: string
  actionLabel?: string
}

const ConnectionModal = ({
  open,
  message,
  onClose,
  title = 'CONNECTION REQUIRED',
  actionLabel = 'RETRY',
}: ConnectionModalProps) => {
  if (!open) return null

  return (
    <div className="retro-modal-overlay">
      <div className="retro-modal error-modal">
        <div className="modal-header">{title}</div>
        <div className="modal-body">
          <p>{message}</p>
          <button className="button retro-btn" onClick={onClose} style={{ marginTop: '20px' }}>
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConnectionModal
