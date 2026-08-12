import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { sendOtp, emailStart, clearError, enterGuestMode } from '@shared/store/slices/authSlice'
import toast from 'react-hot-toast'
import { Mail } from 'lucide-react'
import AuthSplitLayout, {
  AuthField,
  AuthPhoneField,
  AuthSocialButton,
} from '../components/Auth/AuthSplitLayout'
import { DEFAULT_COUNTRY_ISO, getCountryByIso } from '@shared/data/countryCodes'
import { apiUrl } from '@shared/utils/constants'
import { useAppleSignIn } from '@shared/hooks/useAppleSignIn'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.42c-.24 1.26-.96 2.32-2.04 3.03l3.3 2.56c1.92-1.77 3.02-4.38 3.02-7.48 0-.71-.06-1.39-.19-2.02H12Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.73 0 5.02-.9 6.68-2.43l-3.3-2.56c-.91.61-2.08.97-3.38.97-2.6 0-4.8-1.76-5.59-4.12H3.01v2.64A10.08 10.08 0 0 0 12 22Z"
      />
      <path
        fill="#4A90E2"
        d="M6.41 13.86a6.08 6.08 0 0 1 0-3.72V7.5H3.01a10.01 10.01 0 0 0 0 9l3.4-2.64Z"
      />
      <path
        fill="#FBBC05"
        d="M12 6.02c1.49 0 2.82.51 3.86 1.51l2.89-2.89C17.01 2.98 14.72 2 12 2 8.09 2 4.72 4.24 3.01 7.5l3.4 2.64C7.2 7.78 9.4 6.02 12 6.02Z"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-slate-900" aria-hidden="true">
      <path d="M16.37 12.64c.02 2.34 2.05 3.11 2.07 3.12-.02.05-.32 1.12-1.06 2.22-.64.95-1.31 1.9-2.36 1.92-1.03.02-1.37-.61-2.56-.61-1.19 0-1.56.59-2.54.63-1.02.04-1.79-1.02-2.44-1.96-1.33-1.92-2.34-5.42-.98-7.78.68-1.17 1.89-1.92 3.2-1.94 1-.02 1.94.68 2.56.68.62 0 1.79-.84 3.02-.72.51.02 1.95.21 2.87 1.56-.07.04-1.72 1-1.7 2.88Zm-2.01-5.57c.54-.66.91-1.58.81-2.49-.78.03-1.72.52-2.28 1.18-.5.58-.94 1.51-.82 2.4.87.07 1.75-.44 2.29-1.09Z" />
    </svg>
  )
}

