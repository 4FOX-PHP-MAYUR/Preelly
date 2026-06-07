import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Mail,
  Phone,
  Pencil,
  ArrowLeft,
  Fingerprint,
  MapPin,
  Plus,
  Trash2,
  Star,
} from 'lucide-react'
import { userService } from '../../services/api'
import LocationDetailsModal from '../../components/LocationDetailsModal'
import VerificationFlow, { OtpVerificationCard } from '../../components/VerificationFlow'
import IdentityVerificationFlow, { IdentityVerificationCard } from '../../components/IdentityVerificationFlow'
import { refreshUser } from '../../store/slices/authSlice'

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function FieldBox({ icon: Icon, value, onEdit, masked }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
      {Icon && <Icon className="h-4 w-4 text-gray-400 shrink-0" />}
      <span className="flex-1 text-sm text-gray-700 truncate">
        {masked ? '•'.repeat(12) : (value || '—')}
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-indigo-500 hover:text-indigo-700 transition"
        title="Edit"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  )
}

const SOCIAL_PROVIDERS = [
  {
    key: 'facebook',
    label: 'Facebook',
    field: 'facebookProviderId',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 40 40">
        <rect width="40" height="40" rx="10" fill="#1877F2" />
        <path
          fill="white"
          d="M26 20h-4v14h-5V20h-3v-5h3v-2.5C17 9.9 18.9 8 22.4 8H26v5h-2.2c-.8 0-1.8.4-1.8 1.5V15H26l-.5 5z"
        />
      </svg>
    ),
  },
  {
    key: 'instagram',
    label: 'Instagram',
    field: 'instagramProviderId',
    usernameField: 'instagramUsername',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 40 40">
        <defs>
          <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f9ce34" />
            <stop offset="50%" stopColor="#ee2a7b" />
            <stop offset="100%" stopColor="#6228d7" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="10" fill="url(#ig-grad)" />
        <rect x="12" y="12" width="16" height="16" rx="5" fill="none" stroke="white" strokeWidth="2" />
        <circle cx="20" cy="20" r="4" fill="none" stroke="white" strokeWidth="2" />
        <circle cx="26.5" cy="13.5" r="1.5" fill="white" />
      </svg>
    ),
  },
]

