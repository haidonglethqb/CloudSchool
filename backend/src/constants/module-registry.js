const MODULE_KEYS = [
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
]

const DEFAULT_ENABLED_MODULES = MODULE_KEYS.filter((key) => key !== 'fees')

module.exports = {
  MODULE_KEYS,
  DEFAULT_ENABLED_MODULES,
}
