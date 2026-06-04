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
]

const DEFAULT_ENABLED_MODULES = [...MODULE_KEYS]

const ROLE_MODULE_KEYS = {
  STAFF: MODULE_KEYS,
  TEACHER: ['student-lookup', 'classes', 'subjects', 'scores', 'reports'],
}

module.exports = {
  MODULE_KEYS,
  ROLE_MODULE_KEYS,
  DEFAULT_ENABLED_MODULES,
}
