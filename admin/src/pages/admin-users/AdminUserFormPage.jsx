import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@/services/api'
import AdminFormShell from '../../components/AdminUI/AdminFormShell'
import Input from '../../components/AdminUI/Input'
import Select from '../../components/AdminUI/Select'
import FormSection from '../../components/AdminUI/FormSection'
import toast from 'react-hot-toast'
import { getMediaUrl } from '@shared/utils/helpers'

const LIST_PATH = '/admin-users'
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png']

function AdminUserFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(false)
  const [loadingRecord, setLoadingRecord] = useState(isEdit)
  const [roles, setRoles] = useState([])
  const [existingAvatar, setExistingAvatar] = useState('')
  const [form, setForm] = useState({
    name: '',
    mobileNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    roleId: '',
    status: 'active',
    profileImage: null,
    imagePreview: '',
  })

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const rolesRes = await adminService.getRoles({ limit: 200, status: 'active' })
        if (!cancelled) setRoles(rolesRes.data?.roles || [])

        if (isEdit) {
          const res = await adminService.getAdminUserById(id)
          const row = res.data?.adminUser
          if (!row) throw new Error('Admin user not found')
          if (cancelled) return
          setForm((prev) => ({
            ...prev,
            name: row.name || '',
            mobileNumber: row.phone || '',
            email: row.email || '',
            roleId: row.adminRole?._id || '',
            status: row.status || 'active',
          }))
          setExistingAvatar(row.avatar || '')
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load admin user')
        navigate(LIST_PATH)
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id, isEdit, navigate])

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null
    if (!file) {
      setForm((prev) => ({ ...prev, profileImage: null, imagePreview: '' }))
      return
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Only JPG, JPEG, or PNG images are allowed')
      e.target.value = ''
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Profile image must be 2 MB or smaller')
      e.target.value = ''
      return
    }
    setForm((prev) => ({ ...prev, profileImage: file, imagePreview: URL.createObjectURL(file) }))
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('User name is required')
      return
    }
    if (!form.mobileNumber.trim()) {
      toast.error('Mobile number is required')
      return
    }
    if (!form.email.trim()) {
      toast.error('Email is required')
      return
    }
    if (!isEdit && !form.password) {
      toast.error('Password is required')
      return
    }
    if (form.password && form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Password and Confirm Password do not match')
      return
    }
    if (!form.roleId) {
      toast.error('Select a role')
      return
    }

    const payload = {
      name: form.name.trim(),
      mobileNumber: form.mobileNumber.trim(),
      email: form.email.trim(),
      roleId: form.roleId,
      status: form.status,
      profileImage: form.profileImage || undefined,
    }
    if (form.password) {
      payload.password = form.password
      payload.confirmPassword = form.confirmPassword
    }

    try {
      setLoading(true)
      if (isEdit) {
        await adminService.updateAdminUser(id, payload)
        toast.success('Admin user updated')
      } else {
        await adminService.createAdminUser(payload)
        toast.success('Admin user created')
      }
      navigate(LIST_PATH)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save admin user')
    } finally {
      setLoading(false)
    }
  }

  if (loadingRecord) {
    return (
      <AdminFormShell title={isEdit ? 'Edit Admin User' : 'Add Admin User'} backTo={LIST_PATH} onSubmit={() => {}}>
        <p className="text-sm text-slate-500">Loading…</p>
      </AdminFormShell>
    )
  }

  const previewSrc = form.imagePreview || (existingAvatar ? getMediaUrl(existingAvatar) || existingAvatar : '')

  return (
    <AdminFormShell
      title={isEdit ? 'Edit Admin User' : 'Add Admin User'}
      subtitle="Manage an admin account and its assigned role"
      backTo={LIST_PATH}
      loading={loading}
      onSubmit={handleSubmit}
      submitLabel={isEdit ? 'Update Admin User' : 'Create Admin User'}
    >
      <FormSection title="Account Details">
        <Input
          label="User Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Mayur Mankar"
          required
        />
        <Input
          label="Mobile Number"
          value={form.mobileNumber}
          onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
          placeholder="e.g. +971 50 123 4567"
          required
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="admin@example.com"
          required
        />
        <Select
          label="Role"
          value={form.roleId}
          onChange={(e) => setForm({ ...form, roleId: e.target.value })}
          required
          options={[
            { value: '', label: 'Choose a role…' },
            ...roles.map((r) => ({ value: r._id, label: r.role_name })),
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
      </FormSection>

      <FormSection title="Password">
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder={isEdit ? 'Leave blank to keep current password' : 'Minimum 6 characters'}
          required={!isEdit}
        />
        <Input
          label="Confirm Password"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          placeholder="Re-enter password"
          required={!isEdit || !!form.password}
        />
      </FormSection>

      <FormSection title="Profile Image">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Profile Image <span className="text-slate-400 font-normal">(JPG or PNG, max 2 MB, optional)</span>
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleImageChange}
            className="admin-input file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700"
          />
          {previewSrc && (
            <img
              src={previewSrc}
              alt="Profile preview"
              className="mt-3 h-20 w-20 rounded-full object-cover border border-slate-200 dark:border-slate-700"
            />
          )}
        </div>
      </FormSection>
    </AdminFormShell>
  )
}

export default AdminUserFormPage
