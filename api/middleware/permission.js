const {
  ROUTE_PERMISSION_RULES,
  resolveModuleName,
  actionToField,
  isSuperAdminRole,
  buildFullPermissionSet,
} = require('../config/adminPermissions')
const {
  roleHasPermission,
  getPermissionMapForRole,
} = require('../services/adminPermissionService')

function getRoleId(user) {
  if (!user?.adminRole) return null
  return user.adminRole._id || user.adminRole
}

function isSuperAdminUser(user) {
  return isSuperAdminRole(user?.adminRole)
}

/** Full permission map for Super Admin (all modules, all actions including edit). */
function buildSuperAdminPermissionMap() {
  const map = {}
  buildFullPermissionSet().forEach((p) => {
    map[p.module_name] = {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: true,
    }
  })
  return map
}

/**
 * Middleware factory that checks if the admin has a specific permission
 * for a given module.
 *
 * Admins without an assigned role, and Super Admin, keep full access.
 */
const checkPermission = (moduleName, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' })
      }

      const roleId = getRoleId(req.user)
      if (!roleId || isSuperAdminUser(req.user)) {
        return next()
      }

      if (req.user.adminRole?.status === 'inactive') {
        return res.status(403).json({
          message: 'Access denied. Your admin role is inactive.',
        })
      }

      const resolvedModule = resolveModuleName(moduleName) || moduleName
      const field = actionToField(action)
      if (!field) {
        return res.status(500).json({ message: 'Invalid permission action' })
      }

      const allowed = await roleHasPermission(roleId, resolvedModule, field)
      if (!allowed) {
        return res.status(403).json({
          message: `Access denied. You do not have ${field.replace('can_', '')} permission for ${resolvedModule}.`,
        })
      }

      next()
    } catch (error) {
      console.error('Permission check error:', error)
      res.status(500).json({ message: 'Error checking permissions' })
    }
  }
}

/**
 * Load all permissions for the current admin user and attach to req.permissions
 */
const loadPermissions = async (req, res, next) => {
  try {
    const roleId = getRoleId(req.user)
    if (!roleId) {
      req.permissions = null
      return next()
    }

    if (isSuperAdminUser(req.user)) {
      req.permissions = buildSuperAdminPermissionMap()
      return next()
    }

    req.permissions = await getPermissionMapForRole(roleId)
    next()
  } catch (error) {
    console.error('Error loading permissions:', error)
    req.permissions = null
    next()
  }
}

/**
 * Path-based permission enforcement for /api/admin routes.
 * Must run after adminMiddleware (req.user set).
 */
const enforceAdminPermissions = async (req, res, next) => {
  try {
    if (!req.user) return next()

    const roleId = getRoleId(req.user)
    if (!roleId || isSuperAdminUser(req.user)) return next()

    if (req.user.adminRole?.status === 'inactive') {
      return res.status(403).json({
        message: 'Access denied. Your admin role is inactive.',
      })
    }

    const path = req.path || ''
    const method = (req.method || 'GET').toUpperCase()

    const rule = ROUTE_PERMISSION_RULES.find((r) => r.pattern.test(path))
    if (!rule) return next()

    const required = rule[method]
    if (!required) return next()

    const [moduleName, action] = required
    const allowed = await roleHasPermission(roleId, moduleName, action)
    if (!allowed) {
      return res.status(403).json({
        message: `Access denied. You do not have ${action.replace('can_', '')} permission for ${moduleName}.`,
      })
    }

    next()
  } catch (error) {
    console.error('enforceAdminPermissions error:', error)
    res.status(500).json({ message: 'Error checking permissions' })
  }
}

module.exports = {
  checkPermission,
  loadPermissions,
  enforceAdminPermissions,
  buildSuperAdminPermissionMap,
}
