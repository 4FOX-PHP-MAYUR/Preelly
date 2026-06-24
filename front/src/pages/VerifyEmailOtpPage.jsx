import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Mail } from 'lucide-react'
import { clearError, sendOtp, verifyOtp } from '@shared/store/slices/authSlice'
import { AuthSidePanel } from '../components/Auth/AuthSplitLayout'
import OtpIllustration from '../components/Auth/OtpIllustration'
import { getCountryByIso } from '@shared/data/countryCodes'

const OTP_LENGTH = 6
const RESEND_DELAY = 59

function VerifyEmailOtpPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth)
  const inputRefs = useRef([])

  const queryEmail = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('email') || ''
  }, [location.search])

  const queryPhone = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('phone') || ''
  }, [location.search])

  const queryCountryIso = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('countryIso') || ''
  }, [location.search])

  const authMode = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('mode') === 'signup' ? 'signup' : 'login'
  }, [location.search])

  const target = useMemo(
    () => (localStorage.getItem('authTarget') === 'seller' ? 'seller' : 'buyer'),
    []
  )

  const loginPath = target === 'seller' ? '/login?target=seller' : '/login'
  const signupPath = target === 'seller' ? '/signup?target=seller' : '/signup'
  const backPath = authMode === 'signup' ? signupPath : loginPath

  const [email, setEmail] = useState(queryEmail)
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [otpError, setOtpError] = useState('')
  const [resendCountdown, setResendCountdown] = useState(RESEND_DELAY)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)

  useEffect(() => {
    setEmail(queryEmail)
    setOtpDigits(Array(OTP_LENGTH).fill(''))
    setOtpError('')
    setResendCountdown(RESEND_DELAY)
  }, [queryEmail])

  useEffect(() => {
    if (error) {
      const message = typeof error === 'string' ? error : error?.message
      if (message) toast.error(message)
      dispatch(clearError())
    }
  }, [error, dispatch])

  useEffect(() => {
    if (isAuthenticated) {
      navigate(target === 'seller' ? '/post-ad' : '/')
    }
  }, [isAuthenticated, navigate, target])

  useEffect(() => {
    if (!email) {
      toast.error('Email is missing. Please try again.')
      navigate(backPath)
    }
  }, [email, navigate, backPath])

  useEffect(() => {
    if (resendCountdown <= 0) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setResendCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [resendCountdown])

  const otpValue = otpDigits.join('')

  const handleDigitChange = (index, value) => {
    const cleanValue = value.replace(/\D/g, '')

    if (!cleanValue) {
      setOtpDigits((current) => {
        const next = [...current]
        next[index] = ''
        return next
      })
      setOtpError('')
      return
    }

    if (cleanValue.length > 1) {
      const nextDigits = [...otpDigits]
      cleanValue.slice(0, OTP_LENGTH - index).split('').forEach((digit, offset) => {
        nextDigits[index + offset] = digit
      })
      setOtpDigits(nextDigits)
      setOtpError('')
      const nextIndex = Math.min(index + cleanValue.length, OTP_LENGTH - 1)
      inputRefs.current[nextIndex]?.focus()
      return
    }

    setOtpDigits((current) => {
      const next = [...current]
      next[index] = cleanValue
      return next
    })
    setOtpError('')

    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      inputRefs.current[index - 1]?.focus()
    }

    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (event) => {
    event.preventDefault()
    const pastedDigits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)

    if (!pastedDigits) {
      return
    }

    const nextDigits = Array(OTP_LENGTH).fill('')
    pastedDigits.split('').forEach((digit, index) => {
      nextDigits[index] = digit
    })

    setOtpDigits(nextDigits)
    setOtpError('')
    inputRefs.current[Math.min(pastedDigits.length - 1, OTP_LENGTH - 1)]?.focus()
  }

  const handleVerify = async (event) => {
    event.preventDefault()

    if (!/^\d{6}$/.test(otpValue)) {
      setOtpError('Please enter the 6-digit verification code.')
      return
    }

    try {
      await dispatch(verifyOtp({
        email,
        otp: otpValue,
        phone: queryPhone || undefined,
        phoneCountryCode: queryCountryIso ? getCountryByIso(queryCountryIso).code : undefined,
        phoneCountryIso: queryCountryIso || undefined,
        mode: authMode,
      })).unwrap()
      toast.success(authMode === 'signup' ? 'Account created successfully!' : 'Signed in successfully!')
    } catch (err) {
      if (err?.code === 'USER_ALREADY_EXISTS') {
        setAlreadyRegistered(true)
      }
      toast.error(err?.message || 'Verification failed')
    }
  }

  const onResend = async () => {
    if (resendCountdown > 0) {
      return
    }

    try {
      await dispatch(sendOtp({ email, mode: authMode })).unwrap()
      setOtpDigits(Array(OTP_LENGTH).fill(''))
      setOtpError('')
      setResendCountdown(RESEND_DELAY)
      toast.success('New sign-in code sent to your email.')
    } catch {
      // Error handled by useEffect
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-center">
        <section className="mx-auto w-full max-w-[420px] px-2 py-8 sm:px-4 lg:mx-0 lg:px-0">
          <Link
            to={backPath}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#2c24ff] transition hover:text-[#1800ff]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {authMode === 'signup' ? 'sign up' : 'log in'}
          </Link>

          <div className="mt-8">
            <h1 className="text-[2.35rem] font-semibold tracking-tight text-slate-950">
              Enter verification code
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">
              Enter the code we have sent you to your email id{' '}
              <span className="font-semibold text-[#2c24ff]">{email}</span>
            </p>
          </div>

          <div className="mt-8">
            <OtpIllustration />
          </div>

          <form onSubmit={handleVerify} className="mt-10">
            {alreadyRegistered ? (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                An account with this email already exists. Please{' '}
                <Link to={loginPath} className="font-semibold text-[#2c24ff] hover:text-[#1800ff]">
                  go to login
                </Link>
                .
              </div>
            ) : null}

            <div className="flex items-center justify-center gap-2 sm:gap-3">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(node) => {
                    inputRefs.current[index] = node
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={digit}
                  onChange={(event) => handleDigitChange(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={handlePaste}
                  aria-label={`OTP digit ${index + 1}`}
                  className="h-14 w-12 rounded-[14px] border border-[#cad3e6] bg-white text-center text-xl font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-[#2c24ff] focus:ring-4 focus:ring-[#2c24ff]/10 sm:h-16 sm:w-14"
                />
              ))}
            </div>

            {otpError ? (
              <p className="mt-3 text-center text-sm text-red-500">{otpError}</p>
            ) : null}

            <div className="mt-4 text-center text-sm text-slate-400">
              {resendCountdown > 0 ? (
                <span>
                  Resend code in{' '}
                  <span className="font-semibold text-[#2c24ff]">{resendCountdown}s</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onResend}
                  disabled={loading}
                  className="font-semibold text-[#2c24ff] transition hover:text-[#1800ff] disabled:opacity-60"
                >
                  Resend code
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex h-[54px] w-full items-center justify-center rounded-full bg-[#1a43ff] px-6 text-base font-medium text-white shadow-[0_18px_36px_rgba(26,67,255,0.28)] transition hover:bg-[#1438df] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                'Verify Now'
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-500">
            <p>Not your email id?</p>
            <div className="mt-1 flex flex-col items-center gap-1">
              <div className="inline-flex items-center gap-2 font-medium text-slate-600">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>{email}</span>
              </div>
              <Link to={backPath} className="font-semibold text-[#2c24ff] hover:text-[#1800ff]">
                Change
              </Link>
            </div>
          </div>
        </section>

        <AuthSidePanel
          quote="I found my perfect car in minutes. Scrolling through Preelly made the whole process effortless."
          quoteAuthor="Aarav Mehta"
          quoteRole="Car Buyer"
        />
      </div>
    </div>
  )
}

export default VerifyEmailOtpPage

