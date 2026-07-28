const mongoose = require('mongoose')

/**
 * role_permissions — junction: which permissions a role has
 * Collection: role_permissions
 */
const rolePermissionSchema = new mongoose.Schema(
  {
    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminRole',
      required: true,
      index: true,
    },
    permission_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'role_permissions',
  }
)

rolePermissionSchema.index({ role_id: 1, permission_id: 1 }, { unique: true })

module.exports = mongoose.model('RolePermission', rolePermissionSchema)
