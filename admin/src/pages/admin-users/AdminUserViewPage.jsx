import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@/services/api'
import {
  AdminPage,
  PageHeader,
  Panel,
  Button,
  StatusBadge,
  FormSection,
} from '../../components/AdminUI'
import { usePermission } from '../../hooks/usePermission'
import { ArrowLeft, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { getMediaUrl } from '@shared/utils/helpers'

const LIST_PATH = '/admin-users'

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">{children ?? '—'}</p>
    </div>
  )
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AdminUserViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canEdit } = usePermission('Admin Users')
  const [adminUser, setAdminUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await adminService.getAdminUserById(id)
        if (!cancelled) setAdminUser(res.data?.adminUser)
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load admin user')
        navigate(LIST_PATH)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, navigate])

  if (loading) {
    return (
      <AdminPage>
        <p className="text-sm text-slate-500 py-8">Loading…</p>
      </AdminPage>
    )
  }
  if (!adminUser) return null

  const avatarSrc = adminUser.avatar ? getMediaUrl(adminUser.avatar) || adminUser.avatar : null

  return (
    <AdminPage>
      <PageHeader
        title={adminUser.name}
        subtitle={adminUser.email}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(LIST_PATH)}>
              Back to list
            </Button>
            {canEdit && (
              <Button icon={Pencil} onClick={() => navigate(`${LIST_PATH}/${adminUser._id}/edit`)}>
                Edit
              </Button>
            )}
          </div>
        }
      />

      <Panel>
        <div className="space-y-6">
          <FormSection title="Profile">
            <div className="flex items-center gap-4">
              {avatarSrc ? (
                <img src={avatarSrc} alt={adminUser.name} className="h-16 w-16 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg font-medium text-slate-500">
                  {(adminUser.name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 flex-1">
                <Field label="User Name">{adminUser.name}</Field>
                <Field label="Status">
                  <StatusBadge status={adminUser.status === 'active' ? 'active' : 'inactive'} />
                </Field>
              </div>
            </div>
          </FormSection>

          <FormSection title="Contact">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Email">{adminUser.email}</Field>
              <Field label="Mobile Number">{adminUser.phone}</Field>
              <Field label="Role">{adminUser.adminRole?.role_name}</Field>
            </div>
          </FormSection>

          <FormSection title="Activity">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Last Login">{adminUser.lastLoginAt ? formatDate(adminUser.lastLoginAt) : 'Never'}</Field>
              <Field label="Created By">{adminUser.createdBy?.name || adminUser.createdBy?.email}</Field>
              <Field label="Created At">{formatDate(adminUser.createdAt)}</Field>
            </div>
          </FormSection>
        </div>
      </Panel>
    </AdminPage>
  )
}

export default AdminUserViewPage
