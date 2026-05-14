import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { MapPin, Phone, Save, User } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { userService } from '../../services/api'
import { refreshUser } from '../../store/slices/authSlice'
import { getMediaUrl } from '../../utils/helpers'

function toDateInputValue(d) {
  try {
    if (!d) return ''
    const date = d instanceof Date ? d : new Date(d)
    if (Number.isNaN(date.getTime())) return ''
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

export default function DashboardSettingsPage() {
  const dispatch = useDispatch()
  const currentUser = useSelector((s) => s.auth.user)

  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [gender, setGender] = useState('prefer_not_to_say')
  const [dob, setDob] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [locationSource, setLocationSource] = useState('manual')
  const [profilePicFile, setProfilePicFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)

  useEffect(() => {
    setName(currentUser?.name || '')
    setDisplayName(currentUser?.displayName || '')
    setGender(currentUser?.gender || 'prefer_not_to_say')
    setDob(toDateInputValue(currentUser?.dob))
    setAddressLine1(currentUser?.address?.line1 || '')
    setAddressLine2(currentUser?.address?.line2 || '')
    setPostalCode(currentUser?.address?.postalCode || '')
    setCountry(currentUser?.address?.country || '')
    setPhone(currentUser?.phone || '')
    setCity(currentUser?.location?.city || '')
  }, [currentUser])

  useEffect(() => {
    if (!profilePicFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(profilePicFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [profilePicFile])

  const detectLocation = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation not supported in this browser')
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
        toast.error(err?.message || 'Failed to detect location')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    )
  }

  const save = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      // 1) Update name/phone (JSON)
      await userService.updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        displayName: displayName.trim(),
        gender,
        dob: dob || null,
        address: {
          line1: addressLine1.trim(),
          line2: addressLine2.trim(),
          postalCode: postalCode.trim(),
          country: country.trim(),
        },
      })

      // 2) Update location + avatar (multipart) using the profile setup endpoint (works with local storage)
      const fd = new FormData()
      fd.append('name', name.trim())
      if (displayName.trim()) fd.append('displayName', displayName.trim())
      if (gender) fd.append('gender', gender)
      if (dob) fd.append('dob', dob)
      if (addressLine1.trim()) fd.append('addressLine1', addressLine1.trim())
      if (addressLine2.trim()) fd.append('addressLine2', addressLine2.trim())
      if (postalCode.trim()) fd.append('postalCode', postalCode.trim())
      if (country.trim()) fd.append('country', country.trim())
      if (city.trim()) fd.append('city', city.trim())
      if (lat != null) fd.append('lat', String(lat))
      if (lng != null) fd.append('lng', String(lng))
      fd.append('locationSource', locationSource)
      if (profilePicFile) fd.append('profilePic', profilePicFile)
      await userService.completeBasicProfile(fd)

      await dispatch(refreshUser()).unwrap()
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Account</div>
        <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</div>
      </div>

      <form onSubmit={save} className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-900 overflow-hidden flex items-center justify-center">
            {previewUrl || currentUser?.avatar ? (
              <img src={previewUrl || getMediaUrl(currentUser.avatar) || currentUser.avatar} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="h-7 w-7 text-gray-500 dark:text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Profile image</div>
            <div className="mt-2">
              <input type="file" accept="image/*" onChange={(e) => setProfilePicFile(e.target.files?.[0] || null)} disabled={saving} />
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">JPG/PNG up to 10MB.</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field pl-9 dark:bg-gray-950 dark:text-gray-100 dark:border-gray-900"
                placeholder="Your name"
                required
                disabled={saving}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field pl-9 dark:bg-gray-950 dark:text-gray-100 dark:border-gray-900"
                placeholder="+971..."
                disabled={saving}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-field dark:bg-gray-950 dark:text-gray-100 dark:border-gray-900"
              placeholder="How you want to appear"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="input-field dark:bg-gray-950 dark:text-gray-100 dark:border-gray-900"
              disabled={saving}
            >
              <option value="prefer_not_to_say">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date of birth</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="input-field dark:bg-gray-950 dark:text-gray-100 dark:border-gray-900"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address line 1</label>
            <input
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className="input-field dark:bg-gray-950 dark:text-gray-100 dark:border-gray-900"
              placeholder="Street / building"
              disabled={saving}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address line 2</label>
            <input
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              className="input-field dark:bg-gray-950 dark:text-gray-100 dark:border-gray-900"
              placeholder="Apartment / area (optional)"
              disabled={saving}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Postal code</label>
              <input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="input-field dark:bg-gray-950 dark:text-gray-100 dark:border-gray-900"
                placeholder="Optional"
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Country</label>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="input-field dark:bg-gray-950 dark:text-gray-100 dark:border-gray-900"
                placeholder="Optional"
                disabled={saving}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-900 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <MapPin className="h-4 w-4" /> Location
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <button
              type="button"
              onClick={detectLocation}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 text-sm"
              disabled={saving || detecting}
            >
              {detecting ? 'Detecting…' : 'Auto-detect'}
            </button>
            <div className="flex-1">
              <input
                value={city}
                onChange={(e) => {
                  setCity(e.target.value)
                  setLocationSource('manual')
                }}
                className="input-field dark:bg-gray-950 dark:text-gray-100 dark:border-gray-900"
                placeholder="City"
                disabled={saving}
              />
            </div>
          </div>
          {lat != null && lng != null ? (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Coordinates: {lat.toFixed(5)}, {lng.toFixed(5)}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end">
          <button type="submit" className="btn-primary inline-flex items-center gap-2 px-5" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

