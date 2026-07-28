import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Ban, Bell, BellOff, X } from 'lucide-react'

/** Diamond alert icon matching the reference Report glyph. */
function ReportDiamondIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3.2 20.8 12 12 20.8 3.2 12 12 3.2Z" />
      <path d="M12 8.5v4.2" />
      <circle cx="12" cy="15.8" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  )
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Reusable "More" options sheet.
 * Mobile: bottom sheet. Desktop/tablet: centered modal card.
 */
export default function MoreOptionsModal({
  open,
  onClose,
  title = 'More',
  options = [],
}) {
  const titleId = useId()
  const panelRef = useRef(null)
  const previouslyFocused = useRef(null)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  // Mount / unmount with enter+exit animation (200–300ms).
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement
      setMounted(true)
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
      return () => cancelAnimationFrame(raf)
    }

    setVisible(false)
    const timer = window.setTimeout(() => setMounted(false), 280)
    return () => window.clearTimeout(timer)
  }, [open])

  // Body scroll lock + Escape + focus trap while open.
  useEffect(() => {
    if (!mounted || !visible) return undefined

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusFirst = () => {
      const root = panelRef.current
      if (!root) return
      const nodes = root.querySelectorAll(FOCUSABLE)
      const target = nodes[0] || root
      target.focus?.()
    }
    const focusTimer = window.setTimeout(focusFirst, 30)

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      const root = panelRef.current
      if (!root) return
      const nodes = Array.from(root.querySelectorAll(FOCUSABLE))
      if (nodes.length === 0) {
        e.preventDefault()
        root.focus()
        return
      }
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

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      previouslyFocused.current?.focus?.()
    }
  }, [mounted, visible, onClose])

  if (!mounted) return null

  const handleOptionClick = async (option) => {
    if (option.disabled) return
    try {
      const result = await option.onClick?.()
      // Allow handlers to keep the sheet open by returning `false` (e.g. cancelled confirm).
      if (result !== false) onClose?.()
    } catch {
      onClose?.()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close more options"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/45 transition-opacity duration-300 ease-out ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 w-full max-w-[460px] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.18)] outline-none transition-all duration-300 ease-out ${
          visible
            ? 'translate-y-0 opacity-100 sm:scale-100'
            : 'translate-y-8 opacity-0 sm:translate-y-4 sm:scale-95'
        } rounded-t-[22px] sm:rounded-[22px] pb-[max(0.5rem,env(safe-area-inset-bottom))]`}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center border-b border-[#EEEEEE] px-5 py-4">
          <h2 id={titleId} className="text-[19px] font-bold leading-none text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-700 transition duration-200 hover:bg-slate-100 active:scale-95"
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>

        {/* Options */}
        <div className="px-1 py-1" role="menu" aria-label={title}>
          {options.map((option, index) => {
            const Icon = option.icon
            return (
              <div key={option.id || option.label}>
                {index > 0 ? <div className="mx-5 h-px bg-[#EEEEEE]" /> : null}
                <button
                  type="button"
                  role="menuitem"
                  disabled={option.disabled}
                  onClick={() => handleOptionClick(option)}
                  className="flex w-full cursor-pointer items-center gap-3.5 px-5 py-4 text-left text-base font-medium text-brand transition duration-200 hover:bg-brand-50/60 active:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {Icon ? <Icon className="h-5 w-5 shrink-0 text-brand" aria-hidden /> : null}
                  <span>{option.label}</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

/** Convenience helpers for chat "More" actions. */
export function buildChatMoreOptions({
  is1to1,
  blockedByMe,
  blocking,
  muting,
  isMuted,
  onBlock,
  onReport,
  onMute,
}) {
  const options = []

  if (is1to1) {
    options.push({
      id: 'block',
      label: blockedByMe ? 'Unblock' : 'Block',
      icon: Ban,
      disabled: blocking,
      onClick: onBlock,
    })
    options.push({
      id: 'report',
      label: 'Report',
      icon: ReportDiamondIcon,
      onClick: onReport,
    })
  }

  options.push({
    id: 'mute',
    label: isMuted ? 'Unmute Notifications' : 'Mute Notifications',
    icon: isMuted ? Bell : BellOff,
    disabled: muting,
    onClick: onMute,
  })

  return options
}

export { ReportDiamondIcon }
