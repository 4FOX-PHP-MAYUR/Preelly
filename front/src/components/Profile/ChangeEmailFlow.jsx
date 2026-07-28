import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Loader2, Mail, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { userService } from '@shared/services/api'

const TITLE_NAVY = '#2E2E7E'
const MUTED = '#8B95B3'
const INPUT_BG = '#F5F7FA'
const PRIMARY = '#001AFF'
const OTP_LENGTH = 6
const RESEND_SECONDS = 59

function OtpBoxes({ length = OTP_LENGTH, value, onChange }) {
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

function Shell({ open, onClose, children }) {
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

/**
 * Multi-step change-email flow matching Privacy & Security designs.
 * Step 1: enter new email → Step 2: verify OTP.
 */
export default function ChangeEmailFlow({ open, onClose, onSuccess }) {
  const [step, setStep] = useState('email') // email | otp
  const [newEmail, setNewEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const startCountdown = (secs = RESEND_SECONDS) => {
    clearTimer()
    setCountdown(secs)
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearTimer()
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  useEffect(() => {
    if (!open) {
      clearTimer()
      setStep('email')
      setNewEmail('')
      setOtp('')
      setSending(false)
      setVerifying(false)
      setCountdown(0)
    }
  }, [open])

  useEffect(() => () => clearTimer(), [])

  const requestOtp = async (emailValue) => {
    const email = String(emailValue || '').trim().toLowerCase()
    if (!email || !email.includes('@')) {
      toast.error('Enter a valid email address')
      return false
    }
    setSending(true)
    try {
      await userService.requestEmailChange(email)
      setNewEmail(email)
      setOtp('')
      setStep('otp')
      startCountdown(RESEND_SECONDS)
      toast.success('Verification code sent')
      return true
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send verification code')
      return false
    } finally {
      setSending(false)
    }
  }

  const handleResetMail = async (e) => {
    e.preventDefault()
    await requestOtp(newEmail)
  }

  const handleResend = async () => {
    if (countdown > 0 || sending) return
    await requestOtp(newEmail)
  }

  const handleVerify = async () => {
    if (otp.length < OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit code`)
      return
    }
    setVerifying(true)
    try {
      await userService.verifyEmailChange({ email: newEmail, otp })
      toast.success('Email updated successfully')
      onSuccess?.(newEmail)
      onClose?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid or expired code')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Shell open={open} onClose={onClose}>
      {step === 'email' ? (
        <form onSubmit={handleResetMail} className="space-y-6">
          <div className="pr-8">
            <h2 className="text-[22px] font-bold leading-tight" style={{ color: TITLE_NAVY }}>
              Set a New Email ID
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
              Enter a new email address that isn&apos;t already linked to your account.
            </p>
          </div>

          <label className="block">
            <span className="sr-only">New email address</span>
            <div
              className="flex items-center gap-3 rounded-[12px] border border-[#E2E8F5] px-4 py-3.5 transition focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/10"
              style={{ backgroundColor: INPUT_BG }}
            >
              <Mail className="h-5 w-5 shrink-0" style={{ color: MUTED }} aria-hidden />
              <input
                type="email"
                autoComplete="email"
                autoFocus
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter your new mail ID"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                style={{ color: TITLE_NAVY }}
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={sending}
            aria-label="Reset Mail ID"
            className="flex w-full items-center justify-center rounded-full py-3.5 text-[15px] font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
            style={{ backgroundColor: PRIMARY }}
          >
            {sending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Sending…
              </span>
            ) : (
              'Reset Mail ID'
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="mx-auto flex items-center justify-center gap-1 text-sm font-semibold transition hover:opacity-80"
            style={{ color: TITLE_NAVY }}
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
            Back to Privacy and Security
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="pr-8">
            <h2 className="text-[22px] font-bold leading-tight" style={{ color: TITLE_NAVY }}>
              Enter verification code
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
              Enter the code we have sent you to your email id
            </p>
            <p className="mt-1 text-sm font-bold break-all" style={{ color: TITLE_NAVY }}>
              {newEmail}
            </p>
          </div>

          <div className="mx-auto w-full max-w-[280px]">
            <img
              src="/images/otp-verification-illustration.png"
              alt=""
              aria-hidden
              className="mx-auto h-auto w-full object-contain"
              draggable={false}
            />
          </div>

          <OtpBoxes value={otp} onChange={setOtp} />

          <p className="text-center text-sm" style={{ color: MUTED }}>
            Resend code in{' '}
            {countdown > 0 ? (
              <span className="font-semibold" style={{ color: PRIMARY }}>
                {countdown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={sending}
                className="font-semibold hover:underline disabled:opacity-60"
                style={{ color: PRIMARY }}
              >
                {sending ? 'Sending…' : 'Resend'}
              </button>
            )}
          </p>

          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || otp.length < OTP_LENGTH}
            className="flex w-full items-center justify-center rounded-full py-3.5 text-[15px] font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
            style={{ backgroundColor: PRIMARY }}
          >
            {verifying ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
              </span>
            ) : (
              'Verify Now'
            )}
          </button>

          <div className="space-y-1 text-center">
            <p className="text-sm" style={{ color: MUTED }}>
              Not your email id?
            </p>
            <p className="text-sm break-all text-slate-500">{newEmail}</p>
            <button
              type="button"
              onClick={() => {
                clearTimer()
                setCountdown(0)
                setOtp('')
                setStep('email')
              }}
              className="mt-1 text-sm font-semibold hover:underline"
              style={{ color: PRIMARY }}
            >
              Change
            </button>
          </div>
        </div>
      )}
    </Shell>
  )
}
