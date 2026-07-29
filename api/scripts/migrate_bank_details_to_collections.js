/**
 * Migrate embedded user.bankAccounts / user.savedCards into separate collections.
 * Idempotent — skips accounts/cards whose _id already exists in the new collections.
 * After a successful insert, clears the embedded arrays on the user document.
 *
 * Usage: node scripts/migrate_bank_details_to_collections.js
 */
const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.join(__dirname, '../.env') })

const mongoose = require('mongoose')
const BankAccount = require('../models/BankAccount')
const SavedCard = require('../models/SavedCard')

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGO_URI or MONGODB_URI is required')
    process.exit(1)
  }

  await mongoose.connect(uri)
  console.log('Connected to MongoDB')

  // Read raw users that still have embedded arrays (User schema no longer defines them,
  // so we query the collection directly).
  const users = await mongoose.connection.db.collection('users').find({
    $or: [
      { bankAccounts: { $exists: true, $ne: [] } },
      { savedCards: { $exists: true, $ne: [] } },
    ],
  }).toArray()

  console.log(`Found ${users.length} users with embedded bank/card data`)

  let bankInserted = 0
  let cardInserted = 0
  let usersCleared = 0

  for (const user of users) {
    const userId = user._id
    const banks = Array.isArray(user.bankAccounts) ? user.bankAccounts : []
    const cards = Array.isArray(user.savedCards) ? user.savedCards : []

    for (const account of banks) {
      if (!account || !account.bankName || !account.accountNumber) continue
      const filter = account._id
        ? { _id: account._id }
        : { userId, accountNumber: account.accountNumber, bankName: account.bankName }
      const existing = await BankAccount.findOne(filter).lean()
      if (existing) continue

      await BankAccount.create({
        ...(account._id ? { _id: account._id } : {}),
        userId,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        iban: account.iban || '',
        swift: account.swift || '',
        branchName: account.branchName || '',
        isPrimary: Boolean(account.isPrimary),
      })
      bankInserted += 1
    }

    for (const card of cards) {
      if (!card || !card.last4) continue
      const filter = card._id
        ? { _id: card._id }
        : { userId, last4: card.last4, brand: card.brand || 'Card', expiry: card.expiry || '' }
      const existing = await SavedCard.findOne(filter).lean()
      if (existing) continue

      await SavedCard.create({
        ...(card._id ? { _id: card._id } : {}),
        userId,
        brand: card.brand || 'Card',
        last4: card.last4,
        expiry: card.expiry || '',
        holderName: card.holderName || '',
        nickname: card.nickname || '',
        isPrimary: Boolean(card.isPrimary),
      })
      cardInserted += 1
    }

    await mongoose.connection.db.collection('users').updateOne(
      { _id: userId },
      { $unset: { bankAccounts: '', savedCards: '' } }
    )
    usersCleared += 1
  }

  console.log(`Inserted ${bankInserted} bank accounts, ${cardInserted} saved cards`)
  console.log(`Cleared embedded fields on ${usersCleared} users`)
  await mongoose.disconnect()
  console.log('Done')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
