import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '@/services/api'
import {
  AdminPage,
  PageHeader,
  DataTable,
  Button,
  FilterBar,
  StatusBadge,
  Modal,
  Checkbox,
} from '../../components/AdminUI'
import { usePermission } from '../../hooks/usePermission'
import toast from 'react-hot-toast'
import { getMediaUrl } from '@shared/utils/helpers'
import { Plus, Eye, FileSpreadsheet } from 'lucide-react'

const LIMIT = 20
const LIST_PATH = '/admin-users'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Admin Users — a dedicated module for managing admin accounts, backed by
 * its own `admin_users` collection (never the marketplace `users`
 * collection). Completely independent API surface, permission bucket, and
 * UI from the Users module's flows, filters, and business logic.
 */
function AdminUsersListPage() {
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = usePermission('Admin Users')

  const [adminUsers, setAdminUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const [exportOpen, setExportOpen] = useState(false)
  const [exportFromDate, setExportFromDate] = useState('')
  const [exportToDate, setExportToDate] = useState('')
  const [exportApplyFilters, setExportApplyFilters] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    adminService
      .getRoles({ limit: 200 })
      .then((res) => setRoles(res.data?.roles || []))
      .catch(() => {})
  }, [])

  const fetchAdminUsers = async (
    p = 1,
    searchTerm = search,
    role = roleFilter,
    status = statusFilter
  ) => {
    try {
      setLoading(true)
      const params = { limit: LIMIT, page: p }
      if (searchTerm?.trim()) params.search = searchTerm.trim()
      if (role && role !== 'all') params.roleId = role
      if (status && status !== 'all') params.status = status
      const res = await adminService.getAdminUsers(params)
      const data = res.data || {}
      setAdminUsers(data.adminUsers || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to load admin users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdminUsers(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchAdminUsers(1, search, roleFilter, statusFilter)
  }

  const hasActiveFilters = search || roleFilter !== 'all' || statusFilter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setRoleFilter('all')
    setStatusFilter('all')
    fetchAdminUsers(1, '', 'all', 'all')
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Remove admin account "${row.name}"? Their role assignment and access will be revoked.`)) return
    try {
      await adminService.deleteAdminUser(row._id)
      toast.success('Admin user removed')
      fetchAdminUsers(page, search, roleFilter, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove admin user')
    }
  }

  const openExportModal = () => {
    setExportFromDate('')
    setExportToDate('')
    setExportApplyFilters(true)
    setExportOpen(true)
  }

  const closeExportModal = () => {
    if (exporting) return
    setExportOpen(false)
  }

  const handleExport = async () => {
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
        if (roleFilter !== 'all') params.roleId = roleFilter
        if (statusFilter !== 'all') params.status = statusFilter
        if (search) params.search = search
      }

      const res = await adminService.exportAdminUsers(params)
      const blob = res.data instanceof Blob
        ? res.data
        : new Blob([res.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

      if (blob.type && blob.type.includes('application/json')) {
        const text = await blob.text()
        let message = 'Failed to export admin users'
        try {
          message = JSON.parse(text)?.message || message
        } catch { /* ignore */ }
        throw new Error(message)
      }

      const disposition = res.headers?.['content-disposition'] || ''
      const match = disposition.match(/filename="?([^"]+)"?/i)
      const filename = match?.[1] || `admin-users-${exportFromDate}_${exportToDate}.xlsx`

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
      setExportOpen(false)
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

  return (
    <AdminPage>
      <PageHeader
        title="Admin Users"
        subtitle="Manage admin accounts and their assigned role"
        action={
          <>
            <Button variant="secondary" icon={FileSpreadsheet} onClick={openExportModal}>
              Export Excel
            </Button>
            {canCreate ? (
              <Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>
                Add Admin User
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
            key: 'role',
            type: 'select',
            label: 'Role',
            value: roleFilter,
            onChange: (e) => setRoleFilter(e.target.value),
            options: [
              { value: 'all', label: 'All roles' },
              ...roles.map((r) => ({ value: r._id, label: r.role_name })),
            ],
          },
          {
            key: 'status',
            type: 'select',
            label: 'Status',
            value: statusFilter,
            onChange: (e) => setStatusFilter(e.target.value),
            options: [
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
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
        Showing <span className="font-medium text-slate-700 dark:text-slate-300">{adminUsers.length}</span> of{' '}
        <span className="font-medium text-slate-700 dark:text-slate-300">{total}</span> admin users
      </p>

      <DataTable
        columns={[
          {
            key: 'name',
            title: 'Admin User',
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
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{r.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{r.email}</p>
                  </div>
                </div>
              )
            },
          },
          { key: 'phone', title: 'Mobile', render: (r) => r.phone || '—' },
          { key: 'role', title: 'Role', render: (r) => r.adminRole?.role_name || '—' },
          {
            key: 'status',
            title: 'Status',
            render: (r) => <StatusBadge status={r.status === 'active' ? 'active' : 'inactive'} />,
          },
          {
            key: 'lastLoginAt',
            title: 'Last Login',
            render: (r) => (r.lastLoginAt ? formatDate(r.lastLoginAt) : 'Never'),
          },
        ]}
        data={adminUsers}
        loading={loading}
        serverSide
        showSearch={false}
        emptyTitle="No admin users found"
        emptyDescription="Add your first admin user to get started."
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchAdminUsers(p, search, roleFilter, statusFilter),
        }}
        onEdit={canEdit ? (row) => navigate(`${LIST_PATH}/${row._id}/edit`) : undefined}
        onDelete={canDelete ? handleDelete : undefined}
        customActions={(row) => (
          <Button
            variant="ghost"
            size="sm"
            icon={Eye}
            onClick={(e) => {
              e.stopPropagation()
              navigate(`${LIST_PATH}/${row._id}`)
            }}
            aria-label="View admin user"
          />
        )}
      />

      <Modal
        open={exportOpen}
        onClose={closeExportModal}
        title="Export Admin Users to Excel"
        size="sm"
        footer={
          <Modal.Footer
            onCancel={closeExportModal}
            onConfirm={handleExport}
            cancelLabel="Cancel"
            confirmLabel="Export"
            loading={exporting}
          />
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Choose the account-creation date range you want to export.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="admin-user-export-from-date">
              From Date
            </label>
            <input
              id="admin-user-export-from-date"
              type="date"
              value={exportFromDate}
              max={exportToDate || undefined}
              onChange={(e) => setExportFromDate(e.target.value)}
              required
              className="admin-input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="admin-user-export-to-date">
              To Date
            </label>
            <input
              id="admin-user-export-to-date"
              type="date"
              value={exportToDate}
              min={exportFromDate || undefined}
              onChange={(e) => setExportToDate(e.target.value)}
              required
              className="admin-input w-full"
            />
          </div>
        </div>
        <Checkbox
          label="Apply current search & filters"
          checked={exportApplyFilters}
          onChange={(e) => setExportApplyFilters(e.target.checked)}
        />
      </Modal>
    </AdminPage>
  )
}

export default AdminUsersListPage
