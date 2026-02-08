interface ConnectionModalProps {
  open: boolean
  message: string
  onClose: () => void
  title?: string
}

const ConnectionModal = ({
  open,
  message,
  onClose,
  title = 'CONNECTION REQUIRED',
}: ConnectionModalProps) => {
  if (!open) return null

  return (
    <div className="retro-modal-overlay" onClick={onClose}>
      <div className="retro-modal error-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">{title}</div>
        <div className="modal-body">
          <p>{message}</p>
          <div className="modal-hint">Click anywhere to dismiss</div>
        </div>
      </div>
    </div>
  )
}

export default ConnectionModal
