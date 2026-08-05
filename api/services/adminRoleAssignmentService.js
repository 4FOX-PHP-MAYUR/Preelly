/**
 * Shared business logic for the Admin User ↔ Admin Role mapping
 * (admin_role_assignments). Used by:
 *   - routes/admin.js  → /role-assignments (assign users from inside a role)
 *   - routes/admin.js  → /admin-users      (set/change an admin user's role)
 *
 * Kept in one place so both entry points enforce identical rules:
 *   - the admin user/role must exist, and the role must be active
 *   - no duplicate (user, role) assignment
 *   - only one ACTIVE assignment per user at a time
 *   - AdminUser.adminRole (the FK the rest of the permission stack reads —
 *     adminMiddleware, checkPermission, getPermissionMapForRole) is kept in
 *     sync so permissions apply immediately
 *
 * `adminUserId`/`assignedBy` always refer to the dedicated `admin_users`
 * collection — this module has no relationship to the marketplace `users`
 * collection.
 */
const { Types } = require('mongoose')
const AdminUser = require('../models/AdminUser')
const AdminRole = require('../models/AdminRole')
const AdminRoleAssignment = require('../models/AdminRoleAssignment')

const ASSIGNMENT_POPULATE = [
  { path: 'adminUserId', select: 'name email status' },
  { path: 'roleId', select: 'role_name status is_system' },
  { path: 'assignedBy', select: 'name email' },
]

class AssignmentError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
  }
}

async function getPopulatedAssignment(assignmentId) {
  return AdminRoleAssignment.findById(assignmentId).populate(ASSIGNMENT_POPULATE).lean()
}

/**
 * Assign a role to an admin user. If `status` is 'active', any other active
 * assignment the user holds is deactivated first (one active role at a time).
 */
async function assignRole({ adminUserId, roleId, status = 'active', notes, assignedBy }) {
  if (!adminUserId || !Types.ObjectId.isValid(adminUserId)) {
    throw new AssignmentError(400, 'A valid admin user is required')
  }
  if (!roleId || !Types.ObjectId.isValid(roleId)) {
    throw new AssignmentError(400, 'A valid role is required')
  }

  const [adminUser, role] = await Promise.all([
    AdminUser.findOne({ _id: adminUserId, isDeleted: { $ne: true } }),
    AdminRole.findOne({ _id: roleId, isDeleted: { $ne: true } }),
  ])
  if (!adminUser) throw new AssignmentError(404, 'Admin user not found')
  if (!role) throw new AssignmentError(404, 'Role not found')
  if (role.status !== 'active') throw new AssignmentError(400, 'Cannot assign an inactive role')

  const duplicate = await AdminRoleAssignment.findOne({ adminUserId, roleId, isDeleted: false })
  if (duplicate) throw new AssignmentError(400, 'This user is already assigned to this role')

  const normalizedStatus = status === 'inactive' ? 'inactive' : 'active'

  if (normalizedStatus === 'active') {
    // One admin user can hold only one active role assignment at a time.
    await AdminRoleAssignment.updateMany(
      { adminUserId, isDeleted: false, status: 'active' },
      { $set: { status: 'inactive' } }
    )
  }

  const assignment = await AdminRoleAssignment.create({
    adminUserId,
    roleId,
    status: normalizedStatus,
    notes: notes ? String(notes).trim() : '',
    assignedBy: assignedBy || null,
    assignedAt: new Date(),
  })

  if (normalizedStatus === 'active') {
    // Inherit the role's permissions immediately via the existing FK the
    // rest of the permission stack already reads from.
    adminUser.adminRole = role._id
    await adminUser.save()
  }

  return getPopulatedAssignment(assignment._id)
}

/** Update an existing assignment's role/status/notes. */
async function updateAssignment(assignmentId, { roleId, status, notes }) {
  if (!Types.ObjectId.isValid(assignmentId)) throw new AssignmentError(400, 'Invalid id')
  const assignment = await AdminRoleAssignment.findOne({ _id: assignmentId, isDeleted: false })
  if (!assignment) throw new AssignmentError(404, 'Assignment not found')

  let targetRoleId = assignment.roleId

  if (roleId !== undefined && String(roleId) !== String(assignment.roleId)) {
    if (!Types.ObjectId.isValid(roleId)) throw new AssignmentError(400, 'Invalid role')
    const role = await AdminRole.findOne({ _id: roleId, isDeleted: { $ne: true } })
    if (!role) throw new AssignmentError(404, 'Role not found')
    if (role.status !== 'active') throw new AssignmentError(400, 'Cannot assign an inactive role')
    const duplicate = await AdminRoleAssignment.findOne({
      _id: { $ne: assignmentId },
      adminUserId: assignment.adminUserId,
      roleId,
      isDeleted: false,
    })
    if (duplicate) throw new AssignmentError(400, 'This user is already assigned to this role')
    assignment.roleId = role._id
    targetRoleId = role._id
  }

  if (notes !== undefined) assignment.notes = String(notes).trim()

  const nextStatus = status === undefined ? assignment.status : (status === 'inactive' ? 'inactive' : 'active')

  if (nextStatus === 'active') {
    // One admin user can hold only one active role assignment at a time.
    await AdminRoleAssignment.updateMany(
      { _id: { $ne: assignmentId }, adminUserId: assignment.adminUserId, isDeleted: false, status: 'active' },
      { $set: { status: 'inactive' } }
    )
  }
  assignment.status = nextStatus
  await assignment.save()

  // Keep the admin user's effective permissions in sync immediately.
  const adminUser = await AdminUser.findById(assignment.adminUserId)
  if (adminUser) {
    if (nextStatus === 'active') {
      adminUser.adminRole = targetRoleId
      await adminUser.save()
    } else if (adminUser.adminRole && String(adminUser.adminRole) === String(targetRoleId)) {
      // This was the user's active assignment and it just got deactivated — revoke.
      adminUser.adminRole = null
      await adminUser.save()
    }
  }

  return getPopulatedAssignment(assignment._id)
}

/** Soft-delete an assignment and revoke the role if it was the user's active one. */
async function unassignRole(assignmentId) {
  if (!Types.ObjectId.isValid(assignmentId)) throw new AssignmentError(400, 'Invalid id')
  const assignment = await AdminRoleAssignment.findOne({ _id: assignmentId, isDeleted: false })
  if (!assignment) throw new AssignmentError(404, 'Assignment not found')

  assignment.isDeleted = true
  assignment.status = 'inactive'
  await assignment.save()

  const adminUser = await AdminUser.findById(assignment.adminUserId)
  if (adminUser && adminUser.adminRole && String(adminUser.adminRole) === String(assignment.roleId)) {
    adminUser.adminRole = null
    await adminUser.save()
  }

  return assignment
}

/** Revoke whichever assignment currently gives `adminUserId` its active role (used when soft-deleting an admin user). */
async function revokeActiveAssignmentForUser(adminUserId) {
  const active = await AdminRoleAssignment.findOne({ adminUserId, isDeleted: false, status: 'active' })
  if (active) await unassignRole(active._id)
}

module.exports = {
  AssignmentError,
  ASSIGNMENT_POPULATE,
  assignRole,
  updateAssignment,
  unassignRole,
  revokeActiveAssignmentForUser,
  getPopulatedAssignment,
}
