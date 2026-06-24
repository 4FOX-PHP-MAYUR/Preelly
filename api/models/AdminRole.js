const mongoose = require('mongoose')

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
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model('AdminRole', adminRoleSchema)
