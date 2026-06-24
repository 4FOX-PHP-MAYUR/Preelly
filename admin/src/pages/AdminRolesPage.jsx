import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import {
  AdminPage,
  PageHeader,
  DataTable,
  Button,
  Drawer,
  Input,
  Select,
  FilterBar,
  StatusBadge,
} from '../components/AdminUI'
import toast from 'react-hot-toast'
import { Settings, Plus } from 'lucide-react'

function AdminRolesPage() {
  const navigate = useNavigate()
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ role_name: '', description: '', status: 'active' })
  const [search, setSearch] = useState('')

  const fetchRoles = async (searchTerm = '') => {
    try {
      setLoading(true)
      const params = { limit: 100 }
      if (searchTerm.trim()) params.search = searchTerm.trim()
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
    fetchRoles(search)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ role_name: '', description: '', status: 'active' })
    setShowForm(true)
  }

  const openEdit = (role) => {
    setEditing(role)
    setForm({
      role_name: role.role_name,
      description: role.description || '',
      status: role.status,
    })
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.role_name.trim()) {
      toast.error('Role name is required')
      return
    }
    try {
      if (editing) {
        await adminService.updateRole(editing._id, form)
        toast.success('Role updated')
      } else {
        await adminService.createRole(form)
        toast.success('Role created')
      }
      setShowForm(false)
      setEditing(null)
      fetchRoles(search)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save role')
    }
  }

  const handleDelete = async (row) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return
    try {
      await adminService.deleteRole(row._id)
      toast.success('Role deleted')
      fetchRoles(search)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete role')
    }
  }

  return (
    <AdminPage>
      <PageHeader
        title="Admin Roles"
        subtitle="Manage admin roles and their permissions"
        action={<Button onClick={openAdd} icon={Plus}>Add Role</Button>}
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        searchPlaceholder="Search roles..."
        actions={
          search ? (
            <Button variant="secondary" onClick={() => { setSearch(''); fetchRoles('') }}>
              Clear
            </Button>
          ) : null
        }
      />

      <Drawer
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Role' : 'Create New Role'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} icon={Plus}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Role Name"
            value={form.role_name}
            onChange={(e) => setForm({ ...form, role_name: e.target.value })}
            placeholder="e.g. Super Admin"
            required
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional description"
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </form>
      </Drawer>

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
        onEdit={openEdit}
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

export default AdminRolesPage
