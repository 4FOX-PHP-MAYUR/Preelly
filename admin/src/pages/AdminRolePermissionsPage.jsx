import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminService } from '@/services/api'
import {
  AdminPage,
  PageHeader,
  Button,
  Panel,
} from '../components/AdminUI'
import PermissionMatrix from './roles/PermissionMatrix'
import { hasAnyPermissionSelected } from '../utils/adminPermissions'
import toast from 'react-hot-toast'
import { ArrowLeft, Save } from 'lucide-react'

function AdminRolePermissionsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [role, setRole] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPermissions()
  }, [id])

  const fetchPermissions = async () => {
    try {
      setLoading(true)
      const res = await adminService.getRolePermissions(id)
      setRole(res.data.role)
      setPermissions(res.data.permissions || [])
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to load permissions')
      navigate('/roles')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (role?.is_system) {
      toast.error('Super Admin permissions cannot be modified')
      return
    }
    if (!hasAnyPermissionSelected(permissions)) {
      toast.error('At least one permission must be selected')
      return
    }
    try {
      setSaving(true)
      await adminService.saveRolePermissions(id, permissions)
      toast.success('Permissions saved successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      </AdminPage>
    )
  }

  const isSystem = !!role?.is_system

  return (
    <AdminPage>
      <PageHeader
        title={`Permissions — ${role?.role_name || ''}`}
        subtitle="Configure module access for this role"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/roles')}>
              Back
            </Button>
            {!isSystem && (
              <Button icon={Save} onClick={handleSave} loading={saving}>
                Save Permissions
              </Button>
            )}
          </div>
        }
      />

      {isSystem && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Super Admin permissions cannot be modified.
        </div>
      )}

      <Panel>
        <PermissionMatrix
          permissions={permissions}
          onChange={setPermissions}
          readOnly={isSystem}
        />
      </Panel>
    </AdminPage>
  )
}

export default AdminRolePermissionsPage
