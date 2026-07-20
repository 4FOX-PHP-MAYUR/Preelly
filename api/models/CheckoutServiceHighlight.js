const mongoose = require('mongoose')
const { Schema } = mongoose

// One bullet point ("Packaging included", …) belonging to a checkout service.
const CheckoutServiceHighlightSchema = new Schema(
  {
    checkoutServiceId: {
      type: Schema.Types.ObjectId,
      ref: 'CheckoutService',
      required: true,
      index: true,
    },
    highlight: {
      type: String,
      required: [true, 'Highlight is required'],
      trim: true,
      maxlength: [250, 'Highlight cannot exceed 250 characters'],
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: [0, 'Display order cannot be negative'],
    },
  },
  {
    timestamps: true,
    collection: 'checkout_service_highlights',
  }
)

CheckoutServiceHighlightSchema.index({ checkoutServiceId: 1, displayOrder: 1 })

module.exports = mongoose.model('CheckoutServiceHighlight', CheckoutServiceHighlightSchema)
