import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { Archive, ArrowLeft, Filter, Search } from 'lucide-react'
import SettingsPageShell from '../../components/Dashboard/SettingsPageShell'
import ArchiveCard, { ArchiveCardSkeleton } from '../../components/Archives/ArchiveCard'
import DeleteArchiveModal from '../../components/Archives/DeleteArchiveModal'
import { productService, userService } from '@shared/services/api'

const SORT_OPTIONS = [
  { value: 'archived_newest', label: 'Newest archived' },
  { value: 'archived_oldest', label: 'Oldest archived' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
]

export default function DashboardArchivesPage() {
  const navigate = useNavigate()
  const rootCategories = useSelector((s) => s.categories.rootCategories || [])

  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [q, setQ] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('archived_newest')
  const [busyId, setBusyId] = useState(null)

  const [deleteItem, setDeleteItem] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const categoryOptions = useMemo(
    () =>
      (rootCategories || [])
        .filter((c) => c?._id)
        .map((c) => ({ value: String(c._id), label: c.name || 'Category' })),
    [rootCategories],
  )

  const fetchArchives = async (nextPage = page, { silent } = { silent: false }) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await userService.getListings({
        archived: true,
        page: nextPage,
        limit: 12,
        q: appliedQ || undefined,
        category: category || undefined,
        sort: sort || undefined,
      })
      setItems(res.data.items || [])
      setPage(res.data.page || nextPage)
      setTotalPages(res.data.totalPages || 1)
      setTotal(res.data.total || 0)
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load archives')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchArchives(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQ, category, sort])

  const onSearch = (e) => {
    e.preventDefault()
    setAppliedQ(q.trim())
  }

  const handleRestore = async (item) => {
    setBusyId(item._id)
    try {
      await productService.restoreProduct(item._id)
      toast.success('Ad restored to My Ads')
      await fetchArchives(page, { silent: true })
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to restore ad')
    } finally {
      setBusyId(null)
    }
  }

  const handleView = (item) => {
    navigate(`/products/${item._id}`)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return
    setDeleting(true)
    setBusyId(deleteItem._id)
    try {
      await productService.deleteProduct(deleteItem._id)
      toast.success('Ad deleted permanently')
      setDeleteItem(null)
      await fetchArchives(page, { silent: true })
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to delete ad')
    } finally {
      setDeleting(false)
      setBusyId(null)
    }
  }

  return (
    <SettingsPageShell>
      <div className="mx-auto max-w-3xl pb-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">My Archives</h1>
            <p className="mt-1 text-sm text-slate-500">
              Restore, review, or permanently delete your archived ads
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand transition duration-200 hover:text-brand-700 sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <form
          onSubmit={onSearch}
          className="mb-5 space-y-3 rounded-[16px] border border-[#E5E7EB] bg-white p-3 sm:p-4"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-[12px] border border-[#E5E7EB] bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-brand"
              placeholder="Search archived ads…"
              aria-label="Search archived ads"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2">
              <Filter className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand"
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand sm:w-48"
              aria-label="Sort archived ads"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-[12px] bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Apply
            </button>
          </div>
        </form>

        {error ? (
          <div
            role="alert"
            className="mb-4 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <div className="space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => <ArchiveCardSkeleton key={i} />)
          ) : items.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[#E5E7EB] px-4 py-12 text-center">
              <Archive className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-slate-700">No archived ads</p>
              <p className="mt-1 text-xs text-slate-400">
                Ads you archive will appear here. Active listings stay in My Ads.
              </p>
              <Link
                to="/my-profile"
                className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Go to My Ads
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <ArchiveCard
                key={item._id}
                item={item}
                busy={busyId === item._id}
                onRestore={() => handleRestore(item)}
                onView={() => handleView(item)}
                onDelete={() => setDeleteItem(item)}
              />
            ))
          )}
        </div>

        {!loading && items.length > 0 ? (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Page {page} of {totalPages}
              {total ? ` · ${total} archived` : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => fetchArchives(page - 1)}
              >
                Prev
              </button>
              <button
                type="button"
                className="rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => fetchArchives(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <DeleteArchiveModal
        open={Boolean(deleteItem)}
        item={deleteItem}
        saving={deleting}
        onClose={() => {
          if (!deleting) setDeleteItem(null)
        }}
        onConfirm={handleDeleteConfirm}
      />
    </SettingsPageShell>
  )
}
