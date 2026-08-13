import { useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { clearError, mobileAttach } from '@shared/store/slices/authSlice'
import AuthSplitLayout, { AuthPhoneField } from '../components/Auth/AuthSplitLayout'
import { DEFAULT_COUNTRY_ISO, getCountryByIso } from '@shared/data/countryCodes'

// Email→mobile completion: a newly auto-created (U-XXXXXXXX) user has verified
// their email and must now add + verify a mobile number before reaching Home.
function CompleteMobilePage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO)
  const [submitting, setSubmitting] = useState(false)

  const email = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('email') || ''
  }, [location.search])

  useEffect(() => {
    if (!email) {
      toast.error('Email is missing. Please sign in again.')
      navigate('/login')
    }
  }, [email, navigate])

  const onSubmit = async (data) => {
    const phoneDigits = String(data.phone || '').replace(/\D/g, '')
    if (!phoneDigits) {
      toast.error('Mobile number is required')
      return
    }
    const dialCode = getCountryByIso(countryIso).code
    // Send the full international number (country code + local digits), matching
    // the Phone-tab login flow, so WhatsApp delivery + storage include the code.
    const fullPhone = `${dialCode}${phoneDigits}`.replace(/\D/g, '')
    setSubmitting(true)
    try {
      const result = await dispatch(
        mobileAttach({
          email,
          phone: fullPhone,
          phoneCountryCode: dialCode,
          phoneCountryIso: countryIso,
        })
      ).unwrap()
      toast.success('Verification code sent to your WhatsApp')
      const query = new URLSearchParams({
        phone: result?.phone || fullPhone,
        countryIso,
        flow: 'mobile-complete',
      })
      navigate(`/verify-phone-otp?${query.toString()}`)
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
      title="Add your mobile number"
      subtitle="Verify your mobile number via WhatsApp to finish setting up your account."
      quote="I found my perfect car in minutes. Scrolling through Preelly made the whole process effortless."
      quoteAuthor="Aarav Mehta"
      quoteRole="Car Buyer"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <AuthPhoneField
          label="Mobile Number"
          countryIso={countryIso}
          onCountryIsoChange={setCountryIso}
          placeholder="Enter your mobile number"
          error={errors.phone?.message}
          {...register('phone', {
            required: 'Mobile number is required',
            validate: (value) => {
              const digits = String(value || '').replace(/\D/g, '')
              return digits.length >= 6 || 'Please enter a valid mobile number'
            },
          })}
        />

        <button
          type="submit"
          disabled={submitting}
          className="flex h-14 w-full items-center justify-center rounded-full bg-brand px-6 text-base font-medium text-white shadow-[0_18px_40px_rgba(0,0,255,0.25)] transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            'Send WhatsApp code'
          )}
        </button>
      </form>
    </AuthSplitLayout>
  )
}

export default CompleteMobilePage
