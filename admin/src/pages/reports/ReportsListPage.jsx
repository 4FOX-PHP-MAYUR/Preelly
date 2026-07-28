import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { adminService } from '@/services/api'
import { selectPermissions } from '@shared/store/slices/authSlice'
import { getMediaUrl } from '@shared/utils/helpers'
import {
  AdminPage,
  PageHeader,
  DataTable,
  Button,
  FilterBar,
  StatusBadge,
  Card,
  Panel,
} from '../../components/AdminUI'
import {
  Eye,
  Flag,
  Clock3,
  CheckCircle2,
  ShieldCheck,
  Users,
  AlertTriangle,
  Ban,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  REPORT_STATUS_OPTIONS,
  REPORT_COUNT_OPTIONS,
  SORT_OPTIONS,
  formatDateTime,
  truncateId,
  displayName,
} from './reportConstants'

const LIMIT = 10
const LIST_PATH = '/reports'

const EMPTY_FILTERS = {
  search: '',
  status: 'all',
  reason: 'all',
  dateFrom: '',
  dateTo: '',
  minReports: 'all',
  sort: 'latest',
}

const EMPTY_STATS = {
  totalUserReports: 0,
  pendingReports: 0,
  reviewedReports: 0,
  resolvedReports: 0,
  totalReportedUsers: 0,
  mostReportedUsers: 0,
  reportThreshold: 5,
}

function UserCell({ user, subtitle }) {
  const name = displayName(user)
  const avatarUrl = user?.avatar ? getMediaUrl(user.avatar) || user.avatar : null
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-300">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </div>
      <div className="min-w-0">
        <p className="font-medium text-slate-900 dark:text-white truncate">{name}</p>
        {subtitle !== undefined ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
        ) : user?.email ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
        ) : null}
      </div>
    </div>
  )
}

function ReportMobileCard({ row, actions }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <UserCell user={row.reportedUser} subtitle={row.reportedUser?.email} />
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={row.statusBadge || row.status} label={row.statusLabel} />
          {actions}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <p className="text-slate-500 dark:text-slate-400">Report ID</p>
          <p className="font-mono text-slate-800 dark:text-slate-200">{row.reportIdShort || truncateId(row.reportId)}</p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-slate-400">Reports</p>
          <p className="font-semibold tabular-nums text-slate-900 dark:text-white">
            {row.reportCount}
            {row.exceedsThreshold ? (
              <span className="ml-1 text-red-600 dark:text-red-400">!</span>
            ) : null}
          </p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-slate-400">Reported By</p>
          <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
            {displayName(row.reportedBy)}
          </p>
        </div>
        <div>
          <p className="text-slate-500 dark:text-slate-400">Latest</p>
          <p className="font-medium text-slate-800 dark:text-slate-200">
            {formatDateTime(row.latestReportDate)}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-slate-500 dark:text-slate-400">Reason</p>
          <p className="font-medium text-slate-800 dark:text-slate-200">{row.reportReason || '—'}</p>
        </div>
      </div>
    </div>
  )
}

function canEditReports(permissions) {
  if (!permissions) return true
  const mod = permissions.Reports || permissions.Users
  if (!mod) return false
  return !!(mod.can_edit || mod.can_delete)
}

