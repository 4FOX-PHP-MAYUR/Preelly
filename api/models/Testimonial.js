const mongoose = require('mongoose')
const { Schema } = mongoose

const TestimonialSchema = new Schema(
  {
    testimonialName: {
      type: String,
      required: [true, 'Testimonial name is required'],
      trim: true,
      minlength: [2, 'Testimonial name must be at least 2 characters'],
      maxlength: [100, 'Testimonial name cannot exceed 100 characters'],
    },
    customerType: {
      type: String,
      required: [true, 'Customer type is required'],
      enum: { values: ['seller', 'buyer'], message: 'Customer type must be Seller or Buyer' },
    },
    testimonial: {
      type: String,
      required: [true, 'Testimonial is required'],
      trim: true,
      minlength: [10, 'Testimonial must be at least 10 characters'],
      maxlength: [2000, 'Testimonial cannot exceed 2000 characters'],
    },
    // Relative path to the uploaded profile image, e.g. "/uploads/images/profileImage-123.png"
    profileImage: {
      type: String,
      default: null,
      trim: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be between 1 and 5'],
      max: [5, 'Rating must be between 1 and 5'],
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: [0, 'Display order cannot be negative'],
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
  },
  {
    timestamps: true,
    collection: 'testimonials',
  }
)

TestimonialSchema.index({ isDeleted: 1, status: 1, displayOrder: 1 })
TestimonialSchema.index({ isDeleted: 1, customerType: 1 })
TestimonialSchema.index({ isDeleted: 1, testimonialName: 1 })

TestimonialSchema.statics.fixIndexes = async function fixIndexes() {
  try {
    await this.syncIndexes()
    console.log('[Testimonial] Indexes synced')
  } catch (err) {
    console.error('[Testimonial] fixIndexes error:', err.message)
  }
}

module.exports = mongoose.model('Testimonial', TestimonialSchema)
