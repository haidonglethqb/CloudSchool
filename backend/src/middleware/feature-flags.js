const { AppError } = require('./errorHandler')
const { MODULE_KEYS, DEFAULT_ENABLED_MODULES } = require('../constants/module-registry')

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

module.exports = {
  requireFeature,
  requireAllFeatures,
  isFeatureEnabled,
  normalizeEnabledModules,
}
