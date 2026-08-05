import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@/services/api'
import {
  AdminPage,
  PageHeader,
  DataTable,
  Button,
  FilterBar,
  StatusBadge,
  Modal,
  SearchableSelect,
  Select,
  Input,
  Textarea,
  Checkbox,
} from '../../components/AdminUI'
import { usePermission } from '../../hooks/usePermission'
import toast from 'react-hot-toast'
import { ArrowLeft, UserPlus, FileSpreadsheet } from 'lucide-react'

const LIST_PATH = '/roles'
const LIMIT = 20

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Users assigned to a single admin role — the "Assign Users" action from the
 * Roles list opens this page. Backed by the admin_role_assignments mapping
 * table (scoped to this role via the `roleId` query param on the shared
 * role-assignments API), not a separate module.
 */
function AssignUsersPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = usePermission('Settings')

  const [role, setRole] = useState(null)
  const [roleLoading, setRoleLoading] = useState(true)
  const [assignments, setAssignments] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortDir, setSortDir] = useState('desc')

  // Assign / edit modal
  const [formOpen, setFormOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState(null) // null = assigning a new user
  const [availableUsers, setAvailableUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [formUserId, setFormUserId] = useState('')
  const [formStatus, setFormStatus] = useState('active')
  const [formNotes, setFormNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Export modal
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFromDate, setExportFromDate] = useState('')
  const [exportToDate, setExportToDate] = useState('')
  const [exportApplyFilters, setExportApplyFilters] = useState(true)
  const [exporting, setExporting] = useState(false)

  const fetchAssignments = async (
    p = 1,
    searchTerm = search,
    status = statusFilter,
    dir = sortDir
  ) => {
    try {
      setLoading(true)
      const params = { roleId: id, limit: LIMIT, page: p, sortBy: 'assignedAt', sortDir: dir }
      if (searchTerm?.trim()) params.search = searchTerm.trim()
      if (status && status !== 'all') params.status = status
      const res = await adminService.getRoleAssignments(params)
      const data = res.data || {}
      setAssignments(data.assignments || [])
      setTotal(Number(data.total ?? 0))
      setPage(p)
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to load assigned users')
    } finally {
      setLoading(false)
    }
  }

  const loadRole = async () => {
    try {
      setRoleLoading(true)
      const res = await adminService.getRoleById(id)
      setRole(res.data?.role || res.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load role')
      navigate(LIST_PATH)
    } finally {
      setRoleLoading(false)
    }
  }

  useEffect(() => {
    loadRole()
    fetchAssignments(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchAssignments(1, search, statusFilter, sortDir)
  }

  const hasActiveFilters = search || statusFilter !== 'all' || sortDir !== 'desc'

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setSortDir('desc')
    fetchAssignments(1, '', 'all', 'desc')
  }

  const loadAvailableUsers = async () => {
    if (availableUsers.length) return
    try {
      setUsersLoading(true)
      // Admin Users only — a dedicated collection, never the marketplace Users list.
      const res = await adminService.getAdminUsers({ limit: 500 })
      setAvailableUsers(res.data?.adminUsers || [])
    } catch {
      // Selection list can stay empty; the searchable select will just show no options.
    } finally {
      setUsersLoading(false)
    }
  }

  const openAssignModal = () => {
    setEditingAssignment(null)
    setFormUserId('')
    setFormStatus('active')
    setFormNotes('')
    setFormOpen(true)
    loadAvailableUsers()
  }

  const openEditModal = (assignment) => {
    setEditingAssignment(assignment)
    setFormUserId(assignment.adminUserId?._id || '')
    setFormStatus(assignment.status || 'active')
    setFormNotes(assignment.notes || '')
    setFormOpen(true)
  }

  const closeFormModal = () => {
    if (saving) return
    setFormOpen(false)
  }

  const handleSaveAssignment = async () => {
    if (!editingAssignment && !formUserId) {
      toast.error('Select an admin user')
      return
    }
    try {
      setSaving(true)
      if (editingAssignment) {
        await adminService.updateRoleAssignment(editingAssignment._id, {
          status: formStatus,
          notes: formNotes,
        })
        toast.success('Assignment updated')
      } else {
        await adminService.createRoleAssignment({
          adminUserId: formUserId,
          roleId: id,
          status: formStatus,
          notes: formNotes,
        })
        toast.success('Role assigned')
      }
      setFormOpen(false)
      await fetchAssignments(editingAssignment ? page : 1, search, statusFilter, sortDir)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save assignment')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (assignment) => {
    const name = assignment.adminUserId?.name || 'this user'
    if (!window.confirm(`Remove ${name} from the ${role?.role_name || 'role'} role?`)) return
    try {
      await adminService.deleteRoleAssignment(assignment._id)
      toast.success('User unassigned')
      fetchAssignments(page, search, statusFilter, sortDir)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove assignment')
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
      const params = { roleId: id, fromDate: exportFromDate, toDate: exportToDate }
      if (exportApplyFilters) {
        if (statusFilter !== 'all') params.status = statusFilter
        if (search) params.search = search
      }

      const res = await adminService.exportRoleAssignments(params)
      const blob = res.data instanceof Blob
        ? res.data
        : new Blob([res.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

      if (blob.type && blob.type.includes('application/json')) {
        const text = await blob.text()
        let message = 'Failed to export assignments'
        try {
          message = JSON.parse(text)?.message || message
        } catch { /* ignore */ }
        throw new Error(message)
      }

      const disposition = res.headers?.['content-disposition'] || ''
      const match = disposition.match(/filename="?([^"]+)"?/i)
      const roleSlug = (role?.role_name || 'role').toLowerCase().replace(/\s+/g, '-')
      const filename = match?.[1] || `${roleSlug}-assigned-users-${exportFromDate}_${exportToDate}.xlsx`

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

  if (roleLoading) {
    return (
      <AdminPage>
        <p className="text-sm text-slate-500 py-8">Loading…</p>
      </AdminPage>
    )
  }

  return (
    <AdminPage>
      <PageHeader
        title={`Assign Users — ${role?.role_name || 'Role'}`}
        subtitle={`${total} user${total === 1 ? '' : 's'} assigned to this role`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(LIST_PATH)}>
              Back to Roles
            </Button>
            <Button variant="secondary" icon={FileSpreadsheet} onClick={openExportModal}>
              Export Excel
            </Button>
            {canCreate ? (
              <Button icon={UserPlus} onClick={openAssignModal}>
                Assign User
              </Button>
            ) : null}
          </div>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search by name or email..."
        filters={[
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
          {
            key: 'sort',
            type: 'select',
            label: 'Sort by',
            value: sortDir,
            onChange: (e) => {
              setSortDir(e.target.value)
              fetchAssignments(1, search, statusFilter, e.target.value)
            },
            options: [
              { value: 'desc', label: 'Newest assigned first' },
              { value: 'asc', label: 'Oldest assigned first' },
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

      <DataTable
        columns={[
          {
            key: 'adminUser',
            title: 'User',
            render: (r) => (
              <div className="min-w-[160px]">
                <p className="font-medium text-slate-900 dark:text-white">{r.adminUserId?.name || '—'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{r.adminUserId?.email || '—'}</p>
              </div>
            ),
          },
          {
            key: 'status',
            title: 'Status',
            render: (r) => <StatusBadge status={r.status === 'active' ? 'active' : 'inactive'} />,
          },
          {
            key: 'assignedBy',
            title: 'Assigned By',
            render: (r) => r.assignedBy?.name || r.assignedBy?.email || '—',
          },
          {
            key: 'assignedAt',
            title: 'Assigned At',
            render: (r) => formatDate(r.assignedAt),
          },
          {
            key: 'notes',
            title: 'Notes',
            wrap: true,
            render: (r) => r.notes || '—',
          },
        ]}
        data={assignments}
        loading={loading}
        serverSide
        showSearch={false}
        emptyTitle="No users assigned"
        emptyDescription={`Assign an admin user to the ${role?.role_name || 'role'} to get started.`}
        pagination={{
          page,
          limit: LIMIT,
          total,
          onPageChange: (p) => fetchAssignments(p, search, statusFilter, sortDir),
        }}
        onEdit={canEdit ? (row) => openEditModal(row) : undefined}
        onDelete={canDelete ? handleRemove : undefined}
      />

      <Modal
        open={formOpen}
        onClose={closeFormModal}
        title={editingAssignment ? 'Edit Assignment' : 'Assign User'}
        footer={
          <Modal.Footer
            onCancel={closeFormModal}
            onConfirm={handleSaveAssignment}
            confirmLabel={editingAssignment ? 'Update' : 'Assign'}
            loading={saving}
          />
        }
      >
        <div className="space-y-4">
          {editingAssignment ? (
            <Input
              label="Admin User"
              value={`${editingAssignment.adminUserId?.name || ''} (${editingAssignment.adminUserId?.email || ''})`}
              disabled
            />
          ) : (
            <SearchableSelect
              label="Admin User"
              value={formUserId}
              onChange={(e) => setFormUserId(e.target.value)}
              placeholder={usersLoading ? 'Loading users…' : 'Choose an admin user…'}
              searchPlaceholder="Search by name or email…"
              disabled={usersLoading}
              options={availableUsers.map((u) => ({
                value: u._id,
                label: `${u.name} (${u.email})`,
              }))}
            />
          )}

          <Input label="Role" value={role?.role_name || ''} disabled hint="This assignment is scoped to the current role." />

          <Select
            label="Status"
            value={formStatus}
            onChange={(e) => setFormStatus(e.target.value)}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />

          <Textarea
            label="Assignment Notes"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="Optional — reason for this assignment, ticket reference, etc."
          />
        </div>
      </Modal>

      <Modal
        open={exportOpen}
        onClose={closeExportModal}
        title="Export Assigned Users to Excel"
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
          Choose the assignment-date range you want to export for this role.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="role-assign-export-from-date">
              From Date
            </label>
            <input
              id="role-assign-export-from-date"
              type="date"
              value={exportFromDate}
              max={exportToDate || undefined}
              onChange={(e) => setExportFromDate(e.target.value)}
              required
              className="admin-input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" htmlFor="role-assign-export-to-date">
              To Date
            </label>
            <input
              id="role-assign-export-to-date"
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

export default AssignUsersPage
