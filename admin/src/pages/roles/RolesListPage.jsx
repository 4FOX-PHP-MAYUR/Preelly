import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import {
  AdminPage,
  PageHeader,
  DataTable,
  Button,
  FilterBar,
  StatusBadge,
} from '../../components/AdminUI'
import toast from 'react-hot-toast'
import { Settings, Plus } from 'lucide-react'

const LIST_PATH = '/admin/roles'

function RolesListPage() {
  const navigate = useNavigate()
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
      toast.error('Failed to load roles')
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
    if (!window.confirm('Are you sure you want to delete this role?')) return
    try {
      await adminService.deleteRole(row._id)
      toast.success('Role deleted')
      fetchRoles(search, statusFilter)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete role')
    }
  }

  return (
    <AdminPage>
      <PageHeader
        title="Admin Roles"
        subtitle="Manage admin roles and their permissions"
        action={<Button onClick={() => navigate(`${LIST_PATH}/new`)} icon={Plus}>Add Role</Button>}
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
          (search || statusFilter !== 'all') ? (
            <Button variant="secondary" onClick={() => { setSearch(''); setStatusFilter('all'); fetchRoles('', 'all') }}>
              Clear
            </Button>
          ) : null
        }
      />

      <DataTable
        columns={[
          { key: 'role_name', title: 'Role Name', render: (r) => <span className="font-medium">{r.role_name}</span> },
          { key: 'description', title: 'Description', render: (r) => r.description || '—' },
          {
            key: 'status',
            title: 'Status',
            render: (r) => <StatusBadge status={r.status === 'active' ? 'active' : 'inactive'} />,
          },
        ]}
        data={roles}
        loading={loading}
        emptyTitle="No roles found"
        emptyDescription="Create your first admin role to get started."
        onEdit={(role) => navigate(`${LIST_PATH}/${role._id}/edit`)}
        onDelete={handleDelete}
        customActions={(role) => (
          <Button
            variant="ghost"
            size="sm"
            icon={Settings}
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/admin/roles/${role._id}/permissions`)
            }}
          >
            Permissions
          </Button>
        )}
        showSearch={false}
      />
    </AdminPage>
  )
}

export default RolesListPage
