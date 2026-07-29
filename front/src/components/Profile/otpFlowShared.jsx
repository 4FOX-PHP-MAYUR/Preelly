import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * Shared chrome for the Privacy & Security OTP flows
 * (ChangeEmailFlow / ChangePhoneFlow) so both stay visually identical.
 */
export const TITLE_NAVY = '#2E2E7E'
export const MUTED = '#8B95B3'
export const INPUT_BG = '#F5F7FA'
export const PRIMARY = '#001AFF'
export const OTP_LENGTH = 6
export const RESEND_SECONDS = 59

export function OtpBoxes({ length = OTP_LENGTH, value, onChange }) {
  const refs = useRef([])
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length)

  const commit = (next) => onChange(next.join('').replace(/\D/g, '').slice(0, length))

  const handleKey = (e, i) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = digits.slice()
      if (next[i]) {
        next[i] = ''
        commit(next)
      } else if (i > 0) {
        next[i - 1] = ''
        commit(next)
        refs.current[i - 1]?.focus()
      }
      return
    }
    if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus()
      return
    }
    if (e.key === 'ArrowRight' && i < length - 1) {
      refs.current[i + 1]?.focus()
      return
    }
    if (!/^\d$/.test(e.key)) return
    e.preventDefault()
    const next = digits.slice()
    next[i] = e.key
    commit(next)
    if (i < length - 1) refs.current[i + 1]?.focus()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = String(e.clipboardData.getData('text') || '')
      .replace(/\D/g, '')
      .slice(0, length)
    if (!pasted) return
    onChange(pasted)
    const focusAt = Math.min(pasted.length, length - 1)
    refs.current[focusAt]?.focus()
  }

  return (
    <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Digit ${i + 1} of ${length}`}
          value={d || ''}
          placeholder="-"
          onChange={() => {}}
          onKeyDown={(e) => handleKey(e, i)}
          onFocus={(e) => e.target.select()}
          className="h-12 w-11 rounded-[10px] border border-[#D8E0F0] text-center text-lg font-semibold outline-none transition placeholder:text-slate-300 focus:border-brand focus:ring-2 focus:ring-brand/15"
          style={{ backgroundColor: INPUT_BG, color: TITLE_NAVY }}
        />
      ))}
    </div>
  )
}

export function Shell({ open, onClose, children }) {
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
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [mounted, visible, onClose])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
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
        aria-labelledby={titleId}
        className={`relative z-10 flex max-h-[92vh] w-full max-w-[400px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.18)] outline-none transition-all duration-300 ease-out sm:rounded-[28px] ${
          visible ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-8 opacity-0 sm:translate-y-3 sm:scale-95'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
        >
          <X className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <div id={titleId} className="min-h-0 flex-1 overflow-y-auto px-6 pb-7 pt-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
