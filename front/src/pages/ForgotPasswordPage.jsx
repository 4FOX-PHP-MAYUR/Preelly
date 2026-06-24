import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ArrowLeft, Lock, Mail } from 'lucide-react'
import {
  clearError,
  forgotPassword,
  verifyPasswordResetOtp,
  resetPassword,
} from '@shared/store/slices/authSlice'
import AuthSplitLayout, { AuthField, AuthSidePanel } from '../components/Auth/AuthSplitLayout'
import OtpIllustration from '../components/Auth/OtpIllustration'

const OTP_LENGTH = 6
const RESEND_DELAY = 59
const isEmailLike = (value) => /^\S+@\S+\.\S+$/.test(String(value || '').trim())

function ForgotPasswordPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth)
  const inputRefs = useRef([])

  const queryEmail = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('email') || ''
  }, [location.search])

  const loginPath = useMemo(
    () => (localStorage.getItem('authTarget') === 'seller' ? '/login?target=seller' : '/login'),
    []
  )

  const [step, setStep] = useState(queryEmail ? 'otp' : 'email')
  const [email, setEmail] = useState(queryEmail)
  const [phone, setPhone] = useState('')
  const [contactChannel, setContactChannel] = useState(queryEmail ? 'email' : 'email')
  const [resetToken, setResetToken] = useState('')
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [otpError, setOtpError] = useState('')
  const [resendCountdown, setResendCountdown] = useState(RESEND_DELAY)

  const emailForm = useForm({
    defaultValues: {
      identifier: queryEmail,
    },
  })
  const passwordForm = useForm()
  const passwordValue = passwordForm.watch('password')

  useEffect(() => {
    emailForm.reset({ identifier: queryEmail })
    if (queryEmail) {
      setEmail(queryEmail)
      setPhone('')
      setContactChannel('email')
      setStep((currentStep) => (currentStep === 'password' ? currentStep : 'otp'))
    }
  }, [queryEmail, emailForm])

  useEffect(() => {
    if (step === 'otp') {
      setOtpDigits(Array(OTP_LENGTH).fill(''))
      setOtpError('')
      setResendCountdown(RESEND_DELAY)
    }
  }, [step, email])

  useEffect(() => {
    if (error) {
      toast.error(error)
      dispatch(clearError())
    }
  }, [error, dispatch])

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    if (step !== 'otp' || resendCountdown <= 0) {
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
  }, [step, resendCountdown])

  const onRequestOtp = async (data) => {
    try {
      const response = await dispatch(forgotPassword({ identifier: data.identifier })).unwrap()
      setContactChannel(response?.channel || (isEmailLike(data.identifier) ? 'email' : 'phone'))
      setEmail(response?.email || (isEmailLike(data.identifier) ? String(data.identifier || '').trim().toLowerCase() : ''))
      setPhone(response?.phone || (!isEmailLike(data.identifier) ? String(data.identifier || '').trim() : ''))
      setStep('otp')
      toast.success(
        response?.channel === 'phone'
          ? 'Password reset OTP sent to your mobile number.'
          : 'Password reset OTP sent to your email.'
      )
    } catch {
      // Error handled by useEffect
    }
  }

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

  const onVerifyOtp = async (event) => {
    event.preventDefault()

    if (!/^\d{6}$/.test(otpValue)) {
      setOtpError('Please enter the 6-digit verification code.')
      return
    }

    try {
      const response = await dispatch(
        verifyPasswordResetOtp({ identifier: contactChannel === 'phone' ? phone : email, otp: otpValue })
      ).unwrap()
      setResetToken(response.resetToken)
      setContactChannel(response?.channel || contactChannel)
      setEmail(response?.email || email)
      setPhone(response?.phone || phone)
      setStep('password')
      passwordForm.reset({ password: '', confirmPassword: '' })
      toast.success('OTP verified. You can now change your password.')
    } catch {
      // Error handled by useEffect
    }
  }

  const onResetPassword = async (data) => {
    try {
      await dispatch(resetPassword({ resetToken, password: data.password })).unwrap()
      toast.success('Password updated successfully. Please sign in.')
      navigate('/login')
    } catch {
      // Error handled by useEffect
    }
  }

  const onResendOtp = async () => {
    if (resendCountdown > 0) {
      return
    }

    try {
      await dispatch(
        forgotPassword({ identifier: contactChannel === 'phone' ? phone : email })
      ).unwrap()
      setOtpDigits(Array(OTP_LENGTH).fill(''))
      setOtpError('')
      setResendCountdown(RESEND_DELAY)
      toast.success(
        contactChannel === 'phone'
          ? 'A new OTP has been sent to your mobile number.'
          : 'A new OTP has been sent to your email.'
      )
    } catch {
      // Error handled by useEffect
    }
  }

  const stepMeta = {
    email: {
      title: 'Forgot Password',
      subtitle: 'Enter the email linked to your account and we will send you a verification OTP.',
      quote: 'Preelly helps me move fast, so resetting access needs to be just as smooth and secure.',
      quoteAuthor: 'Noah Ali',
      quoteRole: 'Marketplace User',
    },
    otp: {
      title: 'Check your Email',
      subtitle: 'Enter the code we have sent you to your email id',
      quote: 'I found my perfect car in minutes. Scrolling through Preelly made the whole process effortless.',
      quoteAuthor: 'Aarav Mehta',
      quoteRole: 'Car Buyer',
    },
    password: {
      title: 'Change Password',
      subtitle: 'Your OTP is verified. Create a new password to regain access to your account.',
      quote: 'A simple password reset flow makes it easy to get back to buying and selling without friction.',
      quoteAuthor: 'Zayn Malik',
      quoteRole: 'Seller',
    },
  }

  if (step === 'email') {
    return (
      <div className="min-h-screen bg-[#f6f7fb] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-center">
          <section className="mx-auto w-full max-w-[420px] px-2 py-8 sm:px-4 lg:mx-0 lg:px-0">
            <Link
              to={loginPath}
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#2c24ff] transition hover:text-[#1800ff]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to log in
            </Link>

            <div className="mt-8">
              <h1 className="text-[2.35rem] font-semibold tracking-tight text-slate-950">
                Forgot Password
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">
                Please enter your email address to reset your password.
              </p>
            </div>

            <div className="mt-8">
              <div className="mx-auto flex w-full max-w-[320px] items-center justify-center">
                <img
                  src="/images/forgot-password-illustration.png"
                  alt="Forgot password illustration"
                  className="h-auto w-full object-contain"
                  loading="eager"
                />
              </div>
            </div>

            <form onSubmit={emailForm.handleSubmit(onRequestOtp)} className="mt-8">
              <label className="mb-2 block text-sm font-medium text-slate-800">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter your email ID"
                  className="h-14 w-full rounded-2xl border border-[#d8dbea] bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#3128ff] focus:ring-4 focus:ring-[#3128ff]/10"
                  {...emailForm.register('identifier', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                />
              </div>
              {emailForm.formState.errors.identifier?.message ? (
                <p className="mt-2 text-sm text-red-500">
                  {emailForm.formState.errors.identifier.message}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-7 flex h-[54px] w-full items-center justify-center rounded-full bg-[#1a43ff] px-6 text-base font-medium text-white shadow-[0_18px_36px_rgba(26,67,255,0.28)] transition hover:bg-[#1438df] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  'Send Otp'
                )}
              </button>
            </form>

            <div className="mt-8 text-center text-sm text-slate-400">
              <p>Don&apos;t remember your email?</p>
              <p className="mt-1">
                Contact us at{' '}
                <a href="mailto:hello@preelly.com" className="font-semibold text-[#2c24ff]">
                  hello@preelly.com
                </a>
              </p>
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

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-[#f6f7fb] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-center">
          <section className="mx-auto w-full max-w-[420px] px-2 py-8 sm:px-4 lg:mx-0 lg:px-0">
            <Link
              to={loginPath}
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#2c24ff] transition hover:text-[#1800ff]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to log in
            </Link>

            <div className="mt-8">
              <h1 className="text-[2.35rem] font-semibold tracking-tight text-slate-950">
                {contactChannel === 'phone' ? 'Verify your Mobile' : 'Check your Email'}
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">
                Enter the code we have sent you to your{' '}
                {contactChannel === 'phone' ? 'mobile number' : 'email id'}{' '}
                <span className="font-semibold text-[#2c24ff]">
                  {contactChannel === 'phone' ? phone : email}
                </span>
              </p>
            </div>

            <div className="mt-8">
              <OtpIllustration
                src={
                  contactChannel === 'phone'
                    ? '/images/verification-illustration.png'
                    : '/images/check-email-illustration.png'
                }
                alt={
                  contactChannel === 'phone'
                    ? 'Mobile verification illustration'
                    : 'Check your email illustration'
                }
              />
            </div>

            <form onSubmit={onVerifyOtp} className="mt-10">
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
                    Resend otp in{' '}
                    <span className="font-semibold text-[#2c24ff]">{resendCountdown}s</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onResendOtp}
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
                  'Reset Password'
                )}
              </button>
            </form>

            <div className="mt-8 text-center text-sm text-slate-400">
              <p>Don&apos;t remember your email ?</p>
              <p className="mt-1">
                Contact us at{' '}
                <a href="mailto:hello@preelly.com" className="font-semibold text-[#2c24ff]">
                  hello@preelly.com
                </a>
              </p>
            </div>
          </section>

          <AuthSidePanel
            quote={stepMeta.otp.quote}
            quoteAuthor={stepMeta.otp.quoteAuthor}
            quoteRole={stepMeta.otp.quoteRole}
          />
        </div>
      </div>
    )
  }

  return (
    <AuthSplitLayout
      title={stepMeta[step].title}
      subtitle={stepMeta[step].subtitle}
      switchPrompt="Remember your password?"
      switchLabel="Sign In"
      switchTo="/login"
      quote={stepMeta[step].quote}
      quoteAuthor={stepMeta[step].quoteAuthor}
      quoteRole={stepMeta[step].quoteRole}
    >
      {step === 'otp' ? (
        <div className="mb-5 rounded-2xl border border-[#eceef6] bg-[#f8f9fd] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Email
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700">{email}</p>
        </div>
      ) : null}

      {step === 'email' ? (
        <form onSubmit={emailForm.handleSubmit(onRequestOtp)} className="space-y-6">
          <AuthField
            label="Email"
            type="email"
            icon={Mail}
            placeholder="Enter your email"
            error={emailForm.formState.errors.email?.message}
            {...emailForm.register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
          />

          <button
            type="submit"
            disabled={loading}
            className="flex h-[50px] w-full items-center justify-center rounded-full bg-[#1400ff] px-6 text-[1.05rem] font-medium text-white shadow-[0_16px_36px_rgba(20,0,255,0.3)] transition hover:bg-[#1000d6] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              'Send OTP'
            )}
          </button>
        </form>
      ) : null}

      {step === 'password' ? (
        <form onSubmit={passwordForm.handleSubmit(onResetPassword)} className="space-y-6">
          <AuthField
            label="New Password"
            type="password"
            icon={Lock}
            placeholder="Enter your new password"
            error={passwordForm.formState.errors.password?.message}
            {...passwordForm.register('password', {
              required: 'Password is required',
              minLength: {
                value: 6,
                message: 'Password must be at least 6 characters',
              },
            })}
          />

          <AuthField
            label="Confirm Password"
            type="password"
            icon={Lock}
            placeholder="Confirm your new password"
            error={passwordForm.formState.errors.confirmPassword?.message}
            {...passwordForm.register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (value) =>
                value === passwordValue || 'Passwords do not match',
            })}
          />

          <button
            type="submit"
            disabled={loading || !resetToken}
            className="flex h-[50px] w-full items-center justify-center rounded-full bg-[#1400ff] px-6 text-[1.05rem] font-medium text-white shadow-[0_16px_36px_rgba(20,0,255,0.3)] transition hover:bg-[#1000d6] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              'Change Password'
            )}
          </button>

          <div className="text-center text-sm text-slate-500">
            <Link to="/login" className="font-medium text-[#291cff] hover:text-[#1f15d9]">
              Back to Sign In
            </Link>
          </div>
        </form>
      ) : null}
    </AuthSplitLayout>
  )
}

export default ForgotPasswordPage
