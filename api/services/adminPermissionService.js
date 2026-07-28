/**
 * Service for normalized admin permissions:
 *   admin_roles  → AdminRole
 *   permissions  → Permission
 *   role_permissions → RolePermission
 *
 * Frontend still uses a module matrix:
 *   [{ module_name, can_view, can_create, can_edit, can_delete }]
 */
const Permission = require('../models/Permission')
const RolePermission = require('../models/RolePermission')
const {
  ACTIONS,
  ACTION_TO_FIELD,
  AVAILABLE_MODULES,
  actionToField,
} = require('../config/adminPermissions')

const FIELD_TO_ACTION = {
  can_view: 'view',
  can_create: 'create',
  can_edit: 'edit',
  can_delete: 'delete',
}

function permissionCode(moduleName, action) {
  return `${moduleName}.${action}`
}

function emptyMatrixRow(moduleName) {
  return {
    module_name: moduleName,
    can_view: false,
    can_create: false,
    can_edit: false,
    can_delete: false,
  }
}

/**
 * Ensure every module×action exists in the permissions table.
 * Safe to call repeatedly (upsert).
 */
async function ensurePermissionsCatalog() {
  const ops = []
  for (const module_name of AVAILABLE_MODULES) {
    for (const action of ACTIONS) {
      const code = permissionCode(module_name, action)
      ops.push({
        updateOne: {
          filter: { code },
          update: {
            $setOnInsert: {
              module_name,
              action,
              code,
              description: `${action} access for ${module_name}`,
            },
          },
          upsert: true,
        },
      })
    }
  }
  if (ops.length) {
    await Permission.bulkWrite(ops, { ordered: false })
  }
  return Permission.find({ module_name: { $in: AVAILABLE_MODULES } }).lean()
}

/**
 * Load all permission docs keyed by code and by module+action.
 */
async function loadPermissionIndex() {
  await ensurePermissionsCatalog()
  const all = await Permission.find({ module_name: { $in: AVAILABLE_MODULES } }).lean()
  const byCode = {}
  const byModuleAction = {}
  all.forEach((p) => {
    byCode[p.code] = p
    byModuleAction[`${p.module_name}::${p.action}`] = p
  })
  return { all, byCode, byModuleAction }
}

/**
 * Build UI matrix for a role from role_permissions + permissions.
 */
async function getPermissionMatrixForRole(roleId) {
  const { byModuleAction } = await loadPermissionIndex()
  const assigned = await RolePermission.find({ role_id: roleId }).select('permission_id').lean()
  const assignedIds = new Set(assigned.map((r) => String(r.permission_id)))

  return AVAILABLE_MODULES.map((module_name) => {
    const row = emptyMatrixRow(module_name)
    for (const action of ACTIONS) {
      const perm = byModuleAction[`${module_name}::${action}`]
      if (perm && assignedIds.has(String(perm._id))) {
        row[ACTION_TO_FIELD[action]] = true
      }
    }
    return row
  })
}

/**
 * Replace a role's permissions from a UI matrix.
 * Deletes previous role_permissions rows for the role, then inserts selected ones.
 */
async function saveRolePermissionMatrix(roleId, matrix) {
  const { byModuleAction } = await loadPermissionIndex()
  const permissionIds = []

  for (const row of matrix || []) {
    if (!row || !AVAILABLE_MODULES.includes(row.module_name)) continue
    for (const action of ACTIONS) {
      const field = ACTION_TO_FIELD[action]
      if (!row[field]) continue
      const perm = byModuleAction[`${row.module_name}::${action}`]
      if (perm) permissionIds.push(perm._id)
    }
  }

  await RolePermission.deleteMany({ role_id: roleId })

  if (permissionIds.length) {
    await RolePermission.insertMany(
      permissionIds.map((permission_id) => ({
        role_id: roleId,
        permission_id,
      })),
      { ordered: false }
    )
  }

  return getPermissionMatrixForRole(roleId)
}

/**
 * Map used by auth/frontend:
 * { Dashboard: { can_view, can_create, can_edit, can_delete }, ... }
 */
async function getPermissionMapForRole(roleId) {
  const matrix = await getPermissionMatrixForRole(roleId)
  const map = {}
  matrix.forEach((row) => {
    map[row.module_name] = {
      can_view: !!row.can_view,
      can_create: !!row.can_create,
      can_edit: !!row.can_edit,
      can_delete: !!row.can_delete,
    }
  })
  return map
}

/**
 * Check if a role has a specific permission.
 * @param {string|ObjectId} roleId
 * @param {string} moduleName - display name e.g. "Listings"
 * @param {string} actionOrField - "view" | "can_view" | etc.
 */
async function roleHasPermission(roleId, moduleName, actionOrField) {
  const field = actionToField(actionOrField)
  if (!field) return false
  const action = FIELD_TO_ACTION[field]
  if (!action) return false

  const perm = await Permission.findOne({
    module_name: moduleName,
    action,
  })
    .select('_id')
    .lean()
  if (!perm) return false

  const link = await RolePermission.findOne({
    role_id: roleId,
    permission_id: perm._id,
  })
    .select('_id')
    .lean()
  return !!link
}

/** Grant every catalog permission to a role (Super Admin). */
async function assignAllPermissionsToRole(roleId) {
  const all = await ensurePermissionsCatalog()
  await RolePermission.deleteMany({ role_id: roleId })
  if (all.length) {
    await RolePermission.insertMany(
      all.map((p) => ({ role_id: roleId, permission_id: p._id })),
      { ordered: false }
    )
  }
  return getPermissionMatrixForRole(roleId)
}

/**
 * Migrate legacy adminrolepermissions (module + boolean flags)
 * into permissions + role_permissions. Idempotent.
 */
async function migrateLegacyRolePermissions() {
  const mongoose = require('mongoose')
  const db = mongoose.connection.db
  if (!db) return { migrated: 0, skipped: true }

  const legacyName = 'adminrolepermissions'
  const collections = await db.listCollections({ name: legacyName }).toArray()
  if (!collections.length) {
    return { migrated: 0, skipped: true, reason: 'no legacy collection' }
  }

  const legacy = await db.collection(legacyName).find({}).toArray()
  if (!legacy.length) {
    return { migrated: 0, skipped: false, reason: 'empty legacy collection' }
  }

  const { byModuleAction } = await loadPermissionIndex()
  let inserted = 0

  for (const row of legacy) {
    if (!row.role_id) continue
    const roleId = row.role_id
    const moduleName = row.module_name
    for (const action of ACTIONS) {
      const field = ACTION_TO_FIELD[action]
      if (!row[field]) continue
      const perm = byModuleAction[`${moduleName}::${action}`]
      if (!perm) continue
      try {
        await RolePermission.updateOne(
          { role_id: roleId, permission_id: perm._id },
          { $setOnInsert: { role_id: roleId, permission_id: perm._id } },
          { upsert: true }
        )
        inserted += 1
      } catch {
        // duplicate key — already migrated
      }
    }
  }

  return { migrated: inserted, legacyRows: legacy.length }
}

module.exports = {
  ensurePermissionsCatalog,
  getPermissionMatrixForRole,
  saveRolePermissionMatrix,
  getPermissionMapForRole,
  roleHasPermission,
  assignAllPermissionsToRole,
  migrateLegacyRolePermissions,
  permissionCode,
  FIELD_TO_ACTION,
}
