import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminService } from '@/services/api'
import {
  AdminPage,
  PageHeader,
  Panel,
  Button,
  SearchableSelect,
  StatusBadge,
} from '../../components/AdminUI'
import PermissionMatrix from '../roles/PermissionMatrix'
import { emptyPermissionMatrix, hasAnyPermissionSelected } from '../../utils/adminPermissions'
import { usePermission } from '../../hooks/usePermission'
import toast from 'react-hot-toast'
import { Save, RotateCcw } from 'lucide-react'

/**
 * Standalone Role Permissions module — select a role, load the modules ×
 * actions matrix, edit, save. Reuses the exact same PermissionMatrix
 * component, APIs (getRolePermissions/saveRolePermissions), and
 * role_permissions storage as the per-role "Permissions" action on the
 * Admin Roles list — this page is just a second, role-first entry point
 * into the same data (no duplicated permission logic).
 */
function RolePermissionsPage() {
  const { canEdit } = usePermission('Settings')
  const [searchParams, setSearchParams] = useSearchParams()

  const [roles, setRoles] = useState([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [roleId, setRoleId] = useState(() => searchParams.get('roleId') || '')
  const [role, setRole] = useState(null)
  const [permissions, setPermissions] = useState(emptyPermissionMatrix())
  const [originalPermissions, setOriginalPermissions] = useState(emptyPermissionMatrix())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminService
      .getRoles({ limit: 200 })
      .then((res) => setRoles(res.data?.roles || []))
      .catch(() => toast.error('Failed to load roles'))
      .finally(() => setRolesLoading(false))
  }, [])

  const loadPermissions = async (id) => {
    if (!id) {
      setRole(null)
      setPermissions(emptyPermissionMatrix())
      setOriginalPermissions(emptyPermissionMatrix())
      return
    }
    try {
      setLoading(true)
      const res = await adminService.getRolePermissions(id)
      setRole(res.data?.role || null)
      const matrix = res.data?.permissions || emptyPermissionMatrix()
      setPermissions(matrix)
      setOriginalPermissions(matrix)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load permissions for this role')
      setRole(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPermissions(roleId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId])

  const handleSelectRole = (e) => {
    const id = e.target.value
    setRoleId(id)
    setSearchParams(id ? { roleId: id } : {})
  }

  const isSystem = !!role?.is_system
  const locked = !canEdit || isSystem

  const handleSave = async () => {
    if (!roleId) {
      toast.error('Select a role first')
      return
    }
    if (!hasAnyPermissionSelected(permissions)) {
      toast.error('At least one permission must be selected')
      return
    }
    try {
      setSaving(true)
      const res = await adminService.saveRolePermissions(roleId, permissions)
      const saved = res.data?.permissions || permissions
      setPermissions(saved)
      setOriginalPermissions(saved)
      toast.success('Permissions saved — assigned users get the update immediately')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setPermissions(originalPermissions)
    toast.success('Changes reset')
  }

  const isDirty = JSON.stringify(permissions) !== JSON.stringify(originalPermissions)

  return (
    <AdminPage>
      <PageHeader
        title="Role Permissions"
        subtitle="Select a role to view and manage its module-level permissions"
      />

      <Panel className="mb-6">
        <div className="max-w-md">
          <SearchableSelect
            label="Role"
            value={roleId}
            onChange={handleSelectRole}
            placeholder={rolesLoading ? 'Loading roles…' : 'Choose a role…'}
            searchPlaceholder="Search roles…"
            disabled={rolesLoading}
            options={roles.map((r) => ({ value: r._id, label: r.role_name }))}
          />
        </div>
      </Panel>

      {loading && (
        <Panel>
          <p className="text-sm text-slate-500 py-4">Loading permissions…</p>
        </Panel>
      )}

      {!loading && roleId && role && (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{role.role_name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {role.description || 'No description'}
              </p>
            </div>
            <StatusBadge status={role.status === 'active' ? 'active' : 'inactive'} />
          </div>

          {isSystem && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-4">
              Super Admin always has full access to every module — permissions cannot be changed for this role.
            </div>
          )}

          <PermissionMatrix permissions={permissions} onChange={setPermissions} readOnly={locked} />

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            Export actions are governed by each module's <strong>View</strong> permission — there is no
            separate export permission to avoid duplicating the existing permission model.
          </p>

          {!locked && (
            <div className="flex flex-wrap justify-end gap-2 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <Button variant="secondary" icon={RotateCcw} onClick={handleReset} disabled={!isDirty || saving}>
                Reset
              </Button>
              <Button icon={Save} onClick={handleSave} loading={saving}>
                Save Permissions
              </Button>
            </div>
          )}
        </Panel>
      )}

      {!loading && !roleId && (
        <Panel>
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
            Select a role above to view and manage its permissions.
          </p>
        </Panel>
      )}
    </AdminPage>
  )
}

export default RolePermissionsPage
