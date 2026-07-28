import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@/services/api'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import Input from '../../components/AdminUI/Input'
import Select from '../../components/AdminUI/Select'
import PermissionMatrix from './PermissionMatrix'
import {
  emptyPermissionMatrix,
  hasAnyPermissionSelected,
} from '../../utils/adminPermissions'
import toast from 'react-hot-toast'

const LIST_PATH = '/roles'

function RoleFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [isSystem, setIsSystem] = useState(false)
  const [form, setForm] = useState({ role_name: '', description: '', status: 'active' })
  const [permissions, setPermissions] = useState(emptyPermissionMatrix())

  useEffect(() => {
    let cancelled = false

    const loadModules = async () => {
      try {
        const res = await adminService.getModules()
        const modules = res.data?.modules
        if (!cancelled && Array.isArray(modules) && modules.length) {
          setPermissions((prev) => {
            const map = Object.fromEntries(prev.map((p) => [p.module_name, p]))
            return modules.map((module_name) => map[module_name] || {
              module_name,
              can_view: false,
              can_create: false,
              can_edit: false,
              can_delete: false,
            })
          })
        }
      } catch {
        // keep defaults
      }
    }

    const loadRole = async () => {
      if (!isEdit) {
        await loadModules()
        if (!cancelled) setLoadingRecord(false)
        return
      }
      try {
        setLoadingRecord(true)
        const res = await adminService.getRoleById(id)
        const row = res.data?.role || res.data
        if (!row) throw new Error('Role not found')
        if (cancelled) return
        setForm({
          role_name: row.role_name || '',
          description: row.description || '',
          status: row.status || 'active',
        })
        setIsSystem(!!row.is_system)
        if (Array.isArray(res.data?.permissions) && res.data.permissions.length) {
          setPermissions(res.data.permissions)
        } else {
          const permRes = await adminService.getRolePermissions(id)
          if (!cancelled) {
            setPermissions(permRes.data?.permissions || emptyPermissionMatrix())
          }
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load role')
        navigate(LIST_PATH)
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    }

    loadRole()
    return () => { cancelled = true }
  }, [id, isEdit, navigate])

  const handleSubmit = async () => {
    if (isSystem) {
      toast.error('Super Admin role cannot be modified')
      return
    }
    if (!form.role_name.trim()) {
      toast.error('Role name is required')
      return
    }
    if (!hasAnyPermissionSelected(permissions)) {
      toast.error('At least one permission must be selected')
      return
    }
    try {
      setLoading(true)
      const payload = { ...form, permissions }
      if (isEdit) {
        await adminService.updateRole(id, payload)
        toast.success('Role updated')
      } else {
        await adminService.createRole(payload)
        toast.success('Role created')
      }
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save role')
    } finally {
      setLoading(false)
    }
  }

  if (loadingRecord) {
    return (
      <AdminFormShell title={isEdit ? 'Edit Role' : 'Create Role'} backTo={LIST_PATH} onSubmit={() => {}}>
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  return (
    <AdminFormShell
      title={isEdit ? (isSystem ? 'View Role' : 'Edit Role') : 'Create New Role'}
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSubmit}
      submitLabel={isSystem ? undefined : isEdit ? 'Update Role' : 'Create Role'}
      hideSubmit={isSystem}
    >
      {isSystem && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Super Admin is a system role and cannot be modified or deleted.
        </div>
      )}
      <Input
        label="Role Name"
        value={form.role_name}
        onChange={(e) => setForm({ ...form, role_name: e.target.value })}
        placeholder="e.g. Content Manager"
        required
        disabled={isSystem}
      />
      <Input
        label="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder="Optional description"
        disabled={isSystem}
      />
      <Select
        label="Status"
        value={form.status}
        onChange={(e) => setForm({ ...form, status: e.target.value })}
        disabled={isSystem}
        options={[
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ]}
      />
      <PermissionMatrix
        permissions={permissions}
        onChange={setPermissions}
        readOnly={isSystem}
      />
    </AdminFormShell>
  )
}

export default RoleFormPage
