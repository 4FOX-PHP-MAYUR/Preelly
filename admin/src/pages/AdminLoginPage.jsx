import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  sendOtp,
  verifyOtp,
  clearError,
  logout,
  selectIsAuthenticated,
  selectUser,
} from '@shared/store/slices/authSlice'
import toast from 'react-hot-toast'
import { Mail, Shield, LogIn, ArrowLeft } from 'lucide-react'
import Button from '../components/AdminUI/Button'
import Input from '../components/AdminUI/Input'
import Panel from '../components/AdminUI/Panel'
import BrandLogo from '@shared/components/BrandLogo'

const OTP_LENGTH = 6

function AdminLoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading, error } = useSelector((state) => state.auth)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [checkedInitially, setCheckedInitially] = useState(false)
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reason') === 'session') {
      toast.error('Your session is no longer valid. Please sign in again.', {
        id: 'admin-session-expired',
      })
      navigate('/admin/login', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    if (!checkedInitially) {
      if (isAuthenticated && user?.role === 'admin') {
        navigate('/admin')
      }
      setCheckedInitially(true)
    }
  }, [isAuthenticated, user, navigate, checkedInitially])

  useEffect(() => {
    if (error) {
      const message = typeof error === 'string' ? error : error?.message
      if (message) toast.error(message)
      dispatch(clearError())
    }
  }, [error, dispatch])

  const onSendOtp = async (data) => {
    try {
      const normalizedEmail = data.email.trim()
      await dispatch(sendOtp({ email: normalizedEmail })).unwrap()
      setEmail(normalizedEmail)
      setStep('otp')
      toast.success('Sign-in code sent to your email')
    } catch {
      // Error handled by useEffect
    }
  }

  const onVerifyOtp = async (event) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(otp)) {
      toast.error('Please enter the 6-digit code')
      return
    }

    try {
      const result = await dispatch(verifyOtp({ email, otp })).unwrap()

      if (result.user?.role !== 'admin') {
        await dispatch(logout('user-click'))
        toast.error('You are not authorized as an admin')
        setStep('email')
        setOtp('')
        return
      }

      toast.success('Admin login successful!')
      navigate('/admin')
    } catch {
      // Error handled by useEffect
    }
  }

  return (
    <div className="admin-login-page">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <BrandLogo variant="light" className="h-10 w-auto mx-auto mb-6 dark:hidden" />
          <BrandLogo variant="dark" className="h-10 w-auto mx-auto mb-6 hidden dark:block" />
          <div className="inline-flex h-14 w-14 rounded-2xl bg-primary-100 dark:bg-primary-900/40 items-center justify-center mb-4">
            <Shield className="h-7 w-7 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Admin Console</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            Sign in with your admin email. We will send you a one-time code.
          </p>
        </div>

        <Panel className="border-t-4 border-t-primary-600">
          {step === 'email' ? (
            <form onSubmit={handleSubmit(onSendOtp)} className="space-y-5">
              <Input
                label="Admin Email"
                type="email"
                icon={Mail}
                placeholder="admin@example.com"
                error={errors.email?.message}
                required
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
              />

              <Button type="submit" loading={loading} icon={LogIn} className="w-full" size="lg">
                Send Sign-In Code
              </Button>
            </form>
          ) : (
            <form onSubmit={onVerifyOtp} className="space-y-5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={ArrowLeft}
                onClick={() => {
                  setStep('email')
                  setOtp('')
                }}
              >
                Back
              </Button>

              <Input
                label={`Enter 6-digit code sent to ${email}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={OTP_LENGTH}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                inputClassName="text-center text-xl tracking-[0.4em]"
                placeholder="000000"
              />

              <Button type="submit" loading={loading} icon={LogIn} className="w-full" size="lg">
                Verify & Sign In
              </Button>
            </form>
          )}

          <p className="mt-5 text-xs text-slate-500 dark:text-slate-400 text-center">
            This area is restricted to authorized administrators only.
          </p>
        </Panel>
      </div>
    </div>
  )
}

export default AdminLoginPage
