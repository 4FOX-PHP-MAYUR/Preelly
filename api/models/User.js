const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    displayName: {
      type: String,
      default: null,
      trim: true,
      maxlength: [80, 'Display name is too long'],
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
      default: null,
    },
    dob: {
      type: Date,
      default: null,
    },
    address: {
      line1: { type: String, default: null, trim: true, maxlength: [120, 'Address line is too long'] },
      line2: { type: String, default: null, trim: true, maxlength: [120, 'Address line is too long'] },
      postalCode: { type: String, default: null, trim: true, maxlength: 20 },
      country: { type: String, default: null, trim: true, maxlength: 80 },
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    phone: {
      type: String,
      required: false,
      trim: true,
    },
    phoneCountryCode: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    phoneCountryIso: {
      type: String,
      required: false,
      trim: true,
      uppercase: true,
      default: null,
    },
    password: {
      type: String,
      required: false,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
      index: true,
    },
    location: {
      city: {
        type: String,
        default: null,
        trim: true,
      },
      coordinates: {
        type: {
          type: String,
          enum: ['Point'],
          default: undefined,
        },
        coordinates: {
          type: [Number], // [lng, lat]
          default: undefined,
        },
        _id: false,
      },
      source: {
        type: String,
        enum: ['geolocation', 'manual'],
        default: null,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },
    savedLocations: [
      {
        label: { type: String, default: 'Home', trim: true, maxlength: 50 },
        city: { type: String, default: '', trim: true, maxlength: 120 },
        building: { type: String, default: '', trim: true, maxlength: 200 },
        apartment: { type: String, default: '', trim: true, maxlength: 100 },
        coordinates: {
          type: { type: String, enum: ['Point'], default: undefined },
          coordinates: { type: [Number], default: undefined }, // [lng, lat]
          _id: false,
        },
        isDefault: { type: Boolean, default: false },
      },
    ],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    memberSince: {
      type: Date,
      default: Date.now,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    emiratesIdFront: {
      type: String,
      default: null,
    },
    emiratesIdBack: {
      type: String,
      default: null,
    },
    identityVerificationStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
      index: true,
    },
    identityVerificationRejectionReason: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
    identityVerificationSubmittedAt: {
      type: Date,
      default: null,
    },
    identityVerifiedAt: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    adminRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminRole',
      default: null,
    },
    savedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    // Social OAuth provider IDs (optional).
    // We keep local (email/password) + social accounts in the same `User` by matching on `email`.
    googleProviderId: {
      type: String,
      default: undefined,
      trim: true,
    },
    appleProviderId: {
      type: String,
      default: undefined,
      trim: true,
    },
    facebookProviderId: {
      type: String,
      default: undefined,
      trim: true,
    },
    instagramProviderId: {
      type: String,
      default: undefined,
      trim: true,
    },
    instagramUsername: {
      type: String,
      default: undefined,
      trim: true,
    },
    lastOauthProvider: {
      type: String,
      enum: ['google', 'apple', 'facebook', 'instagram'],
      default: null,
    },
    moderationWarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Last watched reel index per feed (e.g. { main: 3, "categoryId_subId": 1 }) for resume on revisit
    reelsProgress: {
      type: Object,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
)

// Hash password before saving
// Use async middleware without calling next() to match Mongoose's async hook behavior
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, 12)
})

// Auto-verify admins
// Auto-verify admins (no next)
userSchema.pre('save', async function () {
  // If user is admin, automatically verify them
  if (this.role === 'admin') {
    this.isEmailVerified = true
    this.isPhoneVerified = true
    this.isVerified = true
  }
})

// Keep the aggregate verification flag in sync for newly created users and explicit verification updates.
userSchema.pre('save', function () {
  if (this.role === 'admin') return
  if (!this.isNew && !this.isModified('isEmailVerified') && !this.isModified('isPhoneVerified')) return
  this.isVerified = Boolean(this.isEmailVerified && this.isPhoneVerified)
})

// Keep optional geo field valid for 2dsphere index:
// - Either `location.coordinates` is absent, or it's a proper GeoJSON Point with [lng, lat].
userSchema.pre('save', function () {
  const coords = this.location?.coordinates
  if (!coords) return

  const arr = coords.coordinates
  const valid =
    Array.isArray(arr) &&
    arr.length === 2 &&
    typeof arr[0] === 'number' &&
    Number.isFinite(arr[0]) &&
    typeof arr[1] === 'number' &&
    Number.isFinite(arr[1])

  if (!valid) {
    // Unset invalid coordinate subdoc so geo index extraction doesn't fail.
    this.set('location.coordinates', undefined)
    this.markModified('location')
  } else if (!coords.type) {
    // Ensure type is set when coordinates are set.
    this.set('location.coordinates.type', 'Point')
  }
})

// Helps “saved products” membership checks for the current user.
// (Saved products is stored as an array of Product ObjectIds.)
userSchema.index({ savedProducts: 1 })
userSchema.index({ 'location.coordinates': '2dsphere' })
// Keep OAuth provider IDs unique only when actually present.
userSchema.index(
  { googleProviderId: 1 },
  { unique: true, partialFilterExpression: { googleProviderId: { $type: 'string' } } }
)
userSchema.index(
  { appleProviderId: 1 },
  { unique: true, partialFilterExpression: { appleProviderId: { $type: 'string' } } }
)
userSchema.index(
  { facebookProviderId: 1 },
  { unique: true, partialFilterExpression: { facebookProviderId: { $type: 'string' } } }
)
userSchema.index(
  { instagramProviderId: 1 },
  { unique: true, partialFilterExpression: { instagramProviderId: { $type: 'string' } } }
)

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false
  return await bcrypt.compare(candidatePassword, this.password)
}

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.password
  return obj
}

module.exports = mongoose.model('User', userSchema)

