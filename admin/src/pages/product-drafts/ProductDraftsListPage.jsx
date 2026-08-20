import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '@/services/api'
import {
  AdminPage,
  PageHeader,
  DataTable,
  Button,
  FilterBar,
  Input,
  Select,
} from '../../components/AdminUI'
import { Plus, Eye, ChevronUp, ChevronDown, ImageIcon, Video, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePermission } from '../../hooks/usePermission'
import {
  LIST_PATH,
  DraftStatusBadge,
  STATUS_FILTER_OPTIONS,
  STEP_OPTIONS,
  formatDateTime,
  userLabel,
  draftLabel,
} from './draftShared'

const LIMIT = 20
const MODULE = 'Product Drafts'

const EMPTY_FILTERS = {
  search: '',
  status: 'all',
  hasVideo: 'all',
  step: '',
  fromDate: '',
  toDate: '',
}

function buildParams(filters, page, sortBy, sortDir) {
  const params = { page, limit: LIMIT, sortBy, sortDir }
  if (filters.search?.trim()) params.search = filters.search.trim()
  if (filters.status !== 'all') params.status = filters.status
  if (filters.hasVideo !== 'all') params.hasVideo = filters.hasVideo
  if (filters.step) params.step = filters.step
  if (filters.fromDate) params.fromDate = filters.fromDate
  if (filters.toDate) params.toDate = filters.toDate
  return params
}

