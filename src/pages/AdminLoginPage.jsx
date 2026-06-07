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
} from '../store/slices/authSlice'
import toast from 'react-hot-toast'
import { Mail, Shield, LogIn, ArrowLeft } from 'lucide-react'

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
      toast.error(error)
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
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 border-t-4 border-primary-600">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                <Shield className="h-7 w-7 text-primary-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Admin Login</h1>
            <p className="text-gray-600 text-sm">
              Sign in with your admin email. We will send you a one-time code.
            </p>
          </div>

          {step === 'email' ? (
            <form onSubmit={handleSubmit(onSendOtp)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                    className="input-field pl-10"
                    placeholder="admin@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary flex items-center justify-center space-x-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                aria-label="Send admin sign-in code"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Sending code...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    <span>Send Sign-In Code</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={onVerifyOtp} className="space-y-6">
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setOtp('')
                }}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter 6-digit code sent to {email}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={OTP_LENGTH}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                  className="input-field text-center text-xl tracking-[0.4em]"
                  placeholder="000000"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    <span>Verify & Sign In</span>
                  </>
                )}
              </button>
            </form>
          )}

          <p className="mt-4 text-xs text-gray-500 text-center">
            This area is restricted to authorized administrators only.
          </p>
        </div>
      </div>
    </div>
  )
}

export default AdminLoginPage
