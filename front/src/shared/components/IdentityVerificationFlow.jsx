import { useState, useRef } from 'react'
import { Upload, Loader2, CheckCircle2, Clock, AlertCircle, CreditCard } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { selectUser, refreshUser } from '../store/slices/authSlice'
import { userService } from '../services/api'
import { getMediaUrl } from '../utils/helpers'
import toast from 'react-hot-toast'
import {
  VerificationModalShell,
  VerificationIntroBody,
  VerificationMethodCard,
  VerificationPrimaryButton,
  VerificationOutlineButton,
  VERIFY_BLUE,
} from './verification/VerificationModalShared'

function IdUploadZone({ label, preview, onFileSelect }) {
  const inputRef = useRef(null)

  return (
    <div className="space-y-2">
      <p className="text-[14px] font-semibold text-gray-800">{label}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl border-2 border-dashed p-4 flex flex-col items-center gap-2 min-h-[120px] justify-center transition hover:opacity-90"
        style={{ borderColor: '#C7D7FF', backgroundColor: '#FAFBFF' }}
      >
        {preview ? (
          <img src={preview} alt={label} className="max-h-24 rounded-lg object-contain" />
        ) : (
          <>
            <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EEF4FF' }}>
              <Upload className="h-5 w-5" style={{ color: VERIFY_BLUE }} />
            </div>
            <span className="text-xs text-gray-500">Tap to upload photo</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelect(file)
        }}
      />
    </div>
  )
}

function UploadStep({ onSubmit, submitting }) {
  const [frontFile, setFrontFile] = useState(null)
  const [backFile, setBackFile] = useState(null)
  const [frontPreview, setFrontPreview] = useState(null)
  const [backPreview, setBackPreview] = useState(null)

  const handleFile = (side, file) => {
    const preview = URL.createObjectURL(file)
    if (side === 'front') {
      setFrontFile(file)
      setFrontPreview(preview)
    } else {
      setBackFile(file)
      setBackPreview(preview)
    }
  }

  const handleSubmit = () => {
    if (!frontFile || !backFile) {
      toast.error('Please upload both front and back of your Emirates ID')
      return
    }
    onSubmit(frontFile, backFile)
  }

  return (
    <div className="px-6 pb-7 pt-2 space-y-4">
      <div
        className="rounded-xl border-2 border-dashed p-4"
        style={{ borderColor: '#C7D7FF', backgroundColor: '#EEF4FF' }}
      >
        <p className="text-[14px] font-bold text-gray-900 mb-1">Please select an option</p>
        <p className="text-[12px] text-gray-500 leading-relaxed">
          Upload clear photos of your Emirates ID (front and back). Our admin team will review your documents.
        </p>
      </div>

      <VerificationMethodCard
        icon={CreditCard}
        title="Verify via Emirates ID"
        description="Upload front and back photos of your Emirates ID for identity verification."
        selected
        onClick={() => {}}
      />

      <IdUploadZone label="Emirates ID (Front)" preview={frontPreview} onFileSelect={(f) => handleFile('front', f)} />
      <IdUploadZone label="Emirates ID (Back)" preview={backPreview} onFileSelect={(f) => handleFile('back', f)} />

      <VerificationPrimaryButton onClick={handleSubmit} disabled={submitting}>
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
          </span>
        ) : (
          'Submit for Review'
        )}
      </VerificationPrimaryButton>
    </div>
  )
}

function PendingStep({ onClose }) {
  return (
    <div className="flex flex-col items-center text-center px-6 pb-7 pt-2 space-y-4">
      <div className="h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center">
        <Clock className="h-10 w-10 text-amber-500" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-bold text-gray-900">Under Review</p>
        <p className="text-sm text-gray-500 leading-relaxed">
          Your Emirates ID has been submitted. Our team will review it shortly.
        </p>
      </div>
      <VerificationPrimaryButton onClick={onClose}>Done</VerificationPrimaryButton>
    </div>
  )
}

function RejectedStep({ reason, onRetry, onClose }) {
  return (
    <div className="flex flex-col items-center text-center px-6 pb-7 pt-2 space-y-4">
      <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center">
        <AlertCircle className="h-10 w-10 text-red-500" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-bold text-gray-900">Verification Rejected</p>
        <p className="text-sm text-gray-500 leading-relaxed">
          {reason || 'Please upload clearer photos and try again.'}
        </p>
      </div>
      <div className="flex items-center gap-3 w-full">
        <VerificationOutlineButton onClick={onClose}>Close</VerificationOutlineButton>
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 py-3 rounded-full text-[14px] font-bold text-white hover:opacity-90"
          style={{ backgroundColor: VERIFY_BLUE }}
        >
          Try Again
        </button>
      </div>
    </div>
  )
}

