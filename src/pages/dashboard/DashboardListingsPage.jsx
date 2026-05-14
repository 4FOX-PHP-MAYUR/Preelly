import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, Edit3, Filter, Loader2, Search, Tag, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { productService, userService } from '../../services/api'
import { getMediaUrl } from '../../utils/helpers'

function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-8 text-center">
      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</div>
      <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{body}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

function StatusPill({ status, moderationStatus }) {
  const effective = moderationStatus || status
  const s = String(effective || '').toLowerCase()
  const cls =
    s === 'approved' || s === 'active'
      ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300'
      : s === 'sold'
      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300'
      : s === 'pending'
      ? 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300'
      : s === 'rejected'
        ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
      : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300'

  const label =
    s === 'approved' || s === 'active'
      ? 'Approved'
      : s === 'pending'
        ? 'Pending'
        : s === 'rejected'
          ? 'Rejected'
          : s
  return <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${cls}`}>{label || 'unknown'}</span>
}

export default function DashboardListingsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [busyId, setBusyId] = useState(null)

  const fetchListings = async (nextPage = page, { silent } = { silent: false }) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await userService.getListings({ page: nextPage, limit: 12, q: q || undefined, status: status || undefined })
      setItems(res.data.items || [])
      setPage(res.data.page || nextPage)
      setTotalPages(res.data.totalPages || 1)
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load listings')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchListings(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSearch = (e) => {
    e.preventDefault()
    fetchListings(1)
  }

  const onDelete = async (id) => {
    if (!window.confirm('Delete this listing? This cannot be undone.')) return
    setBusyId(id)
    try {
      await productService.deleteProduct(id)
      toast.success('Listing deleted')
      await fetchListings(1, { silent: true })
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to delete')
    } finally {
      setBusyId(null)
    }
  }

  const onMarkSold = async (item) => {
    setBusyId(item._id)
    try {
      await productService.updateProduct(item._id, { status: 'sold' })
      toast.success('Marked as sold')
      await fetchListings(page, { silent: true })
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to update status')
    } finally {
      setBusyId(null)
    }
  }

  const onResubmit = async (item) => {
    setBusyId(item._id)
    try {
      await productService.resubmitProduct(item._id)
      toast.success('Resubmitted for review')
      await fetchListings(page, { silent: true })
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to resubmit')
    } finally {
      setBusyId(null)
    }
  }

  const filtersBar = (
    <form onSubmit={onSearch} className="flex flex-col lg:flex-row gap-3 lg:items-center">
      <div className="flex-1 relative">
        <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input-field pl-9 dark:bg-gray-950 dark:text-gray-100 dark:border-gray-900"
          placeholder="Search title or description…"
        />
      </div>
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="input-field dark:bg-gray-950 dark:text-gray-100 dark:border-gray-900"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="sold">Sold</option>
          <option value="inactive">Inactive</option>
          <option value="rejected">Rejected</option>
        </select>
        <button type="submit" className="btn-primary px-4">
          Apply
        </button>
      </div>
    </form>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Seller</div>
          <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">My Listings</div>
        </div>
        <Link to="/post-ad" className="btn-primary inline-flex items-center gap-2 justify-center">
          <Tag className="h-4 w-4" />
          Post new listing
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-4">
        {filtersBar}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 p-4 animate-pulse h-56" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No listings yet"
          body="Post your first product to start selling."
          action={
            <Link to="/post-ad" className="btn-primary inline-flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Post a listing
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((p) => {
              const img = p.video ? null : p.images?.[0]
              const mediaSrc = img ? getMediaUrl(img) || img : p.video ? getMediaUrl(p.video) : null
              return (
                <div key={p._id} className="rounded-2xl border border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-950 overflow-hidden">
                  <div className="h-40 bg-gray-100 dark:bg-gray-900">
                    {p.video ? (
                      <video className="h-full w-full object-cover" src={mediaSrc} muted playsInline />
                    ) : mediaSrc ? (
                      <img src={mediaSrc} alt={p.title} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{p.title}</div>
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          {p.currency || 'USD'} {Number(p.price || 0).toLocaleString()}
                        </div>
                      </div>
                      <StatusPill status={p.status} moderationStatus={p.moderationStatus} />
                    </div>

                    {p.status === 'rejected' && p.rejectionReason ? (
                      <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-2">
                        {p.rejectionReason}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/products/${p._id}`}
                        className="text-sm font-medium text-primary-700 dark:text-primary-300 hover:underline"
                      >
                        View
                      </Link>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/post-ad?edit=${encodeURIComponent(p._id)}`}
                          className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200 hover:text-primary-600"
                          title="Edit"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Link>
                        {p.status === 'rejected' ? (
                          <button
                            type="button"
                            onClick={() => onResubmit(p)}
                            className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-600 disabled:opacity-50"
                            disabled={busyId === p._id}
                            title="Resubmit for moderation"
                          >
                            <Tag className="h-4 w-4" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onDelete(p._id)}
                          className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200 hover:text-red-600 disabled:opacity-50"
                          disabled={busyId === p._id}
                          title="Delete"
                        >
                          {busyId === p._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                        {p.status !== 'sold' ? (
                          <button
                            type="button"
                            onClick={() => onMarkSold(p)}
                            className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200 hover:text-green-600 disabled:opacity-50"
                            disabled={busyId === p._id}
                            title="Mark as sold"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-900 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => fetchListings(page - 1)}
              >
                Prev
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-900 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => fetchListings(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