export default function DashboardSettingsPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = useSelector((s) => s.auth.user)

  const [editingField, setEditingField] = useState(null) // 'email' | 'phone'
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [linkingProvider, setLinkingProvider] = useState(null)

  // Location state
  const [locations, setLocations] = useState([])
  const [locationModal, setLocationModal] = useState(null) // null | { mode: 'add' } | { mode: 'edit', data: loc }

  useEffect(() => {
    userService.getLocations()
      .then((res) => setLocations(res?.data?.locations || []))
      .catch(() => {})
  }, [])

  const handleAddLocation = async (data) => {
    const res = await userService.addLocation(data)
    setLocations((prev) => [...prev, res.data.location])
    toast.success('Location added')
  }

  const handleUpdateLocation = async (data) => {
    const id = locationModal?.data?._id
    const res = await userService.updateLocation(id, data)
    setLocations((prev) => prev.map((l) => (l._id === id ? res.data.location : l)))
    toast.success('Location updated')
  }

  const handleDeleteLocation = async (id) => {
    if (!window.confirm('Delete this location?')) return
    try {
      await userService.deleteLocation(id)
      setLocations((prev) => prev.filter((l) => l._id !== id))
      toast.success('Location deleted')
    } catch {
      toast.error('Failed to delete location')
    }
  }
  const [biometrics, setBiometrics] = useState(() => localStorage.getItem('biometricsEnabled') === 'true')
  const [saving, setSaving] = useState(false)
  const [showIdentityVerification, setShowIdentityVerification] = useState(false)
  const [showOtpVerification, setShowOtpVerification] = useState(false)

  useEffect(() => {
    setEmail(currentUser?.email || '')
    setPhone(currentUser?.phone || '')
  }, [currentUser])

  useEffect(() => {
    localStorage.setItem('biometricsEnabled', biometrics)
  }, [biometrics])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const linked = params.get('socialLinked')
    const socialError = params.get('socialError')

    if (linked) {
      dispatch(refreshUser())
        .unwrap()
        .then(() => toast.success(`${linked.charAt(0).toUpperCase()}${linked.slice(1)} account linked`))
        .catch(() => toast.success('Social account linked'))
      setLinkingProvider(null)
      navigate('/dashboard/settings', { replace: true })
    } else if (socialError) {
      toast.error(decodeURIComponent(socialError))
      setLinkingProvider(null)
      navigate('/dashboard/settings', { replace: true })
    }
  }, [location.search, dispatch, navigate])

  const cancelEdit = () => {
    setEditingField(null)
    setEmail(currentUser?.email || '')
    setPhone(currentUser?.phone || '')
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      if (editingField === 'email') {
        if (!email.trim() || !email.includes('@')) { toast.error('Enter a valid email'); setSaving(false); return }
        await userService.updateProfile({ email: email.trim() })
        await dispatch(refreshUser()).unwrap()
        toast.success('Email updated')
      } else if (editingField === 'phone') {
        await userService.updateProfile({ phone: phone.trim() })
        await dispatch(refreshUser()).unwrap()
        toast.success('Mobile number updated')
      } else {
        await userService.updateProfile({ biometricsEnabled: biometrics })
        toast.success('Settings saved')
      }
      setEditingField(null)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const unlinkSocial = async (provider) => {
    if (!window.confirm(`Unlink your ${provider} account?`)) return
    try {
      await userService.unlinkSocial(provider)
      await dispatch(refreshUser()).unwrap()
      toast.success(`${provider} account unlinked`)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to unlink')
    }
  }

  const linkSocial = (provider) => {
    setLinkingProvider(provider)
    userService.linkSocial(provider)
  }

  return (
    <div className="max-w-3xl">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Privacy and Security</h1>
          <p className="text-sm text-gray-500 mt-1">Update your communication details here</p>
        </div>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-indigo-600 hover:text-indigo-800 transition whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          BACK TO HOME
        </Link>
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        {/* Email */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-800">Email</label>
          {editingField === 'email' ? (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              className="w-full rounded-2xl border border-indigo-300 bg-white px-4 py-3 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
          ) : (
            <FieldBox icon={Mail} value={currentUser?.email} onEdit={() => setEditingField('email')} />
          )}
        </div>

        {/* Mobile Number */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-800">Mobile Number</label>
          {editingField === 'phone' ? (
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
              className="w-full rounded-2xl border border-indigo-300 bg-white px-4 py-3 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
          ) : (
            <FieldBox icon={Phone} value={currentUser?.phone} onEdit={() => setEditingField('phone')} />
          )}
        </div>

        {/* Biometrics */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-800">Enable Biometrics</label>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
            <Fingerprint className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="flex-1 text-sm text-gray-500">
              {biometrics ? 'Fingerprint / Face ID enabled' : 'Disabled'}
            </span>
            <Toggle checked={biometrics} onChange={setBiometrics} />
          </div>
        </div>
      </div>

      {/* Verification — OTP and Emirates ID are separate */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-1">Verification</h2>
        <p className="text-sm text-gray-500 mb-4">
          Account OTP verification and Emirates ID identity verification are separate steps.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OtpVerificationCard onOpenFlow={() => setShowOtpVerification(true)} />
          <IdentityVerificationCard onOpenFlow={() => setShowIdentityVerification(true)} />
        </div>
      </div>

      {/* Social Account */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-1">Social Account</h2>
        <p className="text-sm text-gray-500 mb-5">
          Below are the platforms where your account is currently linked. You can unlink any account at any time using the button provided.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SOCIAL_PROVIDERS.map(({ key, label, field, usernameField, icon }) => {
            const linked = field ? Boolean(currentUser?.[field]) : false
            const username = usernameField ? currentUser?.[usernameField] : null
            const isLinking = linkingProvider === key
            return (
              <div key={key} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4">
                {icon}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm text-gray-800">{label}</span>
                  {linked && username && (
                    <p className="text-xs text-gray-500 truncate">@{username}</p>
                  )}
                  {linked && !username && (
                    <p className="text-xs text-emerald-600">Connected</p>
                  )}
                  {!linked && (
                    <p className="text-xs text-gray-400">Not connected</p>
                  )}
                </div>
                {linked ? (
                  <button
                    type="button"
                    onClick={() => unlinkSocial(key)}
                    className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition shrink-0"
                  >
                    Unlink
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => linkSocial(key)}
                    disabled={isLinking}
                    className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition shrink-0 disabled:opacity-60"
                  >
                    {isLinking ? 'Linking…' : 'Link account'}
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Saved Locations */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Saved Locations</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage your delivery and pickup addresses</p>
          </div>
          <button
            type="button"
            onClick={() => setLocationModal({ mode: 'add' })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
          >
            <Plus className="h-4 w-4" />
            Add Location
          </button>
        </div>

        {locations.length === 0 ? (
          <div
            onClick={() => setLocationModal({ mode: 'add' })}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 py-10 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 transition group"
          >
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center transition">
              <MapPin className="h-6 w-6 text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700">No saved locations yet</p>
              <p className="text-xs text-gray-400 mt-0.5">Tap to add your first address</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <div
                key={loc._id}
                className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 hover:border-indigo-200 transition group"
              >
                <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{loc.label}</span>
                    {loc.isDefault && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold">
                        <Star className="h-2.5 w-2.5" /> Default
                      </span>
                    )}
                  </div>
                  {loc.building && <p className="text-xs text-gray-600 mt-0.5 truncate">{loc.building}</p>}
                  {loc.city && <p className="text-xs text-gray-400 truncate">{loc.city}</p>}
                  {loc.apartment && <p className="text-xs text-gray-400">{loc.apartment}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={() => setLocationModal({ mode: 'edit', data: loc })}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteLocation(loc._id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Location Details Modal */}
      {locationModal && (
        <LocationDetailsModal
          onClose={() => setLocationModal(null)}
          initialData={locationModal.mode === 'edit' ? locationModal.data : undefined}
          onSave={locationModal.mode === 'edit' ? handleUpdateLocation : handleAddLocation}
        />
      )}

      {showIdentityVerification && (
        <IdentityVerificationFlow onClose={() => setShowIdentityVerification(false)} />
      )}

      {showOtpVerification && (
        <VerificationFlow onClose={() => setShowOtpVerification(false)} />
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="px-16 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60 transition shadow-sm"
        >
          {saving ? 'Saving…' : 'Submit'}
        </button>
        {editingField && (
          <button
            type="button"
            onClick={cancelEdit}
            className="px-6 py-3 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