function SuccessStep({ onClose }) {
  return (
    <div className="flex flex-col items-center text-center px-6 pb-7 pt-2 space-y-4">
      <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-bold text-gray-900">Identity Verified!</p>
        <p className="text-sm text-gray-500 leading-relaxed">
          Your Emirates ID has been approved. You&apos;ll see the verified badge on your profile.
        </p>
      </div>
      <VerificationPrimaryButton onClick={onClose}>Done</VerificationPrimaryButton>
    </div>
  )
}

export default function IdentityVerificationFlow({ onClose }) {
  const dispatch = useDispatch()
  const user = useSelector(selectUser)
  const status = user?.identityVerificationStatus || 'none'

  const initialStep =
    status === 'approved' ? 'success'
    : status === 'pending' ? 'pending'
    : status === 'rejected' ? 'rejected'
    : 'intro'

  const [step, setStep] = useState(initialStep)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (frontFile, backFile) => {
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('emiratesIdFront', frontFile)
      formData.append('emiratesIdBack', backFile)
      await userService.submitIdentityVerification(formData)
      await dispatch(refreshUser()).unwrap()
      toast.success('Verification submitted successfully')
      setStep('pending')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit verification')
    } finally {
      setSubmitting(false)
    }
  }

  const TITLES = {
    intro: 'Get Verified On Preelly',
    upload: 'Verify Your Identity',
    pending: 'Identity Review Pending',
    rejected: 'Verification Rejected',
    success: 'Identity Verified',
  }

  return (
    <VerificationModalShell
      title={TITLES[step]}
      onClose={onClose}
      backLabel={step === 'upload' ? '← Back' : null}
      onBack={step === 'upload' ? () => setStep('intro') : null}
    >
      {step === 'intro' && (
        <VerificationIntroBody
          onClose={onClose}
          onContinue={() => setStep('upload')}
          subtitle="Upload your Emirates ID to get the identity verified badge on your profile."
          continueLabel="Get Verified"
        />
      )}
      {step === 'upload' && (
        <UploadStep onSubmit={handleSubmit} submitting={submitting} />
      )}
      {step === 'pending' && <PendingStep onClose={onClose} />}
      {step === 'rejected' && (
        <RejectedStep
          reason={user?.identityVerificationRejectionReason}
          onRetry={() => setStep('upload')}
          onClose={onClose}
        />
      )}
      {step === 'success' && <SuccessStep onClose={onClose} />}
    </VerificationModalShell>
  )
}

export function IdentityVerificationCard({ onOpenFlow }) {
  const user = useSelector(selectUser)
  const status = user?.identityVerificationStatus || 'none'
  const identityVerified = status === 'approved'

  return (
    <div
      className="rounded-3xl border p-6 shadow-sm"
      style={{ borderColor: '#C7D7FF', backgroundColor: '#FAFBFF' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-4 w-4" style={{ color: VERIFY_BLUE }} />
            <h2 className="text-base font-bold text-gray-900">Emirates ID Verification</h2>
          </div>
          <p className="text-sm text-gray-500">
            Upload your Emirates ID for admin review. This gives you the identity verified badge on your profile.
          </p>
          {status === 'pending' && (
            <p className="text-xs text-amber-600 font-medium mt-2 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Under admin review
            </p>
          )}
          {status === 'rejected' && (
            <p className="text-xs text-red-600 font-medium mt-2">
              Rejected: {user?.identityVerificationRejectionReason || 'Please resubmit clearer photos'}
            </p>
          )}
        </div>
        {identityVerified ? (
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            ID Verified
          </span>
        ) : status === 'pending' ? (
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold shrink-0">
            <Clock className="h-4 w-4" />
            ID Pending
          </span>
        ) : (
          <button
            type="button"
            onClick={onOpenFlow}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-white text-sm font-semibold transition shrink-0 hover:opacity-90"
            style={{ backgroundColor: VERIFY_BLUE }}
          >
            Get Verified
          </button>
        )}
      </div>
      {(user?.emiratesIdFront || user?.emiratesIdBack) && status !== 'none' && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
          {user.emiratesIdFront && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Front</p>
              <img
                src={getMediaUrl(user.emiratesIdFront)}
                alt="Emirates ID front"
                className="w-full h-24 object-cover rounded-lg border border-gray-200"
              />
            </div>
          )}
          {user.emiratesIdBack && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Back</p>
              <img
                src={getMediaUrl(user.emiratesIdBack)}
                alt="Emirates ID back"
                className="w-full h-24 object-cover rounded-lg border border-gray-200"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
