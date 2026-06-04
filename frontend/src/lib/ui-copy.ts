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
    report: 'BÃ¡o cÃ¡o',
    semester: 'Há»c ká»³',
    academicYear: 'NÄƒm há»c',
    ratio: 'Tá»· lá»‡',
    permissions: 'PhÃ¢n quyá»n',
    regulations: 'Quy Ä‘á»‹nh',
    promotion: 'XÃ©t lÃªn lá»›p',
    all: 'Táº¥t cáº£',
    select: 'Chá»n',
    choose: 'Chá»n',
    save: 'LÆ°u',
    delete: 'XÃ³a',
    add: 'ThÃªm',
    cancel: 'Há»§y',
    actions: 'Thao tÃ¡c',
    children: 'Con em',
  },
  roles: {
    STAFF: 'NhÃ¢n viÃªn giÃ¡o vá»¥',
    TEACHER: 'GiÃ¡o viÃªn',
    SUPER_ADMIN: 'Quáº£n trá»‹ trÆ°á»ng',
    PLATFORM_ADMIN: 'Quáº£n trá»‹ há»‡ thá»‘ng',
    PARENT: 'Phá»¥ huynh',
    STUDENT: 'Há»c sinh',
  },
  modules: {
    'student-admission': 'Tiáº¿p nháº­n há»c sinh',
    'student-lookup': 'Tra cá»©u há»c sinh',
    classes: 'Lá»›p há»c',
    'class-transfer': 'Chuyá»ƒn lá»›p',
    subjects: 'MÃ´n há»c',
    scores: 'Äiá»ƒm sá»‘',
    reports: 'BÃ¡o cÃ¡o',
    parents: 'Phá»¥ huynh',
    'academic-calendar': 'NÄƒm há»c & há»c ká»³',
    export: 'Xuáº¥t dá»¯ liá»‡u',
    settings: 'CÃ i Ä‘áº·t',
  },
}

export function getUiRoleLabel(role: string): string {
  return UI_COPY.roles[role] || role
}

export function getUiModuleLabel(moduleKey: string): string {
  return UI_COPY.modules[moduleKey] || moduleKey
}
