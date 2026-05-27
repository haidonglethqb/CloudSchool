const stripPhoneSeparators = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[\s.-]/g, '')
}

const isValidVietnamPhone = (value) => {
  const normalized = stripPhoneSeparators(value)
  if (!normalized) return true
  return /^0\d{9,10}$/.test(normalized)
}

const normalizeVietnamPhone = (value) => {
  const normalized = stripPhoneSeparators(value)
  return normalized || null
}

module.exports = {
  stripPhoneSeparators,
  isValidVietnamPhone,
  normalizeVietnamPhone,
}
