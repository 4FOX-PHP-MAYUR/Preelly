import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { login, clearError } from '../store/slices/authSlice'
import toast from 'react-hot-toast'
import { Mail, Lock, LogIn } from 'lucide-react'

function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth)
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [oauthLoading, setOauthLoading] = useState(null)

  const params = new URLSearchParams(location.search)
  const target = params.get('target') === 'seller' ? 'seller' : 'buyer'

  useEffect(() => {
    localStorage.setItem('authTarget', target)
    if (isAuthenticated) {
      navigate(target === 'seller' ? '/post-ad' : '/')
    }
  }, [isAuthenticated, navigate, target])

  useEffect(() => {
    if (error) {
      toast.error(error)
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
      await dispatch(login(data)).unwrap()
      toast.success('Login successful!')
      navigate(target === 'seller' ? '/post-ad' : '/')
    } catch (error) {
      // Error handled by useEffect
    }
  }

  const startSocialLogin = (provider) => {
    setOauthLoading(provider)
    const url = `/api/auth/oauth/${provider}?target=${encodeURIComponent(target)}`
    window.location.href = url
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-gray-600">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email or Phone
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  {...register('email', {
                    required: 'Email or phone is required',
                  })}
                  className="input-field pl-10"
                  placeholder="Enter email or phone"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                  className="input-field pl-10"
                  placeholder="Enter password"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <span className="ml-2 text-sm text-gray-600">Remember me</span>
              </label>
              <Link
                to="#"
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="text-center text-sm text-gray-500 mb-3">
              Or continue with
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => startSocialLogin('google')}
                disabled={!!oauthLoading}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 flex items-center justify-center space-x-2"
              >
                <span className="font-semibold">Continue with Google</span>
              </button>
              <button
                type="button"
                onClick={() => startSocialLogin('facebook')}
                disabled={!!oauthLoading}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 flex items-center justify-center space-x-2"
              >
                <span className="font-semibold">Continue with Facebook</span>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary-600 hover:text-primary-700 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage

