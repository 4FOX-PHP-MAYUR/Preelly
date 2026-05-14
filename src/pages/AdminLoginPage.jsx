import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { login, clearError, logout, selectIsAuthenticated, selectUser } from '../store/slices/authSlice'
import toast from 'react-hot-toast'
import { Mail, Lock, Shield, LogIn } from 'lucide-react'

function AdminLoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading, error } = useSelector((state) => state.auth)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const user = useSelector(selectUser)
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [checkedInitially, setCheckedInitially] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reason') === 'session') {
      toast.error('Your session is no longer valid. Please sign in again.', {
        id: 'admin-session-expired',
      })
      navigate('/admin/login', { replace: true })
    }
  }, [navigate])

  // If already logged in as admin, go straight to admin dashboard
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

  const onSubmit = async (data) => {
    try {
      const result = await dispatch(login(data)).unwrap()

      if (result.user?.role !== 'admin') {
        // Immediately log out non-admins who try to use the admin login
        await dispatch(logout())
        toast.error('You are not authorized as an admin')
        return
      }

      toast.success('Admin login successful!')
      navigate('/admin')
    } catch (err) {
      // Error is handled by useEffect via authSlice
      console.error('Admin login error:', err)
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
              Sign in with your admin credentials to access the dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  {...register('email', {
                    required: 'Email is required',
                  })}
                  className="input-field pl-10"
                  placeholder="admin@example.com"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center space-x-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              aria-label="Sign in as admin"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  <span>Sign In as Admin</span>
                </>
              )}
            </button>

            <p className="mt-4 text-xs text-gray-500 text-center">
              This area is restricted to authorized administrators only.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AdminLoginPage


