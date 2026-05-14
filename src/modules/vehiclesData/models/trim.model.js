const mongoose = require('mongoose');

const TrimSchema = new mongoose.Schema(
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
    model: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleModel',
      required: true,
      index: true,
    },
    price: {
      type: Number,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'vehicle_trims',
  }
);

// Prevent duplicate trim names within same model/company/category
TrimSchema.index({ name: 1, model: 1, company: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('VehicleTrim', TrimSchema);

