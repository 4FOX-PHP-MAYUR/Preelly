const mongoose = require('mongoose')

const adminRolePermissionSchema = new mongoose.Schema(
  {
    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminRole',
      required: true,
    },
    module_name: {
      type: String,
      required: true,
      trim: true,
    },
    can_view: {
      type: Boolean,
      default: false,
    },
    can_create: {
      type: Boolean,
      default: false,
    },
    can_edit: {
      type: Boolean,
      default: false,
    },
    can_delete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
)

adminRolePermissionSchema.index({ role_id: 1, module_name: 1 }, { unique: true })

module.exports = mongoose.model('AdminRolePermission', adminRolePermissionSchema)