function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth)
  const params = new URLSearchParams(location.search)

  // Returning from the OTP screen via "Change" — prefill whichever value the
  // user already submitted so they aren't retyping it from scratch.
  const queryEmail = params.get('email') || ''
  const queryCountryIso = params.get('countryIso') || DEFAULT_COUNTRY_ISO
  const queryPhoneDigits = (() => {
    const raw = params.get('phone') || ''
    if (!raw) return ''
    const dialCode = getCountryByIso(queryCountryIso).code.replace(/\D/g, '')
    // `phone` arrives as dialCode + local number concatenated (no separator) —
    // strip the dial code so the input only shows the local digits.
    return raw.startsWith(dialCode) ? raw.slice(dialCode.length) : raw
  })()

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { email: queryEmail, phone: queryPhoneDigits },
  })
  const [oauthLoading, setOauthLoading] = useState(null)
  // Phone tab is the default per the new login design, unless the caller
  // asks for the email tab (e.g. returning from the email OTP screen).
  const [channel, setChannel] = useState(() =>
    new URLSearchParams(location.search).get('tab') === 'email' ? 'email' : 'whatsapp'
  )
  const [countryIso, setCountryIso] = useState(queryCountryIso)

  const target = params.get('target') === 'seller' ? 'seller' : 'buyer'
  // Set by the shared "Login Required" modal so guests land back on the page
  // (and protected action) they were on before being asked to log in. Persisted
  // to localStorage (like authTarget) so it survives the multi-step OTP/OAuth
  // hops that follow this page.
  const redirectParam = params.get('redirect')
  const redirectTo = redirectParam && redirectParam.startsWith('/') ? redirectParam : null

  useEffect(() => {
    localStorage.setItem('authTarget', target)
    localStorage.setItem('authRedirectTo', redirectTo || '')
    if (isAuthenticated) {
      navigate(redirectTo || (target === 'seller' ? '/post-ad' : '/dashboard/settings'))
    }
  }, [isAuthenticated, navigate, target, redirectTo])

  useEffect(() => {
    if (error) {
      const message = typeof error === 'string' ? error : error?.message
      if (message) toast.error(message)
      dispatch(clearError())
    }
  }, [error, dispatch])

  useEffect(() => {
    const oauthError = new URLSearchParams(location.search).get('oauthError')
    if (oauthError) {
      setOauthLoading(null)
      toast.error(decodeURIComponent(oauthError))
    }
  }, [location.search])

  const onSubmit = async (data) => {
    try {
      if (channel === 'whatsapp') {
        const phoneDigits = String(data.phone || '').replace(/\D/g, '')
        const dialCode = getCountryByIso(countryIso).code
        const fullPhone = phoneDigits ? `${dialCode}${phoneDigits}` : ''

        if (!phoneDigits) {
          toast.error('Mobile number is required')
          return
        }

        await dispatch(
          sendOtp({
            phone: fullPhone.replace(/\D/g, ''),
            phoneCountryCode: dialCode,
            phoneCountryIso: countryIso,
            mode: 'login',
            channel: 'whatsapp',
          })
        ).unwrap()
        toast.success('Sign-in code sent to your WhatsApp')

        const query = new URLSearchParams({
          phone: fullPhone.replace(/\D/g, ''),
          countryIso,
          mode: 'login',
          channel: 'whatsapp',
        })
        navigate(`/verify-phone-otp?${query.toString()}`)
        return
      }

      const email = data.email.trim()
      const result = await dispatch(emailStart({ email })).unwrap()
      toast.success(result?.message || 'Verification code sent to your email')
      if (result?.mode === 'signup') {
        // New user — created as U-XXXXXXXX. Run the email→mobile completion chain.
        navigate(`/verify-email-otp?email=${encodeURIComponent(email)}&flow=email-complete`)
      } else {
        navigate(`/verify-email-otp?email=${encodeURIComponent(email)}&mode=login&channel=email`)
      }
    } catch {
      // Error handled by useEffect
    }
  }

  const startSocialLogin = (provider) => {
    setOauthLoading(provider)
    const url = apiUrl(`/auth/oauth/${provider}?target=${encodeURIComponent(target)}`)
    window.location.href = url
  }

  // Apple runs in a popup and posts the identity token to the web-only
  // /auth/apple/web endpoint instead of leaving the page like Google's redirect
  // flow; the isAuthenticated effect above handles the navigation.
  const { startAppleSignIn } = useAppleSignIn({
    onStart: () => setOauthLoading('apple'),
    onFinish: () => setOauthLoading(null),
  })

  return (
    <AuthSplitLayout
      title="Login"
      subtitle={
        target === 'seller'
          ? 'Access your seller dashboard, manage listings, and reply to buyers without missing a step.'
          : 'Explore cars your way scroll effortlessly, discover the best deals, and drive home your perfect match.'
      }
      switchLabel="Continue as Guest"
      switchTo="/"
      switchArrow
      switchOnClick={() => dispatch(enterGuestMode())}
      quote="I found my perfect car in minutes. Scrolling through Preelly made the whole process effortless."
      quoteAuthor="Aarav Mehta"
      quoteRole="Car Buyer"
    >
      <div className="mb-6 grid grid-cols-2 rounded-xl border border-[#e7e9f2] bg-[#f4f5fb]">
        <button
          type="button"
          onClick={() => setChannel('whatsapp')}
          className={`rounded-s-xl px-4 py-3.5 text-sm font-semibold transition ${
            channel === 'whatsapp'
              ? 'bg-[#1400ff] text-white shadow-[0_8px_20px_rgba(20,0,255,0.25)]'
              : 'text-[#232388] hover:bg-white/70'
          }`}
        >
          Phone
        </button>
        <button
          type="button"
          onClick={() => setChannel('email')}
          className={`rounded-e-xl px-4 py-3.5 text-sm font-semibold transition ${
            channel === 'email'
              ? 'bg-[#1400ff] text-white shadow-[0_8px_20px_rgba(20,0,255,0.25)]'
              : 'text-[#232388] hover:bg-white/70'
          }`}
        >
          Email
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {channel === 'email' ? (
          <AuthField
            label="Email"
            type="email"
            icon={Mail}
            placeholder="Enter your email"
            error={errors.email?.message}
            {...register('email', {
              required: channel === 'email' ? 'Email is required' : false,
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
          />
        ) : (
          <AuthPhoneField
            label="Mobile Number"
            countryIso={countryIso}
            onCountryIsoChange={setCountryIso}
            placeholder="Phone number"
            error={errors.phone?.message}
            {...register('phone', {
              required: channel === 'whatsapp' ? 'Mobile number is required' : false,
              validate: (value) => {
                if (channel !== 'whatsapp') return true
                const digits = String(value || '').replace(/\D/g, '')
                return digits.length >= 6 || 'Please enter a valid mobile number'
              },
            })}
          />
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex h-14 w-full items-center justify-center rounded-full bg-[#1400ff] px-6 text-base font-medium text-white shadow-[0_18px_40px_rgba(20,0,255,0.25)] transition hover:bg-[#1000d6] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : channel === 'whatsapp' ? (
            'Continue with WhatsApp'
          ) : (
            'Continue with Email'
          )}
        </button>
      </form>

      <div className="mt-8">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-[#e7e9f2]" />
          <span className="text-sm font-medium uppercase tracking-[0.24em] text-slate-400">
            Or
          </span>
          <div className="h-px flex-1 bg-[#e7e9f2]" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <AuthSocialButton
            label="Continue with Google"
            onClick={() => startSocialLogin('google')}
            disabled={!!oauthLoading}
            active={oauthLoading === 'google'}
          >
            <GoogleIcon />
          </AuthSocialButton>
          <AuthSocialButton
            label="Continue with Apple"
            onClick={startAppleSignIn}
            disabled={!!oauthLoading}
            active={oauthLoading === 'apple'}
          >
            <AppleIcon />
          </AuthSocialButton>
        </div>
      </div>
    </AuthSplitLayout>
  )
}

export default LoginPage
