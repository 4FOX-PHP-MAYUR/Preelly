/**
 * @deprecated Legacy denormalized role+module permission model.
 * Replaced by:
 *   - permissions (catalog)
 *   - role_permissions (junction)
 *
 * Kept only so old scripts that require this file do not crash.
 * Prefer ../services/adminPermissionService.js
 */
module.exports = require('./RolePermission')
