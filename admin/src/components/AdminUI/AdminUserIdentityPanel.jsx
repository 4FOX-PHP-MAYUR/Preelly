import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import { EmiratesIdPreviewPanel } from './EmiratesIdPreview'
import toast from 'react-hot-toast'
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Clock, ShieldCheck } from 'lucide-react'

function StatusPill({ status }) {
  const styles = {
    none: 'bg-gray-100 text-gray-600',
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
  }
  const labels = {
    none: 'Not submitted',
    pending: 'Pending review',
    approved: 'ID Verified',
    rejected: 'Rejected',
  }
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.none}`}>
      {labels[status] || status}
    </span>
  )
}

export default function AdminUserIdentityPanel({ userId, userName, onStatusChange }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const loadIdentity = async () => {
    setLoading(true)
    try {
      const res = await adminService.getIdentityVerification(userId)
      setUser(res.data.user)
    } catch (err) {
      if (err?.response?.status === 404) {
        setUser({ identityVerificationStatus: 'none', emiratesIdFront: null, emiratesIdBack: null })
      } else {
        toast.error('Failed to load identity verification')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userId) loadIdentity()
  }, [userId])

  const handleApprove = async () => {
    setProcessing(true)
    try {
      await adminService.approveIdentityVerification(userId)
      toast.success(`${userName || 'User'} identity verified`)
      setShowRejectForm(false)
      setRejectReason('')
      await loadIdentity()
      onStatusChange?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to approve')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please enter a rejection reason')
      return
    }
    setProcessing(true)
    try {
      await adminService.rejectIdentityVerification(userId, rejectReason.trim())
      toast.success('Identity verification rejected')
      setShowRejectForm(false)
      setRejectReason('')
      await loadIdentity()
      onStatusChange?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to reject')
    } finally {
      setProcessing(false)
    }
  }

  const status = user?.identityVerificationStatus || 'none'
  const hasImages = user?.emiratesIdFront || user?.emiratesIdBack

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Link
            to="/admin?tab=users"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Link>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">Emirates ID Verification</h2>
          </div>
        </div>
        {!loading && <StatusPill status={status} />}
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading verification data…
          </div>
        ) : !hasImages && status === 'none' ? (
          <p className="text-sm text-gray-500 py-4">This user has not submitted Emirates ID documents yet.</p>
        ) : (
          <>
            <EmiratesIdPreviewPanel front={user.emiratesIdFront} back={user.emiratesIdBack} />

            {user.identityVerificationSubmittedAt && (
              <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Submitted: {new Date(user.identityVerificationSubmittedAt).toLocaleString()}
              </p>
            )}

            {user.identityVerificationRejectionReason && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-100 p-3">
                <p className="text-xs font-semibold text-red-700 mb-1">Rejection reason</p>
                <p className="text-sm text-red-600">{user.identityVerificationRejectionReason}</p>
              </div>
            )}

            {showRejectForm && (
              <div className="mt-4 space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  Rejection reason <span className="font-normal text-gray-500">(sent to user by email)</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="Explain why the ID was rejected…"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
              </div>
            )}

            {status === 'pending' && (
              <div className="flex flex-wrap items-center gap-3 mt-6 pt-4 border-t border-gray-100">
                {!showRejectForm ? (
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(true)}
                    disabled={processing}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject ID
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { setShowRejectForm(false); setRejectReason('') }}
                      className="px-4 py-2.5 rounded-full border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={processing}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      Confirm Reject
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={processing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 ml-auto"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Verify ID
                </button>
              </div>
            )}

            {status === 'approved' && (
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-semibold">This user&apos;s Emirates ID is verified.</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
