import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import Button from './Button'

function Modal({
  title,
  open,
  onClose,
  children,
  footer,
  size = 'md',
  showClose = true,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-5xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className={`relative w-full ${sizes[size] || sizes.md} bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-10 max-h-[90vh] flex flex-col animate-fade-in`}>
        {(title || showClose) && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            {title && (
              <h3 id="admin-modal-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                {title}
              </h3>
            )}
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-auto"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 shrink-0 flex flex-wrap justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

Modal.Footer = function ModalFooter({ onCancel, onConfirm, cancelLabel = 'Cancel', confirmLabel = 'Confirm', loading = false, confirmVariant = 'primary' }) {
  return (
    <>
      {onCancel && (
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
      )}
      {onConfirm && (
        <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      )}
    </>
  )
}

export default Modal
