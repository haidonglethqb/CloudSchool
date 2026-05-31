export interface UiCopyDictionary {
  common: {
    report: string
    semester: string
    academicYear: string
    ratio: string
    permissions: string
    regulations: string
    promotion: string
    all: string
    select: string
    choose: string
    save: string
    delete: string
    add: string
    cancel: string
    actions: string
    children: string
  }
  roles: Record<string, string>
  modules: Record<string, string>
}

export const UI_COPY: UiCopyDictionary = {
  common: {
    report: 'Báo cáo',
    semester: 'Học kỳ',
    academicYear: 'Năm học',
    ratio: 'Tỷ lệ',
    permissions: 'Phân quyền',
    regulations: 'Quy định',
    promotion: 'Xét lên lớp',
    all: 'Tất cả',
    select: 'Chọn',
    choose: 'Chọn',
    save: 'Lưu',
    delete: 'Xóa',
    add: 'Thêm',
    cancel: 'Hủy',
    actions: 'Thao tác',
    children: 'Con em',
  },
  roles: {
    STAFF: 'Nhân viên giáo vụ',
    TEACHER: 'Giáo viên',
    SUPER_ADMIN: 'Quản trị trường',
    PLATFORM_ADMIN: 'Quản trị hệ thống',
    PARENT: 'Phụ huynh',
    STUDENT: 'Học sinh',
  },
  modules: {
    'student-admission': 'Tiếp nhận học sinh',
    'student-lookup': 'Tra cứu học sinh',
    classes: 'Lớp học',
    'class-transfer': 'Chuyển lớp',
    subjects: 'Môn học',
    scores: 'Điểm số',
    reports: 'Báo cáo',
    parents: 'Phụ huynh',
    'academic-calendar': 'Năm học & học kỳ',
    fees: 'Học phí',
    export: 'Xuất dữ liệu',
    settings: 'Cài đặt',
  },
}

export function getUiRoleLabel(role: string): string {
  return UI_COPY.roles[role] || role
}

export function getUiModuleLabel(moduleKey: string): string {
  return UI_COPY.modules[moduleKey] || moduleKey
}
