import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Shared modal / bottom-sheet dialog matching dashboard design language.
 */
export default function ModalDialog({
  open = true,
  onClose,
  title,
  children,
  footer,
  maxWidthClass = 'sm:max-w-md',
  labelledBy,
}) {
  const titleId = useId()
  const panelRef = useRef(null)
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
      return () => cancelAnimationFrame(raf)
    }
    setVisible(false)
    const t = window.setTimeout(() => setMounted(false), 280)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!mounted || !visible) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const root = panelRef.current
      if (!root) return
      const nodes = Array.from(root.querySelectorAll(FOCUSABLE))
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector(FOCUSABLE)
      first?.focus?.()
    }, 40)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [mounted, visible, onClose])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        className={`absolute inset-0 bg-slate-900/45 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || titleId}
        tabIndex={-1}
        className={`relative z-10 flex max-h-[92vh] w-full ${maxWidthClass} flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.18)] outline-none transition-all duration-300 ease-out sm:rounded-[24px] pb-[max(0.25rem,env(safe-area-inset-bottom))] ${
          visible ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-8 opacity-0 sm:translate-y-3 sm:scale-95'
        }`}
      >
        {title ? (
          <div className="relative flex shrink-0 items-center justify-center px-5 pb-3 pt-5">
            <h2 id={titleId} className="text-lg font-bold text-slate-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-700 transition duration-200 hover:bg-slate-100"
            >
              <X className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer ? <div className="shrink-0 px-5 pb-5 pt-1">{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}
