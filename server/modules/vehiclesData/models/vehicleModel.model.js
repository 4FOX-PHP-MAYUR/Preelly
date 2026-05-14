const mongoose = require('mongoose');

const VehicleModelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleCategory',
      required: true,
      index: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleCompany',
      required: true,
      index: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'vehicle_models',
  }
);

// Prevent duplicate model names under same company and category
VehicleModelSchema.index({ name: 1, company: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('VehicleModel', VehicleModelSchema);

