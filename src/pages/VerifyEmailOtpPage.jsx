import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Mail, Shield, RotateCcw } from 'lucide-react'
import { clearError, sendEmailOtp, verifyEmailOtp } from '../store/slices/authSlice'

function VerifyEmailOtpPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { loading, error, user } = useSelector((state) => state.auth)

  const queryEmail = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('email') || ''
  }, [location.search])

  const [email, setEmail] = useState(queryEmail)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm()

  useEffect(() => {
    setEmail(queryEmail)
  }, [queryEmail])

  useEffect(() => {
    if (error) {
      toast.error(error)
      dispatch(clearError())
    }
  }, [error, dispatch])

  useEffect(() => {
    if (user?.isVerified) {
      navigate('/dashboard')
    }
  }, [user, navigate])

  useEffect(() => {
    if (!email) {
      toast.error('Email is missing. Please sign up again.')
      navigate('/signup')
    }
  }, [email, navigate])

  const onVerify = async (data) => {
    try {
      await dispatch(verifyEmailOtp({ email, otp: data.otp })).unwrap()
      toast.success('Email verified successfully!')
    } catch {
      // Error handled by useEffect
    }
  }

  const onResend = async () => {
    try {
      await dispatch(sendEmailOtp({ email })).unwrap()
      toast.success('New verification code sent to your email.')
    } catch {
      // Error handled by useEffect
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify Email</h1>
            <p className="text-gray-600 text-sm">
              Enter the OTP sent to your email address to activate your account.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-10"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <form onSubmit={handleSubmit(onVerify)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">OTP Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="input-field"
                  placeholder="Enter 6-digit OTP"
                  {...register('otp', {
                    required: 'OTP is required',
                    pattern: {
                      value: /^\d{6}$/,
                      message: 'OTP must be 6 digits',
                    },
                  })}
                />
                {errors.otp && <p className="mt-1 text-sm text-red-600">{errors.otp.message}</p>}
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
                    <span>Verify OTP</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={onResend}
                  disabled={loading}
                  className="text-primary-600 hover:text-primary-700 font-medium flex items-center space-x-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Resend OTP
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  className="text-gray-500 hover:text-gray-700 font-medium"
                >
                  Edit Email
                </button>
              </div>
            </form>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Didn&apos;t get the email? You can resend the code.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VerifyEmailOtpPage

