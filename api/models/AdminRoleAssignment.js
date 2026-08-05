const mongoose = require('mongoose')

/**
 * admin_role_assignments — mapping layer between Admin Users and Admin Roles.
 * Collection: admin_role_assignments
 *
 * `adminUserId`/`assignedBy` reference the dedicated `admin_users` collection
 * only — this table has no relationship to the marketplace `users` collection.
 * It keeps `AdminUser.adminRole` (the FK adminMiddleware/checkPermission read
 * from) in sync so role/permission logic keeps working unchanged.
 */
const adminRoleAssignmentSchema = new mongoose.Schema(
  {
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: [true, 'Admin user is required'],
      // Indexed via the partial-unique indexes below — no plain index here
      // to avoid a duplicate-index warning.
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminRole',
      required: [true, 'Role is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      // Indexed via schema.index({ status: 1 }) below.
    },
    /** Optional free-text notes about this assignment (e.g. reason, ticket ref). */
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Notes are too long'],
    },
    /** Admin user (Super Admin) who performed the assignment. */
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    /** Soft delete — keeps assignment history instead of hard-deleting rows. */
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'admin_role_assignments',
  }
)

adminRoleAssignmentSchema.index({ status: 1 })
adminRoleAssignmentSchema.index({ assignedAt: -1 })

// One admin user can hold only one ACTIVE assignment at a time.
adminRoleAssignmentSchema.index(
  { adminUserId: 1 },
  { unique: true, partialFilterExpression: { status: 'active', isDeleted: false } }
)
// Prevent duplicate (user, role) assignment rows.
adminRoleAssignmentSchema.index(
  { adminUserId: 1, roleId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
)

module.exports = mongoose.model('AdminRoleAssignment', adminRoleAssignmentSchema)
