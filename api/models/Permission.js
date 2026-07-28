const mongoose = require('mongoose')

/**
 * permissions — master list of module + action permissions
 * Collection: permissions
 *
 * One row per (module_name, action), e.g. Listings + view
 */
const permissionSchema = new mongoose.Schema(
  {
    module_name: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['view', 'create', 'edit', 'delete'],
      trim: true,
    },
    /** Stable unique key, e.g. "Listings.view" */
    code: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'permissions',
  }
)

permissionSchema.index({ module_name: 1, action: 1 }, { unique: true })
permissionSchema.index({ module_name: 1 })

module.exports = mongoose.model('Permission', permissionSchema)
