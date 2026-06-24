import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@shared/services/api'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import Input from '../../components/AdminUI/Input'
import Select from '../../components/AdminUI/Select'
import toast from 'react-hot-toast'

const LIST_PATH = '/admin/roles'

function RoleFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [form, setForm] = useState({ role_name: '', description: '', status: 'active' })

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    const load = async () => {
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
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load role')
        navigate(LIST_PATH)
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isEdit, navigate])

  const handleSubmit = async () => {
    if (!form.role_name.trim()) {
      toast.error('Role name is required')
      return
    }
    try {
      setLoading(true)
      if (isEdit) {
        await adminService.updateRole(id, form)
        toast.success('Role updated')
      } else {
        await adminService.createRole(form)
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
      title={isEdit ? 'Edit Role' : 'Create New Role'}
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Update' : 'Create'}
    >
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
    </AdminFormShell>
  )
}

export default RoleFormPage
