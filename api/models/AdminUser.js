const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

/**
 * admin_users — Admin Panel accounts, completely separate from the
 * marketplace `users` collection. Admin authentication, role assignment,
 * and permission checks all key off this collection exclusively; nothing
 * here is shared with or derived from marketplace customer data.
 */
const adminUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
      unique: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    /** FK → admin_roles._id. Every admin user belongs to exactly one role. */
    adminRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminRole',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    /** Admin (_id in this same collection) who created this account. */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    /** Soft delete — a removed admin account loses API access immediately (see adminMiddleware). */
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'admin_users',
  }
)

adminUserSchema.index({ status: 1 })

adminUserSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, 12)
})

adminUserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false
  return bcrypt.compare(candidatePassword, this.password)
}

adminUserSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.password
  return obj
}

module.exports = mongoose.model('AdminUser', adminUserSchema)
