import { useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Mail } from 'lucide-react'
import { clearError, emailAttach } from '@shared/store/slices/authSlice'
import AuthSplitLayout, { AuthField } from '../components/Auth/AuthSplitLayout'

// Phone→email completion: a user who signed in with their mobile number but has
// no linked email must add + verify an email before reaching Home.
function CompleteEmailPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [submitting, setSubmitting] = useState(false)

  const phone = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('phone') || ''
  }, [location.search])

  useEffect(() => {
    if (!phone) {
      toast.error('Mobile number is missing. Please sign in again.')
      navigate('/login')
    }
  }, [phone, navigate])

  const onSubmit = async (data) => {
    const email = String(data.email || '').trim()
    if (!email) {
      toast.error('Email is required')
      return
    }
    setSubmitting(true)
    try {
      const result = await dispatch(emailAttach({ phone, email })).unwrap()
      toast.success('Verification code sent to your email')
      navigate(`/verify-email-otp?email=${encodeURIComponent(result?.email || email)}&flow=email-complete`)
    } catch (err) {
      toast.error(typeof err === 'string' ? err : err?.message || 'Unable to send verification code')
      dispatch(clearError())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthSplitLayout
      modeLabel="Almost there"
      title="Add your email"
      subtitle="Verify your email to finish setting up your account and continue."
      quote="I found my perfect car in minutes. Scrolling through Preelly made the whole process effortless."
      quoteAuthor="Aarav Mehta"
      quoteRole="Car Buyer"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <AuthField
          label="Email"
          type="email"
          icon={Mail}
          placeholder="Enter your email"
          error={errors.email?.message}
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
          })}
        />

        <button
          type="submit"
          disabled={submitting}
          className="flex h-14 w-full items-center justify-center rounded-full bg-[#1400ff] px-6 text-base font-medium text-white shadow-[0_18px_40px_rgba(20,0,255,0.25)] transition hover:bg-[#1000d6] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            'Send email code'
          )}
        </button>
      </form>
    </AuthSplitLayout>
  )
}

export default CompleteEmailPage
