import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  loginAdmin,
  clearAdminAuthError,
  selectIsAdminAuthenticated,
  selectAdminAuthLoading,
  selectAdminAuthError,
} from '../store/adminAuthSlice'
import toast from 'react-hot-toast'
import { Mail, Lock, LogIn } from 'lucide-react'
import Button from '../components/AdminUI/Button'
import Input from '../components/AdminUI/Input'
import Panel from '../components/AdminUI/Panel'
import BrandLogo from '@shared/components/BrandLogo'

function AdminLoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const loading = useSelector(selectAdminAuthLoading)
  const error = useSelector(selectAdminAuthError)
  const isAuthenticated = useSelector(selectIsAdminAuthenticated)
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [checkedInitially, setCheckedInitially] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reason') === 'session') {
      toast.error('Your session is no longer valid. Please sign in again.', {
        id: 'admin-session-expired',
      })
      navigate('/login', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    if (!checkedInitially) {
      if (isAuthenticated) navigate('/')
      setCheckedInitially(true)
    }
  }, [isAuthenticated, navigate, checkedInitially])

  useEffect(() => {
    if (error) {
      toast.error(error)
      dispatch(clearAdminAuthError())
    }
  }, [error, dispatch])

  const onSubmit = async (data) => {
    try {
      await dispatch(loginAdmin({ email: data.email.trim(), password: data.password })).unwrap()
      toast.success('Admin login successful!')
      navigate('/')
    } catch {
      // Error toast handled by the useEffect above
    }
  }

  return (
    <div className="admin-login-page">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <BrandLogo variant="light" className="h-10 w-auto mx-auto mb-6 dark:hidden" />
          <BrandLogo variant="dark" className="h-10 w-auto mx-auto mb-6 hidden dark:block" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Admin Console</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            Sign in with your admin email and password.
          </p>
        </div>

        <Panel className="border-t-4 border-t-primary-600">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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

            <Input
              label="Password"
              type="password"
              icon={Lock}
              placeholder="Enter your password"
              error={errors.password?.message}
              required
              {...register('password', { required: 'Password is required' })}
            />

            <Button type="submit" loading={loading} icon={LogIn} className="w-full" size="lg">
              Sign In
            </Button>
          </form>

          <p className="mt-5 text-xs text-slate-500 dark:text-slate-400 text-center">
            This area is restricted to authorized administrators only.
          </p>
        </Panel>
      </div>
    </div>
  )
}

export default AdminLoginPage
