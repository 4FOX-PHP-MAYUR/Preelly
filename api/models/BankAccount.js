const mongoose = require('mongoose')
const { Schema } = mongoose

const BankAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bankName: { type: String, required: true, trim: true, maxlength: 120 },
    accountNumber: { type: String, required: true, trim: true, maxlength: 64 },
    iban: { type: String, default: '', trim: true, maxlength: 64 },
    swift: { type: String, default: '', trim: true, maxlength: 32 },
    branchName: { type: String, default: '', trim: true, maxlength: 120 },
    isPrimary: { type: Boolean, default: false },
  },
  { timestamps: true }
)

BankAccountSchema.index({ userId: 1, isPrimary: 1 })
BankAccountSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('BankAccount', BankAccountSchema)