function ProductDraftsListPage() {
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = usePermission(MODULE)
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState(null)
  const [sortBy, setSortBy] = useState('updatedAt')
  const [sortDir, setSortDir] = useState('desc')

  const fetchDrafts = useCallback(
    async (p = 1, f = filters, sort = { by: sortBy, dir: sortDir }) => {
      try {
        setLoading(true)
        const res = await adminService.getProductDrafts(buildParams(f, p, sort.by, sort.dir))
        const data = res.data || {}
        setDrafts(data.drafts || [])
        setTotal(Number(data.total ?? 0))
        setPage(p)
      } catch (err) {
        if (err.code === 'ERR_CANCELED') return
        toast.error(err.response?.data?.message || 'Failed to load drafts')
      } finally {
        setLoading(false)
      }
    },
    // Called with explicit arguments everywhere; state is only the default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const fetchCounts = useCallback(async () => {
    try {
      const res = await adminService.getProductDraftStats()
      setCounts(res.data || null)
    } catch {
      // Counts are a nicety — a failure here must not blank the table.
    }
  }, [])

  useEffect(() => {
    fetchDrafts(1, EMPTY_FILTERS, { by: 'updatedAt', dir: 'desc' })
    fetchCounts()
  }, [fetchDrafts, fetchCounts])

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  const handleSearch = (e) => {
    e.preventDefault()
    fetchDrafts(1, filters, { by: sortBy, dir: sortDir })
  }

  const handleFilterChange = (key, value) => {
    const next = { ...filters, [key]: value }
    setFilters(next)
    fetchDrafts(1, next, { by: sortBy, dir: sortDir })
  }

  const handleReset = () => {
    setFilters(EMPTY_FILTERS)
    fetchDrafts(1, EMPTY_FILTERS, { by: sortBy, dir: sortDir })
  }

  const handleSort = (field) => {
    const dir = sortBy === field && sortDir === 'desc' ? 'asc' : 'desc'
    setSortBy(field)
    setSortDir(dir)
    fetchDrafts(1, filters, { by: field, dir })
  }

  /**
   * Mirrors the collection's own two-stage lifecycle: a live draft is discarded
   * first (soft delete — the record and its user/product links stay), and only an
   * already-discarded draft is removed for good.
   */
  const handleDelete = async (row) => {
    const label = draftLabel(row)
    const isDiscarded = row.status === 'discarded'
    const message = isDiscarded
      ? `Permanently delete "${label}"? This removes the record from the database and cannot be undone.`
      : `Discard "${label}"? The draft is kept with status "Discarded" and disappears from the seller's Post Your Ad flow.`
    if (!window.confirm(message)) return

    try {
      setLoading(true)
      await adminService.deleteProductDraft(row.id, { soft: !isDiscarded })
      toast.success(isDiscarded ? 'Draft deleted' : 'Draft discarded')
      await Promise.all([
        fetchDrafts(page, filters, { by: sortBy, dir: sortDir }),
        fetchCounts(),
      ])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete draft')
      setLoading(false)
    }
  }

  const SortIcon = ({ field }) => {
    if (sortBy !== field) {
      return <ChevronUp className="h-3 w-3 text-slate-300 dark:text-slate-600 shrink-0" aria-hidden="true" />
    }
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3 w-3 text-primary-500 shrink-0" aria-hidden="true" />
    ) : (
      <ChevronDown className="h-3 w-3 text-primary-500 shrink-0" aria-hidden="true" />
    )
  }

  const sortableHeader = (field, label) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="inline-flex items-center gap-1 font-inherit hover:text-slate-700 dark:hover:text-slate-300"
      aria-label={`Sort by ${label}`}
    >
      {label}
      <SortIcon field={field} />
    </button>
  )

  const columns = [
    {
      key: 'title',
      title: 'Draft',
      wrap: true,
      render: (row) => (
        <div className="min-w-0 max-w-[260px]">
          <p className="truncate font-medium text-slate-900 dark:text-white">
            {row.title?.trim() || <span className="italic text-slate-400">Untitled</span>}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.id}</p>
        </div>
      ),
    },
    {
      key: 'user',
      title: 'Seller',
      render: (row) => (
        <div className="min-w-0 max-w-[200px]">
          <p className="truncate text-slate-800 dark:text-slate-200">{userLabel(row.user)}</p>
          {row.user?.email ? (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{row.user.email}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'category',
      title: 'Category',
      render: (row) =>
        row.category ? (
          <div className="min-w-0 max-w-[220px]">
            <p className="truncate text-slate-800 dark:text-slate-200">
              {row.category.name || row.category.id}
            </p>
            {row.categoryPath?.length > 1 ? (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {row.categoryPath.map((c) => c.name || c.id).join(' › ')}
              </p>
            ) : null}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'currentStep',
      title: sortableHeader('currentStep', 'Step'),
      render: (row) => (
        <span className="text-slate-800 dark:text-slate-200">
          {row.currentStep}
          {row.lastSavedStep ? (
            <span className="text-xs text-slate-500 dark:text-slate-400"> (saved {row.lastSavedStep})</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'media',
      title: sortableHeader('imageCount', 'Media'),
      render: (row) => (
        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1" title={`${row.imageCount} photo(s)`}>
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {row.imageCount}
          </span>
          <span
            className={`inline-flex items-center gap-1 ${row.hasVideo ? '' : 'text-slate-300 dark:text-slate-600'}`}
            title={row.hasVideo ? 'Has video' : 'No video'}
          >
            <Video className="h-3.5 w-3.5" aria-hidden="true" />
            {row.hasVideo ? 'Yes' : 'No'}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      title: sortableHeader('status', 'Status'),
      render: (row) => <DraftStatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      title: sortableHeader('createdAt', 'Created'),
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">{formatDateTime(row.createdAt)}</span>
      ),
    },
    {
      key: 'updatedAt',
      title: sortableHeader('updatedAt', 'Updated'),
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">{formatDateTime(row.updatedAt)}</span>
      ),
    },
  ]

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  return (
    <AdminPage>
      <PageHeader
        title="Product Drafts"
        subtitle="In-progress Post Your Ad drafts saved by sellers"
        action={
          canCreate ? (
            <Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>
              Add Draft
            </Button>
          ) : null
        }
      />

      <FilterBar
        searchValue={filters.search}
        onSearchChange={(v) => setFilter('search', v)}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by title, description, seller name/email or draft id"
        filters={[
          {
            key: 'status',
            type: 'select',
            label: 'Status',
            value: filters.status,
            onChange: (e) => handleFilterChange('status', e.target.value),
            options: STATUS_FILTER_OPTIONS,
          },
          {
            key: 'step',
            type: 'select',
            label: 'Current Step',
            value: filters.step,
            onChange: (e) => handleFilterChange('step', e.target.value),
            options: [
              { value: '', label: 'All Steps' },
              ...STEP_OPTIONS.map((s) => ({ value: String(s), label: `Step ${s}` })),
            ],
          },
          {
            key: 'hasVideo',
            type: 'select',
            label: 'Video',
            value: filters.hasVideo,
            onChange: (e) => handleFilterChange('hasVideo', e.target.value),
            options: [
              { value: 'all', label: 'All' },
              { value: 'yes', label: 'With video' },
              { value: 'no', label: 'Without video' },
            ],
          },
          {
            key: 'sort',
            render: () => (
              <Select
                label="Sort By"
                value={`${sortBy}:${sortDir}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split(':')
                  setSortBy(field)
                  setSortDir(dir)
                  fetchDrafts(1, filters, { by: field, dir })
                }}
                options={[
                  { value: 'updatedAt:desc', label: 'Recently updated' },
                  { value: 'updatedAt:asc', label: 'Least recently updated' },
                  { value: 'createdAt:desc', label: 'Newest created' },
                  { value: 'createdAt:asc', label: 'Oldest created' },
                  { value: 'lastSavedAt:desc', label: 'Last saved' },
                  { value: 'currentStep:desc', label: 'Furthest step' },
                  { value: 'currentStep:asc', label: 'Earliest step' },
                  { value: 'imageCount:desc', label: 'Most photos' },
                ]}
              />
            ),
          },
          {
            key: 'fromDate',
            render: () => (
              <Input
                label="Created From"
                type="date"
                value={filters.fromDate}
                max={filters.toDate || undefined}
                onChange={(e) => handleFilterChange('fromDate', e.target.value)}
              />
            ),
          },
          {
            key: 'toDate',
            render: () => (
              <Input
                label="Created To"
                type="date"
                value={filters.toDate}
                min={filters.fromDate || undefined}
                onChange={(e) => handleFilterChange('toDate', e.target.value)}
              />
            ),
          },
        ]}
        actions={
          hasFilters ? (
            <Button variant="secondary" icon={RotateCcw} onClick={handleReset}>
              Reset Filters
            </Button>
          ) : null
        }
      />

      {counts ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">
          <span className="font-medium text-slate-700 dark:text-slate-300">{counts.total}</span> total drafts
          {' · '}
          {counts.draft} in progress · {counts.published} published · {counts.discarded} discarded
          {hasFilters ? (
            <>
              {' · '}
              <span className="font-medium text-primary-600 dark:text-primary-400">{total}</span> matching filter
              {total !== 1 ? 's' : ''}
            </>
          ) : null}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={drafts}
        loading={loading}
        emptyTitle={hasFilters ? 'No drafts match these filters' : 'No drafts found'}
        emptyDescription={
          hasFilters
            ? 'Try adjusting the search or filters, or reset them to see every draft.'
            : 'Drafts appear here as soon as a seller starts the Post Your Ad flow.'
        }
        onRowClick={(row) => navigate(`${LIST_PATH}/${row.id}`)}
        onEdit={canEdit ? (row) => navigate(`${LIST_PATH}/${row.id}/edit`) : undefined}
        onDelete={canDelete ? handleDelete : undefined}
        customActions={(row) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`${LIST_PATH}/${row.id}`)
            }}
            className="admin-table-action text-slate-500 dark:text-slate-400"
            title="View"
            aria-label={`View ${draftLabel(row)}`}
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
        mobileCardRender={(row, { actions }) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900 dark:text-white">
                  {row.title?.trim() || 'Untitled'}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{userLabel(row.user)}</p>
              </div>
              {actions}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <DraftStatusBadge status={row.status} />
              <span>Step {row.currentStep}</span>
              <span>· {row.imageCount} photos</span>
              <span>· {row.hasVideo ? 'video' : 'no video'}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {row.category?.name ? `${row.category.name} · ` : ''}Updated {formatDateTime(row.updatedAt)}
            </p>
          </div>
        )}
        showSearch={false}
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchDrafts(p, filters, { by: sortBy, dir: sortDir }),
        }}
        serverSide
      />
    </AdminPage>
  )
}

export default ProductDraftsListPage
