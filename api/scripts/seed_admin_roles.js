/**
 * Seed / migrate normalized admin RBAC collections:
 *   admin_roles
 *   permissions
 *   role_permissions
 *
 * Also migrates legacy collections:
 *   adminroles → admin_roles
 *   adminrolepermissions → role_permissions (+ permissions catalog)
 *
 * Usage (from api/):
 *   node scripts/seed_admin_roles.js
 *   npm run seed:admin-roles
 */
require('dotenv').config()
const mongoose = require('mongoose')
const AdminRole = require('../models/AdminRole')
const AdminUser = require('../models/AdminUser')
const {
  SUPER_ADMIN_ROLE_NAME,
  AVAILABLE_MODULES,
  isSuperAdminRole,
} = require('../config/adminPermissions')
const {
  ensurePermissionsCatalog,
  assignAllPermissionsToRole,
  migrateLegacyRolePermissions,
} = require('../services/adminPermissionService')

async function migrateAdminRolesCollection(db) {
  const legacy = await db.listCollections({ name: 'adminroles' }).toArray()
  const modern = await db.listCollections({ name: 'admin_roles' }).toArray()
  if (!legacy.length) {
    return { migrated: 0, reason: 'no legacy adminroles' }
  }

  const legacyCols = db.collection('adminroles')
  const modernCols = db.collection('admin_roles')
  const docs = await legacyCols.find({}).toArray()
  if (!docs.length) return { migrated: 0, reason: 'empty legacy' }

  let upserted = 0
  for (const doc of docs) {
    const { _id, ...rest } = doc
    await modernCols.updateOne(
      { _id },
      { $set: { ...rest, is_system: rest.is_system || isSuperAdminRole(rest) } },
      { upsert: true }
    )
    upserted += 1
  }

  // Keep legacy as backup; do not drop automatically
  return { migrated: upserted, modernExisted: !!modern.length }
}

async function seed() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGO_URI / MONGODB_URI is not set')
    process.exit(1)
  }

  await mongoose.connect(uri)
  console.log('Connected to MongoDB')

  const db = mongoose.connection.db

  const roleMig = await migrateAdminRolesCollection(db)
  console.log('admin_roles migration:', roleMig)

  // Prefer existing SuperAdmin / Super Admin role
  let role =
    (await AdminRole.findOne({ role_name: SUPER_ADMIN_ROLE_NAME })) ||
    (await AdminRole.findOne({ role_name: /^super\s*admin$/i }))

  if (!role) {
    role = await AdminRole.create({
      role_name: SUPER_ADMIN_ROLE_NAME,
      description: 'Full access to all admin modules. Cannot be modified or deleted.',
      status: 'active',
      is_system: true,
    })
    console.log(`Created role: ${SUPER_ADMIN_ROLE_NAME}`)
  } else {
    role.is_system = true
    role.status = 'active'
    if (!role.description) {
      role.description = 'Full access to all admin modules. Cannot be modified or deleted.'
    }
    await role.save()
    console.log(`Updated existing role: ${role.role_name}`)
  }

  const catalog = await ensurePermissionsCatalog()
  console.log(`permissions catalog: ${catalog.length} rows (${AVAILABLE_MODULES.length} modules × 4 actions)`)

  const legacyMig = await migrateLegacyRolePermissions()
  console.log('legacy role_permissions migration:', legacyMig)

  await assignAllPermissionsToRole(role._id)
  console.log(`Assigned all permissions to ${role.role_name}`)

  // Bootstrap the very first Admin Panel login. admin_users is a dedicated
  // collection — nothing here is migrated from marketplace `users`; if the
  // collection already has any account, this is a no-op.
  const existingAdminCount = await AdminUser.countDocuments({ isDeleted: { $ne: true } })
  if (existingAdminCount === 0) {
    const seedEmail = (process.env.ADMIN_SEED_EMAIL || 'superadmin@example.com').toLowerCase()
    const seedPassword = process.env.ADMIN_SEED_PASSWORD || 'ChangeMe123!'
    const seedName = process.env.ADMIN_SEED_NAME || 'Super Admin'
    const seedPhone = process.env.ADMIN_SEED_PHONE || '+10000000000'

    const superAdminUser = await AdminUser.create({
      name: seedName,
      email: seedEmail,
      phone: seedPhone,
      password: seedPassword,
      adminRole: role._id,
      status: 'active',
    })
    console.log('Created initial admin_users account:')
    console.log(`  email:    ${superAdminUser.email}`)
    console.log(`  password: ${seedPassword}`)
    console.log('  Log in via the Admin Panel and change this password immediately.')
  } else {
    console.log(`admin_users already has ${existingAdminCount} account(s) — skipping bootstrap.`)
  }

  await mongoose.disconnect()
  console.log('Done.')
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
