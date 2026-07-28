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
} from '../../components/AdminUI'
import { usePermission } from '../../hooks/usePermission'
import toast from 'react-hot-toast'
import { Settings, Plus, Users } from 'lucide-react'

const LIST_PATH = '/roles'

function RolesListPage() {
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = usePermission('Settings')
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchRoles = async (searchTerm = '', status = statusFilter) => {
    try {
      setLoading(true)
      const params = { limit: 100 }
      if (searchTerm.trim()) params.search = searchTerm.trim()
      if (status && status !== 'all') params.status = status
      const res = await adminService.getRoles(params)
      setRoles(res.data.roles || [])
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to load roles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchRoles(search, statusFilter)
  }

  const handleDelete = async (row) => {
    if (row.is_system) {
      toast.error('Super Admin role cannot be deleted')
      return
    }
    const assigned = Number(row.userCount) || 0
    const message =
      assigned > 0
        ? `This role is assigned to ${assigned} user(s). Deleting it will remove the role from those users. Continue?`
        : 'Are you sure you want to delete this role?'
    if (!window.confirm(message)) return
    try {
      await adminService.deleteRole(row._id)
      toast.success(assigned > 0 ? 'Role deleted and users unassigned' : 'Role deleted')
      fetchRoles(search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete role')
    }
  }

  return (
    <AdminPage>
      <PageHeader
        title="Admin Roles"
        subtitle="Manage admin roles, permissions, and user assignments"
        action={
          canCreate ? (
            <Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>
              Add Role
            </Button>
          ) : null
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search roles..."
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
        ]}
        actions={
          search || statusFilter !== 'all' ? (
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
                fetchRoles('', 'all')
              }}
            >
              Clear
            </Button>
          ) : null
        }
      />

      <DataTable
        columns={[
          {
            key: 'role_name',
            title: 'Role Name',
            render: (r) => (
              <span className="font-medium">
                {r.role_name}
                {r.is_system ? (
                  <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                    System
                  </span>
                ) : null}
              </span>
            ),
          },
          { key: 'description', title: 'Description', render: (r) => r.description || '—' },
          {
            key: 'status',
            title: 'Status',
            render: (r) => <StatusBadge status={r.status === 'active' ? 'active' : 'inactive'} />,
          },
          {
            key: 'userCount',
            title: 'Users',
            render: (r) => r.userCount ?? 0,
          },
        ]}
        data={roles}
        loading={loading}
        emptyTitle="No roles found"
        emptyDescription="Create your first admin role to get started."
        onEdit={
          canEdit
            ? (role) => navigate(`${LIST_PATH}/${role._id}/edit`)
            : undefined
        }
        onDelete={canDelete ? handleDelete : undefined}
        canDeleteRow={(role) => !role.is_system}
        customActions={(role) => (
          <div className="flex items-center gap-1">
            {canEdit && !role.is_system && (
              <Button
                variant="ghost"
                size="sm"
                icon={Settings}
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`${LIST_PATH}/${role._id}/permissions`)
                }}
              >
                Permissions
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                icon={Users}
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`${LIST_PATH}/${role._id}/assign`)
                }}
              >
                Assign
              </Button>
            )}
          </div>
        )}
        showSearch={false}
      />
    </AdminPage>
  )
}

export default RolesListPage
