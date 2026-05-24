import { useFocusTrap } from '../hooks/useFocusTrap';

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
  const modalRef = useFocusTrap<HTMLDivElement>(open, onClose);

  if (!open) return null

  return (
    <div
      className="retro-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="retro-modal error-modal" onClick={(e) => e.stopPropagation()} ref={modalRef}>
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
