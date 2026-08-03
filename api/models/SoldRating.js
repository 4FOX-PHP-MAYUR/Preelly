const mongoose = require('mongoose')

// Buyer rating submitted by the seller at the end of the "Mark as Sold" flow
// (Preelly path). Kept in its own collection — separate from any future
// general-purpose reviews/ratings table — since it's specific to a sale event.
// Feeds User.rating (existing 0-5 field) via a recomputed average.
const soldRatingSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    rater: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ratee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    responseRating: { type: Number, min: 1, max: 5, default: null },
    behaviourRating: { type: Number, min: 1, max: 5, default: null },
    overallRating: { type: Number, min: 1, max: 5, default: null },
    comment: { type: String, default: '', trim: true },
  },
  { timestamps: true, collection: 'sold_ratings' },
)

soldRatingSchema.index({ ratee: 1, createdAt: -1 })

module.exports = mongoose.model('SoldRating', soldRatingSchema)
