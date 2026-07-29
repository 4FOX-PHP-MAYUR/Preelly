import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { userService } from '@shared/services/api'
import { DEFAULT_COUNTRY_ISO, getCountryByIso } from '@shared/data/countryCodes'
import { AuthPhoneField } from '../Auth/AuthSplitLayout'
import {
  OtpBoxes,
  Shell,
  TITLE_NAVY,
  MUTED,
  PRIMARY,
  OTP_LENGTH,
  RESEND_SECONDS,
} from './otpFlowShared'

/**
 * Multi-step change-mobile-number flow — the phone counterpart to
 * ChangeEmailFlow. Step 1: enter the new number → Step 2: verify the OTP.
 * The code is delivered over WhatsApp by the same sender used at sign-in.
 */
export default function ChangePhoneFlow({ open, onClose, onSuccess }) {
  const [step, setStep] = useState('phone') // phone | otp
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO)
  const [phoneInput, setPhoneInput] = useState('')
  const [sentPhone, setSentPhone] = useState(null) // { phone, phoneCountryCode, phoneCountryIso }
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
      setStep('phone')
      setCountryIso(DEFAULT_COUNTRY_ISO)
      setPhoneInput('')
      setSentPhone(null)
      setOtp('')
      setSending(false)
      setVerifying(false)
      setCountdown(0)
    }
  }, [open])

  useEffect(() => () => clearTimer(), [])

  /** Build the same payload shape the login flow sends to /auth/send-otp. */
  const buildPayload = (rawPhone, iso) => {
    const digits = String(rawPhone || '').replace(/\D/g, '')
    if (!digits) return null
    const dialCode = getCountryByIso(iso).code
    return {
      phone: `${dialCode}${digits}`.replace(/\D/g, ''),
      phoneCountryCode: dialCode,
      phoneCountryIso: iso,
    }
  }

  const requestOtp = async (payload) => {
    if (!payload) {
      toast.error('Enter a valid mobile number')
      return false
    }
    setSending(true)
    try {
      await userService.requestPhoneChange(payload)
      setSentPhone(payload)
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

  const handleSubmitPhone = async (e) => {
    e.preventDefault()
    const digits = String(phoneInput || '').replace(/\D/g, '')
    if (digits.length < 6) {
      toast.error('Please enter a valid mobile number')
      return
    }
    await requestOtp(buildPayload(phoneInput, countryIso))
  }

  const handleResend = async () => {
    if (countdown > 0 || sending) return
    await requestOtp(sentPhone)
  }

  const handleVerify = async () => {
    if (otp.length < OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit code`)
      return
    }
    setVerifying(true)
    try {
      await userService.verifyPhoneChange({ ...sentPhone, otp })
      toast.success('Mobile number updated successfully')
      onSuccess?.(sentPhone?.phone)
      onClose?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid or expired code')
    } finally {
      setVerifying(false)
    }
  }

  const prettyPhone = sentPhone?.phone ? `+${sentPhone.phone}` : ''

  return (
    <Shell open={open} onClose={onClose}>
      {step === 'phone' ? (
        <form onSubmit={handleSubmitPhone} className="space-y-6">
          <div className="pr-8">
            <h2 className="text-[22px] font-bold leading-tight" style={{ color: TITLE_NAVY }}>
              Set a New Mobile Number
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
              Enter a new mobile number that isn&apos;t already linked to your account.
            </p>
          </div>

          <AuthPhoneField
            label="Mobile Number"
            countryIso={countryIso}
            onCountryIsoChange={setCountryIso}
            placeholder="Enter your new mobile number"
            autoFocus
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
          />

          <button
            type="submit"
            disabled={sending}
            aria-label="Reset Mobile Number"
            className="flex w-full items-center justify-center rounded-full py-3.5 text-[15px] font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
            style={{ backgroundColor: PRIMARY }}
          >
            {sending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Sending…
              </span>
            ) : (
              'Reset Mobile Number'
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
              Enter the code we have sent you on WhatsApp
            </p>
            <p className="mt-1 text-sm font-bold break-all" style={{ color: TITLE_NAVY }}>
              {prettyPhone}
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
              Not your mobile number?
            </p>
            <p className="text-sm break-all text-slate-500">{prettyPhone}</p>
            <button
              type="button"
              onClick={() => {
                clearTimer()
                setCountdown(0)
                setOtp('')
                setStep('phone')
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
