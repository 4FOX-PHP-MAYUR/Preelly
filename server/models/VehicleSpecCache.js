const mongoose = require('mongoose')

const vehicleSpecCacheSchema = new mongoose.Schema(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    brand: { type: String, trim: true, index: true },
    model: { type: String, trim: true, index: true },
    year: { type: Number, index: true },
    variant: { type: String, trim: true, default: null },
    generation: { type: String, trim: true, default: null },
    profile: { type: mongoose.Schema.Types.Mixed, required: true },
    confidence: { type: Number, default: null },
    source: { type: String, enum: ['openai', 'local_db', 'manual'], default: 'openai' },
  },
  {
    timestamps: true,
    collection: 'vehicle_spec_cache',
  },
)

vehicleSpecCacheSchema.index({ brand: 1, model: 1, year: 1, variant: 1 })

module.exports = mongoose.model('VehicleSpecCache', vehicleSpecCacheSchema)
