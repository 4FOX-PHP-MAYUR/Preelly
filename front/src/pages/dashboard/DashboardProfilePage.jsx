import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Plus,
  User,
} from 'lucide-react'
import { userService } from '@shared/services/api'
import { refreshUser } from '@shared/store/slices/authSlice'
import { getMediaUrl } from '@shared/utils/helpers'
import LocationDetailsModal from '../../components/LocationDetailsModal'
import VerificationFlow from '@shared/components/VerificationFlow'
import IdentityVerificationFlow from '@shared/components/IdentityVerificationFlow'
import SettingsPageShell from '../../components/Dashboard/SettingsPageShell'
import FormInput from '../../components/Profile/FormInput'
import SectionHeader from '../../components/Profile/SectionHeader'
import ProfileHeaderCard from '../../components/Profile/ProfileHeaderCard'
import AddressCard from '../../components/Profile/AddressCard'
import BankCard from '../../components/Profile/BankCard'
import SavedCard from '../../components/Profile/SavedCard'
import NationalitySelect from '../../components/Profile/NationalitySelect'
import BankAccountModal from '../../components/Profile/BankAccountModal'
import SavedCardModal from '../../components/Profile/SavedCardModal'

function splitName(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function toDateInputValue(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function toDisplayDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function SoftButton({ children, onClick, className = '', type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 rounded-[12px] border border-brand/20 bg-brand-50 px-4 py-3.5 text-sm font-semibold text-brand transition duration-200 hover:bg-brand-100 active:scale-[0.99] ${className}`}
    >
      {children}
    </button>
  )
}

export default function DashboardProfilePage() {
  const dispatch = useDispatch()
  const location = useLocation()
  const currentUser = useSelector((s) => s.auth.user)

  const initialNames = useMemo(() => splitName(currentUser?.name), [currentUser?.name])

  const [firstName, setFirstName] = useState(initialNames.firstName)
  const [lastName, setLastName] = useState(initialNames.lastName)
  const [dob, setDob] = useState(toDateInputValue(currentUser?.dob))
  const [nationality, setNationality] = useState(currentUser?.address?.country || '')
  const [gender, setGender] = useState(currentUser?.gender || '')
  const [customGender, setCustomGender] = useState('')
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [primaryLoadingId, setPrimaryLoadingId] = useState(null)

  const [locations, setLocations] = useState([])
  const [locationModal, setLocationModal] = useState(null)
  const [bankAccounts, setBankAccounts] = useState([])
  const [savedCards, setSavedCards] = useState([])
  const [bankModal, setBankModal] = useState(null)
  const [cardModal, setCardModal] = useState(null)

  const [showOtpVerification, setShowOtpVerification] = useState(false)
  const [showIdentityVerification, setShowIdentityVerification] = useState(false)

  useEffect(() => {
    const names = splitName(currentUser?.name)
    setFirstName(names.firstName)
    setLastName(names.lastName)
    setDob(toDateInputValue(currentUser?.dob))
    setNationality(currentUser?.address?.country || '')
    setGender(currentUser?.gender || '')
    setCustomGender(currentUser?.genderCustom || '')
  }, [currentUser])

  useEffect(() => {
    userService
      .getLocations()
      .then((res) => setLocations(res?.data?.locations || []))
      .catch(() => {})
    userService
      .getBankAccounts()
      .then((res) => setBankAccounts(res?.data?.bankAccounts || []))
      .catch(() => {})
    userService
      .getSavedCards()
      .then((res) => setSavedCards(res?.data?.savedCards || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const hash = location.hash?.replace('#', '')
    if (!hash) return
    const el = document.getElementById(hash)
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [location.hash, locations.length, bankAccounts.length, savedCards.length])

  const avatarSrc = currentUser?.avatar ? getMediaUrl(currentUser.avatar) || currentUser.avatar : null
  const displayName = currentUser?.displayName || currentUser?.name || 'User'
  const isVerified = Boolean(
    currentUser?.isVerified ||
      currentUser?.identityVerificationStatus === 'approved'
  )

  const handleAvatarChange = async (file) => {
    if (!file) return
    setAvatarUploading(true)
    try {
      const formData = new FormData()
      formData.append('name', currentUser?.name || `${firstName} ${lastName}`.trim() || 'User')
      formData.append('profilePic', file)
      await userService.completeBasicProfile(formData)
      await dispatch(refreshUser()).unwrap()
      toast.success('Profile photo updated')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update photo')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    const fullName = `${firstName} ${lastName}`.trim()
    if (!fullName) {
      toast.error('Please enter your name')
      return
    }

    let nextGender = gender
    if (gender === 'other' && customGender.trim()) {
      nextGender = 'other'
    }
    if (nextGender && !['male', 'female', 'other', 'prefer_not_to_say'].includes(nextGender)) {
      toast.error('Invalid gender')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: fullName,
        displayName: fullName,
        address: {
          ...(currentUser?.address || {}),
          country: nationality || null,
        },
        genderCustom: nextGender === 'other' ? (customGender.trim() || null) : null,
      }
      if (nextGender) payload.gender = nextGender
      if (dob) payload.dob = dob

      await userService.updateProfile(payload)
      await dispatch(refreshUser()).unwrap()
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleAddLocation = async (data) => {
    const res = await userService.addLocation(data)
    setLocations((prev) => [...prev, res.data.location])
    toast.success('Address added')
  }

  const handleUpdateLocation = async (data) => {
    const id = locationModal?.data?._id
    const res = await userService.updateLocation(id, data)
    setLocations((prev) => prev.map((l) => (l._id === id ? res.data.location : l)))
    toast.success('Address updated')
  }

  const handleDeleteLocation = async (loc) => {
    if (!window.confirm('Delete this address?')) return
    try {
      await userService.deleteLocation(loc._id)
      setLocations((prev) => prev.filter((l) => l._id !== loc._id))
      toast.success('Address deleted')
    } catch {
      toast.error('Failed to delete address')
    }
  }

  const handleTogglePrimaryLocation = async (loc) => {
    if (loc.isDefault) return
    setPrimaryLoadingId(loc._id)
    try {
      const res = await userService.updateLocation(loc._id, { isDefault: true })
      setLocations((prev) =>
        prev.map((l) =>
          l._id === loc._id
            ? res.data.location
            : { ...l, isDefault: false }
        )
      )
      toast.success('Primary address updated')
    } catch {
      toast.error('Failed to update primary address')
    } finally {
      setPrimaryLoadingId(null)
    }
  }

  const handleAddBank = async (data) => {
    const res = await userService.addBankAccount(data)
    setBankAccounts((prev) => {
      const next = data.isPrimary ? prev.map((a) => ({ ...a, isPrimary: false })) : prev
      return [...next, res.data.bankAccount]
    })
    toast.success('Bank account added')
  }

  const handleUpdateBank = async (data) => {
    const id = bankModal?.data?._id
    const res = await userService.updateBankAccount(id, data)
    setBankAccounts((prev) =>
      prev.map((a) => {
        if (a._id === id) return res.data.bankAccount
        if (data.isPrimary) return { ...a, isPrimary: false }
        return a
      })
    )
    toast.success('Bank account updated')
  }

  const handleDeleteBank = async (account) => {
    if (!window.confirm('Delete this bank account?')) return
    try {
      await userService.deleteBankAccount(account._id)
      setBankAccounts((prev) => prev.filter((a) => a._id !== account._id))
      toast.success('Bank account deleted')
    } catch {
      toast.error('Failed to delete bank account')
    }
  }

  const handleTogglePrimaryBank = async (account) => {
    if (account.isPrimary) return
    setPrimaryLoadingId(account._id)
    try {
      const res = await userService.updateBankAccount(account._id, { isPrimary: true })
      setBankAccounts((prev) =>
        prev.map((a) =>
          a._id === account._id ? res.data.bankAccount : { ...a, isPrimary: false }
        )
      )
      toast.success('Primary bank account updated')
    } catch {
      toast.error('Failed to update primary bank account')
    } finally {
      setPrimaryLoadingId(null)
    }
  }

  const handleAddCard = async (data) => {
    const res = await userService.addSavedCard(data)
    setSavedCards((prev) => {
      const next = data.isPrimary ? prev.map((c) => ({ ...c, isPrimary: false })) : prev
      return [...next, res.data.savedCard]
    })
  }

  const handleUpdateCard = async (data) => {
    const id = cardModal?.data?._id
    const res = await userService.updateSavedCard(id, data)
    setSavedCards((prev) =>
      prev.map((c) => {
        if (c._id === id) return res.data.savedCard
        if (data.isPrimary) return { ...c, isPrimary: false }
        return c
      })
    )
  }

  const handleDeleteCard = async (card) => {
    if (!window.confirm('Delete this card?')) return
    try {
      await userService.deleteSavedCard(card._id)
      setSavedCards((prev) => prev.filter((c) => c._id !== card._id))
      toast.success('Card deleted')
    } catch {
      toast.error('Failed to delete card')
    }
  }

  const handleTogglePrimaryCard = async (card) => {
    if (card.isPrimary) return
    setPrimaryLoadingId(card._id)
    try {
      const res = await userService.updateSavedCard(card._id, { isPrimary: true })
      setSavedCards((prev) =>
        prev.map((c) =>
          c._id === card._id ? res.data.savedCard : { ...c, isPrimary: false }
        )
      )
      toast.success('Primary card updated')
    } catch {
      toast.error('Failed to update primary card')
    } finally {
      setPrimaryLoadingId(null)
    }
  }

  return (
    <SettingsPageShell>
      <div className="mx-auto max-w-3xl pb-10">
        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">My Profile</h1>
            <p className="mt-1 text-sm text-slate-500">Update your profile details here.</p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand transition duration-200 hover:text-brand-700 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        {/* Profile summary */}
        <div className="mb-8 space-y-3">
          <ProfileHeaderCard
            avatarSrc={avatarSrc}
            displayName={displayName}
            joinedAt={currentUser?.memberSince || currentUser?.createdAt}
            updatedAt={currentUser?.updatedAt || currentUser?.memberSince || currentUser?.createdAt}
            isVerified={isVerified}
            avatarUploading={avatarUploading}
            onAvatarChange={handleAvatarChange}
            onGetVerified={() => setShowIdentityVerification(true)}
          />
          {currentUser?.identityVerificationStatus && currentUser.identityVerificationStatus !== 'none' ? (
            <div className="rounded-[12px] border border-[#E5E7EB] bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Verification status:{' '}
              <span className="font-semibold capitalize text-slate-900">
                {currentUser.identityVerificationStatus === 'approved'
                  ? 'Verified'
                  : currentUser.identityVerificationStatus === 'pending'
                    ? 'Under Review'
                    : currentUser.identityVerificationStatus}
              </span>
            </div>
          ) : null}
        </div>

        {/* Profile Name */}
        <section className="mb-8">
          <SectionHeader
            title="Profile Name"
            description="This name will appear on your profile and listings."
          />
          <div className="space-y-3">
            <FormInput
              icon={User}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              autoComplete="given-name"
            />
            <FormInput
              icon={User}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              autoComplete="family-name"
            />
          </div>
        </section>

        {/* Account Details */}
        <section className="mb-8">
          <SectionHeader
            title="Account Details"
            description="Share a few personal details to personalize your experience."
          />
          <div className="space-y-3">
            <div className="relative">
              <FormInput
                icon={Calendar}
                type="text"
                value={toDisplayDate(dob)}
                placeholder="DD/MM/YYYY"
                readOnly
                aria-label="Date of birth"
                className="pointer-events-none"
              />
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                aria-label="Select date of birth"
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>
            <NationalitySelect value={nationality} onChange={setNationality} />
          </div>
        </section>

        {/* Gender */}
        <section className="mb-8">
          <SectionHeader
            title="Gender"
            description="Select the option that best describes you."
          />
          <div className="flex flex-wrap items-center gap-6">
            {[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'other', label: 'Other' },
            ].map((option) => (
              <label
                key={option.value}
                className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-700"
              >
                <input
                  type="radio"
                  name="gender"
                  value={option.value}
                  checked={gender === option.value}
                  onChange={() => {
                    setGender(option.value)
                    if (option.value !== 'other') setCustomGender('')
                  }}
                  className="h-4 w-4 border-[#E5E7EB] text-brand focus:ring-brand/30"
                />
                {option.label}
              </label>
            ))}
          </div>

          {gender === 'other' ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="shrink-0 text-sm font-medium text-slate-500">Or</span>
              <FormInput
                value={customGender}
                onChange={(e) => setCustomGender(e.target.value)}
                placeholder="Define your self"
                className="flex-1"
              />
            </div>
          ) : null}
        </section>

        {/* Address */}
        <section id="address" className="mb-8 scroll-mt-6">
          <SectionHeader
            title="Address"
            description="Manage your delivery and pickup addresses."
          />
          <div className="space-y-3">
            {locations.length === 0 ? (
              <div
                onClick={() => setLocationModal({ mode: 'add' })}
                onKeyDown={(e) => e.key === 'Enter' && setLocationModal({ mode: 'add' })}
                role="button"
                tabIndex={0}
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed border-[#E5E7EB] py-10 transition duration-200 hover:border-brand/40 hover:bg-brand-50/40"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand">
                  <MapPin className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">No saved addresses yet</p>
                  <p className="mt-0.5 text-xs text-slate-400">Tap to add your first address</p>
                </div>
              </div>
            ) : (
              locations.map((loc) => (
                <AddressCard
                  key={loc._id}
                  location={loc}
                  primaryLoading={primaryLoadingId === loc._id}
                  onEdit={(item) => setLocationModal({ mode: 'edit', data: item })}
                  onDelete={handleDeleteLocation}
                  onTogglePrimary={handleTogglePrimaryLocation}
                />
              ))
            )}
            <SoftButton onClick={() => setLocationModal({ mode: 'add' })}>
              <Plus className="h-4 w-4" />
              Add New Address
            </SoftButton>
          </div>
        </section>

        {/* Bank Details */}
        <section id="bank-details" className="mb-8 scroll-mt-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[#111827]">Bank Details</h2>
            <p className="mt-1 text-sm text-[#9CA3AF]">Please review the details</p>
          </div>

          <div className="space-y-4">
            {bankAccounts.map((account) => (
              <BankCard
                key={account._id}
                account={account}
                primaryLoading={primaryLoadingId === account._id}
                onEdit={(item) => setBankModal({ mode: 'edit', data: item })}
                onDelete={handleDeleteBank}
                onTogglePrimary={handleTogglePrimaryBank}
              />
            ))}

            {savedCards.map((card) => (
              <SavedCard
                key={card._id}
                card={card}
                primaryLoading={primaryLoadingId === card._id}
                onEdit={(item) => setCardModal({ mode: 'edit', data: item })}
                onDelete={handleDeleteCard}
                onTogglePrimary={handleTogglePrimaryCard}
              />
            ))}

            {bankAccounts.length === 0 && savedCards.length === 0 ? (
              <p className="py-2 text-sm text-[#9CA3AF]">No bank accounts or cards saved yet.</p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setBankModal({ mode: 'add' })}
                className="flex w-full items-center justify-center rounded-full bg-[#E8F0FE] px-4 py-3.5 text-sm font-semibold text-brand transition duration-200 hover:bg-[#DCE8FC] active:scale-[0.99]"
              >
                Add New Bank Account
              </button>
              <button
                type="button"
                onClick={() => setCardModal({ mode: 'add' })}
                className="flex w-full items-center justify-center rounded-full bg-[#E8F0FE] px-4 py-3.5 text-sm font-semibold text-brand transition duration-200 hover:bg-[#DCE8FC] active:scale-[0.99]"
              >
                Add New Card
              </button>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={saving}
            className="min-h-[48px] rounded-[12px] bg-brand px-10 py-3 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => setShowIdentityVerification(true)}
            className="min-h-[48px] rounded-[12px] border border-[#E5E7EB] px-6 py-3 text-sm font-semibold text-slate-700 transition duration-200 hover:border-brand hover:text-brand"
          >
            Verify Identity
          </button>
        </div>
      </div>

      {locationModal && (
        <LocationDetailsModal
          onClose={() => setLocationModal(null)}
          initialData={locationModal.mode === 'edit' ? locationModal.data : undefined}
          onSave={locationModal.mode === 'edit' ? handleUpdateLocation : handleAddLocation}
        />
      )}

      {bankModal && (
        <BankAccountModal
          onClose={() => setBankModal(null)}
          initialData={bankModal.mode === 'edit' ? bankModal.data : undefined}
          onSave={bankModal.mode === 'edit' ? handleUpdateBank : handleAddBank}
        />
      )}

      {cardModal && (
        <SavedCardModal
          onClose={() => setCardModal(null)}
          initialData={cardModal.mode === 'edit' ? cardModal.data : undefined}
          onSave={cardModal.mode === 'edit' ? handleUpdateCard : handleAddCard}
        />
      )}

      {showOtpVerification && (
        <VerificationFlow onClose={() => setShowOtpVerification(false)} />
      )}

      {showIdentityVerification && (
        <IdentityVerificationFlow onClose={() => setShowIdentityVerification(false)} />
      )}
    </SettingsPageShell>
  )
}
