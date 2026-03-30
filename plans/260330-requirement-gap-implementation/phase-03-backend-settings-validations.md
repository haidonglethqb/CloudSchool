# Phase 3: Backend API - Settings mở rộng + Validations

## Priority: P1
## Status: pending
## Depends on: Phase 1

## Overview

Bổ sung các field cấu hình mới vào Settings API và thêm validation rules vào các route tương ứng theo QĐ3, QĐ5, QĐ6, QĐ7, QĐ9, QĐ12.

## Related Code Files

### Files to modify
- `backend/src/routes/settings.routes.js` — CRUD settings mới
- `backend/src/routes/subject.routes.js` — validate maxSubjects (QĐ5)
- `backend/src/routes/score.routes.js` — validate min/maxScore từ settings (QĐ6)
- `backend/src/routes/class.routes.js` — validate gradeLevel khi tạo lớp (QĐ3)

## Implementation Steps

### Step 1: Mở rộng Settings API

Cập nhật PUT `/settings` để support thêm fields:
```js
body('minGradeLevel').optional().isInt({ min: 1, max: 20 }),
body('maxGradeLevel').optional().isInt({ min: 1, max: 20 }),
body('maxSubjects').optional().isInt({ min: 1, max: 50 }),
body('minScore').optional().isFloat({ min: 0, max: 100 }),
body('maxScore').optional().isFloat({ min: 0, max: 100 }),
body('maxSemesters').optional().isInt({ min: 1, max: 4 }),
body('maxRetentions').optional().isInt({ min: 1, max: 10 }),
```

Validation thêm:
- `minGradeLevel <= maxGradeLevel`
- `minScore <= maxScore`

### Step 2: QĐ3 — Validate Grade level khi tạo Grade

Trong `settings.routes.js` POST `/grades`:
```js
// Đọc settings
const settings = await prisma.tenantSettings.findUnique(...)
if (level < settings.minGradeLevel || level > settings.maxGradeLevel) {
  throw new AppError(`Khối phải nằm trong khoảng ${settings.minGradeLevel}-${settings.maxGradeLevel}`)
}
```

### Step 3: QĐ5 — Validate maxSubjects khi tạo Subject

Trong `subject.routes.js` POST `/`:
```js
const settings = await prisma.tenantSettings.findUnique(...)
const subjectCount = await prisma.subject.count({ where: { tenantId, isActive: true } })
if (subjectCount >= settings.maxSubjects) {
  throw new AppError(`Số môn học không được vượt quá ${settings.maxSubjects}`)
}
```

### Step 4: QĐ6 — Validate min/maxScore từ settings

Trong `score.routes.js` POST `/` và POST `/batch`:
- Đọc `settings.minScore`, `settings.maxScore`
- Thay hardcode `min:0, max:10` bằng dynamic validation
```js
const settings = await prisma.tenantSettings.findUnique(...)
if (value < settings.minScore || value > settings.maxScore) {
  throw new AppError(`Điểm phải nằm trong khoảng ${settings.minScore}-${settings.maxScore}`)
}
```

### Step 5: Frontend Settings API update

Cập nhật `api.ts` `settingsApi.update`:
```ts
update: (data: Partial<{
  minAge: number; maxAge: number;
  maxClassSize: number; passScore: number;
  minGradeLevel: number; maxGradeLevel: number;
  maxSubjects: number; minScore: number; maxScore: number;
  maxSemesters: number; maxRetentions: number;
}>) => api.put('/settings', data),
```

## Todo List

- [ ] PUT /settings hỗ trợ 7 field mới
- [ ] Validate minGradeLevel <= maxGradeLevel, minScore <= maxScore
- [ ] POST /settings/grades validate grade level theo settings (QĐ3)
- [ ] POST /subjects validate maxSubjects (QĐ5)
- [ ] POST /scores validate minScore/maxScore từ settings (QĐ6)
- [ ] POST /scores/batch cũng validate từ settings
- [ ] Cập nhật frontend api.ts

## Success Criteria

- Tất cả validation đọc từ TenantSettings thay vì hardcode
- Thay đổi settings ảnh hưởng ngay validation rules
- Backward compatible: default values khớp với hành vi cũ
