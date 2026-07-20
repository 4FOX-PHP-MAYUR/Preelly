const mongoose = require('mongoose')
const { Schema } = mongoose

const PRICE_TYPES = ['FIXED', 'STARTING_FROM', 'FREE']

const CheckoutServiceSchema = new Schema(
  {
    serviceName: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      minlength: [2, 'Service name must be at least 2 characters'],
      maxlength: [120, 'Service name cannot exceed 120 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    priceType: {
      type: String,
      enum: PRICE_TYPES,
      default: 'FIXED',
      index: true,
    },
    price: {
      type: Number,
      default: 0,
      min: [0, 'Price cannot be negative'],
    },
    learnMoreUrl: {
      type: String,
      default: '',
      trim: true,
    },
    buttonText: {
      type: String,
      default: 'Learn More',
      trim: true,
      maxlength: [60, 'Button text cannot exceed 60 characters'],
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: [0, 'Display order cannot be negative'],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    status: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'checkout_services',
  }
)

CheckoutServiceSchema.index({ isDeleted: 1, status: 1, displayOrder: 1 })
CheckoutServiceSchema.index({ isDeleted: 1, serviceName: 1 })

CheckoutServiceSchema.statics.PRICE_TYPES = PRICE_TYPES

module.exports = mongoose.model('CheckoutService', CheckoutServiceSchema)
