import { useCallback, useEffect, useState } from 'react'
import { adminService } from '../services/api'
import PageHeader from '../components/AdminUI/PageHeader'
import toast from 'react-hot-toast'
import { getMediaUrl } from '../utils/helpers'
import { CheckCircle2, XCircle, Eye, Loader2, ShieldCheck, Clock } from 'lucide-react'
import { EmiratesIdPreviewPanel, EmiratesIdThumbnailPair, EmiratesIdLightbox } from '../components/AdminUI/EmiratesIdPreview'

const STATUS_TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}

function ReviewModal({ user, onClose, onApprove, onReject, processing }) {
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  if (!user) return null

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    onReject(user._id, rejectReason.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{user.name}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <StatusBadge status={user.identityVerificationStatus} />
        </div>

        <div className="p-6 space-y-6">
          <EmiratesIdPreviewPanel
            front={user.emiratesIdFront}
            back={user.emiratesIdBack}
          />

          {user.identityVerificationSubmittedAt && (
            <p className="text-xs text-gray-500">
              Submitted: {new Date(user.identityVerificationSubmittedAt).toLocaleString()}
            </p>
          )}
          {user.identityVerificationRejectionReason && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">Rejection reason</p>
              <p className="text-sm text-red-600">{user.identityVerificationRejectionReason}</p>
            </div>
          )}

          {showRejectForm && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                Rejection reason <span className="font-normal text-gray-500">(sent to user by email)</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                required
                placeholder="Explain why the verification was rejected..."
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:bg-white transition"
          >
            Close
          </button>
          {user.identityVerificationStatus === 'pending' && (
            <>
              {!showRejectForm ? (
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  disabled={processing}
                  className="px-4 py-2 rounded-full border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={processing}
                  className="px-4 py-2 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50"
                >
                  Confirm Reject
                </button>
              )}
              <button
                type="button"
                onClick={() => onApprove(user._id)}
                disabled={processing}
                className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Approve Identity
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminIdentityVerificationPage() {
  const [verifications, setVerifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedUser, setSelectedUser] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [lightbox, setLightbox] = useState(null)

  const fetchVerifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminService.getIdentityVerifications({
        status: statusFilter,
        search: search || undefined,
        page,
        limit: 20,
      })
      setVerifications(res.data.verifications || [])
      setTotal(res.data.total || 0)
    } catch {
      toast.error('Failed to load verification requests')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search, page])

  useEffect(() => {
    fetchVerifications()
  }, [fetchVerifications])

  const handleApprove = async (userId) => {
    setProcessing(true)
    try {
      await adminService.approveIdentityVerification(userId)
      toast.success('User verified successfully')
      setSelectedUser(null)
      fetchVerifications()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to approve')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (userId, reason) => {
    setProcessing(true)
    try {
      await adminService.rejectIdentityVerification(userId, reason)
      toast.success('Verification rejected')
      setSelectedUser(null)
      fetchVerifications()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to reject')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Identity Verification"
        subtitle="Review Emirates ID submissions and approve or reject user verification"
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setStatusFilter(tab.key); setPage(1) }}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
              statusFilter === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="ml-auto rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 min-w-[220px]"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-3 text-gray-500 text-sm">Loading requests...</p>
          </div>
        ) : verifications.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No verification requests found</p>
          </div>
        ) : (
          <div className="divide-y">
            {verifications.map((user) => (
              <div key={user._id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  {user.avatar ? (
                    <img
                      src={getMediaUrl(user.avatar)}
                      alt={user.name}
                      className="w-11 h-11 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-blue-600 font-bold text-sm">{user.name?.[0]}</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">{user.name}</h3>
                      <StatusBadge status={user.identityVerificationStatus} />
                      {user.identityVerificationStatus === 'approved' && (
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-0.5">
                          <CheckCircle2 className="h-3 w-3" /> ID Verified
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    {user.identityVerificationSubmittedAt && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {new Date(user.identityVerificationSubmittedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                <EmiratesIdThumbnailPair
                  front={user.emiratesIdFront}
                  back={user.emiratesIdBack}
                  onPreview={(src, label) => setLightbox({ src, label })}
                />

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedUser(user)}
                    className="h-9 px-3 rounded-full flex items-center gap-1.5 border border-gray-200 text-sm text-gray-700 hover:bg-gray-100 transition"
                  >
                    <Eye className="h-4 w-4" />
                    Review
                  </button>
                  {user.identityVerificationStatus === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApprove(user._id)}
                        disabled={processing}
                        className="h-9 px-3 rounded-full flex items-center gap-1.5 bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedUser(user)}
                        disabled={processing}
                        className="h-9 px-3 rounded-full flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {total > 20 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 rounded-full border text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page}</span>
          <button
            type="button"
            disabled={page * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 rounded-full border text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {selectedUser && (
        <ReviewModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          processing={processing}
        />
      )}

      {lightbox && (
        <EmiratesIdLightbox
          src={lightbox.src}
          label={lightbox.label}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
