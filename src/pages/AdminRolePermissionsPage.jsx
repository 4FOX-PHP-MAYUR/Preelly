import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminService } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Shield } from 'lucide-react'

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
      toast.error('Failed to load permissions')
      navigate('/admin/roles')
    } finally {
      setLoading(false)
    }
  }

  const togglePermission = (moduleIndex, field) => {
    setPermissions((prev) => {
      const updated = [...prev]
      updated[moduleIndex] = {
        ...updated[moduleIndex],
        [field]: !updated[moduleIndex][field],
      }
      return updated
    })
  }

  const toggleAllForModule = (moduleIndex) => {
    setPermissions((prev) => {
      const updated = [...prev]
      const mod = updated[moduleIndex]
      const allChecked = mod.can_view && mod.can_create && mod.can_edit && mod.can_delete
      updated[moduleIndex] = {
        ...mod,
        can_view: !allChecked,
        can_create: !allChecked,
        can_edit: !allChecked,
        can_delete: !allChecked,
      }
      return updated
    })
  }

  const selectAll = () => {
    setPermissions((prev) =>
      prev.map((mod) => ({
        ...mod,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true,
      }))
    )
  }

  const deselectAll = () => {
    setPermissions((prev) =>
      prev.map((mod) => ({
        ...mod,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      }))
    )
  }

  const handleSave = async () => {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/roles')}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Roles
        </button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                Permissions — {role?.role_name}
              </h1>
              <p className="text-sm text-gray-600">
                Configure module access for this role
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200"
            >
              Deselect All
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Permissions
            </button>
          </div>
        </div>
      </div>

      {/* Permissions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="responsive-table-wrap">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Module
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                View
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Create
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Edit
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Delete
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                All
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {permissions.map((mod, idx) => {
              const allChecked = mod.can_view && mod.can_create && mod.can_edit && mod.can_delete
              return (
                <tr key={mod.module_name} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">{mod.module_name}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={mod.can_view}
                      onChange={() => togglePermission(idx, 'can_view')}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={mod.can_create}
                      onChange={() => togglePermission(idx, 'can_create')}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={mod.can_edit}
                      onChange={() => togglePermission(idx, 'can_edit')}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={mod.can_delete}
                      onChange={() => togglePermission(idx, 'can_delete')}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={() => toggleAllForModule(idx)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Bottom Save */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Permissions
        </button>
      </div>
    </div>
  )
}

export default AdminRolePermissionsPage
