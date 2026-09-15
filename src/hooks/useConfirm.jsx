import { useCallback, useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

// Înlocuiește window.confirm cu un dialog în stilul aplicației, păstrând
// aceeași ergonomie la locul de apel: `const ok = await confirm('...')`.
// Componenta întoarsă (`dialog`) trebuie randată o dată, oriunde în arbore.
export function useConfirm() {
  const [state, setState] = useState(null)
  const resolverRef = useRef(null)

  const confirm = useCallback((message, options = {}) => {
    setState({ message, ...options })
    return new Promise((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setState(null)
    resolverRef.current?.(true)
  }, [])

  const handleCancel = useCallback(() => {
    setState(null)
    resolverRef.current?.(false)
  }, [])

  const dialog = state ? (
    <ConfirmDialog
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      danger={state.danger}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null

  return { confirm, dialog }
}
