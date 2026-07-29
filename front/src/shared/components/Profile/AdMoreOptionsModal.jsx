import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BarChart3,
  EyeOff,
  Gavel,
  Pencil,
  Rocket,
  Trash2,
  Warehouse,
  X,
} from 'lucide-react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Instagram-style “More” bottom sheet for own ads on My Profile.
 * Matches the product design: grab handle, left title, blue actions, red delete.
 */
export default function AdMoreOptionsModal({
  open,
  onClose,
  onEdit,
  onWarehouse,
  onInsight,
  onBoost,
  onMarkSold,
  onUnpublish,
  onDelete,
  busy = false,
}) {
  const titleId = useId()
  const panelRef = useRef(null)
  const [mounted, setMounted] = useState(false)
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
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [mounted, visible, onClose])

  if (!mounted) return null

  const rows = [
    { id: 'edit', label: 'Edit this Ad', icon: Pencil, onClick: onEdit },
    { id: 'warehouse', label: 'Move to Warehouse', icon: Warehouse, onClick: onWarehouse },
    { id: 'insight', label: 'See Insight', icon: BarChart3, onClick: onInsight },
    { id: 'boost', label: 'Boost this Ad', icon: Rocket, onClick: onBoost },
    { id: 'sold', label: 'Mark as sold', icon: Gavel, onClick: onMarkSold },
    { id: 'unpublish', label: 'Unpublish this', icon: EyeOff, onClick: onUnpublish },
    { id: 'delete', label: 'Delete this Ad', icon: Trash2, onClick: onDelete, danger: true },
  ]

  const handleClick = async (row) => {
    if (busy) return
    try {
      const result = await row.onClick?.()
      if (result !== false) onClose?.()
    } catch {
      onClose?.()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <button
        type="button"
        aria-label="Close more options"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/45 transition-opacity duration-300 ease-out ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 w-full max-w-[420px] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.18)] outline-none transition-all duration-300 ease-out ${
          visible
            ? 'translate-y-0 opacity-100 sm:scale-100'
            : 'translate-y-8 opacity-0 sm:translate-y-4 sm:scale-95'
        } rounded-t-[22px] sm:rounded-[22px] pb-[max(0.5rem,env(safe-area-inset-bottom))]`}
      >
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <div className="relative flex items-center border-b border-[#EEEEEE] px-5 py-3.5">
          <h2 id={titleId} className="text-[18px] font-bold text-slate-900">
            More
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>

        <div className="px-1 py-1" role="menu" aria-label="Ad options">
          {rows.map((row, index) => {
            const Icon = row.icon
            return (
              <div key={row.id}>
                {index > 0 ? <div className="mx-5 h-px bg-[#EEEEEE]" /> : null}
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => handleClick(row)}
                  className={`flex w-full items-center gap-3.5 px-5 py-4 text-left text-[15px] font-medium transition hover:bg-slate-50 disabled:opacity-50 ${
                    row.danger ? 'text-red-500' : 'text-brand'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${row.danger ? 'text-red-500' : 'text-brand'}`}
                    strokeWidth={1.85}
                    aria-hidden
                  />
                  <span>{row.label}</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