function ReportsListPage() {
  const navigate = useNavigate()
  const permissions = useSelector(selectPermissions)
  const allowActions = canEditReports(permissions)

  const [items, setItems] = useState([])
  const [mostReported, setMostReported] = useState([])
  const [reasons, setReasons] = useState([])
  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(EMPTY_STATS)
  const [actionId, setActionId] = useState(null)
  const [reportThreshold, setReportThreshold] = useState(5)

  const buildParams = (p, f) => {
    const params = { page: p, limit: LIMIT, sort: f.sort || 'latest' }
    if (f.search?.trim()) params.search = f.search.trim()
    if (f.status !== 'all') params.status = f.status
    if (f.reason !== 'all') params.reason = f.reason
    if (f.dateFrom) params.dateFrom = f.dateFrom
    if (f.dateTo) params.dateTo = f.dateTo
    if (f.minReports !== 'all') params.minReports = f.minReports
    return params
  }

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const [statsRes, mostRes] = await Promise.all([
        adminService.getUserReportStats(),
        adminService.getMostReportedUsers({ limit: 5 }),
      ])
      setStats(statsRes.data || EMPTY_STATS)
      setMostReported(mostRes.data?.items || [])
      if (statsRes.data?.reportThreshold) {
        setReportThreshold(statsRes.data.reportThreshold)
      } else if (mostRes.data?.reportThreshold) {
        setReportThreshold(mostRes.data.reportThreshold)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const fetchReports = useCallback(async (p = 1, f = filters) => {
    try {
      setLoading(true)
      setError(null)
      const res = await adminService.getUserReports(buildParams(p, f))
      const data = res.data || {}
      setItems(data.items || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
      if (data.reportThreshold) setReportThreshold(data.reportThreshold)
    } catch (err) {
      console.error(err)
      const message = err.response?.data?.message || 'Failed to load user reports'
      setError(message)
      toast.error(message)
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchReports(1)
    fetchStats()
    adminService.getUserReportReasons()
      .then((res) => setReasons(res.data?.reasons || []))
      .catch(() => setReasons([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  const handleSearch = (e) => {
    e.preventDefault()
    fetchReports(1, filters)
  }

  const handleClear = () => {
    setFilters(EMPTY_FILTERS)
    fetchReports(1, EMPTY_FILTERS)
  }

  const runAction = async (userId, action) => {
    if (!allowActions) {
      toast.error('You do not have permission to moderate reports')
      return
    }
    try {
      setActionId(`${userId}:${action}`)
      const res = await adminService.resolveUserReport(userId, { action })
      toast.success(res.data?.message || 'Action completed')
      await Promise.all([fetchReports(page, filters), fetchStats()])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply action')
    } finally {
      setActionId(null)
    }
  }

  const columns = [
    {
      key: 'reportId',
      title: 'Report ID',
      render: (row) => (
        <span className="font-mono text-xs" title={row.reportId || ''}>
          {row.reportIdShort || truncateId(row.reportId)}
        </span>
      ),
    },
    {
      key: 'reportedUser',
      title: 'Reported User',
      render: (row) => <UserCell user={row.reportedUser} />,
    },
    {
      key: 'reportedBy',
      title: 'Reported By',
      render: (row) => (
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {displayName(row.reportedBy)}
        </span>
      ),
    },
    {
      key: 'reportReason',
      title: 'Reason',
      render: (row) => (
        <div className="min-w-0 max-w-[12rem]">
          <p className="truncate font-medium">{row.reportReason || '—'}</p>
          {row.reasons?.length > 1 && (
            <p className="text-xs text-slate-500 truncate">+{row.reasons.length - 1} more</p>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      title: 'Description',
      render: (row) => (
        <span className="block max-w-[14rem] truncate text-slate-600 dark:text-slate-300" title={row.description || ''}>
          {row.description || '—'}
        </span>
      ),
    },
    {
      key: 'reportCount',
      title: 'Reports',
      render: (row) => (
        <span className={`font-semibold tabular-nums ${row.exceedsThreshold ? 'text-red-600 dark:text-red-400' : ''}`}>
          {row.reportCount}
          {row.exceedsThreshold ? ' ⚠' : ''}
        </span>
      ),
    },
    {
      key: 'latestReportDate',
      title: 'Latest Report',
      render: (row) => formatDateTime(row.latestReportDate),
    },
    {
      key: 'status',
      title: 'Status',
      render: (row) => (
        <StatusBadge status={row.statusBadge || row.status} label={row.statusLabel} />
      ),
    },
  ]

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)
  const reasonOptions = [
    { value: 'all', label: 'All Reasons' },
    ...reasons.map((r) => ({ value: r, label: r })),
  ]

  return (
    <AdminPage>
      <PageHeader
        title="User Reports"
        subtitle="Review and moderate reports submitted against users"
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Card title="Total User Reports" value={statsLoading ? '…' : stats.totalUserReports} icon={Flag} accent="default" />
        <Card title="Pending" value={statsLoading ? '…' : stats.pendingReports} icon={Clock3} accent="yellow" />
        <Card title="Reviewed" value={statsLoading ? '…' : stats.reviewedReports} icon={ShieldCheck} accent="purple" />
        <Card title="Resolved" value={statsLoading ? '…' : stats.resolvedReports} icon={CheckCircle2} accent="green" />
        <Card title="Reported Users" value={statsLoading ? '…' : stats.totalReportedUsers} icon={Users} accent="default" />
        <Card title="Top Report Count" value={statsLoading ? '…' : stats.mostReportedUsers} icon={AlertTriangle} accent="red" />
      </div>

      <Panel className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Most Reported Users</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Highlighted when report count reaches {reportThreshold}+
            </p>
          </div>
        </div>
        {statsLoading && mostReported.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Loading…</p>
        ) : mostReported.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No reported users yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {mostReported.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => navigate(`${LIST_PATH}/${row.id}`)}
                className={`text-left rounded-xl border p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                  row.exceedsThreshold
                    ? 'border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <UserCell
                  user={row.reportedUser}
                  subtitle={`${row.reportCount} report${row.reportCount === 1 ? '' : 's'}`}
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <StatusBadge
                    status={row.accountStatus === 'inactive' ? 'inactive' : 'active'}
                    label={row.accountStatus === 'inactive' ? 'Blocked' : 'Active'}
                  />
                  {row.exceedsThreshold && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 dark:text-red-300">
                      <AlertTriangle className="h-3 w-3" />
                      Threshold
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <FilterBar
        searchValue={filters.search}
        onSearchChange={(v) => setFilter('search', v)}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search user name, ID, email, or reporter"
        filters={[
          {
            key: 'status',
            type: 'select',
            label: 'Report Status',
            value: filters.status,
            onChange: (e) => setFilter('status', e.target.value),
            options: [{ value: 'all', label: 'All Statuses' }, ...REPORT_STATUS_OPTIONS],
          },
          {
            key: 'reason',
            type: 'select',
            label: 'Report Reason',
            value: filters.reason,
            onChange: (e) => setFilter('reason', e.target.value),
            options: reasonOptions,
          },
          {
            key: 'minReports',
            type: 'select',
            label: 'Report Count',
            value: filters.minReports,
            onChange: (e) => setFilter('minReports', e.target.value),
            options: REPORT_COUNT_OPTIONS,
          },
          {
            key: 'sort',
            type: 'select',
            label: 'Sort By',
            value: filters.sort,
            onChange: (e) => setFilter('sort', e.target.value),
            options: SORT_OPTIONS,
          },
          {
            key: 'dateFrom',
            type: 'custom',
            label: 'From',
            render: () => (
              <label className="block text-sm">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">From</span>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilter('dateFrom', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </label>
            ),
          },
          {
            key: 'dateTo',
            type: 'custom',
            label: 'To',
            render: () => (
              <label className="block text-sm">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">To</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilter('dateTo', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </label>
            ),
          },
        ]}
        actions={
          hasFilters ? (
            <Button variant="secondary" onClick={handleClear}>
              Clear
            </Button>
          ) : null
        }
      />

      {error && !loading && items.length === 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-4 py-6 text-center">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
          <Button
            variant="secondary"
            className="mt-3 w-full sm:w-auto"
            onClick={() => {
              fetchReports(page, filters)
              fetchStats()
            }}
          >
            Retry
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="No user reports found"
          emptyDescription="Try adjusting filters or search terms"
          onRowClick={(row) => navigate(`${LIST_PATH}/${row.id}`)}
          mobileCardRender={(row, { actions }) => (
            <ReportMobileCard row={row} actions={actions} />
          )}
          customActions={(row) => (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`${LIST_PATH}/${row.id}`)
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="View details"
                aria-label="View details"
              >
                <Eye className="h-4 w-4" />
              </button>
              {allowActions && (row.status === 'pending' || row.status === 'reviewed') && (
                <>
                  <button
                    type="button"
                    disabled={!!actionId}
                    onClick={(e) => {
                      e.stopPropagation()
                      runAction(row.id, 'resolve')
                    }}
                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50"
                    title="Resolve"
                    aria-label="Resolve"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!!actionId}
                    onClick={(e) => {
                      e.stopPropagation()
                      runAction(row.id, 'dismiss')
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                    title="Dismiss"
                    aria-label="Dismiss"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                  {row.accountStatus !== 'inactive' && (
                    <button
                      type="button"
                      disabled={!!actionId}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(`Block ${displayName(row.reportedUser)}? Their account will be set inactive.`)) {
                          runAction(row.id, 'block')
                        }
                      }}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                      title="Block user"
                      aria-label="Block user"
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          showSearch={false}
          pagination={{
            page,
            limit: LIMIT,
            total,
            onPageChange: (p) => fetchReports(p, filters),
          }}
          serverSide
        />
      )}
    </AdminPage>
  )
}

export default ReportsListPage
