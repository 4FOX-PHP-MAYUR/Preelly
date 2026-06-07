const mongoose = require('mongoose')

const vehicleAiLogSchema = new mongoose.Schema(
  {
    operation: {
      type: String,
      enum: ['enrichment', 'transcript_extract', 'vehicle_mapping'],
      required: true,
      index: true,
    },
    cacheKey: { type: String, index: true, default: null },
    brand: { type: String, trim: true, index: true },
    model: { type: String, trim: true, index: true },
    year: { type: Number, index: true },
    variant: { type: String, trim: true, default: null },
    requestPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    responsePayload: { type: mongoose.Schema.Types.Mixed, default: null },
    source: { type: String, default: null },
    success: { type: Boolean, default: true },
    errorMessage: { type: String, default: null },
    durationMs: { type: Number, default: null },
  },
  {
    timestamps: true,
    collection: 'vehicle_ai_logs',
  },
)

vehicleAiLogSchema.index({ createdAt: -1 })

module.exports = mongoose.model('VehicleAiLog', vehicleAiLogSchema)
