import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { adminService } from '@/services/api'
import {
  AdminPage,
  PageHeader,
  Button,
  Panel,
  Select,
  StatusBadge,
} from '../../components/AdminUI'
import toast from 'react-hot-toast'
import { ArrowLeft, UserPlus } from 'lucide-react'

const LIST_PATH = '/roles'

function AssignUsersPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [role, setRole] = useState(null)
  const [assignedUsers, setAssignedUsers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [removingId, setRemovingId] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const [roleRes, usersRes, allRes] = await Promise.all([
        adminService.getRoleById(id),
        adminService.getRoleUsers(id),
        adminService.getUsers({ limit: 200 }),
      ])
      setRole(roleRes.data?.role || roleRes.data)
      setAssignedUsers(usersRes.data?.users || [])
      setAllUsers(allRes.data?.users || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load role users')
      navigate(LIST_PATH)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const availableUsers = allUsers.filter(
    (u) => !assignedUsers.some((a) => String(a._id) === String(u._id))
  )

  const handleAssign = async () => {
    if (!selectedUserId) {
      toast.error('Select a user to assign')
      return
    }
    try {
      setAssigning(true)
      await adminService.setUserAdminRole(selectedUserId, id)
      toast.success('Role assigned')
      setSelectedUserId('')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign role')
    } finally {
      setAssigning(false)
    }
  }

  const handleRemove = async (userId) => {
    if (!window.confirm('Remove this role from the user?')) return
    try {
      setRemovingId(userId)
      await adminService.setUserAdminRole(userId, null)
      toast.success('Role removed from user')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove role')
    } finally {
      setRemovingId(null)
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <p className="text-sm text-slate-500 py-8">Loading…</p>
      </AdminPage>
    )
  }

  return (
    <AdminPage>
      <PageHeader
        title={`Assign Users — ${role?.role_name || 'Role'}`}
        subtitle="Assign this admin role to users. Each admin user has one role."
        action={
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(LIST_PATH)}>
            Back to Roles
          </Button>
        }
      />

      <Panel className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <Select
              label="Select user"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              options={[
                { value: '', label: 'Choose a user…' },
                ...availableUsers.map((u) => ({
                  value: u._id,
                  label: `${u.name} (${u.email})${u.role === 'admin' ? '' : ' — will become admin'}`,
                })),
              ]}
            />
          </div>
          <Button icon={UserPlus} onClick={handleAssign} loading={assigning} disabled={!selectedUserId}>
            Assign Role
          </Button>
        </div>
      </Panel>

      <Panel>
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          Assigned users ({assignedUsers.length})
        </h3>
        {assignedUsers.length === 0 ? (
          <p className="text-sm text-slate-500">No users assigned to this role yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {assignedUsers.map((user) => (
              <li key={user._id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={user.status === 'active' ? 'active' : 'inactive'} />
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={removingId === user._id}
                    onClick={() => handleRemove(user._id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AdminPage>
  )
}

export default AssignUsersPage
