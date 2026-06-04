const { AppError } = require('./errorHandler')
const { MODULE_KEYS, ROLE_MODULE_KEYS, DEFAULT_ENABLED_MODULES } = require('../constants/module-registry')

const DEFAULT_ROLE_PERMISSIONS = {
  STAFF: [
    'users',
    'student-admission',
    'student-lookup',
    'classes',
    'class-transfer',
    'subjects',
    'scores',
    'reports',
    'parents',
    'academic-calendar',
    'settings',
    'export',
    'fees',
  ],
  TEACHER: ['student-lookup', 'classes', 'subjects', 'scores', 'reports'],
}

const normalizeEnabledModules = (rawValue) => {
  if (!Array.isArray(rawValue)) return [...DEFAULT_ENABLED_MODULES]
  const valid = rawValue.filter((key) => MODULE_KEYS.includes(key))
  return valid.length > 0 ? valid : [...DEFAULT_ENABLED_MODULES]
}

const isFeatureEnabled = (settings, moduleKey) => {
  if (!MODULE_KEYS.includes(moduleKey)) return false
  const enabledModules = normalizeEnabledModules(settings?.enabledModules)
  return enabledModules.includes(moduleKey)
}

const requireFeature = (moduleKey) => {
  return (req, res, next) => {
    if (req.user?.role === 'PLATFORM_ADMIN') return next()
    if (!req.tenantId) return next()
    if (isFeatureEnabled(req.tenantSettings, moduleKey)) return next()
    return next(new AppError('Tính năng đã bị tắt', 403, 'FEATURE_DISABLED'))
  }
}

const requireAllFeatures = (moduleKeys = []) => {
  return (req, res, next) => {
    if (req.user?.role === 'PLATFORM_ADMIN') return next()
    if (!req.tenantId) return next()
    const disabled = moduleKeys.find((moduleKey) => !isFeatureEnabled(req.tenantSettings, moduleKey))
    if (!disabled) return next()
    return next(new AppError('Tính năng đã bị tắt', 403, 'FEATURE_DISABLED'))
  }
}

const normalizeRolePermissions = (rawPermissions) => {
  if (!rawPermissions || typeof rawPermissions !== 'object' || Array.isArray(rawPermissions)) {
    return DEFAULT_ROLE_PERMISSIONS
  }

  const normalized = {}
  for (const roleKey of ['STAFF', 'TEACHER']) {
    const rawModules = rawPermissions[roleKey]
    if (!Array.isArray(rawModules)) {
      normalized[roleKey] = [...DEFAULT_ROLE_PERMISSIONS[roleKey]]
      continue
    }
    const allowedModules = ROLE_MODULE_KEYS[roleKey] || MODULE_KEYS
    const validModules = rawModules.filter((moduleKey) => allowedModules.includes(moduleKey))
    normalized[roleKey] = validModules
  }

  return normalized
}

const requireRolePermission = (moduleKey) => {
  return (req, res, next) => {
    if (!MODULE_KEYS.includes(moduleKey)) {
      return next(new AppError(`Invalid module key: ${moduleKey}`, 500, 'INVALID_MODULE_KEY'))
    }

    const userRole = req.user?.role
    if (!userRole) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'))
    }

    if (userRole === 'SUPER_ADMIN' || userRole === 'PLATFORM_ADMIN') return next()
    if (userRole !== 'STAFF' && userRole !== 'TEACHER') return next()

    const permissions = normalizeRolePermissions(req.tenantSettings?.rolePermissions)
    const allowedModules = permissions[userRole] || []
    if (allowedModules.includes(moduleKey)) return next()

    return next(new AppError('Bạn không có quyền truy cập chức năng này', 403, 'ROLE_PERMISSION_DENIED'))
  }
}

module.exports = {
  requireFeature,
  requireAllFeatures,
  requireRolePermission,
  isFeatureEnabled,
  normalizeEnabledModules,
  DEFAULT_ROLE_PERMISSIONS,
  normalizeRolePermissions,
  ROLE_MODULE_KEYS,
}
