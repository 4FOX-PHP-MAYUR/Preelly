import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileSpreadsheet, Eye, ShieldCheck, ShieldOff } from 'lucide-react'
import { adminService } from '@/services/api'
import PageHeader from '../../components/AdminUI/PageHeader'
import AdminPage from '../../components/AdminUI/AdminPage'
import DataTable from '../../components/AdminUI/DataTable'
import Button from '../../components/AdminUI/Button'
import FilterBar from '../../components/AdminUI/FilterBar'
import StatusBadge from '../../components/AdminUI/StatusBadge'
import Modal from '../../components/AdminUI/Modal'
import toast from 'react-hot-toast'
import { getMediaUrl } from '@shared/utils/helpers'
import { VERIFIED_BADGE_IMAGES } from '@shared/utils/verifiedBadge'
import { usePermission } from '../../hooks/usePermission'

const LIMIT = 20
const LIST_PATH = '/users'

function getMemberSince(user) {
  const date = user?.memberSince || user?.createdAt
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

function UsersListPage() {
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = usePermission('Users')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportFromDate, setExportFromDate] = useState('')
  const [exportToDate, setExportToDate] = useState('')
  const [exportApplyFilters, setExportApplyFilters] = useState(true)
  const [exporting, setExporting] = useState(false)

  const fetchUsers = async (
    p = 1,
    searchTerm = search,
    status = statusFilter,
    role = typeFilter,
    from = fromDate,
    to = toDate
  ) => {
    try {
      setLoading(true)
      const params = { limit: LIMIT, page: p }
      if (searchTerm?.trim()) params.search = searchTerm.trim()
      if (status && status !== 'all') params.status = status
      if (role && role !== 'all') params.role = role
      if (from) params.fromDate = from
      if (to) params.toDate = to
      const res = await adminService.getUsers(params)
      const data = res.data || {}
      setUsers(data.users || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchUsers(1, search, statusFilter, typeFilter, fromDate, toDate)
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setTypeFilter('all')
    setFromDate('')
    setToDate('')
    fetchUsers(1, '', 'all', 'all', '', '')
  }

  const handleToggleStatus = async (row) => {
    const newStatus = row.status === 'active' ? 'inactive' : 'active'
    try {
      setLoading(true)
      await adminService.setUserStatus(row._id, newStatus)
      toast.success(newStatus === 'active' ? 'User unblocked' : 'User blocked')
      await fetchUsers(page, search, statusFilter, typeFilter, fromDate, toDate)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleVerify = async (row) => {
    try {
      setLoading(true)
      await adminService.verifyUser(row._id, !row.isVerified)
      toast.success(row.isVerified ? 'User unverified' : 'User verified')
      await fetchUsers(page, search, statusFilter, typeFilter, fromDate, toDate)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update verification')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm('Delete this user? Their account will be deactivated and blocked from signing in.')) return
    try {
      setLoading(true)
      await adminService.setUserStatus(row._id, 'inactive')
      toast.success('User deleted')
      await fetchUsers(page, search, statusFilter, typeFilter, fromDate, toDate)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user')
    } finally {
      setLoading(false)
    }
  }

  const openExportModal = () => {
    setExportFromDate('')
    setExportToDate('')
    setExportApplyFilters(true)
    setExportModalOpen(true)
  }

  const closeExportModal = () => {
    if (exporting) return
    setExportModalOpen(false)
  }

  const handleExportUsers = async () => {
    if (!exportFromDate || !exportToDate) {
      toast.error('Please select From Date and To Date')
      return
    }
    if (exportFromDate > exportToDate) {
      toast.error('From Date cannot be after To Date')
      return
    }

    try {
      setExporting(true)
      const params = { fromDate: exportFromDate, toDate: exportToDate }
      if (exportApplyFilters) {
        if (statusFilter !== 'all') params.status = statusFilter
        if (typeFilter !== 'all') params.role = typeFilter
        if (search) params.search = search
      }

      const res = await adminService.exportUsers(params)
      const blob = res.data instanceof Blob
        ? res.data
        : new Blob([res.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

      if (blob.type && blob.type.includes('application/json')) {
        const text = await blob.text()
        let message = 'Failed to export users'
        try {
          message = JSON.parse(text)?.message || message
        } catch { /* ignore */ }
        throw new Error(message)
      }

      const disposition = res.headers?.['content-disposition'] || ''
      const match = disposition.match(/filename="?([^"]+)"?/i)
      const filename = match?.[1] || `users-${exportFromDate}_${exportToDate}.xlsx`

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      const truncated = String(res.headers?.['x-export-truncated'] || '') === '1'
      toast.success(truncated
        ? 'Excel exported (first 10,000 matching rows)'
        : 'Excel exported successfully')
      setExportModalOpen(false)
    } catch (err) {
      console.error(err)
      let message = 'Failed to export Excel'
      const data = err.response?.data
      if (data instanceof Blob) {
        try {
          const text = await data.text()
          message = JSON.parse(text)?.message || message
        } catch { /* ignore */ }
      } else {
        message = err.message || err.response?.data?.message || message
      }
      toast.error(message)
    } finally {
      setExporting(false)
    }
  }

  const hasActiveFilters = search || statusFilter !== 'all' || typeFilter !== 'all' || fromDate || toDate

  return (
    <AdminPage>
      <PageHeader
        title="Users"
        subtitle="Manage marketplace users, verification, and access"
        action={
          <>
            <Button variant="secondary" icon={FileSpreadsheet} onClick={openExportModal}>
              Export Excel
            </Button>
            {canCreate ? (
              <Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>
                Add User
              </Button>
            ) : null}
          </>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by name, email, or mobile number..."
        filters={[
          {
            key: 'status',
            type: 'select',
            label: 'User Status',
            value: statusFilter,
            onChange: (e) => setStatusFilter(e.target.value),
            options: [
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
          {
            key: 'role',
            type: 'select',
            label: 'User Type',
            value: typeFilter,
            onChange: (e) => setTypeFilter(e.target.value),
            options: [
              { value: 'all', label: 'All types' },
              { value: 'user', label: 'User' },
              { value: 'admin', label: 'Admin' },
            ],
          },
          {
            key: 'fromDate',
            render: () => (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Registration From
                </label>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="admin-input w-full"
                />
              </div>
            ),
          },
          {
            key: 'toDate',
            render: () => (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Registration To
                </label>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => setToDate(e.target.value)}
                  className="admin-input w-full"
                />
              </div>
            ),
          },
        ]}
        actions={
          hasActiveFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Clear
            </Button>
          ) : null
        }
      />

      <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">
        Showing <span className="font-medium text-slate-700 dark:text-slate-300">{users.length}</span> of{' '}
        <span className="font-medium text-slate-700 dark:text-slate-300">{total}</span> users
      </p>

      <DataTable
        columns={[
          {
            key: 'avatar',
            title: 'User',
            render: (r) => {
              const src = r.avatar ? getMediaUrl(r.avatar) || r.avatar : null
              return (
                <div className="flex items-center gap-3 min-w-[180px]">
                  {src ? (
                    <img src={src} alt={r.name} className="h-9 w-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-medium text-slate-500 shrink-0">
                      {(r.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium text-slate-900 dark:text-white flex items-center gap-1">
                    {r.name}
                    {r.isVerified && (
                      <img src={VERIFIED_BADGE_IMAGES.medium} alt="Verified" className="h-4 w-4" />
                    )}
                  </span>
                </div>
              )
            },
          },
          { key: 'email', title: 'Email', render: (r) => <span className="text-slate-700 dark:text-slate-300">{r.email || '—'}</span> },
          { key: 'phone', title: 'Mobile', render: (r) => <span className="text-slate-700 dark:text-slate-300">{r.phone || '—'}</span> },
          {
            key: 'type',
            title: 'Type',
            render: (r) => (
              <span className="text-slate-700 dark:text-slate-300">
                {r.adminRole?.role_name || (r.role === 'admin' ? 'Admin' : 'User')}
              </span>
            ),
          },
          {
            key: 'memberSince',
            title: 'Registered',
            render: (r) => <span className="text-slate-700 dark:text-slate-300">{getMemberSince(r)}</span>,
          },
          {
            key: 'status',
            title: 'Status',
            render: (r) => (
              <button type="button" onClick={() => handleToggleStatus(r)} className="focus:outline-none">
                <StatusBadge status={r.status === 'active' ? 'active' : 'inactive'} />
              </button>
            ),
          },
        ]}
        data={users}
        loading={loading}
        serverSide
        emptyTitle="No users found"
        emptyDescription="Try adjusting your filters or search terms."
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchUsers(p, search, statusFilter, typeFilter, fromDate, toDate),
        }}
        onEdit={canEdit ? (row) => navigate(`${LIST_PATH}/${row._id}/edit`) : undefined}
        onDelete={canDelete ? handleDelete : undefined}
        canDeleteRow={(row) => row.status === 'active'}
        customActions={(row) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Eye}
              onClick={(e) => {
                e.stopPropagation()
                navigate(`${LIST_PATH}/${row._id}`)
              }}
              aria-label="View user"
            />
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                icon={row.isVerified ? ShieldOff : ShieldCheck}
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleVerify(row)
                }}
                aria-label={row.isVerified ? 'Unverify user' : 'Verify user'}
              />
            )}
          </div>
        )}
      />

      <Modal
        open={exportModalOpen}
        onClose={closeExportModal}
        title="Export Users to Excel"
        size="sm"
        footer={
          <Modal.Footer
            onCancel={closeExportModal}
            onConfirm={handleExportUsers}
            cancelLabel="Cancel"
            confirmLabel="Export"
            loading={exporting}
          />
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Choose the registration-date range for the users you want to export.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="export-from-date">
              From Date
            </label>
            <input
              id="export-from-date"
              type="date"
              value={exportFromDate}
              max={exportToDate || undefined}
              onChange={(e) => setExportFromDate(e.target.value)}
              required
              className="admin-input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="export-to-date">
              To Date
            </label>
            <input
              id="export-to-date"
              type="date"
              value={exportToDate}
              min={exportFromDate || undefined}
              onChange={(e) => setExportToDate(e.target.value)}
              required
              className="admin-input w-full"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={exportApplyFilters}
            onChange={(e) => setExportApplyFilters(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          Apply currently selected filters (status, type, search)
        </label>
      </Modal>
    </AdminPage>
  )
}

export default UsersListPage
