import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@/services/api'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import Input from '../../components/AdminUI/Input'
import Select from '../../components/AdminUI/Select'
import FormSection from '../../components/AdminUI/FormSection'
import toast from 'react-hot-toast'

const LIST_PATH = '/users'

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'user',
  status: 'active',
}

function UserFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    const load = async () => {
      try {
        setLoadingRecord(true)
        const res = await adminService.getUserById(id)
        const row = res.data?.user || res.data
        if (!row) throw new Error('User not found')
        if (cancelled) return
        setForm({
          name: row.name || '',
          email: row.email || '',
          phone: row.phone || '',
          password: '',
          role: row.role === 'admin' ? 'admin' : 'user',
          status: row.status === 'inactive' ? 'inactive' : 'active',
        })
      } catch (err) {
        toast.error(err.response?.data?.message || err.message || 'Failed to load user')
        navigate(LIST_PATH)
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isEdit, navigate])

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error('Name is required')
      return
    }
    if (!form.email?.trim()) {
      toast.error('Email is required')
      return
    }
    if (!form.phone?.trim()) {
      toast.error('Phone is required')
      return
    }
    if (!isEdit && (!form.password || form.password.length < 6)) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (isEdit && form.password && form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    try {
      setLoading(true)
      if (isEdit) {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          role: form.role,
          status: form.status,
        }
        if (form.password) payload.password = form.password
        await adminService.updateUser(id, payload)
        toast.success('User updated')
      } else {
        await adminService.createUser({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          role: form.role,
          status: form.status,
        })
        toast.success('User created')
      }
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save user')
    } finally {
      setLoading(false)
    }
  }

  if (loadingRecord) {
    return (
      <AdminFormShell title={isEdit ? 'Edit User' : 'Add User'} backTo={LIST_PATH} onSubmit={() => {}}>
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  return (
    <AdminFormShell
      title={isEdit ? 'Edit User' : 'Add User'}
      subtitle={isEdit ? 'Update user account details' : 'Create a new user account'}
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSave}
      submitLabel={isEdit ? 'Save Changes' : 'Create User'}
    >
      <FormSection title="Basic information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="Full name"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            placeholder="email@example.com"
          />
          <Input
            label="Mobile Number"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
            placeholder="Phone number"
          />
        </div>
      </FormSection>

      <FormSection title="Account">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!isEdit}
            placeholder="Min 6 characters"
            hint={isEdit ? 'Leave blank to keep current password' : undefined}
          />
          <Select
            label="User Type"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[
              { value: 'user', label: 'User' },
              { value: 'admin', label: 'Admin' },
            ]}
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
        </div>
      </FormSection>
    </AdminFormShell>
  )
}

export default UserFormPage
