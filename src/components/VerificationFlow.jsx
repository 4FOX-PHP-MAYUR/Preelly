import { useState, useRef, useEffect } from 'react'
import { Phone, Mail, CheckCircle2, Loader2 } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { selectUser, refreshUser } from '../store/slices/authSlice'
import { authService } from '../services/api'
import toast from 'react-hot-toast'
import {
  VerificationModalShell,
  VerificationIntroBody,
  VerificationMethodBody,
  VerificationMethodCard,
  VerificationPrimaryButton,
  VERIFY_BLUE,
} from './verification/VerificationModalShared'

function OtpInput({ length = 6, value, onChange }) {
  const refs = useRef([])
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length)

  const handleKey = (e, i) => {
    if (e.key === 'Backspace') {
      const next = digits.slice()
      if (next[i]) {
        next[i] = ''
        onChange(next.join(''))
      } else if (i > 0) {
        next[i - 1] = ''
        onChange(next.join(''))
        refs.current[i - 1]?.focus()
      }
      return
    }
    if (!/^\d$/.test(e.key)) return
    const next = digits.slice()
    next[i] = e.key
    onChange(next.join(''))
    if (i < length - 1) refs.current[i + 1]?.focus()
  }

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={() => {}}
          onKeyDown={(e) => handleKey(e, i)}
          onFocus={(e) => e.target.select()}
          className="h-12 w-10 rounded-xl border-2 border-gray-200 text-center text-lg font-bold text-gray-900 focus:border-[#0044FF] focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
        />
      ))}
    </div>
  )
}

function MethodModal({ user, onSelect }) {
  const hasPhone = Boolean(user?.phone)
  const hasEmail = Boolean(user?.email)

  return (
    <VerificationMethodBody>
      <VerificationMethodCard
        icon={Phone}
        title="Verify via Mobile Number"
        description={
          hasPhone
            ? "We'll send a verification code to your registered mobile number."
            : 'No mobile number linked to your account.'
        }
        selected={hasPhone}
        disabled={!hasPhone}
        onClick={() => hasPhone && onSelect('phone')}
      />
      <VerificationMethodCard
        icon={Mail}
        title="Verify via Email Address"
        description={
          hasEmail
            ? "We'll send a verification code to your registered email address."
            : 'No email address linked to your account.'
        }
        selected={false}
        disabled={!hasEmail}
        onClick={() => hasEmail && onSelect('email')}
      />
    </VerificationMethodBody>
  )
}

