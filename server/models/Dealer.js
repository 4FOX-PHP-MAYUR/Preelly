const mongoose = require('mongoose')
const { Schema } = mongoose

const DealerSchema = new Schema(
  {
    dealer_name: { type: String, required: true, trim: true },
    dealer_email: { type: String, trim: true, lowercase: true, unique: true },
    dealer_mobile: { type: String, trim: true },
    dealer_whatsapp: { type: String, default: null, trim: true },
    synopsis: { type: String, default: null },
    dealer_image: { type: String, default: null },
    status: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'dealers',
  }
)

DealerSchema.index({ dealer_email: 1 }, { unique: true })
DealerSchema.index({ dealer_name: 1 })
DealerSchema.index({ status: 1 })

module.exports = mongoose.model('Dealer', DealerSchema)
