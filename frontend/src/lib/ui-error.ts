export interface UiErrorDictionary {
  byCode: Record<string, string>
  fallback: string
}

type ApiErrorBody = {
  code?: string
  message?: string
  details?: unknown[]
}

type ApiErrorLike = {
  response?: {
    data?: {
      error?: ApiErrorBody
    }
  }
}

export const UI_ERROR_DICTIONARY: UiErrorDictionary = {
  byCode: {
    DUPLICATE_ENTRY: 'Dữ liệu đã tồn tại trong hệ thống.',
    NOT_FOUND: 'Không tìm thấy dữ liệu yêu cầu.',
    FOREIGN_KEY_CONFLICT: 'Không thể thao tác vì có dữ liệu liên quan.',
    TRANSACTION_CONFLICT: 'Xung đột giao dịch, vui lòng thử lại.',
    VALIDATION_ERROR: 'Dữ liệu không hợp lệ.',
    INVALID_TOKEN: 'Phiên đăng nhập không hợp lệ.',
    TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn.',
    TOO_MANY_REQUESTS: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
    CLASS_FULL: 'Lớp đã đủ sĩ số tối đa.',
    FEATURE_DISABLED: 'Tính năng này chưa được kích hoạt cho trường.',
    FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
    MISSING_SCORES: 'Còn thiếu điểm, chưa thể xét lên lớp.',
    SEMESTER_NOT_FINISHED: 'Học kỳ chưa kết thúc, chưa thể xét lên lớp.',
    INTERNAL_ERROR: 'Đã xảy ra lỗi hệ thống.',
  },
  fallback: 'Đã xảy ra lỗi. Vui lòng thử lại.',
}

export function getApiError(error: unknown): ApiErrorBody {
  const candidate = error as ApiErrorLike
  return candidate?.response?.data?.error || {}
}

export function resolveUiErrorMessage(error: unknown, fallbackMessage: string = UI_ERROR_DICTIONARY.fallback): string {
  const apiError = getApiError(error)

  if (apiError.code && UI_ERROR_DICTIONARY.byCode[apiError.code]) {
    return UI_ERROR_DICTIONARY.byCode[apiError.code]
  }

  if (typeof apiError.message === 'string' && apiError.message.trim().length > 0) {
    return apiError.message
  }

  return fallbackMessage
}