function OtpModal({ method, user, onSuccess }) {
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef(null)

  const masked =
    method === 'phone'
      ? user?.phone?.replace(/(\d{3})\d+(\d{2})/, '$1••••$2')
      : user?.email?.replace(/(.{2}).+(@.+)/, '$1•••$2')

  const startCountdown = (secs = 60) => {
    setCountdown(secs)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  useEffect(() => () => clearInterval(timerRef.current), [])

  const sendOtp = async () => {
    setSending(true)
    try {
      if (method === 'phone') {
        await authService.sendPhoneOtp({ phone: user.phone })
      } else {
        await authService.sendEmailOtp({ email: user.email })
      }
      startCountdown(60)
      toast.success(`Code sent to your ${method === 'phone' ? 'mobile number' : 'email'}`)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send code')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    sendOtp()
  }, [])

  const verify = async () => {
    if (otp.length < 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    setVerifying(true)
    try {
      if (method === 'phone') {
        await authService.verifyPhoneOtp({ phone: user.phone, otp })
      } else {
        await authService.verifyEmailOtp({ email: user.email, otp })
      }
      onSuccess()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid or expired code')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="px-6 pb-7 pt-2 space-y-5">
      <div className="text-center space-y-1">
        <div
          className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-3"
          style={{ backgroundColor: '#EEF4FF' }}
        >
          {method === 'phone' ? (
            <Phone className="h-6 w-6" style={{ color: VERIFY_BLUE }} />
          ) : (
            <Mail className="h-6 w-6" style={{ color: VERIFY_BLUE }} />
          )}
        </div>
        <p className="text-[14px] font-bold text-gray-900">Enter verification code</p>
        <p className="text-[12px] text-gray-500 leading-relaxed">
          We sent a 6-digit code to <span className="font-semibold text-gray-700">{masked}</span>
        </p>
      </div>

      <OtpInput length={6} value={otp} onChange={setOtp} />

      <VerificationPrimaryButton onClick={verify} disabled={verifying || otp.length < 6}>
        {verifying ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
          </span>
        ) : (
          'Verify'
        )}
      </VerificationPrimaryButton>

      <div className="text-center">
        {countdown > 0 ? (
          <p className="text-xs text-gray-400">Resend code in {countdown}s</p>
        ) : (
          <button
            type="button"
            onClick={sendOtp}
            disabled={sending}
            className="text-xs font-semibold hover:underline disabled:opacity-50"
            style={{ color: VERIFY_BLUE }}
          >
            {sending ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </div>
    </div>
  )
}

function SuccessModal({ onClose }) {
  return (
    <div className="flex flex-col items-center text-center px-6 pb-7 pt-2 space-y-4">
      <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-bold text-gray-900">Account Verified!</p>
        <p className="text-sm text-gray-500 leading-relaxed">
          Your email and phone have been verified. You can now post ads on the platform.
        </p>
      </div>
      <VerificationPrimaryButton onClick={onClose}>Done</VerificationPrimaryButton>
    </div>
  )
}

export default function VerificationFlow({ onClose, startAtMethod }) {
  const dispatch = useDispatch()
  const user = useSelector(selectUser)
  const [step, setStep] = useState(startAtMethod ? 'method' : 'intro')
  const [method, setMethod] = useState(null)

  const handleMethodSelect = (m) => {
    setMethod(m)
    setStep('otp')
  }

  const handleSuccess = async () => {
    try {
      await dispatch(refreshUser()).unwrap()
    } catch {
      /* ignore */
    }
    setStep('success')
  }

  const TITLES = {
    intro: 'Get Verified On Preelly',
    method: 'Verify Your Identity',
    otp: 'Enter OTP',
    success: 'Verification Complete',
  }

  return (
    <VerificationModalShell
      title={TITLES[step]}
      onClose={onClose}
      backLabel={step === 'otp' ? '← Back' : null}
      onBack={step === 'otp' ? () => setStep('method') : null}
    >
      {step === 'intro' && (
        <VerificationIntroBody onClose={onClose} onContinue={() => setStep('method')} />
      )}
      {step === 'method' && <MethodModal user={user} onSelect={handleMethodSelect} />}
      {step === 'otp' && method && (
        <OtpModal method={method} user={user} onSuccess={handleSuccess} />
      )}
      {step === 'success' && <SuccessModal onClose={onClose} />}
    </VerificationModalShell>
  )
}

export function OtpVerificationCard({ onOpenFlow }) {
  const user = useSelector(selectUser)
  const emailDone = user?.isEmailVerified
  const phoneDone = user?.isPhoneVerified
  const otpVerified = user?.isVerified === true

  return (
    <div
      className="rounded-3xl border p-6 shadow-sm"
      style={{ borderColor: '#C7D7FF', backgroundColor: '#FAFBFF' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-4 w-4" style={{ color: VERIFY_BLUE }} />
            <h2 className="text-base font-bold text-gray-900">Account Verification (OTP)</h2>
          </div>
          <p className="text-sm text-gray-500">
            Verify your email and phone with a one-time code. Required to post ads and secure your account.
          </p>
          {!otpVerified && (
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${emailDone ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                Email {emailDone ? '✓' : 'pending'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${phoneDone ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                Phone {phoneDone ? '✓' : 'pending'}
              </span>
            </div>
          )}
        </div>
        {otpVerified ? (
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            OTP Verified
          </span>
        ) : (
          <button
            type="button"
            onClick={onOpenFlow}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-white text-sm font-semibold transition shrink-0 hover:opacity-90"
            style={{ backgroundColor: VERIFY_BLUE }}
          >
            Get Verified
          </button>
        )}
      </div>
    </div>
  )
}
