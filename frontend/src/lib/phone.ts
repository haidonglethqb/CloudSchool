const PHONE_SANITIZE_REGEX = /[\s.-]/g
const VN_PHONE_REGEX = /^0\d{9,10}$/

export const normalizeVietnamPhone = (value?: string | null): string => {
  if (!value) return ''
  return value.replace(PHONE_SANITIZE_REGEX, '')
}

export const isValidVietnamPhone = (value?: string | null): boolean => {
  const normalized = normalizeVietnamPhone(value)
  if (!normalized) return false
  return VN_PHONE_REGEX.test(normalized)
}

