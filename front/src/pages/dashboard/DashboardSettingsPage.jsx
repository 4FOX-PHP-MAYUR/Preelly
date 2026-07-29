import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { Mail, Phone, Pencil, ArrowLeft, Check, X } from 'lucide-react'
import VerificationFlow, { OtpVerificationCard } from '@shared/components/VerificationFlow'
import IdentityVerificationFlow, { IdentityVerificationCard } from '@shared/components/IdentityVerificationFlow'
import { refreshUser } from '@shared/store/slices/authSlice'
import SettingsPageShell from '../../components/Dashboard/SettingsPageShell'
import ChangeEmailFlow from '../../components/Profile/ChangeEmailFlow'
import ChangePhoneFlow from '../../components/Profile/ChangePhoneFlow'

const FIELD_BG =
  'flex items-center gap-3 rounded-[12px] border border-transparent bg-[#F3F5FB] px-4 py-3.5 transition duration-200 focus-within:border-brand/30 focus-within:ring-2 focus-within:ring-brand/10'

function EditableField({ label, icon: Icon, value, editing, draft, onDraftChange, onStartEdit, onSave, onCancel, type = 'text', inputMode }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-900">{label}</label>
      {editing ? (
        <div className={FIELD_BG}>
          <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input
            type={type}
            inputMode={inputMode}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            autoFocus
            aria-label={label}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none"
          />
          <button
            type="button"
            onClick={onSave}
            aria-label={`Save ${label}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-brand transition hover:bg-brand-50"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onCancel}
            aria-label={`Cancel ${label}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className={FIELD_BG}>
          <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{value || '—'}</span>
          <button
            type="button"
            onClick={onStartEdit}
            aria-label={`Edit ${label}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-brand transition duration-200 hover:bg-brand-50"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function DashboardSettingsPage() {
  const dispatch = useDispatch()
  const currentUser = useSelector((s) => s.auth.user)

  const [showIdentityVerification, setShowIdentityVerification] = useState(false)
  const [showOtpVerification, setShowOtpVerification] = useState(false)
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [showChangePhone, setShowChangePhone] = useState(false)

  // Email and mobile are both changed through their OTP flows, which own the
  // toasts — this only refreshes the cached user afterwards.
  const handleContactChanged = async () => {
    try {
      await dispatch(refreshUser()).unwrap()
    } catch {
      // the flow already surfaced the error
    }
  }

  return (
    <SettingsPageShell>
      <div className="mx-auto max-w-2xl pb-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Privacy and Security</h1>
            <p className="mt-1 text-sm text-slate-500">Resume your ads journey from here</p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand transition duration-200 hover:text-brand-700 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="space-y-5">
          <EditableField
            label="Email"
            icon={Mail}
            value={currentUser?.email}
            editing={false}
            draft={currentUser?.email || ''}
            onDraftChange={() => {}}
            type="email"
            onStartEdit={() => setShowChangeEmail(true)}
            onSave={() => {}}
            onCancel={() => {}}
          />

          <EditableField
            label="Mobile Number"
            icon={Phone}
            value={currentUser?.phone}
            editing={false}
            draft={currentUser?.phone || ''}
            onDraftChange={() => {}}
            type="tel"
            inputMode="tel"
            onStartEdit={() => setShowChangePhone(true)}
            onSave={() => {}}
            onCancel={() => {}}
          />
        </div>

        <div className="my-8 border-t border-[#E5E7EB]" />

        <section>
          <h2 className="mb-1 text-base font-bold text-slate-900">Verification</h2>
          <p className="mb-4 text-sm text-slate-500">
            Complete OTP and Emirates ID verification to secure your account.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OtpVerificationCard onOpenFlow={() => setShowOtpVerification(true)} />
            <IdentityVerificationCard onOpenFlow={() => setShowIdentityVerification(true)} />
          </div>
        </section>
      </div>

      {showIdentityVerification && (
        <IdentityVerificationFlow onClose={() => setShowIdentityVerification(false)} />
      )}
      {showOtpVerification && (
        <VerificationFlow onClose={() => setShowOtpVerification(false)} />
      )}
      <ChangeEmailFlow
        open={showChangeEmail}
        onClose={() => setShowChangeEmail(false)}
        onSuccess={handleContactChanged}
      />
      <ChangePhoneFlow
        open={showChangePhone}
        onClose={() => setShowChangePhone(false)}
        onSuccess={handleContactChanged}
      />
    </SettingsPageShell>
  )
}
