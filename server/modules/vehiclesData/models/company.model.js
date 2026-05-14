const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema(
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
    logo: {
      type: String,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'vehicle_companies',
  }
);

// Prevent duplicate company names within the same category
CompanySchema.index({ name: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('VehicleCompany', CompanySchema);

