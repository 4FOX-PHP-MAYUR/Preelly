const mongoose = require('mongoose')

/**
 * admin_roles — admin role definitions
 * Collection: admin_roles
 */
const adminRoleSchema = new mongoose.Schema(
  {
    role_name: {
      type: String,
      required: [true, 'Role name is required'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    /** System roles (e.g. Super Admin) cannot be modified or deleted */
    is_system: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'admin_roles',
  }
)

adminRoleSchema.index({ status: 1 })

module.exports = mongoose.model('AdminRole', adminRoleSchema)
