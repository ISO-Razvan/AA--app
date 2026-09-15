import './ConfirmDialog.css'

// Înlocuiește window.confirm — un modal mic, centrat, în stilul aplicației.
// Randat de useConfirm() ori de câte ori e nevoie de o confirmare.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmă',
  cancelLabel = 'Anulează',
  danger = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-label={title || 'Confirmare'}>
        {title && <h3 className="confirm-dialog-title">{title}</h3>}
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
