import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { userService } from '../services/api'
import { refreshUser } from '../store/slices/authSlice'
import { getMediaUrl } from '../utils/helpers'

const CITY_OPTIONS = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Ras Al Khaimah',
  'Fujairah',
  'Umm Al Quwain',
]

function toDateInputValue(d) {
  try {
    if (!d) return ''
    const date = d instanceof Date ? d : new Date(d)
    if (Number.isNaN(date.getTime())) return ''
    // yyyy-mm-dd in local time
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

function getTargetFromLocation(location) {
  const params = new URLSearchParams(location.search)
  const q = params.get('target')
  if (q === 'seller') return 'seller'
  if (q === 'buyer') return 'buyer'
  const stored = localStorage.getItem('authTarget')
  return stored === 'seller' ? 'seller' : 'buyer'
}

function ProfileSetupPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useSelector((state) => state.auth)

  const target = useMemo(() => getTargetFromLocation(location), [location])

  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [gender, setGender] = useState('prefer_not_to_say')
  const [dob, setDob] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [locationSource, setLocationSource] = useState('manual')
  const [profilePicFile, setProfilePicFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [detecting, setDetecting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // If user already completed profile, never show this page again.
  useEffect(() => {
    if (user?.isProfileComplete) {
      navigate('/welcome', { replace: true })
    }
  }, [user?.isProfileComplete, navigate, target])

  useEffect(() => {
    setName(user?.name || '')
    setDisplayName(user?.displayName || '')
    setGender(user?.gender || 'prefer_not_to_say')
    setDob(toDateInputValue(user?.dob))
    setAddressLine1(user?.address?.line1 || '')
    setAddressLine2(user?.address?.line2 || '')
    setPostalCode(user?.address?.postalCode || '')
    setCountry(user?.address?.country || '')
    setCity(user?.location?.city || '')
  }, [user])

  useEffect(() => {
    if (!profilePicFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(profilePicFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [profilePicFile])

  const redirectAfterComplete = () => {
    navigate('/welcome', { replace: true })
  }

  const onDetectLocation = () => {
    setError(null)
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported in this browser.')
      return
    }
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetecting(false)
        setLocationSource('geolocation')
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        toast.success('Location detected')
      },
      (err) => {
        setDetecting(false)
        setError(err?.message || 'Failed to detect location')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    )
  }

  const submit = async ({ skip } = { skip: false }) => {
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData()
      if (skip) formData.append('skip', '1')
      if (name) formData.append('name', name)
      if (displayName) formData.append('displayName', displayName)
      if (gender) formData.append('gender', gender)
      if (dob) formData.append('dob', dob)
      if (addressLine1) formData.append('addressLine1', addressLine1)
      if (addressLine2) formData.append('addressLine2', addressLine2)
      if (postalCode) formData.append('postalCode', postalCode)
      if (country) formData.append('country', country)
      if (city) formData.append('city', city)
      if (lat != null) formData.append('lat', String(lat))
      if (lng != null) formData.append('lng', String(lng))
      if (locationSource) formData.append('locationSource', locationSource)
      if (profilePicFile) formData.append('profilePic', profilePicFile)

      await userService.completeBasicProfile(formData)
      await dispatch(refreshUser()).unwrap()
      toast.success(skip ? 'Skipped profile setup' : 'Profile saved')
      redirectAfterComplete()
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to save profile'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Basic Profile Setup</h1>
            <p className="text-gray-600">Help others trust you with a complete profile.</p>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit({ skip: false })
            }}
            className="space-y-6"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="Enter your name"
                required
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field"
                placeholder="How you want to appear"
                disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="input-field"
                  disabled={submitting}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date of birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="input-field"
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
              <input
                type="text"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="input-field"
                placeholder="Street / Building"
                disabled={submitting}
              />
              <input
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                className="input-field mt-3"
                placeholder="Apartment / Area (optional)"
                disabled={submitting}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="input-field"
                  placeholder="Postal code (optional)"
                  disabled={submitting}
                />
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="input-field"
                  placeholder="Country (optional)"
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile picture (optional)</label>
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
                  {previewUrl || user?.avatar ? (
                    <img
                      src={previewUrl || getMediaUrl(user.avatar) || user.avatar}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-400 text-sm">No photo</span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProfilePicFile(e.target.files?.[0] || null)}
                    disabled={submitting}
                  />
                  <p className="mt-2 text-xs text-gray-500">JPG/PNG up to 10MB.</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={onDetectLocation}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
                  disabled={submitting || detecting}
                >
                  {detecting ? 'Detecting location…' : 'Auto-detect using GPS'}
                </button>

                <div className="text-center text-xs text-gray-500">OR</div>

                <div>
                  <input
                    list="city-options"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value)
                      setLocationSource('manual')
                    }}
                    className="input-field"
                    placeholder="Select or type your city"
                    disabled={submitting}
                  />
                  <datalist id="city-options">
                    {CITY_OPTIONS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                {lat != null && lng != null ? (
                  <div className="text-xs text-gray-500">
                    Detected coordinates: {lat.toFixed(5)}, {lng.toFixed(5)}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => submit({ skip: true })}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                disabled={submitting}
              >
                Skip
              </button>

              <button
                type="submit"
                className="btn-primary px-6 disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ProfileSetupPage

